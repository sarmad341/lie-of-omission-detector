import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.router import get_completion  # noqa: E402

CATEGORY_GUIDANCE = {
    "car_insurance": (
        "Extract claims about physical damage to a vehicle — location, "
        "severity, and cause. These are typically checkable against photos."
    ),
    "health_insurance": (
        "Extract claims about diagnosis, treatment received, procedures, "
        "and dates of service. Most of these are NOT checkable against "
        "photos — they are typically verified against medical records or "
        "receipts instead. Still extract them, and mark "
        "is_visually_checkable accordingly (usually false unless the claim "
        "describes a visible injury)."
    ),
    "loan_application": (
        "Extract claims about income, assets, employment, and collateral "
        "condition. Most of these are NOT checkable against photos — they "
        "are typically verified against financial documents instead. Only "
        "claims about physical collateral condition (e.g. a vehicle or "
        "property's condition) are usually visually checkable."
    ),
}


def _build_prompt(document_text: str, category: str) -> str:
    guidance = CATEGORY_GUIDANCE.get(category, "Extract distinct, checkable factual claims.")
    return f"""You are analyzing a compliance document in the category: "{category}".

Document text:
\"\"\"
{document_text}
\"\"\"

First, check: does this document's content plausibly belong to the "{category}"
category? Set "domain_match" to true if yes, false if the document is clearly
about something unrelated. If false, write a short "domain_warning" in one
sentence. If true, "domain_warning" should be null.

{guidance}

Rules:
1. Split compound statements into separate ATOMIC claims.
2. Administrative statements (names, dates, ID numbers, dollar amounts)
   should be included with "is_visually_checkable": false, or omitted.
3. Keep each claim self-contained, rewriting pronouns to their referent.
4. Do not invent claims not stated or clearly implied.
5. Be honest and conservative about is_visually_checkable per the category
   guidance above.

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{
  "domain_match": true,
  "domain_warning": null,
  "claims": [{{"claim_text": "...", "is_visually_checkable": true}}, ...]
}}
"""


def extract_claims(document_text: str, category: str = "car_insurance") -> dict:
    prompt = _build_prompt(document_text, category)
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

    claims = parsed.get("claims")
    if not isinstance(claims, list):
        raise ValueError(f"Expected a 'claims' list in response, got: {parsed!r}")

    for i, claim in enumerate(claims, start=1):
        claim["id"] = f"c{i:02d}"

    return {
        "claims": claims,
        "domain_match": parsed.get("domain_match", True),
        "domain_mismatch_warning": parsed.get("domain_warning"),
    }