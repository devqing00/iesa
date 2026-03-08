"""
User Profile Router

Handles user profile CRUD operations.
Users are persistent across sessions.
"""

import re

from fastapi import APIRouter, HTTPException, Depends, status, Request, File, UploadFile
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.user import User, UserCreate, UserUpdate, UserInDB
from app.db import get_database
from app.core.security import verify_token, get_current_user
from app.core.permissions import require_permission
from app.core.audit import audit_user_role_change, AuditLogger
from app.core.auth import verify_password, async_verify_password
from app.core.error_handling import safe_detail

router = APIRouter(prefix="/api/v1/users", tags=["Users"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/", response_model=User, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_or_update_user_profile(
    request: Request,
    user_data: UserCreate,
    token_data: dict = Depends(verify_token)
):
    """
    Create or update user profile after authentication.
    
    Rate limited to prevent spam account creation.
    This endpoint is called by the frontend to sync/update user data in MongoDB.
    With in-app auth, the user is already created at /auth/register,
    so this mainly handles profile updates and legacy data linking.
    """
    db = get_database()
    users = db["users"]
    
    user_id = token_data.get("sub")
    
    # Check if user already exists by _id (normal flow after auth)
    existing_user = await users.find_one({"_id": ObjectId(user_id)})
    
    if existing_user:
        # Update existing user profile
        update_data = user_data.model_dump(exclude={"password", "firebaseUid"}, exclude_none=True)
        update_data["updatedAt"] = datetime.now(timezone.utc)
        update_data["lastLogin"] = datetime.now(timezone.utc)
        
        # Sync isExternalStudent when department changes
        if "department" in update_data:
            update_data["isExternalStudent"] = update_data["department"] != "Industrial Engineering"
        
        await users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        updated_user = await users.find_one({"_id": ObjectId(user_id)})
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated user"
            )
        updated_user["_id"] = str(updated_user["_id"])
        
        return User(**updated_user)
    
    # User not found by _id — should not happen with in-app auth
    # (user is created at /auth/register before getting a token)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found. Please register first."
    )


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
        session_id = str(active_session["_id"])
        # Guard against duplicates — check both field name variants
        existing = await enrollments.find_one({
            "$or": [
                {"studentId": user_id, "sessionId": session_id},
                {"userId": user_id, "sessionId": session_id},
            ]
        })
        if not existing:
            enrollment_data = {
                "studentId": user_id,
                "sessionId": session_id,
                "level": "100L",  # Default level, can be updated later
                "enrollmentDate": datetime.now(timezone.utc),
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
    from app.core.permissions import get_user_permissions
    
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
    
    # Get actual permissions for the user's assigned role in this session.
    # This respects the RBAC system: super_admin gets all, admin/exco get
    # only the permissions their position grants via DEFAULT_PERMISSIONS + overrides.
    permissions = await get_user_permissions(
        str(user["_id"]),
        str(active_session["_id"])
    )
    
    return {
        "permissions": permissions,
        "session_id": str(active_session["_id"]),
        "session_name": active_session.get("name"),
        "is_admin": user.get("role") in ("admin", "exco")
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
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    # Sync isExternalStudent when department changes
    if "department" in update_data:
        update_data["isExternalStudent"] = update_data["department"] != "Industrial Engineering"
    
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
@limiter.limit("5/minute")
async def upload_profile_picture(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """
    Upload or update the current user's profile picture.
    Image is uploaded to Cloudinary and URL is saved in MongoDB.
    
    Rate limited to prevent abuse of image storage.
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
        
        # Upload to Cloudinary (async — does not block the event loop)
        file_extension = file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'jpg'
        image_url = await upload_profile_picture(content, user["_id"], file_extension)
        
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
                    "updatedAt": datetime.now(timezone.utc)
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_detail("Failed to upload profile picture", e)
        )


@router.get("/")
async def list_users(
    role: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(require_permission("user:view_all"))
):
    """
    List all users with optional filtering and search.
    Only admins and excos can view user lists.
    Returns {items, total} for server-side pagination.
    """
    db = get_database()
    users = db["users"]
    
    query = {}
    if role and role != "all":
        query["role"] = role
    if department and department != "all":
        if department == "external":
            query["isExternalStudent"] = True
        elif department == "ipe":
            query["department"] = "Industrial Engineering"
        else:
            query["department"] = department
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"firstName": {"$regex": escaped, "$options": "i"}},
            {"lastName": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
        ]
    
    total = await users.count_documents(query)
    cursor = users.find(query, {"passwordHash": 0}).skip(skip).limit(limit)
    user_list = await cursor.to_list(length=limit)
    
    return {
        "items": [
            User(**{**u, "_id": str(u["_id"])})
            for u in user_list
        ],
        "total": total
    }


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
    
    user = await users.find_one({"_id": ObjectId(user_id)}, {"passwordHash": 0})
    
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
    request: Request,
    admin_user: dict = Depends(require_permission("user:edit_role"))
):
    """
    Update a user's role (student/exco/admin).
    Requires user:edit_role permission.
    
    This action is audited for security compliance.
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
    
    # Get current user data for audit trail
    target_user = await users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    old_role = target_user.get("role", "student")
    
    # Update role
    update_data = {
        "role": new_role,
        "updatedAt": datetime.now(timezone.utc)
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
    
    # Audit log the role change
    await audit_user_role_change(
        actor_id=admin_user["_id"],
        actor_email=admin_user.get("email", "unknown"),
        target_user_id=user_id,
        old_role=old_role,
        new_role=new_role,
        ip_address=request.client.host if request.client else None
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
    request: Request,
    admission_year: Optional[int] = None,
    current_level: Optional[str] = None,
    admin_user: dict = Depends(require_permission("user:edit_academic"))
):
    """
    Update a user's academic information (admission year, current level).
    Requires user:edit_academic permission.
    
    This is separate from profile updates to prevent students from changing their level.
    This action is audited for security compliance.
    """
    db = get_database()
    users = db["users"]
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    target_user = await users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    update_data = {}
    old_values = {}
    
    if admission_year is not None:
        if admission_year < 2000 or admission_year > 2030:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admission year must be between 2000 and 2030"
            )
        old_values["admissionYear"] = target_user.get("admissionYear")
        update_data["admissionYear"] = admission_year
    
    if current_level is not None:
        if current_level not in ["100L", "200L", "300L", "400L", "500L"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current level must be one of: 100L, 200L, 300L, 400L, 500L"
            )
        old_values["currentLevel"] = target_user.get("currentLevel")
        update_data["currentLevel"] = current_level
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    result = await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    # Audit log
    await AuditLogger.log(
        action="user.academic_info_updated",
        actor_id=admin_user["_id"],
        actor_email=admin_user.get("email", "unknown"),
        resource_type="user",
        resource_id=user_id,
        details={
            "target_email": target_user.get("email"),
            "old_values": old_values,
            "new_values": {k: v for k, v in update_data.items() if k != "updatedAt"},
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    updated_user = await users.find_one({"_id": ObjectId(user_id)})
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated user"
        )
    updated_user["_id"] = str(updated_user["_id"])
    
    return User(**updated_user)


@router.patch("/{user_id}/status", response_model=User)
async def toggle_user_status(
    user_id: str,
    is_active: bool,
    request: Request,
    admin_user: dict = Depends(require_permission("user:edit"))
):
    """
    Toggle a user's active/inactive status.
    Requires user:edit permission.
    
    This action is audited for security compliance.
    """
    db = get_database()
    users = db["users"]
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    target_user = await users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    # Prevent deactivating yourself
    if str(target_user["_id"]) == str(admin_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own active status"
        )
    
    old_status = target_user.get("isActive", True)
    
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"isActive": is_active, "updatedAt": datetime.now(timezone.utc)}}
    )
    
    # Audit log
    await AuditLogger.log(
        action="user.status_changed",
        actor_id=admin_user["_id"],
        actor_email=admin_user.get("email", "unknown"),
        resource_type="user",
        resource_id=user_id,
        details={
            "target_email": target_user.get("email"),
            "old_status": old_status,
            "new_status": is_active,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    updated_user = await users.find_one({"_id": ObjectId(user_id)})
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated user"
        )
    updated_user["_id"] = str(updated_user["_id"])
    
    return User(**updated_user)


# ──────────────────────────────────────────────
# NOTIFICATION CHANNEL PREFERENCE
# ──────────────────────────────────────────────

from pydantic import BaseModel as PydanticBaseModel
from typing import Literal as LiteralType

class NotificationChannelRequest(PydanticBaseModel):
    preference: LiteralType["email", "in_app", "both"]

@router.patch("/me/notification-channel")
async def update_notification_channel(
    data: NotificationChannelRequest,
    user: dict = Depends(get_current_user),
):
    """
    Update notification delivery channel preference.
    Options: "email" (email only), "in_app" (in-app only), "both" (both channels).
    """
    db = get_database()
    users = db["users"]

    await users.update_one(
        {"_id": ObjectId(user["_id"])},
        {
            "$set": {
                "notificationChannelPreference": data.preference,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )

    return {
        "message": f"Notification channel updated to '{data.preference}'.",
        "notificationChannelPreference": data.preference
    }


# ──────────────────────────────────────────────
# NOTIFICATION CATEGORY PREFERENCES
# ──────────────────────────────────────────────

from app.core.notification_utils import VALID_NOTIFICATION_CATEGORIES, DEFAULT_NOTIFICATION_CATEGORIES

class NotificationCategoryRequest(PydanticBaseModel):
    category: str
    enabled: bool

class NotificationCategoriesBulkRequest(PydanticBaseModel):
    categories: dict  # {"announcements": True, "payments": False, ...}

@router.patch("/me/notification-categories")
async def update_notification_category(
    data: NotificationCategoryRequest,
    user: dict = Depends(get_current_user),
):
    """
    Toggle a single notification category on or off.
    Valid categories: announcements, payments, events, timetable, academic, mentoring.
    """
    if data.category not in VALID_NOTIFICATION_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{data.category}'. Valid: {sorted(VALID_NOTIFICATION_CATEGORIES)}",
        )

    db = get_database()
    user_doc = await db.users.find_one({"_id": ObjectId(user["_id"])}, {"notificationCategories": 1})
    current = user_doc.get("notificationCategories") or dict(DEFAULT_NOTIFICATION_CATEGORIES)
    current[data.category] = data.enabled

    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"notificationCategories": current, "updatedAt": datetime.now(timezone.utc)}},
    )

    return {"message": f"Category '{data.category}' set to {data.enabled}", "notificationCategories": current}


