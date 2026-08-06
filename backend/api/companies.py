from __future__ import annotations
from fastapi import APIRouter, HTTPException

from pipeline.persistence import get_company, list_companies, get_applicable_rules

router = APIRouter()


@router.get("")
async def list_companies_route(category: str = None):
    """GET /companies — lists available companies, optionally filtered by category.
    Powers the company-selection screen (Step 6 of the redesigned wizard)."""
    return list_companies(category=category)


@router.get("/{company_id}")
async def get_company_route(company_id: str):
    """GET /companies/{id} — full company profile including parameters."""
    try:
        return get_company(company_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@router.get("/{company_id}/rules")
async def get_company_rules_route(company_id: str):
    """GET /companies/{id}/rules — the full rule documents this company applies,
    including source_clause, for transparency in the UI."""
    try:
        return get_applicable_rules(company_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))