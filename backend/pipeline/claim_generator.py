"""
Claim Generator (Entry Point B): drafts a claim FROM evidence, instead of
extracting claims from user-written text. This is the inverse direction
of everything else in the pipeline — describe the photo, then write a
claim statement, rather than take a claim and check it against a photo.

Hard constraint, enforced in the prompt: describe only what's visibly
present. No speculation about cause/history beyond what the user's
Q&A answers stated. No inflating severity. Every claim produced here is
tagged as a draft — never treated as company-approved anywhere downstream.

Path A no longer asks AI-generated adaptive gap-questions — the user is
shown ONLY the fixed claim-form template fields. The one thing AI still
does automatically is try to pre-fill whichever template fields the
evidence genuinely supports (see extract_template_prefill below) —
everything else is left blank for the user, since most fields (name,
address, dates, costs) can never be read off a photo.
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.router import get_completion  # noqa: E402

CATEGORY_LABELS = {
    "car_insurance": "vehicle damage",
    "health_insurance": "medical/health",
    "loan_application": "loan/collateral",
}

# Only fields where a photo could plausibly supply a genuine answer.
# Most claim-form fields (name, address, dates, costs) never belong here.
TEMPLATE_PREFILL_FIELDS = [
    "vehicle_make",
    "vehicle_model",
    "vehicle_year",
    "license_plate",
    "damage_to_other_vehicle",
]

REQUIRED_FIELDS = {
    "first_name",
    "last_name",
    "email",
    "phone",
    "incident_date",
    "incident_location",
    "incident_circumstances",
    "vehicle_make_model",
    "vehicle_year",
    "license_plate",
}


def _build_describe_prompt(category: str) -> str:
    subject = CATEGORY_LABELS.get(category, "the subject")
    return f"""You are analyzing a single piece of photo evidence for a {category} claim.
First, check if this image is actually relevant to a {category} claim (e.g. if the category is 'car_insurance', the photo must show a vehicle, vehicle parts, or an auto accident scene. If it shows an animal, food, or something completely unrelated, it is not relevant). Set "is_relevant" to true if yes, false if it is completely unrelated.

Your task: describe ONLY the VISIBLE, EXTERNAL, STRUCTURAL damage shown in this image.

Strict rules:
1. Describe only what is LITERALLY visible — specific regions, their physical condition,
   exact observable details (e.g. "shattered driver-side taillight", "heavy denting on
   left rear bumper", "paint scraped exposing bare metal over a 10 cm area").
2. For each damaged area, assign a severity category: minor (surface scratches, small
   scuffs), moderate (dents, cracks, broken trim), or severe (structural deformation,
   shattered glass, detached panels).
3. Do NOT speculate about internal or mechanical damage (engine, suspension, airbags,
   etc.) — you can only see the exterior. Never mention mechanical damage.
4. Do NOT infer cause (e.g. do NOT say "from a collision" or "impact-related") unless
   skid marks, debris, or other direct visual evidence makes the cause literally obvious.
5. Explicitly state which regions are NOT visible in this image (e.g. "the front of the
   vehicle is not shown").

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{"is_relevant": true|false, "visible_regions": ["..."], "description": "...", "severity": "minor|moderate|severe", "not_visible": ["..."]}}
"""


def _build_template_prefill_prompt(category: str, descriptions: list) -> str:
    combined = "\n".join(f"- {d['description']}" for d in descriptions)
    field_list = ", ".join(TEMPLATE_PREFILL_FIELDS)
    return f"""You have these descriptions of evidence photos submitted for a
{CATEGORY_LABELS.get(category, 'a')} claim:

{combined}

Some claim-form fields can sometimes be determined directly from what's
visible in evidence photos (e.g. vehicle make/model if a badge or shape
is clearly identifiable, a license plate if legible, whether damage to
ANOTHER vehicle is visible). Most fields can NEVER be determined from a
photo — do not guess at those, and do not include them.

Only include a field below if the evidence LITERALLY and CLEARLY
supports it. Do not guess, infer, or estimate. If nothing in the
evidence supports a field, omit it entirely rather than including it
with an empty, vague, or guessed value.

Candidate fields: {field_list}

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{"prefilled_fields": {{"field_id": "value", ...}}}}
"""


def _build_draft_claim_prompt(
    category: str,
    descriptions: list,
    qa_answers: list,
    company: dict = None,
    claimant_context: dict = None,
    sub_category: str = None,
) -> str:
    combined_descriptions = "\n".join(
        f"- {d['description']}" + (f" [Severity: {d['severity']}]" if d.get("severity") else "")
        for d in descriptions
    )

    company_note = ""
    if company:
        rule_names = ", ".join(r["rule_description"] for r in company.get("_rules_preview", []))
        company_note = (
            f"\nThis claim will be filed with {company['name']}. Where relevant, phrase claims "
            f"using terminology consistent with standard motor insurance policy language "
            f"(e.g. distinguish cosmetic vs structural damage clearly, since this affects "
            f"eligibility under rules like: {rule_names}).\n"
        )

    # Build a claimant context block (personal/form fields) that the model
    # can reference for accuracy but must NOT copy into claim statements.
    context_block = ""
    if claimant_context:
        context_lines = "\n".join(f"  {k}: {v}" for k, v in claimant_context.items() if v)
        context_block = f"""
