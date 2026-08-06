"""
User-facing application routes.

POST /applications/submit                 — submit a completed case as a formal claim
POST /applications/submit-from-generation — submit directly from a generated draft
GET  /applications/my                     — list the current user's applications
GET  /applications/{ref}/status           — check status by VRT reference number
GET  /applications/{ref}/result           — get full result once decided
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, File, UploadFile
from bson import ObjectId
from bson.errors import InvalidId

from core.auth import require_auth
from core.db import get_db
from pipeline.persistence import (
    submit_application,
    get_application_by_ref,
    list_user_applications,
    get_company,
)
from schemas.case_schemas import (
    SubmitApplicationRequest,
    ApplicationTokenResponse,
    ApplicationStatusResponse,
)
from workers.pipeline_runner import (
    run_application_screening_background,
    save_evidence_files,
    run_pipeline_resubmission,
)

router = APIRouter()


def _case_or_404(db, case_id: str) -> dict:
    try:
        oid = ObjectId(case_id)
    except InvalidId:
        raise HTTPException(404, "Case not found")
    doc = db.cases.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Case not found")
    doc["_id"] = str(doc["_id"])
    return doc


# ---------------------------------------------------------------------------
# Submit a fresh case (Route 1: Apply for Claim wizard)
# ---------------------------------------------------------------------------

@router.post("/submit", response_model=ApplicationTokenResponse)
async def submit_application_route(
    body: SubmitApplicationRequest,
    background_tasks: BackgroundTasks,
    auth: dict = Depends(require_auth),
):
    """Links a completed (evidence-uploaded) case to a company as a formal
    claim application. Returns the VRT reference token immediately.

    AI screening runs in the background.
    """
    db = get_db()
    doc = _case_or_404(db, body.case_id)

    # Guard: can't apply if the case is still just an extraction with no evidence
    blocked_statuses = {"pending_confirmation"}
    if doc.get("pipeline_status") in blocked_statuses:
        raise HTTPException(
            400,
            "Case is still at the claim-confirmation step. "
            "Please confirm your claims and upload evidence before submitting.",
        )

    # Guard: already submitted
    if doc.get("is_application"):
        raise HTTPException(
            409,
            f"This case is already submitted as application {doc.get('reference_number')}.",
        )

    # Validate company exists
    try:
        get_company(body.company_id)
    except ValueError:
        raise HTTPException(404, f"Company '{body.company_id}' not found")

    result = submit_application(body.case_id, body.company_id, auth["user_id"])
    background_tasks.add_task(run_application_screening_background, body.case_id)
    return ApplicationTokenResponse(**result)


# ---------------------------------------------------------------------------
# Submit from a Generated Claim (Route 2: Generate -> Apply)
# ---------------------------------------------------------------------------

@router.post("/submit-from-generation", response_model=ApplicationTokenResponse)
async def submit_from_generation_route(
    body: SubmitApplicationRequest,
    background_tasks: BackgroundTasks,
    auth: dict = Depends(require_auth),
):
    """Submit a generated (Path B) claim as a formal application.
    The case_id refers to the generate-wizard case which already has
    AI-produced claims and uploaded evidence. Company is chosen here.
    """
    db = get_db()
    doc = _case_or_404(db, body.case_id)

    # Must be a generated claim
    if doc.get("source_type") != "ai_generated" and not doc.get("claims_checked"):
        raise HTTPException(
            400,
            "This case does not appear to have a completed generated claim. "
            "Please finish the Generate Claim wizard first.",
        )

    if doc.get("is_application"):
        raise HTTPException(
            409,
            f"Already submitted as {doc.get('reference_number')}.",
        )

    try:
        get_company(body.company_id)
    except ValueError:
        raise HTTPException(404, f"Company '{body.company_id}' not found")

    result = submit_application(body.case_id, body.company_id, auth["user_id"])
    background_tasks.add_task(run_application_screening_background, body.case_id)
    return ApplicationTokenResponse(**result)


# ---------------------------------------------------------------------------
# List current user's applications
# ---------------------------------------------------------------------------

@router.get("/my")
async def list_my_applications(auth: dict = Depends(require_auth)):
    """Returns all formal applications submitted by the logged-in user."""
    docs = list_user_applications(auth["user_id"])
    return docs


# ---------------------------------------------------------------------------
# Status by reference number
# ---------------------------------------------------------------------------

@router.get("/{reference_number}/status", response_model=ApplicationStatusResponse)
async def get_application_status(
    reference_number: str,
    auth: dict = Depends(require_auth),
):
    """Check application status by VRT reference number.
    Only the applicant can view their own application status.
    """
    try:
        doc = get_application_by_ref(reference_number)
    except ValueError:
        raise HTTPException(404, f"Application '{reference_number}' not found")

    if doc.get("applicant_user_id") != auth["user_id"]:
        raise HTTPException(403, "Forbidden")

    return ApplicationStatusResponse(
        reference_number=doc["reference_number"],
        case_id=doc["_id"],
        application_status=doc["application_status"],
        company_name=doc.get("company_name", ""),
        category=doc.get("category"),
        submitted_at=doc["submitted_at"],
        admin_decided_at=doc.get("admin_decided_at"),
        admin_decision=doc.get("admin_decision"),
        admin_note=doc.get("admin_note"),
    )


# ---------------------------------------------------------------------------
# Full result (once decided)
# ---------------------------------------------------------------------------

@router.get("/{reference_number}/result")
async def get_application_result(
    reference_number: str,
    auth: dict = Depends(require_auth),
):
    """Returns the full result including AI analysis and admin decision.
    Only visible after the admin has made a decision.
    """
    try:
        doc = get_application_by_ref(reference_number)
    except ValueError:
        raise HTTPException(404, f"Application '{reference_number}' not found")

    if doc.get("applicant_user_id") != auth["user_id"]:
        raise HTTPException(403, "Forbidden")

    status = doc.get("application_status")
    if status not in ("approved", "denied", "sent_back_for_more_evidence"):
        raise HTTPException(
            425,
            f"Result not yet available. Current status: {status}. "
            "Please check back after the company admin has reviewed your application.",
        )

    return doc


@router.post("/{reference_number}/resubmit")
async def resubmit_application_route(
    reference_number: str,
    background_tasks: BackgroundTasks,
    images: List[UploadFile] = File(default=[]),
    documents: List[UploadFile] = File(default=[]),
    auth: dict = Depends(require_auth),
):
    """Resubmits an application with new evidence files specifically for claims flagged by the admin.
    Stores previous state in submission_history and runs pipeline grounding only on flagged claims.
    """
    db = get_db()
    try:
        doc = get_application_by_ref(reference_number)
    except ValueError:
        raise HTTPException(404, f"Application '{reference_number}' not found")

    if doc.get("applicant_user_id") != auth["user_id"]:
        raise HTTPException(403, "Forbidden")

    if doc.get("application_status") != "sent_back_for_more_evidence":
        raise HTTPException(400, "Application is not awaiting more evidence.")

    case_id = str(doc["_id"])

    # 1. Snapshot current state to submission_history
    history_entry = {
        "version": len(doc.get("submission_history", [])) + 1,
        "submitted_at": doc.get("submitted_at"),
        "claims_checked": doc.get("claims_checked", []),
        "evidence_image_names": doc.get("evidence_image_names", []),
        "evidence_document_names": doc.get("evidence_document_names", []),
        "admin_decision": doc.get("admin_decision"),
        "admin_note": doc.get("admin_note"),
        "admin_decided_at": doc.get("admin_decided_at"),
    }

    # 2. Save new evidence files
    image_paths, image_names, doc_paths, doc_names = save_evidence_files(case_id, images, documents)

    # 3. Append names to existing lists
    all_images = doc.get("evidence_image_names", []) + image_names
    all_docs = doc.get("evidence_document_names", []) + doc_names

    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$push": {"submission_history": history_entry},
         "$set": {
             "application_status": "ai_reviewing",
             "status": "processing",
             "pipeline_status": "processing",
             "evidence_image_names": all_images,
             "evidence_document_names": all_docs,
             "submitted_at": datetime.now(timezone.utc),
             "updated_at": datetime.now(timezone.utc),
         }}
    )

    # 4. Trigger background task
    background_tasks.add_task(
        run_pipeline_resubmission, case_id, image_paths, doc_paths
    )

    return {"ok": True, "reference_number": reference_number, "status": "ai_reviewing"}
