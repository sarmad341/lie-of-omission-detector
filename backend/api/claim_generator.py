from __future__ import annotations
from pathlib import Path
from typing import List

from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Form, File, UploadFile, Depends
from fastapi.responses import Response

from core.auth import require_auth
from core.db import get_db
from pipeline.claim_generator import generate_claim_from_evidence, generate_draft_claim
from pipeline.pdf_generator import generate_claim_form_pdf
from schemas.case_schemas import (
    DescribeEvidenceResponse, SubmitAnswersRequest, DraftClaimResponse,
    UpdateClaimsRequest,
    ExtractedClaim, ConfirmAndProcessRequest,
)
from workers.pipeline_runner import (
    create_case_from_generation_start,
    save_generation_images,
    save_generation_docs,
    save_generation_stage1,
    save_generation_draft,
    save_generation_template_data,
)

router = APIRouter()
VALID_CATEGORIES = {"car_insurance", "health_insurance", "loan_application"}


def _get_case_or_404(db, case_id: str) -> dict:
    try:
        oid = ObjectId(case_id)
    except InvalidId:
        raise HTTPException(404, "Case not found")
    doc = db.cases.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Case not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.post("/describe", response_model=DescribeEvidenceResponse)
async def describe_evidence_route(
    category: str = Form(...),
    company_id: str = Form(...),
    sub_category: str = Form(None),
    files: List[UploadFile] = File(...),
    auth: dict = Depends(require_auth),
):
    from pipeline.claim_generator import describe_all_evidence, extract_template_fields_from_document
    from pipeline.load_document import load_document_text

    if category not in VALID_CATEGORIES:
        raise HTTPException(400, f"category must be one of {VALID_CATEGORIES}")
    if not files:
        raise HTTPException(400, "Provide at least one evidence file")

    IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"}

    image_files = [f for f in files if Path(f.filename).suffix.lower() in IMAGE_EXTS]
    doc_files   = [f for f in files if Path(f.filename).suffix.lower() not in IMAGE_EXTS]

    if not image_files and not doc_files:
        raise HTTPException(400, "No recognisable files were uploaded")

    case_id = create_case_from_generation_start(category, company_id, sub_category)

    # Save all files and get paths
    image_paths, image_names = save_generation_images(case_id, image_files)
    doc_paths, doc_names = save_generation_docs(case_id, doc_files)

    # Run vision analysis only on actual image files
    descriptions = describe_all_evidence(image_paths, category) if image_paths else []

    # If any images were uploaded but all were determined to be irrelevant, hard stop
    if image_paths and all(not d.get("is_relevant", True) for d in descriptions):
        raise HTTPException(400, f"No supported evidence found for {category}. Please try again.")

    # For non-image documents:
    # 1. Extract text and map to template fields (the primary purpose)
    # 2. Also add a short excerpt as a description for damage-context awareness
    prefilled_template: dict = {}

    for doc_path, doc_name in zip(doc_paths, doc_names):
        try:
            text = load_document_text(doc_path)

            # --- Template field extraction (main feature) ---
            doc_fields = extract_template_fields_from_document(text, category)
            # Later documents win on conflicts (last-write wins).
            prefilled_template.update(doc_fields)

            # --- Damage context description (secondary) ---
            excerpt = text[:800].strip()
            descriptions.append({
                "visible_regions": [],
                "description": f"[Document: {doc_name}] {excerpt}",
                "severity": None,
                "not_visible": [],
                "stability": "agreed",
                "raw_attempts": [],
                "laterality_conflicts": [],
                "source": "document",
            })
        except Exception as exc:
            descriptions.append({
                "visible_regions": [],
                "description": f"[Document: {doc_name}] Could not extract text: {exc}",
                "severity": None,
                "not_visible": [],
                "stability": "disagreed",
                "raw_attempts": [],
                "laterality_conflicts": [],
                "source": "document",
            })

    questions: list[str] = []
    save_generation_stage1(case_id, image_names, doc_names, descriptions, questions)

    return DescribeEvidenceResponse(
        case_id=case_id, company_id=company_id,
        descriptions=descriptions, questions=questions,
        prefilled_template=prefilled_template,
    )


