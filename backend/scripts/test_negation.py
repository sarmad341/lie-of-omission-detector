"""
Isolates the c06 discrepancy: run the SAME visual question about car2.jpg's
rear bumper frame, phrased two ways — once as a negative claim (matches
what extraction produced) and once as a positive claim (matches what your
manual eval label was reasoning about) — and compare.

Usage:
    python scripts/test_negation.py test_images/car2.jpg
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.ground_and_judge import judge_claim  # noqa: E402

NEGATIVE_CLAIM = "The frame underneath the rear bumper does not appear to be exposed."
POSITIVE_CLAIM = "The frame underneath the rear bumper is exposed."


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_negation.py path/to/car2.jpg")
        sys.exit(1)

    image_path = sys.argv[1]

    print("=== NEGATIVE PHRASING (what extraction produced) ===")
    print(f"Claim: {NEGATIVE_CLAIM}")
    result_neg = judge_claim(NEGATIVE_CLAIM, image_path)
    print(json.dumps(result_neg, indent=2))

    print("\n=== POSITIVE PHRASING (the inverse claim) ===")
    print(f"Claim: {POSITIVE_CLAIM}")
    result_pos = judge_claim(POSITIVE_CLAIM, image_path)
    print(json.dumps(result_pos, indent=2))

    print("\n=== CONSISTENCY CHECK ===")
    print("These two claims are logical opposites of each other.")
    print("A correct model should give OPPOSITE verdicts (or both point the same direction):")
    print(f"  Negative claim verdict: {result_neg['verdict']}")
    print(f"  Positive claim verdict: {result_pos['verdict']}")
    if result_neg["verdict"] == result_pos["verdict"] and result_neg["verdict"] in ("supported", "contradicted"):
        print("  -> WARNING: both phrasings got the SAME definitive verdict. That's a contradiction —")
        print("     the model isn't correctly reasoning about the negation.")


if __name__ == "__main__":
    main()