Claimant reference information (for your awareness ONLY — do NOT include
any of this personal/administrative data inside claim_text outputs):
{context_lines}
"""

    qa_block = "(none provided)"
    if qa_answers:
        qa_block = "\n".join(f'Q: {qa["question"]}\nA: {qa["answer"]}' for qa in qa_answers)

    sub_category_rule = ""
    if sub_category == "theft":
        sub_category_rule = "7. FOCUS on missing items, signs of forced entry (e.g. broken windows, scratched locks). The narrative consistency of stolen articles is paramount."
    elif sub_category == "natural_disaster":
        sub_category_rule = "7. FOCUS on environmental indicators (e.g. water lines for floods, scattered pockmarks for hail). Relate visible damage patterns to the claimed peril."
    elif sub_category == "collision":
        sub_category_rule = "7. FOCUS on point-of-impact damage and verify if the severity is consistent with the described circumstances (e.g. estimated speed).\n8. For each claim, assign it to a 'component_category' choosing EXACTLY from: 'Body work', 'Chassis', 'Accessories & Lamps', or 'Tyres'."

    return f"""You are drafting the DAMAGE ASSESSMENT section of a {CATEGORY_LABELS.get(category, '')} claim.
This is a DRAFT that the claimant will review and edit before submission.
{company_note}
--- EVIDENCE DESCRIPTIONS (pixel-level analysis of submitted photos) ---
{combined_descriptions}

