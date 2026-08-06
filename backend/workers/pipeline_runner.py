"""
Background task functions driving the pipeline from API routes.

Two upload flows exist side by side:
- Legacy (run_pipeline_for_case_legacy): old single-shot upload, extracts
  claims internally from a raw document.
- New staged flow (create_case_from_extraction -> confirm_claims_for_case
  -> save_evidence_files -> run_pipeline_for_case): claims are extracted and
  confirmed by the user BEFORE evidence is even uploaded, so this final step
  uses the already-confirmed claims directly, no re-extraction.
"""
from __future__ import annotations
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId

from core.db import get_db
from pipeline.run_pipeline import run_pipeline, run_pipeline_from_claims
from pipeline.load_document import load_document_text
from pipeline.tiers import run_tier_0, run_tier_1
from pipeline.tiers_ai import run_tier_2_narrative, run_tier_2_image_relevance, run_tier_3_verification

UPLOAD_ROOT = Path("uploaded_cases")


def _now():
    return datetime.now(timezone.utc)


# --- New staged flow ---

def create_case_from_extraction(
    document_filename: str,
    category: str,
    extraction_result: dict,
    sub_category: str = None,
) -> str:
    """Creates the case at EXTRACTION time (step 2->3), not at final
    submission — so confirm-claims and evidence-submission have a real
    case_id to update against from the start."""
    db = get_db()
    case_doc = {
        "created_at": _now(),
        "updated_at": _now(),
        "category": category,
        "sub_category": sub_category,
        "status": "pending_confirmation",
        "source_type": "user_provided",
        "document_name": document_filename,
        "raw_extracted_claims": extraction_result["claims"],
        "confirmed_claims": None,
        "domain_match": extraction_result.get("domain_match", True),
        "domain_mismatch_warning": extraction_result.get("domain_mismatch_warning"),
        "evidence_image_names": [],
        "evidence_document_names": [],
        "claims_checked": [],
        "claims_skipped_administrative": [],
        "review_status": "pending",
        "pipeline_status": "pending_confirmation",
    }
    result = db.cases.insert_one(case_doc)
    return str(result.inserted_id)


def confirm_claims_for_case(case_id: str, confirmed_claims: list[dict]) -> None:
    db = get_db()
    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": {
            "confirmed_claims": confirmed_claims,
            "status": "awaiting_evidence",
            "pipeline_status": "awaiting_evidence",
            "updated_at": _now(),
        }},
    )


def save_evidence_files(case_id: str, image_files: list, document_files: list) -> tuple[list[str], list[str], list[str], list[str]]:
    """Saves evidence into uploaded_cases/{case_id}/ using the REAL case_id
    (the case already exists from the extraction step). Returns
    (image_paths, image_basenames, doc_paths, doc_basenames)."""
    case_dir = UPLOAD_ROOT / case_id
    case_dir.mkdir(parents=True, exist_ok=True)

    image_paths, image_basenames = [], []
    for img in image_files:
        img_filename = Path(img.filename).name
        img_path = case_dir / img_filename
        with img_path.open("wb") as f:
            shutil.copyfileobj(img.file, f)
        image_paths.append(str(img_path))
        image_basenames.append(img_filename)

    doc_paths, doc_basenames = [], []
    for doc in document_files:
        doc_filename = Path(doc.filename).name
        doc_path = case_dir / doc_filename
        with doc_path.open("wb") as f:
            shutil.copyfileobj(doc.file, f)
        doc_paths.append(str(doc_path))
        doc_basenames.append(doc_filename)

    return image_paths, image_basenames, doc_paths, doc_basenames


