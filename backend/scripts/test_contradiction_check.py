"""
Test the contradiction_check module directly against the known-tricky e03
case — the compound claim that judge_claim_stable still got wrong 3/3 times
(consistent, not random, so majority-voting alone couldn't fix it).

Usage:
    python scripts/test_contradiction_check.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.contradiction_check import check_claim  # noqa: E402

CLAIM = (
    "The customer's vehicle sustained severe damage to the rear bumper, "
    "with the bumper corner torn off and the frame exposed underneath."
)
IMAGE_PATH = os.path.join("test_images", "car2.jpg")
EXPECTED = "contradicted"


def main():
    print(f"Claim: {CLAIM}")
    print(f"Expected verdict: {EXPECTED}\n")

    result = check_claim(CLAIM, IMAGE_PATH)

    print(json.dumps(result, indent=2))

    status = "CORRECT" if result["verdict"] == EXPECTED else "WRONG"
    print(f"\n{status} — got '{result['verdict']}', expected '{EXPECTED}'")


if __name__ == "__main__":
    main()
