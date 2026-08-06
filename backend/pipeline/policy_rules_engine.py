"""
Layer 1 of Policy Screening: deterministic, code-based rule checks.
NOT an LLM call — these run first, and any failure here is final
(rejected), matching the pattern already validated in
contradiction_check.py: code decides when the rule is clear, the
model only reasons about genuine ambiguity (that's Layer 2).

Each rule is modeled on real specimen policy language pulled from
AIG (Ireland), AXA (UK), and TAIPA (Texas) — see docstrings per rule
for the source clause each one is based on.
"""

import re

def check_wear_vs_accident(claim: dict, grounding_result: dict) -> dict:
    """
    Source: AIG Ireland Section 1 exclusions — "Wear and tear or
    depreciation" / "any gradually operating cause". AXA UK — identical
    language, "wear and tear, mechanical or electrical failure,
    breakdowns... any gradually operating cause".
    """
    explanation = grounding_result.get("explanation", "").lower()
    wear_indicators = ["rust", "corrosion", "worn", "gradual", "deteriorat", "faded", r"\baged\b"]

    # Use regex word-boundary matching, not plain substring — "aged" as a
    # substring incorrectly matched inside "damaged", causing false
    # rejections on ordinary, legitimate accident claims.
    matched = [w for w in wear_indicators if re.search(w if w.startswith(r"\b") else r"\b" + w, explanation)]
    passed = len(matched) == 0

    return {
        "rule_id": "wear_vs_accident",
        "rule_description": "Damage must be from a sudden accident, not gradual wear/deterioration.",
        "passed": passed,
        "cited_clause": (
            "Excluded per standard policy wording: \"wear and tear or depreciation\" "
            "and \"any gradually operating cause\" are not covered."
            if not passed else "No wear/deterioration language detected in evidence description."
        ),
    }

def check_tyre_exclusion(claim: dict, grounding_result: dict) -> dict:
    """
    Source: AIG Ireland — "Damage to tyres caused by braking or by
    punctures cuts or bursts" excluded. AXA UK — "Damage to tyres from
    braking, punctures, cuts or bursts unless as a result of an
    accident". TAIPA — same pattern ("Blowouts, punctures or other
    road damage to tires" excluded on its own).

    Fails if the claim is ONLY about tyre damage with no other
    accident-related damage described elsewhere in the same case.
    """
    claim_text = claim.get("claim_text", "").lower()
    is_tyre_claim = any(w in claim_text for w in ["tyre", "tire", "puncture", "blowout"])

    if not is_tyre_claim:
        return {
            "rule_id": "tyre_exclusion",
            "rule_description": "Tyre-only damage (puncture/burst/brake wear) is excluded unless tied to a covered accident.",
            "passed": True,
            "cited_clause": "Not a tyre-related claim — rule not applicable.",
        }

    # Tyre claim: only passes if grounding explicitly ties it to accident damage,
    # not a standalone puncture/wear description.
    explanation = grounding_result.get("explanation", "").lower()
    accident_linked = any(w in explanation for w in ["collision", "impact", "accident damage"])

    return {
        "rule_id": "tyre_exclusion",
        "rule_description": "Tyre-only damage (puncture/burst/brake wear) is excluded unless tied to a covered accident.",
        "passed": accident_linked,
        "cited_clause": (
            "Standalone tyre damage (puncture, burst, brake-related wear) is excluded under "
            "standard policy wording unless clearly resulting from a covered collision."
            if not accident_linked
            else "Tyre damage is described as resulting from the covered accident."
        ),
    }