@router.put("/me/notification-categories")
async def set_all_notification_categories(
    data: NotificationCategoriesBulkRequest,
    user: dict = Depends(get_current_user),
):
    """
    Set all notification category preferences at once.
    Accepts a dict of {category: bool} pairs.
    """
    for cat in data.categories:
        if cat not in VALID_NOTIFICATION_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category '{cat}'. Valid: {sorted(VALID_NOTIFICATION_CATEGORIES)}",
            )
    # Merge with defaults so missing categories remain True
    merged = dict(DEFAULT_NOTIFICATION_CATEGORIES)
    merged.update(data.categories)

    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"notificationCategories": merged, "updatedAt": datetime.now(timezone.utc)}},
    )

    return {"message": "Notification categories updated", "notificationCategories": merged}


@router.get("/me/notification-categories")
async def get_notification_categories(
    user: dict = Depends(get_current_user),
):
    """Get the user's current notification category preferences."""
    db = get_database()
    user_doc = await db.users.find_one({"_id": ObjectId(user["_id"])}, {"notificationCategories": 1})
    cats = user_doc.get("notificationCategories") if user_doc else None
    return {"notificationCategories": cats or dict(DEFAULT_NOTIFICATION_CATEGORIES)}


# ──────────────────────────────────────────────
# ACCOUNT DELETION
# ──────────────────────────────────────────────