--- INCIDENT CONTEXT (claimant's answers) ---
{qa_block}
{context_block}
Your job:
Write factual, localized damage claim statements based STRICTLY on what
the evidence descriptions above show. Each statement must describe a
specific, visible, external area of damage including its severity level.

Hard rules:
1. Every claim_text must describe VISIBLE, EXTERNAL damage only — do NOT
   mention internal or mechanical damage (engine, suspension, airbags,
   electronics) that cannot be seen in photos.
2. Do NOT include personal details (name, address, policy number, dates,
   costs) in any claim_text — those belong in other form sections.
3. Do NOT invent or infer damage not described in the evidence.
4. Do NOT estimate repair costs, insurance payouts, or liability.
5. Split into atomic statements — one specific damage fact per claim.
6. If evidence is uncertain about a region, prefix that claim_text with
   "Possible: " and set is_visually_checkable to false.
{sub_category_rule}

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{"claims": [{{"claim_text": "...", "is_visually_checkable": true, "component_category": "Body work|Chassis|Accessories & Lamps|Tyres (if applicable)"}}, ...]}}
"""


def describe_evidence_image(image_path: str, category: str, n_repeats: int = 2) -> dict:
    prompt = _build_describe_prompt(category)

    results = []
    for _ in range(n_repeats):
        try:
            raw = get_completion(prompt, image_path=image_path)
            results.append(_parse_json(raw))
        except ValueError:
            continue

    if not results:
        raise ValueError(f"All {n_repeats} description attempts failed to parse for {image_path}")

    reconciled = _reconcile_descriptions(results)

    # If fewer than a majority of attempts actually succeeded, don't trust
    # whatever consensus the survivors happened to show — force disagreed.
    if len(results) < (n_repeats / 2) + 1:
        reconciled["stability"] = "disagreed"

    return reconciled


def describe_all_evidence(image_paths: list, category: str) -> list:
    """Describes every evidence image (repeat+reconcile per image). Path A
    no longer generates AI adaptive gap-questions here — only the fixed
    claim-form template fields are asked of the user."""
    descriptions = []
    for p in image_paths:
        try:
            desc = describe_evidence_image(p, category)
            desc["filename"] = os.path.basename(p)
            descriptions.append(desc)
        except ValueError as exc:
            descriptions.append({
                "filename": os.path.basename(p),
                "is_relevant": True,
                "visible_regions": [], "description": f"Could not analyze this image: {exc}",
                "not_visible": [], "stability": "disagreed", "raw_attempts": [],
                "laterality_conflicts": [],
            })
    return descriptions


def extract_template_prefill(descriptions: list, category: str) -> dict:
    """One extra call (reuses existing descriptions, no new image calls)
    to fill in ONLY the template fields the evidence genuinely supports.
    Everything else is left for the user — most claim-form fields (name,
    address, dates, costs) can never be read off a photo, and the model
    is explicitly told not to guess at those. Fails safely to an empty
    dict rather than blocking the describe step."""
    prompt = _build_template_prefill_prompt(category, descriptions)
    try:
        raw = get_completion(prompt)
        parsed = _parse_json(raw)
        fields = parsed.get("prefilled_fields", {})
        # Defensive: only accept keys we actually asked about.
        extracted = {}
        for k, v in fields.items():
            if k in TEMPLATE_PREFILL_FIELDS and v:
                val = str(v).strip()
                extracted[k] = val
        return extracted
    except ValueError:
        return {}


# All ClaimTemplateData field IDs — used to constrain document prefill output.
ALL_TEMPLATE_FIELDS = [
    "first_name", "last_name", "street_address", "street_address_2",
    "city", "state", "postal_code", "phone", "email", "date_of_birth", "occupation",
    "incident_date", "incident_time", "incident_location",
    "police_report_filed", "police_report_number",
    "vehicle_make_model", "vehicle_year", "vehicle_vin", "license_plate",
    "current_mileage", "incident_circumstances",
    "injuries_description", "medical_facilities_visited", "medical_expenses",
    "damage_to_other_vehicle", "estimated_repair_cost", "additional_information",
    
    # New sub_category fields
    "point_of_impact", "correct_side_of_road", "estimated_speed", "driven_or_towed",
    "driver_license_number", "driver_license_expiry", "driver_license_class",
    "damage_body_work", "damage_chassis", "damage_accessories_lamps", "damage_tyres",
    "witnesses", "theft_date", "theft_time", "date_reported", "theft_location",
    "was_attended", "attended_by", "time_parked_before_theft", "police_station",
    "later_recovered", "peril_type"
]


def extract_template_fields_from_document(doc_text: str, category: str) -> dict:
    """Reads the text of an uploaded supporting document (docx/pdf/txt)
    and asks the LLM to map any values it finds to ClaimTemplateData
    field names. Unlike the image prefill, a real document CAN contain
    personal data (name, dates, etc.), so all template fields are valid
    targets. Fails safely to {} on any error."""
    fields_list = "\n".join(f"  - {f}" for f in ALL_TEMPLATE_FIELDS)
    prompt = f"""You are reading a document uploaded by a claimant as supporting
evidence for a {CATEGORY_LABELS.get(category, 'insurance')} claim.

Extracted document text:
---
{doc_text[:3000]}
---

Your job: find any values in this text that match the claim form fields
listed below, and extract them exactly as they appear. Only include a
field if the document EXPLICITLY states its value — do NOT guess, infer,
or fabricate anything.

Claim form fields (use these exact field_id keys):
{fields_list}

Respond with ONLY valid JSON, no other text:
{{"prefilled_fields": {{"field_id": "extracted value", ...}}}}

