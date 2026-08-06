"""
Eval harness (PDR Section 13.2): runs every example in eval_set/eval_set.json
through the pipeline and compares the predicted verdict against the manually
assigned correct verdict. Prints overall accuracy and a per-category
breakdown so we can see specifically whether the system is good at catching
'missing evidence', or tends to over-call 'contradicted', etc.

Usage:
    python scripts/run_eval.py
"""
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.ground_and_judge import judge_claim_stable  # noqa: E402

EVAL_SET_PATH = os.path.join(os.path.dirname(__file__), "..", "eval_set", "eval_set.json")
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "test_images")


def main():
    with open(EVAL_SET_PATH, "r", encoding="utf-8") as f:
        examples = json.load(f)

    results = []
    for ex in examples:
        if "REPLACE" in ex["claim_text"] or "REPLACE" in ex["image_filename"]:
            print(f"[{ex['id']}] SKIPPED — still a template placeholder, fill this in first.")
            continue

        image_path = os.path.join(IMAGES_DIR, ex["image_filename"])
        print(f"\n[{ex['id']}] Claim: {ex['claim_text']}")

        if not os.path.exists(image_path):
            print(f"  SKIPPED — image not found at {image_path}")
            continue

        try:
            prediction = judge_claim_stable(ex["claim_text"], image_path)
        except ValueError as exc:
            print(f"  ERROR — {exc}")
            results.append({**ex, "predicted_verdict": "ERROR", "correct": False})
            continue

        predicted = prediction["verdict"]
        correct = predicted == ex["correct_verdict"]
        status = "CORRECT" if correct else "WRONG"
        stability_note = f" [{prediction.get('stability', '?')}: {prediction.get('repeat_verdicts', [])}]"
        print(f"  Expected: {ex['correct_verdict']}  |  Predicted: {predicted}  |  {status}{stability_note}")
        if not correct:
            print(f"  Model explanation: {prediction.get('explanation', '')}")

        results.append({**ex, "predicted_verdict": predicted, "correct": correct})

    _print_summary(results)


def _print_summary(results: list) -> None:
    scored = [r for r in results if "predicted_verdict" in r]
    if not scored:
        print("\nNo scoreable results — fill in eval_set.json with real claims/images first.")
        return

    total = len(scored)
    correct = sum(1 for r in scored if r["correct"])
    print(f"\n=== OVERALL ACCURACY: {correct}/{total} ({100 * correct / total:.0f}%) ===")

    by_category = defaultdict(lambda: {"total": 0, "correct": 0, "confused_with": defaultdict(int)})
    for r in scored:
        cat = r["correct_verdict"]
        by_category[cat]["total"] += 1
        if r["correct"]:
            by_category[cat]["correct"] += 1
        else:
            by_category[cat]["confused_with"][r["predicted_verdict"]] += 1

    print("\nPer-category breakdown:")
    for cat, stats in by_category.items():
        acc = 100 * stats["correct"] / stats["total"]
        print(f"  {cat}: {stats['correct']}/{stats['total']} ({acc:.0f}%)")
        for wrong_pred, count in stats["confused_with"].items():
            print(f"      -> mistaken for '{wrong_pred}' {count}x")


if __name__ == "__main__":
    main()
