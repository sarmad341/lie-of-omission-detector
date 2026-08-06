"""
Persistence layer (PDR Section 5): saves each pipeline run as a "case"
document in MongoDB, so results survive after the script exits instead of
only existing in the console output.
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.db import get_db  # noqa: E402


def save_case(document_name: str, image_names: list, pipeline_result: dict) -> str:
    """Saves one full pipeline run (claim-by-claim results + skipped
    administrative claims) as a case document. Returns the new case's id
    as a string, so it can be referenced later (e.g. in a review UI).
    """
    db = get_db()
    case_doc = {
        "created_at": datetime.now(timezone.utc),
        "document_name": document_name,
        "image_names": image_names,
        "claims_checked": pipeline_result.get("claims_checked", []),
        "claims_skipped_administrative": pipeline_result.get("claims_skipped_administrative", []),
        "review_status": "pending",  # matches PDR's human-review-required design
    }
    result = db.cases.insert_one(case_doc)
    return str(result.inserted_id)


def get_case(case_id: str) -> dict:
    """Retrieves one case by its id. Raises ValueError if not found."""
    from bson import ObjectId

    db = get_db()
    case = db.cases.find_one({"_id": ObjectId(case_id)})
    if case is None:
        raise ValueError(f"No case found with id '{case_id}'")
    case["_id"] = str(case["_id"])
    return case


def list_cases(limit: int = 20) -> list:
    """Returns the most recent cases, newest first."""
    db = get_db()
    cases = list(db.cases.find().sort("created_at", -1).limit(limit))
    for c in cases:
        c["_id"] = str(c["_id"])
    return cases

def get_company(company_id: str) -> dict:
    """Retrieves one company profile by its Mongo _id."""
    from bson import ObjectId

    db = get_db()
    company = db.companies.find_one({"_id": ObjectId(company_id)})
    if company is None:
        raise ValueError(f"No company found with id '{company_id}'")
    company["_id"] = str(company["_id"])
    return company


def list_companies(category: str = None) -> list:
    """Lists company profiles, optionally filtered by category."""
    db = get_db()
    query = {"category": category} if category else {}
    companies = list(db.companies.find(query))
    for c in companies:
        c["_id"] = str(c["_id"])
    return companies


def get_applicable_rules(company_id: str) -> list:
    """Fetches the full rule documents for a company's applicable_rule_ids."""
    company = get_company(company_id)
    db = get_db()
    rules = list(db.policy_rules.find({"rule_id": {"$in": company["applicable_rule_ids"]}}))
    for r in rules:
        r["_id"] = str(r["_id"])
    return rules


# ---------------------------------------------------------------------------
# Application submission & tracking
# ---------------------------------------------------------------------------

def _generate_reference_number() -> str:
    """Generates a human-readable claim reference in the format VRT-YYYY-XXXX.
    Guarantees uniqueness by checking the DB counter atomically.
    """
    db = get_db()
    year = datetime.now(timezone.utc).year

    # Atomic counter per year — findAndModify equivalent via find_one_and_update
    counter_doc = db.ref_counters.find_one_and_update(
        {"year": year},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,  # returns the UPDATED doc
    )
    seq = counter_doc.get("seq", 1)
    return f"VRT-{year}-{seq:04d}"


def submit_application(case_id: str, company_id: str, user_id: str) -> dict:
    """Formally submits a case as a claim application.

    Sets application_status = 'submitted', generates VRT-YYYY-XXXX reference,
    stores company_id and submitted_at on the case document.
    Returns the full application document slice needed for the token page.
    """
    from bson import ObjectId

    db = get_db()
    company = get_company(company_id)
    ref = _generate_reference_number()
    now = datetime.now(timezone.utc)

    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": {
            "reference_number": ref,
            "company_id": company_id,
            "company_name": company["name"],
            "application_status": "submitted",
            "submitted_at": now,
            "updated_at": now,
            "is_application": True,
            "applicant_user_id": user_id,
            "admin_decision": None,
            "admin_note": None,
            "admin_decided_at": None,
        }},
    )
    return {
        "reference_number": ref,
        "case_id": case_id,
        "company_id": company_id,
        "company_name": company["name"],
        "application_status": "submitted",
        "submitted_at": now,
    }


