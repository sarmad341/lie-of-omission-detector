"""
Debug helper: run ONE eval example by id and print the FULL model output,
including the description field — this is what tells us whether a wrong
verdict is because the model didn't see the region at all (perception
problem) vs. saw it but labeled it wrong (judgment/prompt calibration
problem).

Usage:
    python scripts/inspect_case.py e02
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.ground_and_judge import judge_claim  # noqa: E402

EVAL_SET_PATH = os.path.join(os.path.dirname(__file__), "..", "eval_set", "eval_set.json")
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "test_images")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/inspect_case.py <example_id, e.g. e02>")
        sys.exit(1)

    target_id = sys.argv[1]
    with open(EVAL_SET_PATH, "r", encoding="utf-8") as f:
        examples = json.load(f)

    match = next((e for e in examples if e["id"] == target_id), None)
    if not match:
        print(f"No example with id '{target_id}' found in eval_set.json")
        sys.exit(1)

    image_path = os.path.join(IMAGES_DIR, match["image_filename"])
    print(f"Claim: {match['claim_text']}")
    print(f"Your labeled correct verdict: {match['correct_verdict']}\n")

    result = judge_claim(match["claim_text"], image_path)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