def _execute_full_verification_ladder(case_id: str, case_doc: dict, confirmed_claims: list[dict], image_paths: list[str], document_paths: list[str]):
    from pipeline.run_pipeline import run_pipeline_from_claims
    from pipeline.policy_rules_engine import screen_claim_against_company
    from pipeline.persistence import get_company, get_applicable_rules
    db = get_db()
    oid = ObjectId(case_id)
    
    category = case_doc.get("category", "car_insurance")
    cached_descs = case_doc.get("generation_descriptions")
    template_data = case_doc.get("template_data")
    company_id = case_doc.get("company_id")

    all_tier_results = []
    
    # --- Tier 0: Submission Integrity ---
    t0_results = run_tier_0(case_doc, image_paths, document_paths)
    all_tier_results.extend([t.model_dump() for t in t0_results])
    if any(t.fatal and not t.passed for t in t0_results):
        return {"tier_results": all_tier_results, "status": "failed", "pipeline_status": "failed", "error": "Failed Tier 0: Submission Integrity"}
        
    # --- Tier 1: Deterministic Business Rules ---
    if template_data:
        t1_results = run_tier_1(template_data, cached_descs, image_paths)
        all_tier_results.extend([t.model_dump() for t in t1_results])
        if any(t.fatal and not t.passed for t in t1_results):
            return {"tier_results": all_tier_results, "status": "failed", "pipeline_status": "failed", "error": "Failed Tier 1: Deterministic Business Rules"}
    else:
        # Fallbacks for Apply Directly flow (no structured template data)
        all_tier_results.extend([
            {
                "tier": 1,
                "name": "Date Validity",
                "passed": True,
                "fatal": False,
                "details": "Skipped: unstructured document upload (no specific incident date provided)."
            },
            {
                "tier": 1,
                "name": "EXIF Verification",
                "passed": True,
                "fatal": False,
                "details": "Skipped: unstructured document upload (no specific incident date to cross-check)."
            },
            {
                "tier": 1,
                "name": "Point of Impact Check",
                "passed": True,
                "fatal": False,
                "details": "Skipped: unstructured document upload (no declared point of impact)."
            }
        ])

    # --- Extract Document Texts for AI Tiers ---
    document_texts = []
    for dpath in document_paths:
        try:
            document_texts.append(load_document_text(dpath))
        except Exception as e:
            print(f"Warning: Failed to load document {dpath}: {e}")
            
    # --- Tier 2: Narrative Consistency ---
    if template_data:
        t2_results = run_tier_2_narrative(template_data, cached_descs, document_texts)
        all_tier_results.extend([t.model_dump() for t in t2_results])
        if any(t.fatal and not t.passed for t in t2_results):
            return {"tier_results": all_tier_results, "status": "failed", "pipeline_status": "failed", "error": "Failed Tier 2: Narrative Contradiction"}
            
        t2_image_rel = run_tier_2_image_relevance(template_data, cached_descs)
        all_tier_results.extend([t.model_dump() for t in t2_image_rel])
        if any(t.fatal and not t.passed for t in t2_image_rel):
            return {"tier_results": all_tier_results, "status": "failed", "pipeline_status": "failed", "error": "Failed Tier 2: Blatantly Irrelevant Evidence Images"}

    # --- Tier 2: Image Forensics (ELA & Cross-Image) ---
    if image_paths:
        from pipeline.image_forensics import detect_ela_tampering, check_cross_image_consistency
        
        # 1. ELA Check
        ela_failed = False
        for path in image_paths:
            if detect_ela_tampering(path):
                ela_failed = True
                break
                
        if ela_failed:
            all_tier_results.append({
                "tier": 2, "name": "Error Level Analysis (ELA)", "passed": False, "fatal": True,
                "details": "High likelihood of digital tampering detected in one or more images."
            })
            return {"tier_results": all_tier_results, "status": "failed", "pipeline_status": "failed", "error": "Failed Tier 2: ELA Tampering Detected"}
        else:
            all_tier_results.append({
                "tier": 2, "name": "Error Level Analysis (ELA)", "passed": True, "fatal": False,
                "details": "No signs of digital tampering detected via ELA."
            })

        # 2. Cross-Image Consistency
        if len(image_paths) > 1:
            consistent = check_cross_image_consistency(image_paths)
            if not consistent:
                all_tier_results.append({
                    "tier": 2, "name": "Cross-Image Consistency", "passed": False, "fatal": True,
                    "details": "Vision AI determined that the submitted photos do not depict the same vehicle."
                })
                return {"tier_results": all_tier_results, "status": "failed", "pipeline_status": "failed", "error": "Failed Tier 2: Cross-Image Consistency"}
            else:
                all_tier_results.append({
                    "tier": 2, "name": "Cross-Image Consistency", "passed": True, "fatal": False,
                    "details": "Photos confirmed to depict the same vehicle."
                })

    # --- Tier 3: Document Verification (Receipts) ---
    if template_data:
        t3_results = run_tier_3_verification(template_data, document_texts)
        all_tier_results.extend([t.model_dump() for t in t3_results])

    # --- Tier 5: AI Extraction & Grounding (runs before Tier 4 Policy) ---
    grounding_result = run_pipeline_from_claims(
        confirmed_claims,
        image_paths,
        category=category,
        cached_descriptions=cached_descs
    )
    
    screened_claims = grounding_result.get("claims_checked", [])
    
    # --- Tier 4: Policy Enforcement ---
    if company_id:
        try:
            company = get_company(company_id)
            applicable_rules = get_applicable_rules(company_id)
            for claim in screened_claims:
                decision = screen_claim_against_company(claim, claim, company, applicable_rules)
                claim["policy_decision"] = decision
        except Exception as e:
            print(f"Policy screening warning for case {case_id}: {e}")
            
    return {
        "claims_checked": screened_claims,
        "claims_skipped_administrative": grounding_result.get("claims_skipped_administrative", []),
        "tier_results": all_tier_results,
    }


