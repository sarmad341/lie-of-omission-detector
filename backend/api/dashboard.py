from __future__ import annotations
from fastapi import APIRouter

from core.db import get_db
from schemas.case_schemas import DashboardSummary

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary():
    """GET /dashboard/summary — PDR Section 9. Aggregate stats across all cases."""
    db = get_db()

    total_cases = db.cases.count_documents({})

    verdict_distribution: dict[str, int] = {}
    awaiting_review = 0

    for doc in db.cases.find({}, {"claims_checked": 1}):
        for claim in doc.get("claims_checked", []):
            v = claim.get("final_verdict")
            if v:
                verdict_distribution[v] = verdict_distribution.get(v, 0) + 1
            if v == "conflicting_evidence" and not claim.get("reviewed_by_human"):
                awaiting_review += 1

    return DashboardSummary(
        total_cases=total_cases,
        verdict_distribution=verdict_distribution,
        cases_awaiting_review=awaiting_review,
        average_confidence=None,  # TODO once confidence is stored as a numeric score, not a label
    )