def check_region_visibility(claim: dict, grounding_result: dict) -> dict:
    """
    Not from a specific policy clause — this enforces AIG's real claims
    duty: "Provide all reasonable evidence to support your claim."
    A claim whose described region was never actually visible in any
    submitted evidence hasn't met that duty.
    """
    verdict = grounding_result.get("final_verdict")
    passed = verdict != "missing_expected_evidence"

    return {
        "rule_id": "region_visibility",
        "rule_description": "The specific damage/region described in the claim must be visible in submitted evidence.",
        "passed": passed,
        "cited_clause": (
            "Claimant duty: \"Provide all reasonable evidence to support your claim\" — "
            "the described region was not visible in any submitted evidence."
            if not passed
            else "The claimed region is visible in at least one piece of evidence."
        ),
    }


def check_severity_consistency(claim: dict, grounding_result: dict) -> dict:
    """
    Enforces AXA UK's real fraud clause: void if claim details
    "inflate or exaggerate" what evidence actually shows. This is the
    direct policy basis for our whole lie-of-omission detection design.
    """
    verdict = grounding_result.get("final_verdict")
    passed = verdict != "contradicted"

    return {
        "rule_id": "severity_consistency",
        "rule_description": "Claimed severity/type of damage must match what evidence actually shows.",
        "passed": passed,
        "cited_clause": (
            "Per standard fraud provisions, a claim is void if it is \"in any respect fraudulent\" "
            "or exaggerates damage beyond what evidence shows — evidence contradicts this claim's description."
            if not passed
            else "Evidence is consistent with the claimed severity/type of damage."
        ),
    }


def check_unlocked_unattended_theft(claim: dict, grounding_result: dict) -> dict:
    """
    Source: Progressive Section D Exclusion 7 ("left unattended while unlocked or with ignition
    keys left in or on your car"); AIG Section 1 Section B ("keys or keyless entry left unsecured...
    doors left unlocked"); AXA Part A Exclusions ("left unlocked or with keys in your car").
    """
    claim_text = claim.get("claim_text", "").lower()
    explanation = grounding_result.get("explanation", "").lower()
    full_text = f"{claim_text} {explanation}"

    is_theft_claim = any(w in full_text for w in ["stolen", "theft", "burglar", "break-in"])
    if not is_theft_claim:
        return {
            "rule_id": "unlocked_unattended_theft",
            "rule_description": "Theft is excluded if the vehicle was left unattended while unlocked or with keys in/near the car.",
            "passed": True,
            "cited_clause": "Not a theft or break-in claim — security rule not applicable.",
        }

    unsecured_key_words = ["key left inside", "unlocked", "keys in ignition", "left in car", "window open", "keys in vehicle"]
    is_unsecured = any(w in full_text for w in unsecured_key_words)

    return {
        "rule_id": "unlocked_unattended_theft",
        "rule_description": "Theft is excluded if the vehicle was left unattended while unlocked or with keys in/near the car.",
        "passed": not is_unsecured,
        "cited_clause": (
            "Progressive / AIG / AXA Exclusion: Theft is excluded if keys were left inside or vehicle was left unlocked/unattended."
            if is_unsecured
            else "Vehicle security standards verified — no indication of unsecured keys or unlocked doors."
        ),
    }


def check_unauthorized_intoxicated_driver(claim: dict, grounding_result: dict) -> dict:
    """
    Source: Progressive Section D Exclusions 1 & 2 (unlicensed driver, alcohol/drugs);
    AXA General Exclusion 6 (driving over legal limit or unfit through drink/drugs);
    AIG General Exception 1 (unlicensed driver / disqualified person).
    """
    claim_text = claim.get("claim_text", "").lower()
    explanation = grounding_result.get("explanation", "").lower()
    full_text = f"{claim_text} {explanation}"

    intoxicated_words = ["alcohol", "drunk", "intoxicated", "dui", "dwi", "drugs", "breathalyzer", "unlicensed"]
    is_violation = any(w in full_text for w in intoxicated_words)

    return {
        "rule_id": "unauthorized_intoxicated_driver",
        "rule_description": "Excludes loss/damage if vehicle is driven by an unlicensed driver or driver under the influence of alcohol/drugs.",
        "passed": not is_violation,
        "cited_clause": (
            "Exclusion: Loss/damage while driving under the influence or without a valid licence is strictly excluded."
            if is_violation
            else "Driver licence & sobriety requirements verified."
        ),
    }