def _determine_auto_approval(result: dict, category: str = None, sub_category: str = None) -> dict:
    """Check if the case can be automatically approved without human admin review."""
    # 1. No errors
    if result.get("error"):
        return {}
        
    tier_results = result.get("tier_results", [])
    
    # Check for any fatal failures
    if any(t.get("fatal", False) and not t.get("passed", False) for t in tier_results):
        return {}

    # 2. Soft flags tracking (passed=False, fatal=False)
    soft_flags = [t for t in tier_results if not t.get("passed", False) and not t.get("fatal", False)]
    if len(soft_flags) > 1:
        # Default to Manual Review if multiple soft flags are present
        return {}

    # 3. All checked claims supported & policies accepted
    claims = result.get("claims_checked", [])
    if not claims:
        return {}
        
    for c in claims:
        if c.get("final_verdict") != "supported":
            return {}
        policy = c.get("policy_decision", {})
        if policy and policy.get("status") != "accepted":
            return {}

    # 4. Strict 3-of-3 agreement for Collision auto-approval
    if sub_category == "collision":
        required_checks = ["Point of Impact Check", "Narrative Consistency", "Cross-Image Consistency"]
        passed_checks = [t.get("name") for t in tier_results if t.get("passed", False) and t.get("name") in required_checks]
        
        # We need all 3 checks to have passed explicitly to auto-approve a collision
        if len(set(passed_checks)) < 3:
            return {}

    # If we got here, it's a perfect claim!
    return {
        "application_status": "approved",
        "admin_decision": "approved",
        "admin_note": "Auto-approved by AI screening (all claims perfectly supported, all rules passed).",
        "admin_decided_at": _now()
    }


def run_pipeline_for_case(case_id: str, confirmed_claims: list[dict], image_paths: list[str], document_paths: list[str]):
    db = get_db()
    oid = ObjectId(case_id)
    try:
        case_doc = db.cases.find_one({"_id": oid})
        if not case_doc:
            return
            
        result = _execute_full_verification_ladder(case_id, case_doc, confirmed_claims, image_paths, document_paths)
        auto_approve_fields = _determine_auto_approval(result, case_doc.get("category"), case_doc.get("sub_category"))
        
        status = "completed" if not result.get("error") else "failed"
        
        update_fields = {
            **result,
            **auto_approve_fields,
            "status": status,
            "pipeline_status": status,
            "updated_at": _now()
        }
        
        db.cases.update_one(
            {"_id": oid},
            {"$set": update_fields},
        )
    except Exception as exc:  # noqa: BLE001
        db.cases.update_one(
            {"_id": oid},
            {"$set": {"pipeline_status": "failed", "status": "failed", "error": str(exc), "updated_at": _now()}},
        )
        raise


