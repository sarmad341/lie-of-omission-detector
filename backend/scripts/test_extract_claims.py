"""
Test claim extraction on a sample document.

Usage:
    python scripts/test_extract_claims.py sample_documents/sample_claim_1.txt
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.extract_claims import extract_claims  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_extract_claims.py path/to/document.txt")
        sys.exit(1)

    doc_path = sys.argv[1]
    if not os.path.exists(doc_path):
        print(f"File not found: {doc_path}")
        sys.exit(1)

    with open(doc_path, "r", encoding="utf-8") as f:
        document_text = f.read()

    print("--- DOCUMENT TEXT ---")
    print(document_text)
    print("\n--- EXTRACTING CLAIMS ---\n")

    claims = extract_claims(document_text)

    print(json.dumps(claims, indent=2))

    checkable = [c for c in claims if c.get("is_visually_checkable")]
    print(f"\nExtracted {len(claims)} claim(s) total, {len(checkable)} visually checkable.")


if __name__ == "__main__":
    main()
