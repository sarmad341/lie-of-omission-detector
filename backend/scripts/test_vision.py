"""
Step 1 smoke test: confirm the free-tier Groq vision model can take an image
+ a written claim and return a structured lie-of-omission verdict.

No database, no API server, no frontend — just prove the core reasoning
works before building anything else on top of it.

Usage:
    python scripts/test_vision.py path/to/test_image.jpg
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.router import get_completion  # noqa: E402

CLAIM = "The customer's vehicle sustained severe damage to the left rear door during the accident."

PROMPT = f"""You are reviewing a compliance claim against a photograph.

Claim: "{CLAIM}"

Step 1 - Describe: List every part of the vehicle visible in the image, and
note which common vehicle regions (front, rear, left side, right side, roof,
doors) are NOT visible in frame.

Step 2 - Judge: Based ONLY on your description above, decide exactly one of:
- "supported": the claimed detail's region is visible and matches the claim
- "contradicted": the claimed detail's region IS visible but does not match
- "missing_expected_evidence": the region the claim refers to is not visible at all
- "insufficient_evidence": the region is visible but too unclear/partial to judge confidently

If the relevant region is not in frame, you MUST answer "missing_expected_evidence" —
do not guess supported or contradicted.

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{"description": "...", "verdict": "...", "explanation": "...", "confidence": "high|medium|low"}}
"""


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_vision.py path/to/image.jpg")
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(f"Image not found: {image_path}")
        sys.exit(1)

    print(f"Sending claim + image to provider chain...\nClaim: {CLAIM}\n")
    raw = get_completion(PROMPT, image_path=image_path)

    print("--- RAW MODEL OUTPUT ---")
    print(raw)

    try:
        # Models sometimes wrap JSON in ```json fences despite instructions — strip if present.
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned)
        print("\n--- PARSED ---")
        print(json.dumps(parsed, indent=2))
    except json.JSONDecodeError:
        print("\n(Could not parse as JSON — may need a stricter prompt or json_object response mode.)")


if __name__ == "__main__":
    main()