If no fields can be reliably extracted, respond with:
{{"prefilled_fields": {{}}}}
"""
    try:
        raw = get_completion(prompt)
        parsed = _parse_json(raw)
        fields = parsed.get("prefilled_fields", {})
        # Accept only known field IDs with non-empty string values.
        extracted = {}
        for k, v in fields.items():
            if k in ALL_TEMPLATE_FIELDS and str(v).strip():
                val = str(v).strip()
                extracted[k] = val
        return extracted
    except (ValueError, Exception):
        return {}



def _reconcile_descriptions(results: list) -> dict:
    """
    Combines repeated description attempts conservatively.

    Two disagreement checks, not one:
    1. A region only counts as agreed if it appears in a majority of attempts.
    2. SEPARATELY, and regardless of #1: if any attempt describes a region
       as "left ___" and another describes it as "right ___" (or similar
       laterality conflict), that region is ALWAYS treated as disagreed,
       even if a generic noun form (e.g. bare "headlight") happened to
       reach majority via exact-string coincidence. This closes a real gap
       found in testing: a laterality conflict was being silently erased
       because "headlight" and "right headlight" don't exact-match, so the
       bare noun could "win" a majority vote while the actual side
       disagreement went unflagged.
    """
    from collections import Counter

    region_counts = Counter()
    for r in results:
        for region in r.get("visible_regions", []):
            region_counts[region.lower().strip()] += 1

    majority_threshold = len(results) / 2
    agreed_regions = [region for region, count in region_counts.items() if count > majority_threshold]

    def base_noun(region: str) -> str:
        words = region.lower().strip().split()
        return " ".join(w for w in words if w not in ("left", "right", "front", "rear", "the"))

    laterality_by_noun = {}
    for r in results:
        for region in r.get("visible_regions", []):
            region_l = region.lower()
            noun = base_noun(region)
            side = "left" if "left" in region_l else "right" if "right" in region_l else None
            if side:
                laterality_by_noun.setdefault(noun, set()).add(side)

    laterality_conflicted_nouns = {noun for noun, sides in laterality_by_noun.items() if len(sides) > 1}

    agreed_regions = [r for r in agreed_regions if base_noun(r) not in laterality_conflicted_nouns]

    def overlap_score(r):
        r_regions = {x.lower().strip() for x in r.get("visible_regions", [])}
        return len(r_regions & set(agreed_regions))

    best_match = max(results, key=overlap_score) if results else results[0]

    all_not_visible = set()
    for r in results:
        all_not_visible.update(x.lower().strip() for x in r.get("not_visible", []))

    region_disagreement = len(results) > 1 and len({tuple(sorted(r.get("visible_regions", []))) for r in results}) > 1
    disagreement = region_disagreement or bool(laterality_conflicted_nouns)

    relevance_votes = [r.get("is_relevant", True) for r in results]
    is_relevant_consensus = relevance_votes.count(True) > len(results) / 2

    return {
        "is_relevant": is_relevant_consensus,
        "visible_regions": agreed_regions,
        "description": best_match.get("description", ""),
        "not_visible": list(all_not_visible),
        "stability": "disagreed" if disagreement else "agreed",
        "raw_attempts": [r.get("visible_regions", []) for r in results],
        "laterality_conflicts": list(laterality_conflicted_nouns),
    }


def identify_gap_questions(category: str, descriptions: list) -> list:
    """Kept for the standalone CLI test script / backward compatibility —
    Path A's API route no longer calls this."""
    prompt = f"""You have these descriptions of evidence photos submitted for a
{CATEGORY_LABELS.get(category, 'a')} claim:

{chr(10).join(f"- {d['description']}" for d in descriptions)}

Identify ONLY genuine gaps — information a claim needs that the photos
themselves cannot answer. If there are no genuine gaps, return an empty list.

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{"questions": ["...", "..."]}}
"""
    raw = get_completion(prompt)
    parsed = _parse_json(raw)
    return parsed.get("questions", [])


