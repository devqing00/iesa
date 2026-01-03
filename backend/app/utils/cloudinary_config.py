"""
Cloudinary Configuration for Image Uploads

Handles profile picture uploads and other image storage needs.
"""

import os
import cloudinary
import cloudinary.uploader
from typing import Optional

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)


def upload_profile_picture(file_data: bytes, user_id: str, file_extension: str = "jpg") -> Optional[str]:
    """
    Upload a profile picture to Cloudinary
    
    Args:
        file_data: The image file data as bytes
        user_id: The user's Firebase UID
        file_extension: File extension (jpg, png, etc.)
    
    Returns:
        The secure URL of the uploaded image, or None if upload fails
    """
    try:
        # Upload to Cloudinary with specific folder and public_id
        result = cloudinary.uploader.upload(
            file_data,
            folder="iesa/profile_pictures",
            public_id=f"user_{user_id}",
            overwrite=True,  # Replace existing image
            resource_type="image",
            transformation=[
                {"width": 400, "height": 400, "crop": "fill", "gravity": "face"},
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ]
        )
        
        return result.get("secure_url")
    except Exception as e:
        print(f"Error uploading to Cloudinary: {str(e)}")
        return None


def delete_profile_picture(user_id: str) -> bool:
    """
    Delete a profile picture from Cloudinary
    
    Args:
        user_id: The user's Firebase UID
    
    Returns:
        True if deletion was successful, False otherwise
    """
    try:
        public_id = f"iesa/profile_pictures/user_{user_id}"
        result = cloudinary.uploader.destroy(public_id)
        return result.get("result") == "ok"
    except Exception as e:
        print(f"Error deleting from Cloudinary: {str(e)}")
        return False