class DeleteAccountRequest(PydanticBaseModel):
    password: str

@router.delete("/me")
async def delete_account(
    data: DeleteAccountRequest,
    user: dict = Depends(get_current_user),
):
    """
    Permanently delete the current user's account and all associated data.
    Requires password confirmation.
    
    Deletes:
    - User document
    - All enrollments
    - All notifications
    - All refresh tokens
    - All bank transfers
    """
    db = get_database()
    users = db["users"]
    user_id = str(user["_id"])

    # Verify password
    user_doc = await users.find_one({"_id": ObjectId(user_id)})
    if not user_doc or not user_doc.get("passwordHash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot verify identity"
        )

    if not await async_verify_password(data.password, user_doc["passwordHash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )

    # Delete associated data — cast wide to remove all orphaned docs
    await db["enrollments"].delete_many({"studentId": user_id})
    await db["notifications"].delete_many({"userId": user_id})
    await db["refresh_tokens"].delete_many({"userId": user_id})
    await db["bankTransfers"].delete_many({"studentId": user_id})
    await db["growth_data"].delete_many({"userId": user_id})
    await db["ai_rate_limits"].delete_many({"userId": user_id})
    await db["roles"].delete_many({"userId": user_id})
    await db["unit_applications"].delete_many({"userId": user_id})
    await db["paystackTransactions"].update_many(
        {"studentId": user_id},
        {"$set": {"studentName": "[deleted]", "studentEmail": "[deleted]"}},
    )

    # Remove user from study group memberships (don't delete the groups)
    await db["study_groups"].update_many(
        {"members.userId": user_id},
        {"$pull": {"members": {"userId": user_id}}},
    )

    # Delete the user
    await users.delete_one({"_id": ObjectId(user_id)})

    return {"message": "Account deleted successfully"}