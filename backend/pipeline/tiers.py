import os
from datetime import datetime
from schemas.case_schemas import TierResult

def _parse_date(date_str: str):
    """Attempt to parse date strings of various common formats."""
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            pass
    return None

def run_tier_0(case_dict: dict, image_paths: list[str], document_paths: list[str]) -> list[TierResult]:
    """
    Tier 0: Submission Integrity
    - Required fields present (basic check)
    - Files not corrupt (valid extensions)
    """
    results = []
    
    # 1. File validation
    if not image_paths and not document_paths:
        results.append(TierResult(
            tier=0, name="File Submission", passed=False, fatal=True,
            details="No evidence images or documents were submitted."
        ))
        return results
    
    valid_exts = {".jpg", ".jpeg", ".png", ".pdf", ".docx", ".txt"}
    invalid_files = []
    for path in image_paths + document_paths:
        ext = os.path.splitext(path)[1].lower()
        if ext not in valid_exts:
            invalid_files.append(os.path.basename(path))
            
    if invalid_files:
        results.append(TierResult(
            tier=0, name="File Integrity", passed=False, fatal=True,
            details=f"Invalid or unsupported file types: {', '.join(invalid_files)}"
        ))
    else:
        results.append(TierResult(
            tier=0, name="File Integrity", passed=True,
            details=f"Received {len(image_paths)} images and {len(document_paths)} documents."
        ))
        
    return results

def run_tier_1(template_data: dict, vision_cache: list[dict], image_paths: list[str] = None) -> list[TierResult]:
    """
    Tier 1: Deterministic Business Rules
    - Policy-period date checks
    - Point-of-impact cross-check
    - Sub-category hard gates (e.g. theft requires a police report)
    """
    results = []
    if not template_data:
        return results
        
    sub_category = template_data.get("type", "legacy")
    
    # 1. Date Validation
    incident_date_str = template_data.get("incident_date")
    incident_date_dt = None
    if incident_date_str:
        dt = _parse_date(incident_date_str)
        if dt:
            incident_date_dt = dt
            if dt > datetime.now():
                results.append(TierResult(
                    tier=1, name="Date Validity", passed=False, fatal=True,
                    details=f"Incident date ({incident_date_str}) cannot be in the future."
                ))
            else:
                results.append(TierResult(
                    tier=1, name="Date Validity", passed=True,
                    details=f"Incident date ({incident_date_str}) is valid."
                ))
        else:
            # If it's a completely free-text date that we can't parse, we pass it for human review
            results.append(TierResult(
                tier=1, name="Date Validity", passed=True,
                details=f"Could not automatically parse date: {incident_date_str}. Assuming valid."
            ))
            
    # 1.5 EXIF Verification
    if incident_date_dt and image_paths:
        from pipeline.exif_utils import extract_exif_date
        
        oldest_exif_dt = None
        for path in image_paths:
            exif_dt = extract_exif_date(path)
            if exif_dt:
                if not oldest_exif_dt or exif_dt < oldest_exif_dt:
                    oldest_exif_dt = exif_dt
                    
        if oldest_exif_dt:
            time_diff = incident_date_dt - oldest_exif_dt
            if time_diff.total_seconds() > 86400:  # 24 hours
                results.append(TierResult(
                    tier=1, name="EXIF Verification", passed=False, fatal=True,
                    details=f"Fraud Alert: Image EXIF metadata indicates a photo was taken on {oldest_exif_dt.strftime('%Y-%m-%d %H:%M')}, which is prior to the declared incident date ({incident_date_str})."
                ))
            else:
                results.append(TierResult(
                    tier=1, name="EXIF Verification", passed=True,
                    details=f"EXIF timestamps align with or post-date the incident ({incident_date_str})."
                ))
        else:
            results.append(TierResult(
                tier=1, name="EXIF Verification", passed=True,
                details="No EXIF datetime data found in provided images. Skipping cross-check."
            ))

    # 1.6 Timing Heuristic
    policy_inception_str = template_data.get("policy_inception_date")
    if policy_inception_str and incident_date_dt:
        inception_dt = _parse_date(policy_inception_str)
        if inception_dt:
            diff_days = (incident_date_dt - inception_dt).days
            if diff_days <= 30:
                results.append(TierResult(
                    tier=1, name="Timing Heuristic", passed=False, fatal=False,
                    details=f"Incident occurred within {diff_days} days of policy inception. Flagged for review."
                ))
            else:
                results.append(TierResult(
                    tier=1, name="Timing Heuristic", passed=True,
                    details=f"Incident occurred {diff_days} days after policy inception (safe threshold)."
                ))

    # 1.7 Cost Plausibility
    estimated_cost = template_data.get("estimated_repair_cost")
    if estimated_cost:
        try:
            # Assuming cost is a numeric string like "1500" or "$1500"
            import re
            cost_val = float(re.sub(r'[^\d.]', '', estimated_cost))
            # Static plausibility band: e.g., flag if > 15000 for standard auto claims
            if cost_val > 15000:
                results.append(TierResult(
                    tier=1, name="Cost Plausibility", passed=False, fatal=False,
                    details=f"Estimated cost (${cost_val}) exceeds the plausibility band of $15000. Flagged for review."
                ))
            else:
                results.append(TierResult(
                    tier=1, name="Cost Plausibility", passed=True,
                    details=f"Estimated cost (${cost_val}) is within the plausibility band."
                ))
        except ValueError:
            pass
            
    # 2. Sub-Category Hard Gates
    if sub_category == "theft":
        police_report = template_data.get("police_report_number")
        if not police_report:
            results.append(TierResult(
                tier=1, name="Police Report Requirement", passed=False, fatal=True,
                details="A valid Police Report Number is strictly required for Theft claims."
            ))
        else:
            results.append(TierResult(
                tier=1, name="Police Report Requirement", passed=True,
                details=f"Police report number provided: {police_report}"
            ))
            
    # 3. Point of Impact Check (Collision)
    if sub_category == "collision":
        declared_impact = template_data.get("point_of_impact")
        if declared_impact:
            declared_lower = declared_impact.lower().strip()
            if declared_lower in ["", "none", "n/a", "not provided", "unknown", "unspecified"]:
                results.append(TierResult(
                    tier=1, name="Point of Impact Check", passed=True,
                    details="Point of impact not provided in the document. Skipping cross-check."
                ))
            else:
                # Aggregate all visible damaged regions from the vision cache
                all_visible_regions = []
                for desc in (vision_cache or []):
                    all_visible_regions.extend(desc.get("visible_regions", []))
                    
                all_visible_regions = [r.lower() for r in all_visible_regions]
                
                if declared_lower != "multiple":
                    if any(declared_lower in region for region in all_visible_regions):
                        results.append(TierResult(
                            tier=1, name="Point of Impact Check", passed=True,
                            details=f"Declared impact ({declared_impact}) is consistent with vision analysis."
                        ))
                    else:
                        if not vision_cache:
                            results.append(TierResult(
                                tier=1, name="Point of Impact Check", passed=False, fatal=False,
                                details=f"Declared impact ({declared_impact}) could not be verified because no vision analysis is available."
                            ))
                        else:
                            results.append(TierResult(
                                tier=1, name="Point of Impact Check", passed=False, fatal=True,
                                details=f"Declared impact ({declared_impact}) does NOT match regions found in evidence ({', '.join(set(all_visible_regions))})."
                            ))
                else:
                    results.append(TierResult(
                        tier=1, name="Point of Impact Check", passed=True,
                        details="Declared impact is 'Multiple'. Requires human or further AI verification."
                    ))
                
    return results