def get_application_by_ref(reference_number: str) -> dict:
    """Retrieves a submitted application by its VRT reference number."""
    db = get_db()
    doc = db.cases.find_one({"reference_number": reference_number})
    if doc is None:
        raise ValueError(f"No application found with reference '{reference_number}'")
    doc["_id"] = str(doc["_id"])
    return doc


def list_user_applications(user_id: str) -> list:
    """Returns all formal applications submitted by this user, newest first."""
    db = get_db()
    docs = list(
        db.cases.find(
            {"is_application": True, "applicant_user_id": user_id}
        ).sort("submitted_at", -1)
    )
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


def list_company_applications(company_id: str, status_filter: str = None, page: int = 1, limit: int = 20) -> dict:
    """Returns all applications targeting this company (for admin view).
    Optionally filtered by application_status.
    Uses projection to exclude large raw file/description arrays for fast response.
    Returns a paginated dictionary.
    """
    db = get_db()
    query: dict = {"is_application": True, "company_id": company_id}
    if status_filter:
        query["application_status"] = status_filter

    projection = {
        "_id": 1,
        "reference_number": 1,
        "document_name": 1,
        "category": 1,
        "company_id": 1,
        "company_name": 1,
        "applicant_user_id": 1,
        "submitted_at": 1,
        "created_at": 1,
        "application_status": 1,
        "status": 1,
        "tier_results": 1,
        "claims_checked_count": {"$size": {"$ifNull": ["$claims_checked", "$confirmed_claims", "$raw_extracted_claims"]}},
    }
    
    total = db.cases.count_documents(query)
    skip = (page - 1) * limit
    
    docs = list(db.cases.find(query, projection).sort("submitted_at", -1).skip(skip).limit(limit))
    for d in docs:
        d["_id"] = str(d["_id"])
        d["case_id"] = d["_id"]
        
    total_pages = (total + limit - 1) // limit
        
    return {
        "data": docs,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }


def admin_decide_application(case_id: str, decision: str, note: str, admin_user_id: str) -> dict:
    """Admin decides on an application. Updates application_status to
    'approved', 'denied', or 'sent_back_for_more_evidence' (on demand_more_evidence)
    and records the decision metadata.
    """
    from bson import ObjectId

    db = get_db()
    now = datetime.now(timezone.utc)

    app_status = decision
    if decision == "demand_more_evidence":
        app_status = "sent_back_for_more_evidence"

    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": {
            "application_status": app_status,
            "admin_decision": decision,
            "admin_note": note,
            "admin_decided_at": now,
            "admin_user_id": admin_user_id,
            "updated_at": now,
        }},
    )
    doc = db.cases.find_one({"_id": ObjectId(case_id)})
    doc["_id"] = str(doc["_id"])
    return doc


def get_admin_analytics(company_id: str) -> dict:
    """Returns aggregated application statistics for a company's admin dashboard."""
    db = get_db()
    company = get_company(company_id)
    base_query = {"is_application": True, "company_id": company_id}

    total = db.cases.count_documents(base_query)
    pending = db.cases.count_documents({**base_query, "application_status": "admin_pending"})
    approved = db.cases.count_documents({**base_query, "application_status": "approved"})
    denied = db.cases.count_documents({**base_query, "application_status": "denied"})
    ai_reviewing = db.cases.count_documents({**base_query, "application_status": {"$in": ["submitted", "ai_reviewing"]}})

    return {
        "company_id": company_id,
        "company_name": company["name"],
        "total_applications": total,
        "pending_review": pending,
        "approved": approved,
        "denied": denied,
        "ai_reviewing": ai_reviewing,
    }


def update_company_policy_rules(company_id: str, new_version: str, new_rules: list) -> dict:
    """Updates company policy rules and bumps the policy version in MongoDB.
    All future applications screened against this company will automatically use this updated version.
    """
    from bson import ObjectId
    db = get_db()
    oid = ObjectId(company_id) if ObjectId.is_valid(company_id) else company_id
    query = {"_id": oid} if isinstance(oid, ObjectId) else {"company_id": company_id}

    db.companies.update_one(
        query,
        {"$set": {
            "policy_version": new_version,
            "rules": new_rules,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=False
    )

    company = get_company(company_id)
    return {
        "company_id": company_id,
        "company_name": company.get("name"),
        "policy_version": new_version,
        "rules": new_rules,
        "status": "updated",
    }