# --- Legacy flow: single-shot upload (document + images together) ---

def create_case_record(document_filename: str, image_names: list[str]) -> str:
    db = get_db()
    case_doc = {
        "created_at": _now(),
        "document_name": document_filename,
        "image_names": image_names,
        "claims_checked": [],
        "claims_skipped_administrative": [],
        "review_status": "pending",
        "pipeline_status": "processing",
    }
    result = db.cases.insert_one(case_doc)
    return str(result.inserted_id)


def run_pipeline_for_case_legacy(case_id: str, document_path: str, image_paths: list[str]):
    """Legacy single-shot runner: extracts claims internally from raw text."""
    db = get_db()
    oid = ObjectId(case_id)
    try:
        document_text = load_document_text(document_path)
        result = run_pipeline(document_text, image_paths)
        db.cases.update_one(
            {"_id": oid},
            {"$set": {**result, "pipeline_status": "completed", "updated_at": _now()}},
        )
    except Exception as exc:  # noqa: BLE001
        db.cases.update_one(
            {"_id": oid},
            {"$set": {"pipeline_status": "failed", "error": str(exc), "updated_at": _now()}},
        )
        raise


def save_uploaded_files(document_file, image_files) -> tuple[str, list[str], list[str]]:
    upload_token = str(uuid.uuid4())
    case_dir = UPLOAD_ROOT / upload_token
    case_dir.mkdir(parents=True, exist_ok=True)

    doc_filename = Path(document_file.filename).name
    doc_path = case_dir / doc_filename
    with doc_path.open("wb") as f:
        shutil.copyfileobj(document_file.file, f)

    image_paths, image_basenames = [], []
    for img in image_files:
        img_filename = Path(img.filename).name
        img_path = case_dir / img_filename
        with img_path.open("wb") as f:
            shutil.copyfileobj(img.file, f)
        image_paths.append(str(img_path))
        image_basenames.append(img_filename)

    return str(doc_path), image_paths, image_basenames

# --- Claim Generator flow (Entry Point B) ---

def create_case_from_generation_start(category: str, company_id: str, sub_category: str = None) -> str:
    """UPDATED: now takes company_id up front, per the redesigned flow —
    company is selected right after category, before evidence."""
    db = get_db()
    case_doc = {
        "created_at": _now(),
        "updated_at": _now(),
        "category": category,
        "sub_category": sub_category,
        "company_id": company_id,
        "status": "awaiting_generation_answers",
        "source_type": "ai_generated",
        "document_name": "(AI-generated from evidence)",
        "raw_extracted_claims": [],
        "confirmed_claims": None,
        "domain_match": True,
        "domain_mismatch_warning": None,
        "evidence_image_names": [],
        "evidence_document_names": [],
        "claims_checked": [],
        "claims_skipped_administrative": [],
        "review_status": "pending",
        "pipeline_status": "awaiting_generation_answers",
    }
    result = db.cases.insert_one(case_doc)
    return str(result.inserted_id)


def confirm_and_process_generated_case(case_id: str, confirmed_claims: list) -> None:
    db = get_db()
    oid = ObjectId(case_id)
    case = db.cases.find_one({"_id": oid})

    image_paths = [
        str(UPLOAD_ROOT / case_id / name) for name in case.get("evidence_image_names", [])
    ]
    document_paths = [
        str(UPLOAD_ROOT / case_id / name) for name in case.get("evidence_document_names", [])
    ]

    db.cases.update_one(
        {"_id": oid},
        {"$set": {
            "confirmed_claims": confirmed_claims,
            "status": "processing",
            "pipeline_status": "processing",
            "updated_at": _now(),
        }},
    )

    try:
        result = _execute_full_verification_ladder(case_id, case, confirmed_claims, image_paths, document_paths)
        db.cases.update_one(
            {"_id": oid},
            {"$set": {
                **result,
                "status": "pending_admin_review" if not result.get("error") else result.get("status"), 
                "pipeline_status": "completed" if not result.get("error") else result.get("pipeline_status"),
                "updated_at": _now(),
            }},
        )
    except Exception as exc:  # noqa: BLE001
        db.cases.update_one(
            {"_id": oid},
            {"$set": {"pipeline_status": "failed", "status": "failed", "error": str(exc), "updated_at": _now()}},
        )
        raise

