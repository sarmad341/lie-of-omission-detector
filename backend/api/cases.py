from __future__ import annotations
import os
import tempfile
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, UploadFile, File, Form, HTTPException, Depends
from bson import ObjectId
from bson.errors import InvalidId

from core.auth import require_auth
from core.db import get_db
from pipeline.policy_rules_engine import screen_claim_against_company
from pipeline.persistence import get_company, get_applicable_rules
from pipeline.report_generator import generate_markdown_report
from pipeline.extract_claims import extract_claims
from pipeline.load_document import load_document_text
from schemas.case_schemas import (
    CaseDetail, CaseSummary, ReviewRequest, VerdictOut, SkippedClaim,
    ExtractPreviewResponse, ConfirmClaimsRequest,
)
from workers.pipeline_runner import (
    create_case_record,
    save_uploaded_files,
    run_pipeline_for_case,
    run_pipeline_for_case_legacy,
    create_case_from_extraction,
    confirm_claims_for_case,
    save_evidence_files,
)

router = APIRouter()


def _get_case_or_404(db, case_id: str) -> dict:
    try:
        oid = ObjectId(case_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Case not found")
    doc = db.cases.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found")
    doc["_id"] = str(doc["_id"])
    return doc


# --- Legacy flow: single-shot upload (document + images together) ---

@router.post("", response_model=CaseSummary)
async def create_case(
    background_tasks: BackgroundTasks,
    document: UploadFile = File(...),
    images: List[UploadFile] = File(...),
    auth: dict = Depends(require_auth),
):
    """POST /cases — original single-shot flow. Returns immediately; pipeline runs in background."""
    doc_path, image_paths, image_basenames = save_uploaded_files(document, images)
    case_id = create_case_record(document.filename, image_basenames)

    background_tasks.add_task(run_pipeline_for_case_legacy, case_id, doc_path, image_paths)

    db = get_db()
    doc = _get_case_or_404(db, case_id)
    return CaseSummary(
        case_id=case_id,
        status=doc.get("pipeline_status", "completed"),
        document_name=doc["document_name"],
        created_at=doc["created_at"],
        claims_checked_count=0,
    )


# --- New staged flow: extract -> confirm -> evidence ---

@router.post("/extract-preview", response_model=ExtractPreviewResponse)
async def extract_preview(
    category: str = Form(...),
    sub_category: str = Form(None),
    document: UploadFile = File(...),
    auth: dict = Depends(require_auth),
):
    """Step 2->3: reads the claim document, extracts claims (category-aware),
    checks domain match, creates the case at 'pending_confirmation'."""
    valid_categories = {"car_insurance", "health_insurance", "loan_application"}
    if category not in valid_categories:
        raise HTTPException(400, f"category must be one of {valid_categories}")

    suffix = os.path.splitext(document.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await document.read())
        tmp_path = tmp.name

    try:
        document_text = load_document_text(tmp_path)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    finally:
        os.remove(tmp_path)

    extraction_result = extract_claims(document_text, category=category)
    case_id = create_case_from_extraction(document.filename, category, extraction_result, sub_category)

    return ExtractPreviewResponse(
        case_id=case_id,
        claims=extraction_result["claims"],
        domain_match=extraction_result["domain_match"],
        domain_mismatch_warning=extraction_result["domain_mismatch_warning"],
    )


@router.post("/{case_id}/confirm-claims")
async def confirm_claims_route(case_id: str, body: ConfirmClaimsRequest, auth: dict = Depends(require_auth)):
    """Step 3->4: saves the user's reviewed/edited claims, moves case to 'awaiting_evidence'."""
    db = get_db()
    _get_case_or_404(db, case_id)
    confirm_claims_for_case(case_id, [c.dict() for c in body.confirmed_claims])
    return {"ok": True, "case_id": case_id, "status": "awaiting_evidence"}


@router.post("/{case_id}/evidence")
async def submit_evidence_route(
    case_id: str,
    background_tasks: BackgroundTasks,
    images: List[UploadFile] = File(default=[]),
    documents: List[UploadFile] = File(default=[]),
    auth: dict = Depends(require_auth),
):
    """Step 4->5: saves evidence, kicks off the pipeline using already-confirmed claims."""
    db = get_db()
    case = _get_case_or_404(db, case_id)

    if case.get("status") != "awaiting_evidence":
        raise HTTPException(400, f"Case must be 'awaiting_evidence', currently '{case.get('status')}'")
    if not images and not documents:
        raise HTTPException(400, "Provide at least one image or document as evidence")

    image_paths, image_names, doc_paths, doc_names = save_evidence_files(case_id, images, documents)

    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": {
            "status": "processing",
            "pipeline_status": "processing",
            "evidence_image_names": image_names,
            "evidence_document_names": doc_names,
        }},
    )

    background_tasks.add_task(
        run_pipeline_for_case, case_id, case["confirmed_claims"], image_paths, doc_paths
    )
    return {"ok": True, "case_id": case_id, "status": "processing"}


# --- Shared routes: list, detail, review, report ---

@router.get("", response_model=list[CaseSummary])
async def list_cases_route(limit: int = 20, auth: dict = Depends(require_auth)):
    db = get_db()
    cursor = db.cases.find().sort("created_at", -1).limit(limit)
    return [
        CaseSummary(
            case_id=str(doc["_id"]),
            status=doc.get("pipeline_status", "completed"),
            document_name=doc["document_name"],
            created_at=doc["created_at"],
            claims_checked_count=len(doc.get("claims_checked", [])),
            source_type=doc.get("source_type"),
            download_confirmed=doc.get("download_confirmed", False),
            evidence_image_names=doc.get("evidence_image_names", []),
            is_application=doc.get("is_application", False),
            reference_number=doc.get("reference_number"),
            application_status=doc.get("application_status"),
            company_id=doc.get("company_id"),
            company_name=doc.get("company_name"),
            submitted_at=doc.get("submitted_at"),
            admin_decision=doc.get("admin_decision"),
            admin_note=doc.get("admin_note"),
            admin_decided_at=doc.get("admin_decided_at"),
        )
        for doc in cursor
    ]


