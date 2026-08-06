import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.router import get_completion  # noqa: E402

SUB_ASSESSMENTS = {"supported", "contradicted", "missing_expected_evidence", "insufficient_evidence"}


def _build_prompt(claim_text: str) -> str:
    return f"""You are reviewing a compliance claim against a photograph.

Claim: "{claim_text}"

Step 1 - Decompose: break this claim into its distinct, individually
checkable sub-details. Even a claim that reads as one sentence may assert
more than one fact — e.g. "the bumper corner was torn off" asserts BOTH
that this region is damaged AND a specific, literal form of damage
(detached/torn off — not just dented or scratched). Treat descriptive
words like "torn off", "shattered", "exposed" literally; do not soften
them into a generic "damaged" sub-detail. If the claim genuinely asserts
only one fact, return a single sub-detail.

Step 2 - For EACH sub-detail, you MUST first answer: is the SPECIFIC body
region this sub-detail refers to (e.g. front bumper vs rear bumper, hood,
headlight, windshield, a specific door) actually visible in the image? Be
strict about this — a photo showing damage to a DIFFERENT part of the
vehicle (e.g. the rear, when the sub-detail is about the front) does NOT
count as that region being visible, no matter how much damage is shown
elsewhere. Only after confirming the specific named region is visible
should you compare its actual condition against the sub-detail's claim.

For each sub-detail, assess it as:
- "missing_expected_evidence": the SPECIFIC region this sub-detail names is not visible in the image at all — this includes cases where a different part of the vehicle is shown instead
- "supported": the specific named region IS visible and matches
- "contradicted": the specific named region IS visible but does not literally match
- "insufficient_evidence": the specific named region is visible but too unclear to judge confidently

Never mark a sub-detail "contradicted" just because damage exists somewhere
else in the image — "contradicted" requires the claim's own specific
region to be visible and simply not match what's claimed about it.

Left/right convention: sides are defined from the perspective of someone
sitting inside the vehicle facing forward — mirrored relative to a viewer
facing the front of the vehicle.

Distinguish cosmetic damage (scraped paint, dents, scratches on a panel
surface) from structural/frame damage (the metal skeleton, cross-members,
or mechanical parts actually visible) — these are not the same thing.

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{
  "sub_findings": [
    {{"detail": "...", "assessment": "...", "reasoning": "..."}}
  ]
}}
"""


def _aggregate_sub_findings(sub_findings: list) -> str:
    """Deterministic, code-based combination rule — NOT left to the LLM,
    since testing showed the model does not reliably apply a
    disproof-takes-priority rule on its own even when explicitly instructed.

    Rule: any single contradicted sub-detail is enough to disprove the
    claim's specifics, so it always wins. Otherwise, if every checkable
    sub-detail is supported, the claim is supported. If nothing is
    contradicted but some/all sub-details have no visible evidence, treat
    it as missing evidence. Anything else falls back to insufficient.
    """
    assessments = [f["assessment"] for f in sub_findings]

    if "contradicted" in assessments:
        return "contradicted"
    if assessments and all(a == "supported" for a in assessments):
        return "supported"
    if "supported" in assessments and "missing_expected_evidence" in assessments:
        # Some sub-details confirmed, others simply have no evidence either
        # way (not disproven) — the confirmed part stands.
        return "supported"
    if "missing_expected_evidence" in assessments:
        return "missing_expected_evidence"
    return "insufficient_evidence"


def check_claim(claim_text: str, image_path: str) -> dict:
    """Decomposes a claim into sub-details, assesses each independently
    against the image, and combines them with a fixed, testable rule
    (in Python, not the LLM) instead of relying on the model to correctly
    prioritize a disproven detail over an unrelated missing one — which
    testing showed it does not do consistently.
    """
    prompt = _build_prompt(claim_text)
    raw = get_completion(prompt, image_path=image_path)

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model did not return valid JSON: {raw!r}") from exc

    sub_findings = parsed.get("sub_findings")
    if not isinstance(sub_findings, list) or not sub_findings:
        raise ValueError(f"Expected a non-empty 'sub_findings' list, got: {parsed!r}")

    for f in sub_findings:
        if f.get("assessment") not in SUB_ASSESSMENTS:
            raise ValueError(f"Sub-finding has invalid assessment: {f!r}")

    overall_verdict = _aggregate_sub_findings(sub_findings)

    explanation = "Sub-detail breakdown:\n" + "\n".join(
        f"- {f['detail']}: {f['assessment']} ({f.get('reasoning', '')})" for f in sub_findings
    )

    return {
        "verdict": overall_verdict,
        "sub_findings": sub_findings,
        "explanation": explanation,
        "confidence": "high" if len(sub_findings) == 1 else "medium",
    }