def run_application_screening_background(case_id: str) -> None:
    db = get_db()
    oid = ObjectId(case_id)
    case = db.cases.find_one({"_id": oid})
    if not case:
        return

    db.cases.update_one(
        {"_id": oid},
        {"$set": {
            "application_status": "ai_reviewing",
            "status": "processing",
            "pipeline_status": "processing",
            "updated_at": _now(),
        }},
    )

    claims_to_check = case.get("confirmed_claims") or case.get("raw_extracted_claims") or []
    image_paths = [
        str(UPLOAD_ROOT / case_id / name) for name in case.get("evidence_image_names", [])
    ]
    document_paths = [
        str(UPLOAD_ROOT / case_id / name) for name in case.get("evidence_document_names", [])
    ]

    try:
        result = _execute_full_verification_ladder(case_id, case, claims_to_check, image_paths, document_paths)
        auto_approve_fields = _determine_auto_approval(result, case.get("category"), case.get("sub_category"))

        db.cases.update_one(
            {"_id": oid},
            {"$set": {
                **result,
                "application_status": "admin_pending", # default, might be overridden
                "status": "pending_admin_review" if not result.get("error") else result.get("status"),
                "pipeline_status": "completed" if not result.get("error") else result.get("pipeline_status"),
                **auto_approve_fields,
                "updated_at": _now(),
            }},
        )
    except Exception as exc:  # noqa: BLE001
        print(f"Application background screening error for case {case_id}: {exc}")
        db.cases.update_one(
            {"_id": oid},
            {"$set": {
                "application_status": "admin_pending",
                "pipeline_status": "failed",
                "status": "failed",
                "error": str(exc),
                "updated_at": _now(),
            }},
        )

def save_generation_images(case_id: str, image_files: list) -> tuple[list[str], list[str]]:
    """Same uploaded_cases/{case_id}/ convention as save_evidence_files,
    images only."""
    case_dir = UPLOAD_ROOT / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    image_paths, image_basenames = [], []
    for img in image_files:
        img_filename = Path(img.filename).name
        img_path = case_dir / img_filename
        with img_path.open("wb") as f:
            shutil.copyfileobj(img.file, f)
        image_paths.append(str(img_path))
        image_basenames.append(img_filename)
    return image_paths, image_basenames


def save_generation_docs(case_id: str, doc_files: list) -> tuple[list[str], list[str]]:
    """Saves non-image evidence files (pdf, docx, txt) into the same
    uploaded_cases/{case_id}/ directory. Returns (paths, basenames)."""
    case_dir = UPLOAD_ROOT / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    doc_paths, doc_basenames = [], []
    for doc in doc_files:
        doc_filename = Path(doc.filename).name
        doc_path = case_dir / doc_filename
        with doc_path.open("wb") as f:
            shutil.copyfileobj(doc.file, f)
        doc_paths.append(str(doc_path))
        doc_basenames.append(doc_filename)
    return doc_paths, doc_basenames


def save_generation_stage1(
    case_id: str,
    image_names: list[str],
    doc_names: list[str],
    descriptions: list[dict],
    questions: list[str]
) -> None:
    db = get_db()
    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": {
            "evidence_image_names": image_names,
            "evidence_document_names": doc_names,
            "generation_descriptions": descriptions,
            "generation_questions": questions,
            "updated_at": _now(),
        }},
    )

def save_generation_draft(case_id: str, answers: list[dict], claims: list[dict]) -> None:
    """Saves answers + drafted claims, moves the case straight to
    'pending_confirmation' — the SAME status the normal extraction flow
    lands on, so confirm-claims/evidence routes work unchanged."""
    db = get_db()
    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": {
            "generation_qa": answers,
            "raw_extracted_claims": claims,
            "status": "pending_confirmation",
            "pipeline_status": "pending_confirmation",
            "updated_at": _now(),
        }},
    )

