"""
User Profile Router

Handles user profile CRUD operations.
Users are persistent across sessions.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request, File, UploadFile
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.models.user import User, UserCreate, UserUpdate, UserInDB
from app.db import get_database
from app.core.security import verify_token, get_current_user
from app.core.permissions import require_permission

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.post("/", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_or_update_user_profile(
    user_data: UserCreate,
    token_data: dict = Depends(verify_token)
):
    """
    Create or update user profile after Firebase authentication.
    
    This endpoint is called by the frontend immediately after
    Firebase authentication succeeds to sync user data to MongoDB.
    """
    db = get_database()
    users = db["users"]
    
    # Verify Firebase UID matches
    if user_data.firebaseUid != token_data.get("uid"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Firebase UID mismatch"
        )
    
    # Check if user already exists
    existing_user = await users.find_one({"firebaseUid": user_data.firebaseUid})
    
    if existing_user:
        # Update existing user
        update_data = user_data.model_dump(exclude={"firebaseUid"})
        update_data["updatedAt"] = datetime.utcnow()
        
        await users.update_one(
            {"firebaseUid": user_data.firebaseUid},
            {"$set": update_data}
        )
        
        updated_user = await users.find_one({"firebaseUid": user_data.firebaseUid})
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated user"
            )
        updated_user["_id"] = str(updated_user["_id"])
        
        return User(**updated_user)
    
    else:
        # Create new user
        user_dict = user_data.model_dump()
        user_dict["createdAt"] = datetime.utcnow()
        user_dict["updatedAt"] = datetime.utcnow()
        user_dict["lastLogin"] = datetime.utcnow()
        user_dict["isActive"] = True
        user_dict["hasCompletedOnboarding"] = False  # New field
        
        result = await users.insert_one(user_dict)
        created_user = await users.find_one({"_id": result.inserted_id})
        if not created_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created user"
            )
        created_user["_id"] = str(created_user["_id"])
        
        # Auto-enroll in active session if student
        if user_data.role == "student":
            await auto_enroll_in_active_session(str(created_user["_id"]), db)
        
        return User(**created_user)


async def auto_enroll_in_active_session(user_id: str, db):
    """
    Automatically enroll a new student in the active session.
    This ensures students immediately have access to current data.
    """
    sessions = db["sessions"]
    enrollments = db["enrollments"]
    
    # Get active session
    active_session = await sessions.find_one({"isActive": True})
    
    if active_session:
        # Create enrollment
        enrollment_data = {
            "studentId": user_id,
            "sessionId": str(active_session["_id"]),
            "level": "100L",  # Default level, can be updated later
            "enrollmentDate": datetime.utcnow(),
            "isActive": True
        }
        
        await enrollments.insert_one(enrollment_data)


@router.get("/me", response_model=User)
async def get_my_profile(user: dict = Depends(get_current_user)):
    """
    Get the current authenticated user's profile.
    This is called by frontend after login to fetch enriched user data.
    """
    return User(**user)


@router.get("/me/permissions")
async def get_my_permissions(user: dict = Depends(get_current_user)):
    """
    Get the current user's permissions for the active session.
    Frontend uses this to enable/disable UI elements.
    
    Returns:
        {
            "permissions": ["announcement:create", "event:manage", ...],
            "session_id": "...",
            "session_name": "2024/2025"
        }
    """
    from app.core.permissions import get_user_permissions, get_current_session
    
    db = get_database()
    sessions = db["sessions"]
    
    # Get active session
    active_session = await sessions.find_one({"isActive": True})
    if not active_session:
        return {
            "permissions": [],
            "session_id": None,
            "session_name": None,
            "message": "No active session"
        }
    
    # Get permissions for active session
    permissions = await get_user_permissions(
        str(user["_id"]),
        str(active_session["_id"])
    )
    
    return {
        "permissions": permissions,
        "session_id": str(active_session["_id"]),
        "session_name": active_session.get("name"),
        "is_admin": user.get("role") == "admin"
    }


@router.patch("/me", response_model=User)
async def update_my_profile(
    profile_update: UserUpdate,
    user: dict = Depends(get_current_user)
):
    """
    Update the current user's profile.
    Users can only update their own profiles.
    """
    db = get_database()
    users = db["users"]
    
    update_data = profile_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updatedAt"] = datetime.utcnow()
    
    await users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": update_data}
    )
    
    updated_user = await users.find_one({"_id": ObjectId(user["_id"])})
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated user"
        )
    updated_user["_id"] = str(updated_user["_id"])
    
    return User(**updated_user)


@router.post("/me/profile-picture", response_model=User)
async def upload_profile_picture(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """
    Upload or update the current user's profile picture.
    Image is uploaded to Cloudinary and URL is saved in MongoDB.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Validate file size (max 2MB to stay within Cloudinary free tier)
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size must be less than 2MB"
        )
    
    try:
        from app.utils.cloudinary_config import upload_profile_picture
        
        # Upload to Cloudinary
        file_extension = file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'jpg'
        image_url = upload_profile_picture(content, user["firebaseUid"], file_extension)
        
        if not image_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload image to cloud storage"
            )
        
        # Update user profile with new image URL
        db = get_database()
        users = db["users"]
        
        await users.update_one(
            {"_id": ObjectId(user["_id"])},
            {
                "$set": {
                    "profilePictureUrl": image_url,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        # Return updated user profile
        updated_user = await users.find_one({"_id": ObjectId(user["_id"])})
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated user"
            )
        updated_user["_id"] = str(updated_user["_id"])
        
        return User(**updated_user)
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error uploading profile picture: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile picture: {str(e)}"
        )


@router.get("/", response_model=List[User])
async def list_users(
    role: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(require_permission("user:view"))
):
    """
    List all users with optional filtering.
    Only admins and excos can view user lists.
    """
    db = get_database()
    users = db["users"]
    
    query = {}
    if role:
        query["role"] = role
    
    cursor = users.find(query).skip(skip).limit(limit)
    user_list = await cursor.to_list(length=limit)
    
    return [
        User(**{**u, "_id": str(u["_id"])})
        for u in user_list
    ]


@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific user's profile.
    Users can view any profile (for team pages, etc.)
    """
    db = get_database()
    users = db["users"]
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    user = await users.find_one({"_id": ObjectId(user_id)})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    user["_id"] = str(user["_id"])
    return User(**user)


@router.patch("/{user_id}/role", response_model=User)
async def update_user_role(
    user_id: str,
    new_role: str,
    admin_user: dict = Depends(require_permission("user:edit_role"))
):
    """
    Update a user's role (student/exco/admin).
    Requires user:edit_role permission.
    """
    db = get_database()
    users = db["users"]
    
    if new_role not in ["student", "exco", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'student', 'exco', or 'admin'"
        )
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Update role
    update_data = {
        "role": new_role,
        "updatedAt": datetime.utcnow()
    }
    
    result = await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    updated_user = await users.find_one({"_id": ObjectId(user_id)})
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated user"
        )
    updated_user["_id"] = str(updated_user["_id"])
    
    return User(**updated_user)


@router.patch("/{user_id}/academic-info", response_model=User)
async def update_user_academic_info(
    user_id: str,
    admission_year: Optional[int] = None,
    current_level: Optional[str] = None,
    admin_user: dict = Depends(require_permission("user:edit_academic"))
):
    """
    Update a user's academic information (admission year, current level).
    Requires user:edit_academic permission.
    
    This is separate from profile updates to prevent students from changing their level.
    """
    db = get_database()
    users = db["users"]
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    update_data = {}
    
    if admission_year is not None:
        if admission_year < 2000 or admission_year > 2030:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admission year must be between 2000 and 2030"
            )
        update_data["admissionYear"] = admission_year
    
    if current_level is not None:
        if current_level not in ["100L", "200L", "300L", "400L", "500L"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current level must be one of: 100L, 200L, 300L, 400L, 500L"
            )
        update_data["currentLevel"] = current_level
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updatedAt"] = datetime.utcnow()
    
    result = await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    updated_user = await users.find_one({"_id": ObjectId(user_id)})
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated user"
        )
    updated_user["_id"] = str(updated_user["_id"])
    
    return User(**updated_user)
