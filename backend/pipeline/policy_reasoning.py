"""
Layer 2 of Policy Screening: LLM reasoning, but ONLY for what Layer 1's
deterministic rules can't cover — genuine judgment calls, not things with
a clear pass/fail rule. Only runs if every Layer 1 rule already passed
(policy_rules_engine.combine_policy_decision enforces this — a Layer 1
failure short-circuits before this module is ever called).

Explicitly required to cite which rule/clause it's reasoning about, so
output stays traceable rather than a black-box opinion — matching what
real industry practice favors for auditable claims decisions.
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.router import get_completion  # noqa: E402


def _build_prompt(claim: dict, grounding_result: dict, company: dict, passed_rules: list) -> str:
    rules_summary = "\n".join(
        f"- {r['rule_description']} (cited: {r['cited_clause']})" for r in passed_rules
    )
    return f"""You are screening an insurance claim for {company['name']} after it has
already passed every applicable deterministic policy rule. Your job is NOT
to re-check those rules — they already passed. Your job is to judge
whether there is any remaining, genuine ambiguity that a rule-based check
couldn't capture.

Claim: "{claim['claim_text']}"
Evidence grounding result: {grounding_result.get('final_verdict')} — {grounding_result.get('explanation', '')}

Rules already passed:
{rules_summary}

Consider ONLY things a fixed rule cannot capture — for example, whether
the narrative is internally consistent, or whether the described cause
plausibly matches the type of damage shown. Do NOT re-litigate the rules
above; they already passed.

If you find no genuine remaining concern, say so plainly and recommend
"accepted". If you find a real, specific concern a human should look at,
recommend "needs_review" and explain exactly what the concern is,
referencing which rule or policy concept it relates to.

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{"recommendation": "accepted" or "needs_review", "reasoning": "..."}}
"""


def run_layer_2_reasoning(claim: dict, grounding_result: dict, company: dict, passed_rules: list) -> dict:
    """
    Returns {"recommendation": "accepted"|"needs_review", "reasoning": str}.
    Raises ValueError on unparseable model output, same pattern as every
    other module in this pipeline.
    """
    prompt = _build_prompt(claim, grounding_result, company, passed_rules)
    raw = get_completion(prompt)  # text-only, no image needed at this stage

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

    if parsed.get("recommendation") not in ("accepted", "needs_review"):
        raise ValueError(f"Model returned an unrecognized recommendation: {parsed!r}")

    return parsed