def save_generation_template_data(case_id: str, template_data: dict) -> None:
    """Persists the claim-form template fields, normalizing any blank
    field to 'Not provided' HERE — the single source of truth, so every
    downstream reader (GET /cases/{id}, the PDF generator) sees the same
    normalized value, not raw empty strings."""
    normalized = {
        k: (v.strip() if isinstance(v, str) and v.strip() else "Not provided")
        for k, v in template_data.items()
    }
    db = get_db()
    db.cases.update_one(
        {"_id": ObjectId(case_id)},
        {"$set": {"template_data": normalized, "updated_at": _now()}},
    )


def run_pipeline_resubmission(case_id: str, new_image_paths: list[str], new_doc_paths: list[str]):
    """Background runner for resubmitted cases. Grounds only flagged claims against new evidence,
    saving token costs while keeping verdicts updated.
    """
    db = get_db()
    oid = ObjectId(case_id)
    try:
        case = db.cases.find_one({"_id": oid})
        if not case:
            return
        category = case.get("category", "car_insurance")
        claims = case.get("claims_checked", [])
        flagged = [c for c in claims if c.get("needs_more_evidence")]
        
        if not flagged:
            db.cases.update_one(
                {"_id": oid},
                {"$set": {
                    "status": "completed",
                    "pipeline_status": "completed",
                    "application_status": "admin_pending",
                    "updated_at": _now(),
                }}
            )
            return

        # 1. Describe new evidence images
        from pipeline.claim_generator import describe_all_evidence
        new_descriptions = describe_all_evidence(new_image_paths, category)
        
        # Merge with old descriptions
        old_descriptions = case.get("generation_descriptions", [])
        if not isinstance(old_descriptions, list):
            old_descriptions = []
        all_descriptions = old_descriptions + new_descriptions
        
        # 2. Extract checkable flagged claims
        checkable = []
        for c in flagged:
            checkable.append({
                "id": c["claim_id"],
                "claim_text": c["claim_text"],
                "is_visually_checkable": True
            })

        # Get all image paths (old + new)
        all_image_paths = new_image_paths
        # We can also map old images from uploaded_cases folder if they exist
        case_dir = UPLOAD_ROOT / case_id
        for name in case.get("evidence_image_names", []):
            old_path = case_dir / name
            if old_path.exists() and str(old_path) not in all_image_paths:
                all_image_paths.append(str(old_path))

        # 3. Re-run grounding only for flagged claims
        from pipeline.run_pipeline import run_pipeline_from_claims
        grounding_result = run_pipeline_from_claims(
            confirmed_claims=checkable,
            image_paths=all_image_paths,
            category=category,
            cached_descriptions=all_descriptions
        )
        
        # 4. Merge back newly grounded claims with existing claims
        new_grounded = grounding_result.get("claims_checked", [])
        new_grounded_map = {c["claim_id"]: c for c in new_grounded}
        
        updated_claims = []
        for c in claims:
            cid = c["claim_id"]
            if cid in new_grounded_map:
                fresh = new_grounded_map[cid]
                updated_claims.append({
                    **c,
                    "final_verdict": fresh["final_verdict"],
                    "evidence_image": fresh["evidence_image"],
                    "explanation": fresh["explanation"],
                    "confidence": fresh["confidence"],
                    "all_image_results": fresh["all_image_results"],
                    "reviewed_by_human": False,
                    "reviewer_override": None,
                    "reviewer_note": None,
                    "needs_more_evidence": False
                })
            else:
                updated_claims.append(c)

        # 5. Update case status in database
        db.cases.update_one(
            {"_id": oid},
            {"$set": {
                "claims_checked": updated_claims,
                "generation_descriptions": all_descriptions,
                "status": "completed",
                "pipeline_status": "completed",
                "application_status": "admin_pending",
                "admin_decision": None,
                "admin_note": None,
                "admin_decided_at": None,
                "updated_at": _now(),
            }}
        )
    except Exception as exc:
        db.cases.update_one(
            {"_id": oid},
            {"$set": {
                "pipeline_status": "failed",
                "status": "failed",
                "error": str(exc),
                "updated_at": _now(),
            }}
        )
        raise