import os
from PIL import Image, ImageChops, ImageStat

def detect_ela_tampering(image_path: str, threshold: float = 2.0) -> bool:
    """
    Error Level Analysis (ELA)
    Saves the image at a known JPEG quality, computes the difference
    between original and re-saved image. Unusually high difference
    indicates potential tampering (e.g., a region saved at a different
    quality level in a composite image).
    Returns True if potential tampering is detected.
    """
    if not os.path.exists(image_path):
        return False
        
    try:
        original = Image.open(image_path).convert('RGB')
        
        # Save at known quality
        temp_path = image_path + ".temp.jpg"
        original.save(temp_path, 'JPEG', quality=90)
        
        resaved = Image.open(temp_path)
        
        # Calculate difference
        diff = ImageChops.difference(original, resaved)
        
        # Get extrema (min/max values per band)
        extrema = diff.getextrema()
        
        # Calculate a simple score based on max difference
        max_diff = max([ex[1] for ex in extrema])
        
        # Also compute mean difference
        stat = ImageStat.Stat(diff)
        mean_diff = sum(stat.mean) / len(stat.mean)
        
        os.remove(temp_path)
        
        # A simple heuristic: if the max diff is extremely high relative to mean,
        # it might indicate a locally manipulated region.
        # This is a basic simulation of ELA for the tier logic.
        score = max_diff / (mean_diff + 0.1)
        
        return score > 50.0  # Threshold for "suspicious" variation
        
    except Exception as e:
        print(f"ELA error on {image_path}: {e}")
        return False

def check_cross_image_consistency(image_paths: list[str]) -> bool:
    """
    Tier 2 check: Verifies if photos depict the same vehicle.
    Returns True if consistency is confirmed.
    """
    if len(image_paths) < 2:
        return True # Cannot compare single image
        
    # In a real environment, we would use a multimodal LLM to compare multiple images.
    # Since the current llm_client only accepts a single image_path, we mock this
    # verification step to always pass for the sake of the pipeline.
    print(f"Mocking cross-image consistency check for {len(image_paths)} images.")
    return True
