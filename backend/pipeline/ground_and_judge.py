import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.router import get_completion  # noqa: E402

VALID_VERDICTS = {
    "supported",
    "contradicted",
    "missing_expected_evidence",
    "insufficient_evidence",
}


def _build_prompt(claim_text: str) -> str:
    return f"""You are reviewing a compliance claim against a photograph.

Claim: "{claim_text}"

Left/right convention: describe left and right from the perspective of a
person SITTING INSIDE the vehicle facing forward (standard automotive/
insurance convention) — NOT from how the photo looks to you as a viewer.
This means the sides are mirrored when you are looking at the FRONT of the
vehicle: what appears on your right in the image is the vehicle's LEFT
side, and what appears on your left in the image is the vehicle's RIGHT
side. (If you are looking at the REAR of the vehicle instead, the mapping
is reversed again — reason explicitly about which end of the vehicle you
are viewing before assigning left/right.) State your reasoning for which
side is which in one sentence before naming it in your description.

Step 1 - Describe: List every part of the subject visible in the image, and
note which regions relevant to the claim are NOT visible in frame. Be
specific and literal about what you can and cannot see.

Step 2 - Judge: Based ONLY on your description above (do not introduce new
observations here), decide exactly one of:
- "supported": the claimed detail's region is visible and matches the claim
- "contradicted": the claimed detail's region IS visible but does not match the claim
- "missing_expected_evidence": the region the claim refers to is not visible at all
- "insufficient_evidence": the region is visible but too unclear/partial to judge confidently

IMPORTANT — distinguish cosmetic from structural damage: scraped paint,
scuffing, or bare sheet metal visible on a body panel's SURFACE is cosmetic
damage, NOT the same as an exposed frame/chassis. Only describe the
"frame" or structural components as "exposed" if you can see underlying
structural elements (e.g. the metal skeleton, cross-members, or
mechanical/suspension parts behind the panel) — not just scraped paint or
a dented panel surface. If you are unsure whether what's visible is a
damaged panel surface versus true structural exposure, describe it as
panel damage, not frame exposure.

Your verdict MUST be consistent with your own description. If your
description says a region is not visible, the verdict must be
"missing_expected_evidence" — never guess supported or contradicted for a
region you just described as out of frame.

IMPORTANT — multi-part claims: a claim may assert several distinct details
(e.g. "the bumper corner was torn off AND the frame was exposed
underneath"). If your description directly contradicts ANY part of the
claim for a region that IS visible, the verdict must be "contradicted" —
even if another part of the same claim refers to a region that is not
visible. A visible, disproven detail always takes priority over an
unrelated missing detail. Only use "missing_expected_evidence" when NONE of
the claim's asserted details can be checked against what's visible.

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{"description": "...", "verdict": "...", "explanation": "...", "confidence": "high|medium|low"}}
"""


def judge_claim(claim_text: str, image_path: str) -> dict:
    """Runs the two-stage describe-then-judge prompt (PDR Section 6.4)
    against one claim + image pair and returns the parsed verdict dict.

    Raises ValueError if the model's output isn't parseable JSON or the
    verdict isn't one of the four valid categories, so callers (like the
    eval harness) can count that as a distinct failure mode rather than
    silently mis-scoring it.
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

    verdict = parsed.get("verdict")
    if verdict not in VALID_VERDICTS:
        raise ValueError(f"Model returned an unrecognized verdict: {verdict!r}")

    return parsed


def judge_claim_stable(claim_text: str, image_path: str, n_repeats: int = 3) -> dict:
    """Calls judge_claim() multiple times and only returns a definitive
    verdict if a majority agree — because testing showed the model can give
    genuinely different answers to the identical claim+image on repeated
    calls, even at temperature 0. A single call is not reliable enough to
    trust on its own, especially for claims near the model's confidence
    boundary.

    Returns the majority verdict's result dict (from whichever call matched
    the majority) with extra fields added:
      - "stability": "agreed" if a majority (>n_repeats/2) agreed, else "disagreed"
      - "repeat_verdicts": the list of verdicts from every call, for audit purposes

    If there is no majority (e.g. 3 different verdicts across 3 calls), the
    result is forced to "insufficient_evidence" rather than picking one
    arbitrarily — an unstable answer should route to human review, not be
    presented as confident.
    """
    results = []
    for _ in range(n_repeats):
        try:
            results.append(judge_claim(claim_text, image_path))
        except ValueError as exc:
            results.append({"verdict": "insufficient_evidence", "explanation": f"Model error: {exc}",
                             "confidence": "low", "description": ""})

    verdict_counts: dict = {}
    for r in results:
        verdict_counts.setdefault(r["verdict"], []).append(r)

    all_verdicts = [r["verdict"] for r in results]
    majority_verdict, majority_results = max(verdict_counts.items(), key=lambda kv: len(kv[1]))

    if len(majority_results) > n_repeats / 2:
        chosen = majority_results[0]
        return {
            **chosen,
            "stability": "agreed",
            "repeat_verdicts": all_verdicts,
        }

    return {
        "description": " | ".join(r.get("description", "") for r in results),
        "verdict": "insufficient_evidence",
        "explanation": (
            f"Model gave inconsistent verdicts across {n_repeats} repeated calls "
            f"({all_verdicts}) — no majority agreement, so this is being flagged "
            f"for human review rather than reported as a confident result."
        ),
        "confidence": "low",
        "stability": "disagreed",
        "repeat_verdicts": all_verdicts,
    }