def generate_draft_claim(
    category: str,
    descriptions: list,
    qa_answers: list,
    company: dict = None,
    claimant_context: dict = None,
    sub_category: str = None,
) -> list:
    prompt = _build_draft_claim_prompt(category, descriptions, qa_answers, company, claimant_context, sub_category)
    raw = get_completion(prompt)
    parsed = _parse_json(raw)

    claims = parsed.get("claims")
    if not isinstance(claims, list):
        raise ValueError(f"Expected a 'claims' list in response, got: {parsed!r}")

    for i, claim in enumerate(claims, start=1):
        claim["id"] = f"c{i:02d}"
        claim["needs_human_verification"] = False
        claim["verification_reasons"] = []

    disagreed_regions = set()
    for d in descriptions:
        if d.get("stability") == "disagreed":
            for attempt in d.get("raw_attempts", []):
                disagreed_regions.update(r.lower() for r in attempt)
        disagreed_regions -= {r.lower() for r in d.get("visible_regions", [])}
        for noun in d.get("laterality_conflicts", []):
            disagreed_regions.add(noun)

    for claim in claims:
        claim_lower = claim["claim_text"].lower()
        if any(region in claim_lower for region in disagreed_regions):
            claim["verification_reasons"].append("laterality_conflict")

    mixed_signal_present = any(
        any(iw in d.get("description", "").lower() for iw in INTACT_WORDS)
        and any(dw in d.get("description", "").lower() for dw in DAMAGE_WORDS)
        for d in descriptions
    )
    if mixed_signal_present:
        for claim in claims:
            claim_lower = claim["claim_text"].lower()
            if any(iw in claim_lower for iw in INTACT_WORDS):
                claim["verification_reasons"].append("intact_near_damage")

    REASON_LABELS = {
        "laterality_conflict": "inconsistent AI analysis across repeated checks",
        "intact_near_damage": "described as undamaged in the same photo as other visible damage",
    }

    for claim in claims:
        reasons = claim["verification_reasons"]
        if reasons:
            claim["needs_human_verification"] = True

    return claims



INTACT_WORDS = ["intact", "undamaged", "no damage", "no apparent damage", "not damaged", "appears fine", "appears normal"]
DAMAGE_WORDS = ["damaged", "dent", "crack", "torn", "detached", "scratch", "broken", "shattered", "crease", "exposed"]


def _parse_json(raw: str) -> dict:
    import re
    cleaned = raw.strip()
    cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model did not return valid JSON: {raw!r}") from exc


def generate_claim_from_evidence(image_paths: list, category: str, qa_answers: list = None) -> dict:
    """Kept for the standalone CLI test script. Path A's API route now
    calls describe_all_evidence / extract_template_prefill / generate_draft_claim
    directly instead of going through this orchestrator."""
    descriptions = describe_all_evidence(image_paths, category)

    if qa_answers is None:
        questions = identify_gap_questions(category, descriptions)
        return {"stage": "questions", "descriptions": descriptions, "questions": questions}

    try:
        claims = generate_draft_claim(category, descriptions, qa_answers)
    except ValueError as exc:
        return {
            "stage": "draft_failed",
            "descriptions": descriptions,
            "claims": [],
            "error": f"Could not draft a claim from this evidence: {exc}. Please try again or enter the claim manually.",
        }

    return {"stage": "draft_ready", "descriptions": descriptions, "claims": claims}


def generate_evidence_suggestions(descriptions: list, claims: list) -> list:
    """
    Builds plain-language suggestions from signals we already compute —
    NOT a new AI call, just reads existing stability/verification data.
    Always framed as suggestions, never a hard block, per design.
    """
    suggestions = []

    for d in descriptions:
        if d.get("stability") == "disagreed":
            suggestions.append({
                "reason": "low_stability",
                "message": (
                    "One of your photos was hard to analyze consistently — a clearer, "
                    "closer, or better-lit photo of the same area may help."
                ),
            })
            break

    flagged_claims = [c for c in claims if c.get("needs_human_verification")]
    if flagged_claims:
        suggestions.append({
            "reason": "needs_verification",
            "message": (
                f"{len(flagged_claims)} statement(s) in your draft need extra confirmation. "
                "Consider adding another photo from a different angle to help clarify these."
            ),
        })

    return suggestions