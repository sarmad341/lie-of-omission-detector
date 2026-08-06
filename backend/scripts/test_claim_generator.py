"""
Test the Claim Generator standalone, no API, using your real test images.

Usage:
    python scripts/test_claim_generator.py test_images/car1.jpg
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.claim_generator import generate_claim_from_evidence  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_claim_generator.py path/to/image.jpg [image2.jpg ...]")
        sys.exit(1)

    image_paths = sys.argv[1:]
    category = "car_insurance"

    print("--- Stage 1: describing evidence + identifying gaps ---")
    result = generate_claim_from_evidence(image_paths, category)
    print(json.dumps(result, indent=2))

    if result["questions"]:
        print("\n--- Simulating answers to the gap questions ---")
        qa_answers = [
            {"question": q, "answer": "This happened during a parking lot collision last week."}
            for q in result["questions"]
        ]
        print(json.dumps(qa_answers, indent=2))
    else:
        qa_answers = []

    print("\n--- Stage 2: drafting the claim ---")
    final = generate_claim_from_evidence(image_paths, category, qa_answers=qa_answers)
    print(json.dumps(final, indent=2))


if __name__ == "__main__":
    main()