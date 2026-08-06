import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.extract_claims import extract_claims  # noqa: E402
from pipeline.contradiction_check import check_claim, check_claim_against_description  # noqa: E402
from pipeline.claim_generator import describe_evidence_image  # noqa: E402

VERDICT_PRIORITY = ["supported", "contradicted", "insufficient_evidence", "missing_expected_evidence"]
SECONDS_BETWEEN_CALLS = 1.5


def _aggregate(per_image_results: dict) -> dict:
    by_verdict: dict = {}
    for image_path, result in per_image_results.items():
        by_verdict.setdefault(result["verdict"], []).append((image_path, result))

    if "supported" in by_verdict and "contradicted" in by_verdict:
        supporting_images = [os.path.basename(p) for p, _ in by_verdict["supported"]]
        contradicting_images = [os.path.basename(p) for p, _ in by_verdict["contradicted"]]
        return {
            "final_verdict": "conflicting_evidence",
            "evidence_image": None,
            "explanation": (
                f"Evidence conflicts across images: {supporting_images} support this claim, "
                f"while {contradicting_images} appear to contradict it. Requires human review."
            ),
            "confidence": "low",
            "all_image_results": {
                os.path.basename(p): r["verdict"] for p, r in per_image_results.items()
            },
        }

    for verdict in VERDICT_PRIORITY:
        if verdict in by_verdict:
            image_path, result = by_verdict[verdict][0]
            return {
                "final_verdict": verdict,
                "evidence_image": os.path.basename(image_path),
                "explanation": result.get("explanation", ""),
                "confidence": result.get("confidence", ""),
                "all_image_results": {
                    os.path.basename(p): r["verdict"] for p, r in per_image_results.items()
                },
            }

    return {
        "final_verdict": "insufficient_evidence",
        "evidence_image": None,
        "explanation": "No definitive verdict from any image.",
        "confidence": "low",
        "all_image_results": {},
    }


from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"}


def _check_claims_against_images(
    checkable_claims: list,
    image_paths: list,
    category: str = "car_insurance",
    cached_descriptions: list[dict] = None,
    sub_category: str = None
) -> list:
    """Shared grounding loop — used by both run_pipeline() (old, extracts
    internally) and run_pipeline_from_claims() (new, uses already-confirmed
    claims from the staged wizard flow). Matches claims against cached or generated
    image descriptions (vision description runs exactly once per image).
    """
    report = []
    # Filter out any document files (.pdf, .docx, .txt) that might be in image_paths
    valid_image_paths = [p for p in image_paths if Path(p).suffix.lower() in IMAGE_EXTS]

    # 1. Fetch or generate description for each image (once per image)
    descriptions_by_path = {}
    cached_map = {d["filename"]: d for d in cached_descriptions if isinstance(d, dict) and "filename" in d} if cached_descriptions else {}

    for path in valid_image_paths:
        fname = os.path.basename(path)
        if fname in cached_map:
            print(f"  Using cached description for {fname}")
            descriptions_by_path[path] = cached_map[fname]
        else:
            print(f"  Generating description for {fname}...")
            try:
                desc = describe_evidence_image(path, category)
                desc["filename"] = fname
                descriptions_by_path[path] = desc
            except Exception as exc:
                descriptions_by_path[path] = {
                    "filename": fname,
                    "is_relevant": True,
                    "visible_regions": [],
                    "description": f"Could not analyze image: {exc}",
                    "not_visible": [],
                    "stability": "disagreed",
                    "raw_attempts": [],
                    "laterality_conflicts": [],
                }
            time.sleep(SECONDS_BETWEEN_CALLS)

    # 2. Check each claim against the descriptions
    total_calls = len(checkable_claims) * len(valid_image_paths)
    call_count = 0

    for claim in checkable_claims:
        per_image = {}
        for image_path in valid_image_paths:
            call_count += 1
            print(f"  [{call_count}/{total_calls}] text-checking '{claim['claim_text'][:50]}...' against {os.path.basename(image_path)}")
            desc = descriptions_by_path.get(image_path)
            
            # If the image was flagged as irrelevant to the category, treat as missing expected evidence
            if desc and not desc.get("is_relevant", True):
                per_image[image_path] = {
                    "verdict": "missing_expected_evidence",
                    "explanation": f"Image {os.path.basename(image_path)} is not relevant to {category}.",
                    "confidence": "low",
                }
            else:
                try:
                    result = check_claim_against_description(claim["claim_text"], desc, sub_category=sub_category)
                    per_image[image_path] = result
                except ValueError as exc:
                    per_image[image_path] = {
                        "verdict": "insufficient_evidence",
                        "explanation": f"Model error: {exc}",
                        "confidence": "low",
                    }
            time.sleep(SECONDS_BETWEEN_CALLS)

        aggregated = _aggregate(per_image)
        report.append({"claim_id": claim["id"], "claim_text": claim["claim_text"], **aggregated})

    return report


def run_pipeline(document_text: str, image_paths: list, category: str = "car_insurance") -> dict:
    """OLD entry point: extracts claims from raw text internally, then
    grounds them. Kept for backward compatibility with the existing
    POST /cases route and CLI scripts.
    """
    extraction_result = extract_claims(document_text, category=category)
    claims = extraction_result["claims"]
    checkable = [c for c in claims if c.get("is_visually_checkable")]
    skipped = [c for c in claims if not c.get("is_visually_checkable")]

    report = _check_claims_against_images(checkable, image_paths, category=category)
    return {"claims_checked": report, "claims_skipped_administrative": skipped}


def run_pipeline_from_claims(
    confirmed_claims: list,
    image_paths: list,
    category: str = "car_insurance",
    cached_descriptions: list[dict] = None,
    sub_category: str = None
) -> dict:
    """NEW entry point for the staged wizard flow: claims were already
    extracted AND confirmed/edited by the user in an earlier step.
    """
    checkable = [c for c in confirmed_claims if c.get("is_visually_checkable")]
    skipped = [c for c in confirmed_claims if not c.get("is_visually_checkable")]

    report = _check_claims_against_images(
        checkable,
        image_paths,
        category=category,
        cached_descriptions=cached_descriptions,
        sub_category=sub_category
    )
    return {"claims_checked": report, "claims_skipped_administrative": skipped}