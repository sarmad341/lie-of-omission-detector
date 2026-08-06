"""
Test Policy Screening end to end, standalone — no API, no full pipeline.
Uses one of your real seeded companies and a real grounding result shape,
so we can see Layer 1 + Layer 2 behavior clearly before wiring into the API.

Usage:
    python scripts/test_policy_screening.py <company_id>
    (get a company_id from GET /companies, or from run: python -c
     "from pipeline.persistence import list_companies; print(list_companies())")
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.persistence import get_company, get_applicable_rules  # noqa: E402
from pipeline.policy_rules_engine import screen_claim_against_company  # noqa: E402

# Three test cases covering the three possible outcomes:
TEST_CASES = [
    {
        "label": "Should be REJECTED (wear/tear language)",
        "claim": {"claim_text": "The rear bumper was damaged in the accident."},
        "grounding_result": {
            "final_verdict": "supported",
            "explanation": "The rear bumper shows visible rust and gradual corrosion consistent with age.",
        },
    },
    {
        "label": "Should be REJECTED (severity contradicted)",
        "claim": {"claim_text": "Severe damage to the rear bumper, corner torn off."},
        "grounding_result": {
            "final_verdict": "contradicted",
            "explanation": "The bumper shows minor scraping; the corner is intact, not torn off.",
        },
    },
    {
        "label": "Should proceed to Layer 2 (clean pass)",
        "claim": {"claim_text": "The front bumper suffered collision damage."},
        "grounding_result": {
            "final_verdict": "supported",
            "explanation": "The front bumper is visibly dented and cracked, consistent with a frontal collision.",
        },
    },
]


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_policy_screening.py <company_id>")
        sys.exit(1)

    company_id = sys.argv[1]
    company = get_company(company_id)
    applicable_rules = get_applicable_rules(company_id)

    print(f"Testing against: {company['name']}\n")

    for case in TEST_CASES:
        print(f"--- {case['label']} ---")
        result = screen_claim_against_company(
            case["claim"], case["grounding_result"], company, applicable_rules
        )
        print(json.dumps(result, indent=2))
        print()


if __name__ == "__main__":
    main()