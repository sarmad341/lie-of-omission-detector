from PIL import Image, ExifTags
from datetime import datetime

def extract_exif_date(image_path: str) -> datetime | None:
    """
    Extracts the DateTimeOriginal or DateTime from an image's EXIF data.
    Returns a datetime object if found and parsed successfully, otherwise None.
    """
    try:
        with Image.open(image_path) as img:
            exif = img.getexif()
            if not exif:
                return None
                
            # Iterate through all EXIF tags
            for tag_id, value in exif.items():
                tag = ExifTags.TAGS.get(tag_id, tag_id)
                # Look for standard datetime tags (36867 is DateTimeOriginal, 306 is DateTime)
                if tag in ('DateTimeOriginal', 'DateTime'):
                    if isinstance(value, str):
                        try:
                            # Standard EXIF date format: "YYYY:MM:DD HH:MM:SS"
                            return datetime.strptime(value.strip(), "%Y:%m:%d %H:%M:%S")
                        except ValueError:
                            pass
            return None
    except Exception as e:
        print(f"Warning: Failed to extract EXIF from {image_path}: {e}")
        return None