@router.get("/{case_id}", response_model=CaseDetail)
async def get_case_route(case_id: str, auth: dict = Depends(require_auth)):
    db = get_db()
    doc = _get_case_or_404(db, case_id)

    return CaseDetail(
        case_id=doc["_id"],
        status=doc.get("pipeline_status", "completed"),
        category=doc.get("category"),
        document_name=doc["document_name"],
        created_at=doc["created_at"],
        claims_checked_count=len(doc.get("claims_checked", [])),
        source_type=doc.get("source_type"),
        download_confirmed=doc.get("download_confirmed", False),
        is_application=doc.get("is_application", False),
        reference_number=doc.get("reference_number"),
        application_status=doc.get("application_status"),
        company_id=doc.get("company_id"),
        company_name=doc.get("company_name"),
        submitted_at=doc.get("submitted_at"),
        admin_decision=doc.get("admin_decision"),
        admin_note=doc.get("admin_note"),
        admin_decided_at=doc.get("admin_decided_at"),
        raw_extracted_claims=doc.get("raw_extracted_claims", []),
        confirmed_claims=doc.get("confirmed_claims"),
        domain_match=doc.get("domain_match"),
        domain_mismatch_warning=doc.get("domain_mismatch_warning"),
        evidence_image_names=doc.get("evidence_image_names", []),
        evidence_document_names=doc.get("evidence_document_names", []),
        claims_checked=[VerdictOut(**c) for c in doc.get("claims_checked", [])],
        claims_skipped_administrative=[
            SkippedClaim(**c) for c in doc.get("claims_skipped_administrative", [])
        ],
        report_markdown=None,
        generation_qa=doc.get("generation_qa", []),
        pipeline_log_id=doc.get("pipeline_log_id"),
        template_data=doc.get("template_data"),
        submission_history=doc.get("submission_history", []),
    )


@router.post("/{case_id}/claims/{claim_id}/review")
async def review_claim(case_id: str, claim_id: str, review: ReviewRequest, auth: dict = Depends(require_auth)):
    db = get_db()
    oid = ObjectId(case_id) if ObjectId.is_valid(case_id) else None
    if oid is None:
        raise HTTPException(status_code=404, detail="Case not found")
    doc = db.cases.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found")

    claims = doc.get("claims_checked", [])
    for c in claims:
        if c.get("claim_id") == claim_id:
            c["reviewed_by_human"] = True
            if review.action == "override":
                c["reviewer_override"] = review.override_verdict
                c["needs_more_evidence"] = False
            elif review.action == "flag":
                c["reviewer_override"] = "flagged"
                c["needs_more_evidence"] = True
            else:  # accept
                c["reviewer_override"] = None
                c["needs_more_evidence"] = False
            c["reviewer_note"] = review.reviewer_note
            break
    else:
        raise HTTPException(status_code=404, detail="Claim not found in this case")

    db.cases.update_one(
        {"_id": oid},
        {"$set": {"claims_checked": claims, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"ok": True}


@router.get("/{case_id}/report")
async def get_report(case_id: str, auth: dict = Depends(require_auth)):
    db = get_db()
    doc = _get_case_or_404(db, case_id)
    if doc.get("pipeline_status") == "processing":
        raise HTTPException(status_code=409, detail="Case still processing — report not ready yet")

    report_md = generate_markdown_report(doc)

    os.makedirs("reports", exist_ok=True)
    with open(os.path.join("reports", f"{case_id}.md"), "w", encoding="utf-8") as f:
        f.write(report_md)

    return {"case_id": case_id, "report_markdown": report_md}


@router.get("/{case_id}/audit-report")
async def get_audit_report(case_id: str, auth: dict = Depends(require_auth)):
    raise HTTPException(
        status_code=501,
        detail="Audit report requires a pipeline_logs collection — not yet implemented in the pipeline.",
    )


@router.post("/{case_id}/screen")
async def screen_case_route(case_id: str, company_id: str, auth: dict = Depends(require_auth)):
    """
    POST /cases/{case_id}/screen?company_id=...

    On-demand Policy Screening (Option B) — run manually after grounding
    is complete, separate from the automatic background pipeline. Screens
    every checked claim against the selected company's rules, saves the
    per-claim policy_decision, and updates the case's company_id.
    """
    db = get_db()
    case = _get_case_or_404(db, case_id)

    claims_checked = case.get("claims_checked", [])
    if not claims_checked:
        raise HTTPException(400, "Case has no grounded claims yet — run evidence grounding first.")

    try:
        company = get_company(company_id)
        applicable_rules = get_applicable_rules(company_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))

    screened_claims = []
    for claim in claims_checked:
        try:
            decision = screen_claim_against_company(claim, claim, company, applicable_rules)
        except Exception as exc:  # noqa: BLE001 — don't let one claim's Layer 2 failure kill the whole batch
            decision = {
                "status": "needs_review",
                "rule_check_results": [],
                "layer_2_reasoning": f"Policy screening failed: {exc}",
                "stability": None,
            }
        screened_claims.append({**claim, "policy_decision": decision})

    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": {
            "claims_checked": screened_claims,
            "company_id": company_id,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    return {
        "case_id": case_id,
        "company_name": company["name"],
        "screened_claims": screened_claims,
    }