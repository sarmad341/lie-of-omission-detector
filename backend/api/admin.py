"""
Admin-only routes — all require require_admin_auth.

Each admin user has an 'admin_company_id' claim in their Clerk JWT that
identifies exactly which company they can manage. This makes all queries
automatically scoped to that company — an admin for Company A literally
cannot see Company B's data.

GET  /admin/applications          — list applications for my company
GET  /admin/applications/{id}     — full detail of one application
POST /admin/applications/{id}/decide — approve or deny
GET  /admin/analytics             — stats for my company's dashboard
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from bson.errors import InvalidId

from core.auth import require_admin_auth
from core.db import get_db
from pipeline.persistence import (
    list_company_applications,
    admin_decide_application,
    get_admin_analytics,
)
from schemas.case_schemas import AdminDecideRequest, AdminAnalytics, PaginatedApplications

router = APIRouter()


def _case_or_404(db, case_id: str) -> dict:
    try:
        oid = ObjectId(case_id)
    except InvalidId:
        raise HTTPException(404, "Application not found")
    doc = db.cases.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Application not found")
    doc["_id"] = str(doc["_id"])
    return doc


# ---------------------------------------------------------------------------
# List applications for this admin's company
# ---------------------------------------------------------------------------

@router.get("/applications", response_model=PaginatedApplications)
async def list_applications(
    status: str = None,
    page: int = 1,
    limit: int = 20,
    admin: dict = Depends(require_admin_auth),
):
    """Returns all applications submitted to this admin's company with pagination.
    Optional ?status=admin_pending|approved|denied|submitted|ai_reviewing filter.
    """
    return list_company_applications(admin["company_id"], status_filter=status, page=page, limit=limit)


# ---------------------------------------------------------------------------
# Full detail of one application (admin view)
# ---------------------------------------------------------------------------

@router.get("/applications/{case_id}")
async def get_application_detail(
    case_id: str,
    admin: dict = Depends(require_admin_auth),
):
    """Full application detail: claims, verdicts, evidence, AI analysis.
    Only accessible if the application targets this admin's company.
    """
    db = get_db()
    doc = _case_or_404(db, case_id)

    # Company isolation guard
    if doc.get("company_id") != admin["company_id"]:
        raise HTTPException(403, "Forbidden: this application belongs to a different company")

    return doc


# ---------------------------------------------------------------------------
# Approve or deny an application
# ---------------------------------------------------------------------------

@router.post("/applications/{case_id}/decide")
async def decide_application(
    case_id: str,
    body: AdminDecideRequest,
    admin: dict = Depends(require_admin_auth),
):
    """Admin makes a final decision: approved or denied.
    Records the decision, note, timestamp, and admin user ID on the case.
    The user will then see the result on their dashboard.
    """
    db = get_db()
    doc = _case_or_404(db, case_id)

    # Company isolation guard
    if doc.get("company_id") != admin["company_id"]:
        raise HTTPException(403, "Forbidden: this application belongs to a different company")

    if doc.get("application_status") in ("approved", "denied"):
        raise HTTPException(
            409,
            f"Application already decided: {doc.get('application_status')}",
        )

    if body.decision not in ("approved", "denied", "demand_more_evidence"):
        raise HTTPException(400, "decision must be 'approved', 'denied', or 'demand_more_evidence'")

    updated = admin_decide_application(
        case_id, body.decision, body.note, admin["user_id"]
    )
    return updated


# ---------------------------------------------------------------------------
# Analytics for this admin's company dashboard
# ---------------------------------------------------------------------------

@router.get("/analytics", response_model=AdminAnalytics)
async def get_analytics(admin: dict = Depends(require_admin_auth)):
    """Returns application statistics for this company's admin dashboard:
    total, pending review, approved, denied, AI reviewing.
    """
    return get_admin_analytics(admin["company_id"])


# ---------------------------------------------------------------------------
# Policy Rules for this admin's company
# ---------------------------------------------------------------------------

from pydantic import BaseModel

class UpdatePolicyRulesRequest(BaseModel):
    policy_version: str
    rules: list[dict]


@router.get("/policy-rules")
async def get_company_policy_rules(admin: dict = Depends(require_admin_auth)):
    """Returns company profile and active policy rules for this company."""
    from pipeline.persistence import get_company, get_applicable_rules
    company = get_company(admin["company_id"])
    rules = get_applicable_rules(admin["company_id"])
    return {
        "company": company,
        "policy_rules": rules,
        "version": company.get("policy_version", "v2.4"),
        "rule_count": len(rules),
    }


@router.put("/policy-rules")
async def update_company_policy_rules_route(
    body: UpdatePolicyRulesRequest,
    admin: dict = Depends(require_admin_auth),
):
    """Updates company policy rules and bumps version in MongoDB.
    All future applications to this company will automatically use this new version.
    """
    from pipeline.persistence import update_company_policy_rules
    return update_company_policy_rules(admin["company_id"], body.policy_version, body.rules)