def _build_description_prompt(claim_text: str, description_text: str, sub_category: str = None) -> str:
    sub_category_prompt = ""
    if sub_category == "collision":
        sub_category_prompt = "Special attention for Collision: Strictly check if the point of impact and severity match the circumstances described."
    elif sub_category == "theft":
        sub_category_prompt = "Special attention for Theft: Focus on narrative consistency regarding forced entry or missing items."
    elif sub_category == "natural_disaster":
        sub_category_prompt = "Special attention for Natural Disaster: Verify if the damage pattern matches the claimed peril (e.g., water damage for floods)."

    return f"""You are reviewing a compliance claim against a detailed description of an evidence photograph.

Claim: "{claim_text}"

Evidence Photo Description:
\"\"\"
{description_text}
\"\"\"

Step 1 - Decompose: break this claim into its distinct, individually checkable sub-details. Even a claim that reads as one sentence may assert more than one fact — e.g. "the bumper corner was torn off" asserts BOTH that this region is damaged AND a specific, literal form of damage (detached/torn off — not just dented or scratched). Treat descriptive words like "torn off", "shattered", "exposed" literally; do not soften them into a generic "damaged" sub-detail. If the claim genuinely asserts only one fact, return a single sub-detail.

Step 2 - For EACH sub-detail, check if the evidence photo description confirms whether the specific named region (e.g. front bumper, left headlight) is visible and what its condition is. {sub_category_prompt}

For each sub-detail, assess it as:
- "missing_expected_evidence": the SPECIFIC region this sub-detail names is explicitly mentioned as NOT visible/not shown in the photo description, or the photo description does not mention this region at all.
- "supported": the photo description explicitly confirms this specific region is visible and its damage/condition matches the sub-detail.
- "contradicted": the photo description confirms this specific region is visible but describes its condition as different or undamaged (not matching the claim).
- "insufficient_evidence": the photo description mentions the region but there is not enough detail to judge the claim's specific statement.

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{
  "sub_findings": [
    {{"detail": "...", "assessment": "...", "reasoning": "..."}}
  ]
}}
"""


def check_claim_against_description(claim_text: str, description: dict, sub_category: str = None) -> dict:
    """Decomposes a claim into sub-details and assesses each against a text description
    using a text model (no vision call).
    """
    desc_str = f"Detailed Visual Description: {description.get('description', '')}\n"
    if description.get("visible_regions"):
        desc_str += f"Visible Regions: {', '.join(description['visible_regions'])}\n"
    if description.get("not_visible"):
        desc_str += f"Not Visible Regions: {', '.join(description['not_visible'])}\n"

    prompt = _build_description_prompt(claim_text, desc_str, sub_category)
    raw = get_completion(prompt)

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model did not return valid JSON: {raw!r}") from exc

    sub_findings = parsed.get("sub_findings")
    if not isinstance(sub_findings, list) or not sub_findings:
        raise ValueError(f"Expected a non-empty 'sub_findings' list, got: {parsed!r}")

    for f in sub_findings:
        if f.get("assessment") not in SUB_ASSESSMENTS:
            raise ValueError(f"Sub-finding has invalid assessment: {f!r}")

    overall_verdict = _aggregate_sub_findings(sub_findings)

    explanation = "Sub-detail breakdown:\n" + "\n".join(
        f"- {f['detail']}: {f['assessment']} ({f.get('reasoning', '')})" for f in sub_findings
    )

    return {
        "verdict": overall_verdict,
        "sub_findings": sub_findings,
        "explanation": explanation,
        "confidence": "high" if len(sub_findings) == 1 else "medium",
    }