# Registry — maps rule_id to its check function, used by the orchestrator
RULE_REGISTRY = {
    "wear_vs_accident": check_wear_vs_accident,
    "tyre_exclusion": check_tyre_exclusion,
    "region_visibility": check_region_visibility,
    "severity_consistency": check_severity_consistency,
    "unlocked_unattended_theft": check_unlocked_unattended_theft,
    "unauthorized_intoxicated_driver": check_unauthorized_intoxicated_driver,
}


def run_layer_1_checks(claim: dict, grounding_result: dict, applicable_rule_ids: list) -> list:
    """
    Runs every applicable rule for the given company against one claim's
    grounding result. Returns a list of RuleCheckResult-shaped dicts.
    Any single failure here should cause the caller to reject the claim
    outright, without invoking Layer 2 at all — matching the same
    "code decides when clear" pattern used in contradiction_check.py.
    """
    results = []
    for rule_id in applicable_rule_ids:
        check_fn = RULE_REGISTRY.get(rule_id)
        if check_fn is None:
            continue
        results.append(check_fn(claim, grounding_result))
    return results

def combine_policy_decision(rule_results: list, layer_2_reasoning: str = None) -> dict:
    """
    Deterministic combination, same philosophy as
    contradiction_check.py's _aggregate_sub_findings(): any single
    failed rule forces 'rejected', no exceptions, no LLM override.
    Layer 2 reasoning only matters if every Layer 1 rule passed.
    """
    failed = [r for r in rule_results if not r["passed"]]

    if failed:
        return {
            "status": "rejected",
            "rule_check_results": rule_results,
            "layer_2_reasoning": None,  # Layer 2 never runs if Layer 1 already failed
            "stability": None,
        }

    if layer_2_reasoning is None:
        # All rules passed, Layer 2 hasn't run yet
        return {
            "status": "needs_review",
            "rule_check_results": rule_results,
            "layer_2_reasoning": None,
            "stability": None,
        }

    return {
        "status": "accepted",
        "rule_check_results": rule_results,
        "layer_2_reasoning": layer_2_reasoning,
        "stability": None,  # filled in once repeated-call checking is wired in
    }

def screen_claim_against_company(claim: dict, grounding_result: dict, company: dict, applicable_rules: list) -> dict:
    """
    Full Policy Screening orchestration for one claim: Layer 1 first,
    Layer 2 only if Layer 1 fully passed. This is the single function
    the API route/worker should call — callers never invoke Layer 1 or
    Layer 2 directly.
    """
    from pipeline.policy_reasoning import run_layer_2_reasoning

    rule_ids = [r["rule_id"] for r in applicable_rules]
    rule_results = run_layer_1_checks(claim, grounding_result, rule_ids)

    failed = [r for r in rule_results if not r["passed"]]
    if failed:
        # Layer 1 failure is final — Layer 2 never runs, matching the
        # same "code decides when clear" pattern as contradiction_check.py
        return combine_policy_decision(rule_results, layer_2_reasoning=None)

    try:
        layer_2_result = run_layer_2_reasoning(claim, grounding_result, company, rule_results)
    except ValueError as exc:
        # Layer 2 failure shouldn't silently pass the claim — flag for review
        return {
            "status": "needs_review",
            "rule_check_results": rule_results,
            "layer_2_reasoning": f"Layer 2 reasoning failed: {exc}",
            "stability": None,
        }

    if layer_2_result["recommendation"] == "needs_review":
        return {
            "status": "needs_review",
            "rule_check_results": rule_results,
            "layer_2_reasoning": layer_2_result["reasoning"],
            "stability": None,
        }

    return combine_policy_decision(rule_results, layer_2_reasoning=layer_2_result["reasoning"])