@router.post("/{case_id}/draft", response_model=DraftClaimResponse)
async def draft_claim_route(case_id: str, body: SubmitAnswersRequest):
    auth = {}
    from pipeline.claim_generator import generate_evidence_suggestions
    from pipeline.persistence import get_company

    db = get_db()
    case = _get_case_or_404(db, case_id)

    if case.get("status") != "awaiting_generation_answers":
        raise HTTPException(400, f"Case must be 'awaiting_generation_answers', currently '{case.get('status')}'")

    descriptions = case.get("generation_descriptions", [])
    qa_answers = [a.dict() for a in body.answers]

    # Fields that describe the INCIDENT and may genuinely inform the damage
    # description (sent as proper Q&A context to the claim drafter).
    INCIDENT_QA_FIELDS = {
        "incident_date": "Date of Incident",
        "incident_time": "Time of Incident",
        "incident_location": "Location of Incident",
        "police_report_filed": "Police Report Filed?",
        "police_report_number": "Police Report Number",
        "description_of_damage": "Description of Damage",
    }

    # All other form fields are personal/administrative — they must NOT
    # leak into the damage claim statements, so they are passed as
    # claimant_context (reference-only, explicitly walled off in prompt).
    claimant_context: dict = {}

    if body.template_data is not None:
        t_dict = body.template_data.dict()
        for field_id, val in t_dict.items():
            if not (isinstance(val, str) and val.strip()):
                continue
            if field_id in INCIDENT_QA_FIELDS:
                qa_answers.append({
                    "question": INCIDENT_QA_FIELDS[field_id],
                    "answer": val.strip(),
                })
            else:
                label = field_id.replace("_", " ").title()
                claimant_context[label] = val.strip()

    company = get_company(case["company_id"]) if case.get("company_id") else None

    try:
        claims = generate_draft_claim(case["category"], descriptions, qa_answers, company=company, claimant_context=claimant_context, sub_category=case.get("sub_category"))
    except ValueError as exc:
        raise HTTPException(422, f"Could not draft a claim from this evidence: {exc}")

    suggestions = generate_evidence_suggestions(descriptions, claims)
    save_generation_draft(case_id, qa_answers, claims)

    if body.template_data is not None:
        save_generation_template_data(case_id, body.template_data.dict())

    return DraftClaimResponse(
        case_id=case_id, claims=[ExtractedClaim(**c) for c in claims], suggestions=suggestions,
    )


@router.patch("/{case_id}/claims")
async def update_claims_route(case_id: str, body: UpdateClaimsRequest, auth: dict = Depends(require_auth)):
    """Update the raw_extracted_claims with manual edits before downloading PDF."""
    db = get_db()
    case = _get_case_or_404(db, case_id)
    if case.get("status") not in ["pending_confirmation", "awaiting_generation_answers"]:
        raise HTTPException(400, f"Cannot update claims for case in status '{case.get('status')}'")
    
    update_data = {"raw_extracted_claims": [c.dict() for c in body.claims], "updated_at": datetime.now(timezone.utc)}
    
    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": update_data}
    )
    
    if body.template_data is not None:
        save_generation_template_data(case_id, body.template_data.dict())
        
    return {"ok": True}


@router.get("/{case_id}/pdf")
async def download_claim_pdf_route(case_id: str, auth: dict = Depends(require_auth)):
    """Generates the filled claim-form PDF from the case's stored
    template_data + drafted claims. Local generation via reportlab —
    no external service."""
    db = get_db()
    case = _get_case_or_404(db, case_id)

    pdf_bytes = generate_claim_form_pdf(
        case.get("template_data", {}),
        case.get("raw_extracted_claims", []),
        case.get("category", ""),
    )
    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": {"download_confirmed": True, "updated_at": datetime.now(timezone.utc)}}
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="claim-draft-{case_id}.pdf"'},
    )


@router.post("/{case_id}/confirm-and-process")
async def confirm_and_process_route(
    case_id: str,
    body: ConfirmAndProcessRequest,
    auth: dict = Depends(require_auth),
):
    """Path A's confirm step — reuses saved evidence, skips a redundant
    evidence-upload prompt. Body: {"confirmed_claims": [...]}"""
    from workers.pipeline_runner import confirm_and_process_generated_case

    db = get_db()
    case = _get_case_or_404(db, case_id)
    if case.get("status") != "pending_confirmation":
        raise HTTPException(400, f"Case must be 'pending_confirmation', currently '{case.get('status')}'")

    confirmed_claims = [c.dict() for c in body.confirmed_claims]
    confirm_and_process_generated_case(case_id, confirmed_claims)
    return {"ok": True, "case_id": case_id, "status": "processing"}