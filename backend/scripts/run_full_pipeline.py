"""
End-to-end pipeline: document file (.txt, .pdf, or .docx) + a folder of
images -> per-claim verdict report.

Usage:
    python scripts/run_full_pipeline.py sample_documents/sample_claim_1.txt test_images
    python scripts/run_full_pipeline.py my_real_claim.pdf test_images

Note: this makes one model call per (claim x image) pair, with a small delay
between calls to stay under Groq's free-tier rate limit. With ~10 claims and
4 images that's ~40 calls — expect it to take a couple of minutes.
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.load_document import load_document_text  # noqa: E402
from pipeline.persistence import save_case  # noqa: E402
from pipeline.run_pipeline import run_pipeline  # noqa: E402


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/run_full_pipeline.py path/to/document.[txt|pdf|docx] path/to/images_folder")
        sys.exit(1)

    doc_path = sys.argv[1]
    images_folder = sys.argv[2]

    document_text = load_document_text(doc_path)

    image_paths = sorted(
        glob.glob(os.path.join(images_folder, "*.jpg"))
        + glob.glob(os.path.join(images_folder, "*.jpeg"))
        + glob.glob(os.path.join(images_folder, "*.png"))
    )

    if not image_paths:
        print(f"No images found in {images_folder}")
        sys.exit(1)

    print(f"Found {len(image_paths)} image(s): {[os.path.basename(p) for p in image_paths]}")
    print("Running pipeline...\n")

    result = run_pipeline(document_text, image_paths)

    print("\n" + "=" * 70)
    print("CLAIM-BY-CLAIM RESULTS")
    print("=" * 70)
    for c in result["claims_checked"]:
        print(f"\n[{c['claim_id']}] {c['claim_text']}")
        print(f"  Verdict: {c['final_verdict']}  (evidence: {c['evidence_image']}, confidence: {c['confidence']})")
        print(f"  Explanation: {c['explanation']}")
        print(f"  Per-image breakdown: {c['all_image_results']}")

    print("\n" + "=" * 70)
    print(f"Skipped {len(result['claims_skipped_administrative'])} administrative claim(s) (not visually checkable):")
    for c in result["claims_skipped_administrative"]:
        print(f"  - {c['claim_text']}")

    try:
        case_id = save_case(
            document_name=os.path.basename(doc_path),
            image_names=[os.path.basename(p) for p in image_paths],
            pipeline_result=result,
        )
        print(f"\nSaved to database as case: {case_id}")
    except RuntimeError as exc:
        print(f"\n(Not saved to database: {exc})")


if __name__ == "__main__":
    main()
