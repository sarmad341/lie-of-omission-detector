import json
from schemas.case_schemas import TierResult
from models.router import get_completion
from pipeline.claim_generator import _parse_json

def run_tier_2_narrative(template_data: dict, vision_cache: list[dict], document_texts: list[str]) -> list[TierResult]:
    """
    Tier 2: Narrative Consistency
    Uses an LLM to determine if the user's textual narrative matches the physical evidence 
    and the police report.
    """
    results = []
    
    narrative = template_data.get("additional_information") or template_data.get("incident_circumstances")
    
    if not narrative:
        results.append(TierResult(
            tier=2, name="Narrative Consistency", passed=True, fatal=False,
            details="No narrative provided to check for consistency."
        ))
        return results
        
    unified_docs = "\n\n".join(document_texts)
    
    # Format vision cache neatly
    vision_text = ""
    if vision_cache:
        for idx, desc in enumerate(vision_cache):
            vision_text += f"Image {idx+1}:\n"
            vision_text += f"- Visible Regions: {', '.join(desc.get('visible_regions', []))}\n"
            vision_text += f"- Description: {desc.get('description', '')}\n\n"
    else:
        vision_text = "No image evidence provided."
        
    prompt = f"""You are an insurance claims verification assistant. Your job is to check if a claimant's narrative is logically and physically consistent with the available evidence.

Claimant's Narrative:
"{narrative}"

Physical Evidence (from Vision Models):
{vision_text}

Uploaded Documents (may contain Police Reports):
{unified_docs[:3000] if unified_docs else "No documents provided."}

Analyze the narrative against the physical evidence and documents. Does the narrative physically contradict the evidence? (e.g. they claim they were rear-ended, but damage is only on the front, or they claim it was stolen but the police report describes a collision).

Respond with ONLY valid JSON:
{{
    "passed": true/false,
    "fatal": true/false, // Set to true ONLY if there is a glaring, undeniable physical contradiction.
    "details": "A 1-sentence explanation of your finding."
}}
"""
    try:
        raw = get_completion(prompt)
        parsed = _parse_json(raw)
        
        passed = parsed.get("passed", True)
        fatal = parsed.get("fatal", False)
        details = parsed.get("details", "AI verification completed.")
        
        results.append(TierResult(
            tier=2, name="Narrative Consistency", passed=passed, fatal=fatal if not passed else False,
            details=details
        ))
    except Exception as e:
        results.append(TierResult(
            tier=2, name="Narrative Consistency", passed=False, fatal=False,
            details=f"Failed to run AI check: {e}"
        ))
        
    return results

def run_tier_2_image_relevance(template_data: dict, vision_cache: list[dict]) -> list[TierResult]:
    """
    Tier 2: Image Sub-Category Relevance
    Uses an LLM to check if the uploaded images actually depict what is expected for the given sub-category.
    """
    results = []
    
    if not vision_cache:
        return results
        
    category = template_data.get("category", "Car Insurance")
    sub_category = template_data.get("type", "legacy")
    
    vision_text = ""
    for idx, desc in enumerate(vision_cache):
        vision_text += f"Image {idx+1}:\n"
        vision_text += f"- Visible Regions: {', '.join(desc.get('visible_regions', []))}\n"
        vision_text += f"- Description: {desc.get('description', '')}\n\n"
        
    prompt = f"""You are an insurance fraud detection assistant. Your job is to check if the submitted image evidence is relevant to the claimed incident type.

Claim Category: {category}
Claim Sub-Category: {sub_category}

Physical Evidence (from Vision Models):
{vision_text}

Analyze the physical evidence. Do these images actually depict damage or evidence relevant to a '{sub_category}' claim? For example, if it's a collision claim, we expect to see vehicle damage. If it's a theft claim, we might see broken glass, police reports, or an empty parking spot. If the images are entirely irrelevant (e.g., a picture of a dog, a selfie, or a completely undamaged car when claiming collision), flag it as a failure.

Respond with ONLY valid JSON:
{{
    "passed": true/false, // True if the images are reasonably relevant to the sub-category
    "fatal": true/false, // True ONLY if the images are blatantly irrelevant (e.g., a meme or a selfie instead of evidence)
    "details": "A 1-sentence explanation."
}}
"""
    try:
        raw = get_completion(prompt)
        parsed = _parse_json(raw)
        
        passed = parsed.get("passed", True)
        fatal = parsed.get("fatal", False)
        details = parsed.get("details", "AI relevance verification completed.")
        
        results.append(TierResult(
            tier=2, name="Image Relevance Check", passed=passed, fatal=fatal if not passed else False,
            details=details
        ))
    except Exception as e:
        results.append(TierResult(
            tier=2, name="Image Relevance Check", passed=False, fatal=False,
            details=f"Failed to run AI check: {e}"
        ))
        
    return results

def run_tier_3_verification(template_data: dict, document_texts: list[str]) -> list[TierResult]:
    """
    Tier 3: Document Verification (specifically Receipts for Theft)
    """
    results = []
    
    sub_category = template_data.get("type", "legacy")
    
    if sub_category != "theft":
        return results
        
    stolen_articles = template_data.get("stolen_articles", [])
    if not stolen_articles:
        return results
        
    unified_docs = "\n\n".join(document_texts)
    if not unified_docs.strip():
        results.append(TierResult(
            tier=3, name="Receipt Verification", passed=False, fatal=False,
            details="Stolen articles listed, but no documents provided to verify them."
        ))
        return results
        
    articles_json = json.dumps(stolen_articles, indent=2)
    
    prompt = f"""You are an insurance claims verification assistant. Your job is to verify claimed stolen items against the uploaded receipts/invoices.

Claimed Stolen Articles:
{articles_json}

Uploaded Documents (Receipts/Invoices):
{unified_docs[:5000]}

For the stolen articles listed, do the uploaded documents substantiate them (i.e. do they show the purchase of these items at roughly the claimed value)? It does not need to be a perfect match, but it should be reasonable.

Respond with ONLY valid JSON:
{{
    "passed": true/false, // True if the receipts generally support the claimed items.
    "details": "A 1-sentence explanation of what was found or missing in the receipts."
}}
"""
    try:
        raw = get_completion(prompt)
        parsed = _parse_json(raw)
        
        passed = parsed.get("passed", True)
        details = parsed.get("details", "AI receipt verification completed.")
        
        results.append(TierResult(
            tier=3, name="Receipt Verification", passed=passed, fatal=False, # We don't block fatally on noisy receipt checks
            details=details
        ))
    except Exception as e:
        results.append(TierResult(
            tier=3, name="Receipt Verification", passed=False, fatal=False,
            details=f"Failed to run AI receipt check: {e}"
        ))
        
    return results
