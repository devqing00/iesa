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
        user_id: The user's ID
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
        user_id: The user's ID
    
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


def upload_transfer_receipt(file_data: bytes, transfer_id: str, file_extension: str = "jpg") -> Optional[str]:
    """
    Upload a bank transfer receipt image to Cloudinary.
    
    Args:
        file_data: The image file data as bytes
        transfer_id: The transfer submission ID
        file_extension: File extension
    
    Returns:
        The secure URL of the uploaded image, or None if upload fails
    """
    try:
        result = cloudinary.uploader.upload(
            file_data,
            folder="iesa/transfer_receipts",
            public_id=f"transfer_{transfer_id}",
            overwrite=True,
            resource_type="image",
            transformation=[
                {"width": 1200, "height": 1600, "crop": "limit"},
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ]
        )
        return result.get("secure_url")
    except Exception as e:
        print(f"Error uploading transfer receipt to Cloudinary: {str(e)}")
        return None


def upload_press_cover(file_data: bytes, article_id: str, file_extension: str = "jpg") -> Optional[str]:
    """
    Upload a press article cover image to Cloudinary.
    
    Args:
        file_data: The image file data as bytes
        article_id: The press article ID (or a temporary slug)
        file_extension: File extension
    
    Returns:
        The secure URL of the uploaded image, or None if upload fails
    """
    try:
        result = cloudinary.uploader.upload(
            file_data,
            folder="iesa/press_covers",
            public_id=f"cover_{article_id}",
            overwrite=True,
            resource_type="image",
            transformation=[
                {"width": 1600, "height": 900, "crop": "limit"},
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ]
        )
        return result.get("secure_url")
    except Exception as e:
        print(f"Error uploading press cover to Cloudinary: {str(e)}")
        return None
