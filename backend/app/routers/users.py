"""
User Profile Router

Handles user profile CRUD operations.
Users are persistent across sessions.
"""

import re

from fastapi import APIRouter, HTTPException, Depends, status, Request, File, UploadFile, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import date, datetime, timedelta, timezone
from bson import ObjectId
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.user import User, UserCreate, UserUpdate, UserInDB
from app.db import get_database
from app.core.security import verify_token, get_current_user
from app.core.permissions import require_permission
from app.core.audit import audit_user_role_change, AuditLogger
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
        update_data = user_data.model_dump(exclude={"firebaseUid"}, exclude_none=True)
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
    level: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "time",
    sort_order: str = "desc",
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
    if level and level != "all":
        normalized_level = level.strip().upper()
        if normalized_level.isdigit():
            normalized_level = f"{normalized_level}L"
        query["currentLevel"] = normalized_level
    if status and status != "all":
        if status == "active":
            query["isActive"] = {"$ne": False}
        elif status == "inactive":
            query["isActive"] = False
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"firstName": {"$regex": escaped, "$options": "i"}},
            {"lastName": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
            {"currentLevel": {"$regex": escaped, "$options": "i"}},
            {"matricNumber": {"$regex": escaped, "$options": "i"}},
            {"gender": {"$regex": escaped, "$options": "i"}},
        ]
    
    direction = -1 if str(sort_order).lower() == "desc" else 1
    sort_map = {
        "time": [("createdAt", direction), ("_id", direction)],
        "name": [("firstName", direction), ("lastName", direction), ("_id", 1)],
        "level": [("currentLevel", direction), ("firstName", 1), ("_id", 1)],
    }
    sort_fields = sort_map.get(str(sort_by).lower(), sort_map["time"])

    total = await users.count_documents(query)
    cursor = users.find(query, {"passwordHash": 0}).sort(sort_fields).skip(skip).limit(limit)
    user_list = await cursor.to_list(length=limit)
    
    return {
        "items": [
            User(**{**u, "_id": str(u["_id"])})
            for u in user_list
        ],
        "total": total
    }


@router.get("/export/pdf")
async def export_users_pdf(
    role: Optional[str] = None,
    department: Optional[str] = None,
    level: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "time",
    sort_order: str = "desc",
    search: Optional[str] = None,
    limit: int = Query(1000, ge=1, le=5000),
    user: dict = Depends(require_permission("user:export")),
):
    """Export filtered users as PDF."""
    from app.utils.tabular_pdf import generate_tabular_pdf

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
    if level and level != "all":
        normalized_level = level.strip().upper()
        if normalized_level.isdigit():
            normalized_level = f"{normalized_level}L"
        query["currentLevel"] = normalized_level
    if status and status != "all":
        if status == "active":
            query["isActive"] = {"$ne": False}
        elif status == "inactive":
            query["isActive"] = False
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"firstName": {"$regex": escaped, "$options": "i"}},
            {"lastName": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
            {"currentLevel": {"$regex": escaped, "$options": "i"}},
            {"matricNumber": {"$regex": escaped, "$options": "i"}},
            {"gender": {"$regex": escaped, "$options": "i"}},
        ]

    direction = -1 if str(sort_order).lower() == "desc" else 1
    sort_map = {
        "time": [("createdAt", direction), ("_id", direction)],
        "name": [("firstName", direction), ("lastName", direction), ("_id", 1)],
        "level": [("currentLevel", direction), ("firstName", 1), ("_id", 1)],
    }
    sort_fields = sort_map.get(str(sort_by).lower(), sort_map["time"])

    user_list = await users.find(
        query,
        {"passwordHash": 0},
    ).sort(sort_fields).limit(limit).to_list(length=limit)

    rows = []
    for u in user_list:
        rows.append([
            f"{u.get('firstName', '')} {u.get('lastName', '')}".strip(),
            u.get("email", ""),
            "IPE" if u.get("department") == "Industrial Engineering" else (u.get("department") or "External"),
            u.get("currentLevel", ""),
            u.get("gender") or u.get("sex") or "",
            u.get("role", "student"),
            "Active" if u.get("isActive", True) else "Inactive",
        ])

    pdf_buffer = generate_tabular_pdf(
        title="IESA Users Export",
        subtitle=f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · Rows: {len(rows)}",
        headers=["Name", "Email", "Department", "Level", "Gender", "Role", "Status"],
        rows=rows,
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=iesa-users-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"},
    )


def _safe_birthday_for_year(dob: date, year: int) -> date:
    """Return birthday date in a given year, handling Feb 29 in non-leap years."""
    if dob.month == 2 and dob.day == 29:
        try:
            return date(year, 2, 29)
        except ValueError:
            return date(year, 2, 28)
    return date(year, dob.month, dob.day)


def _coerce_dob_to_date(value) -> date | None:
    """Best-effort conversion of stored DOB values to a date.

    Supports datetime/date objects and ISO-like strings (with/without trailing Z).
    """
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
        except ValueError:
            try:
                return datetime.strptime(raw, "%Y-%m-%d").date()
            except ValueError:
                return None
    return None


def _level_rank(level_value: str | None) -> int:
    """Convert levels like '100L' into sortable integer ranks."""
    if not level_value:
        return 9999
    text = str(level_value).strip().upper()
    match = re.search(r"\d+", text)
    if not match:
        return 9999
    try:
        return int(match.group())
    except ValueError:
        return 9999


ROLE_POSITION_LABELS = {
    "president": "President",
    "vice_president": "Vice President",
    "general_secretary": "General Secretary",
    "assistant_general_secretary": "Asst. General Secretary",
    "treasurer": "Treasurer",
    "social_director": "Social Director",
    "sports_secretary": "Sports Secretary",
    "assistant_sports_secretary": "Asst. Sports Secretary",
    "pro": "Public Relations Officer",
    "financial_secretary": "Financial Secretary",
    "timp_lead": "TIMP Lead",
    "timp_mentor": "TIMP Mentor",
    "timp_mentee": "TIMP Mentee",
    "press_editor_in_chief": "Press Editor-in-Chief",
    "press_head": "Press Head",
    "press_member": "Press Member",
    "press_niche_editor": "Press Niche Editor",
    "press_pro": "Press PRO",
    "iepod_hub_director": "IEPOD Hub Director",
    "iepod_hub_lead": "IEPOD Hub Lead",
    "iepod_conference_lead": "IEPOD Conference Lead",
    "iepod_program_coordinator": "IEPOD Program Coordinator",
    "iepod_communications_officer": "IEPOD Communications Officer",
    "iepod_communications_officer_1": "IEPOD Communications Officer 1",
}


def _format_role_position_label(position: str | None, society_name: str | None = None) -> str:
    if not position:
        return "Role"
    pos = str(position).strip()
    if pos.startswith("class_rep_"):
        level = pos.replace("class_rep_", "").upper()
        return f"{level} Class Rep"
    if pos.startswith("asst_class_rep_"):
        level = pos.replace("asst_class_rep_", "").upper()
        return f"{level} Asst. Class Rep"
    if pos.startswith("team_head_"):
        suffix = pos.replace("team_head_", "", 1).replace("_", " ").title()
        return f"Team Head ({suffix})"
    if pos.startswith("team_member_custom_"):
        suffix = pos.replace("team_member_custom_", "", 1).replace("_", " ").title()
        return f"Team Member ({suffix})"
    if pos.startswith("team_") and pos.endswith("_member"):
        suffix = pos.replace("team_", "", 1).replace("_member", "").replace("_", " ").title()
        return f"Team Member ({suffix})"
    base_label = ROLE_POSITION_LABELS.get(pos, pos.replace("_", " ").title())
    if pos == "iepod_hub_lead" and society_name:
        return f"{base_label} ({society_name})"
    return base_label


def _build_role_appreciation(role_labels: list[str]) -> str | None:
    labels = [label for label in role_labels if label]
    if not labels:
        return None
    if len(labels) == 1:
        return f"Thank you for serving as {labels[0]}."
    if len(labels) == 2:
        return f"Thank you for serving as {labels[0]} and {labels[1]}."
    return f"Thank you for serving as {labels[0]}, {labels[1]}, and {len(labels) - 2} other roles."


@router.get("/birthdays")
async def list_upcoming_birthdays(
    days_ahead: int = 90,
    search: Optional[str] = None,
    department: Optional[str] = None,
    level: Optional[str] = None,
    sort_by: str = "time",
    sort_order: str = "asc",
    limit: int = 50,
    skip: int = 0,
    _user: dict = Depends(require_permission("user:view_all")),
):
    """
    List upcoming student birthdays within N days.
    Supports search + department filter and returns paginated results.
    """
    days_ahead = max(1, min(days_ahead, 366))
    full_cycle = days_ahead >= 365
    limit = max(1, min(limit, 200))
    skip = max(0, skip)

    db = get_database()

    query: dict = {
        "isActive": {"$ne": False},
        "dateOfBirth": {"$exists": True, "$ne": None},
    }

    if department and department != "all":
        if department == "external":
            query["isExternalStudent"] = True
        elif department == "ipe":
            query["department"] = "Industrial Engineering"
        else:
            query["department"] = department

    if level and level != "all":
        normalized_level = level.strip().upper()
        if normalized_level.isdigit():
            normalized_level = f"{normalized_level}L"
        query["currentLevel"] = normalized_level

    if search:
        escaped = re.escape(search.strip())
        query["$or"] = [
            {"firstName": {"$regex": escaped, "$options": "i"}},
            {"lastName": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
            {"matricNumber": {"$regex": escaped, "$options": "i"}},
        ]

    users = await db["users"].find(
        query,
        {
            "_id": 1,
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "matricNumber": 1,
            "currentLevel": 1,
            "department": 1,
            "gender": 1,
            "sex": 1,
            "profilePictureUrl": 1,
            "dateOfBirth": 1,
        },
    ).to_list(length=None)

    user_ids = [str(user.get("_id")) for user in users if user.get("_id")]
    active_session_docs = await db["sessions"].find(
        {"isActive": True},
        {"_id": 1},
    ).to_list(length=10)
    active_session_ids = [str(s["_id"]) for s in active_session_docs if s.get("_id")]

    role_labels_by_user: dict[str, list[str]] = {}
    if user_ids:
        role_query: dict = {
            "userId": {"$in": user_ids},
            "isActive": True,
        }
        if active_session_ids:
            role_query["sessionId"] = {"$in": active_session_ids}

        role_docs = await db["roles"].find(
            role_query,
            {"userId": 1, "position": 1, "societyName": 1},
        ).to_list(length=5000)

        for role_doc in role_docs:
            role_user_id = str(role_doc.get("userId") or "")
            label = _format_role_position_label(
                role_doc.get("position"),
                role_doc.get("societyName"),
            )
            if not role_user_id or not label:
                continue
            role_labels_by_user.setdefault(role_user_id, []).append(label)

        for role_user_id, labels in role_labels_by_user.items():
            role_labels_by_user[role_user_id] = sorted(set(labels))

    today = datetime.now(timezone.utc).date()
    upper = today + timedelta(days=days_ahead)

    upcoming: list[dict] = []
    for user in users:
        dob = _coerce_dob_to_date(user.get("dateOfBirth"))
        if dob is None:
            continue
        this_year = _safe_birthday_for_year(dob, today.year)
        next_birthday = this_year if this_year >= today else _safe_birthday_for_year(dob, today.year + 1)

        if not full_cycle and next_birthday > upper:
            continue

        days_until = (next_birthday - today).days
        upcoming.append(
            {
                "id": str(user["_id"]),
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", ""),
                "email": user.get("email", ""),
                "matricNumber": user.get("matricNumber"),
                "currentLevel": user.get("currentLevel"),
                "department": user.get("department"),
                "gender": user.get("gender") or user.get("sex"),
                "profilePictureUrl": user.get("profilePictureUrl"),
                "activeRoles": role_labels_by_user.get(str(user["_id"]), []),
                "daysUntil": days_until,
                "birthdayMonth": next_birthday.month,
                "birthdayDay": next_birthday.day,
                "nextBirthday": next_birthday.isoformat(),
            }
        )

    order_desc = str(sort_order).lower() == "desc"
    sort_key = str(sort_by).lower()

    if sort_key == "name":
        upcoming.sort(
            key=lambda item: (
                (item.get("firstName") or "").lower(),
                (item.get("lastName") or "").lower(),
                item.get("daysUntil", 9999),
            ),
            reverse=order_desc,
        )
    elif sort_key == "level":
        upcoming.sort(
            key=lambda item: (
                _level_rank(item.get("currentLevel")),
                (item.get("firstName") or "").lower(),
            ),
            reverse=order_desc,
        )
    else:
        upcoming.sort(
            key=lambda item: (
                item.get("daysUntil", 9999),
                (item.get("firstName") or "").lower(),
                (item.get("lastName") or "").lower(),
            ),
            reverse=order_desc,
        )

    total = len(upcoming)
    items = upcoming[skip: skip + limit]

    return {
        "items": items,
        "total": total,
        "daysAhead": days_ahead,
        "sortBy": sort_key,
        "sortOrder": "desc" if order_desc else "asc",
    }


@router.get("/birthdays/today-preview")
async def preview_today_birthday_messages(
    _user: dict = Depends(require_permission("user:view_all")),
):
    """Preview today's role-aware birthday messages without sending notifications."""
    db = get_database()
    today = datetime.now(timezone.utc).date()

    users = await db["users"].find(
        {
            "isActive": {"$ne": False},
            "role": "student",
            "dateOfBirth": {"$exists": True, "$ne": None},
        },
        {
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "currentLevel": 1,
            "gender": 1,
            "sex": 1,
            "dateOfBirth": 1,
        },
    ).to_list(length=3000)

    celebrants = []
    celebrant_ids: list[str] = []
    for user in users:
        dob = _coerce_dob_to_date(user.get("dateOfBirth"))
        if not dob:
            continue
        if dob.month == today.month and dob.day == today.day:
            uid = str(user.get("_id"))
            celebrant_ids.append(uid)
            celebrants.append({
                "id": uid,
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", ""),
                "email": user.get("email", ""),
                "currentLevel": user.get("currentLevel"),
                "gender": user.get("gender") or user.get("sex"),
            })

    active_session_docs = await db["sessions"].find(
        {"isActive": True},
        {"_id": 1},
    ).to_list(length=10)
    active_session_ids = [str(s["_id"]) for s in active_session_docs if s.get("_id")]

    role_labels_by_user: dict[str, list[str]] = {}
    if celebrant_ids:
        role_query: dict = {
            "userId": {"$in": celebrant_ids},
            "isActive": True,
        }
        if active_session_ids:
            role_query["sessionId"] = {"$in": active_session_ids}

        role_docs = await db["roles"].find(
            role_query,
            {"userId": 1, "position": 1, "societyName": 1},
        ).to_list(length=1500)

        for role_doc in role_docs:
            role_user_id = str(role_doc.get("userId") or "")
            label = _format_role_position_label(
                role_doc.get("position"),
                role_doc.get("societyName"),
            )
            if not role_user_id or not label:
                continue
            role_labels_by_user.setdefault(role_user_id, []).append(label)

        for role_user_id, labels in role_labels_by_user.items():
            role_labels_by_user[role_user_id] = sorted(set(labels))

    preview_items: list[dict] = []
    for celebrant in celebrants:
        uid = celebrant["id"]
        first_name = celebrant.get("firstName", "")
        full_name = f"{celebrant.get('firstName', '')} {celebrant.get('lastName', '')}".strip() or "Student"
        role_labels = role_labels_by_user.get(uid, [])
        role_appreciation = _build_role_appreciation(role_labels)
        in_app_title = f"Happy Birthday, {first_name}! 🎂" if first_name else "Happy Birthday!"
        in_app_message = (
            "Wishing you a wonderful birthday from the entire IESA community! "
            "Hope your day is as amazing as you are. 🎉"
            + (f" {role_appreciation}" if role_appreciation else "")
        )

        preview_items.append({
            "id": uid,
            "name": full_name,
            "email": celebrant.get("email", ""),
            "currentLevel": celebrant.get("currentLevel"),
            "gender": celebrant.get("gender"),
            "activeRoles": role_labels,
            "roleAppreciation": role_appreciation,
            "inAppPreview": {
                "title": in_app_title,
                "message": in_app_message,
            },
            "emailPreview": {
                "subject": "Happy Birthday from IESA",
                "name": full_name,
                "roleAppreciation": role_appreciation,
            },
        })

    return {
        "date": today.isoformat(),
        "totalCelebrants": len(preview_items),
        "items": preview_items,
    }


@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific user's profile.
    - Admins/exco: full profile (used by admin user-management modal).
    - Own profile: full profile.
    - Student viewing another user (e.g. team page): public fields only — PII stripped.
    """
    db = get_database()
    users = db["users"]

    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )

    caller_id = str(current_user.get("_id", ""))
    caller_role = current_user.get("role", "student")  # from DB via get_current_user, not stale JWT
    is_own_profile = caller_id == user_id
    is_privileged = caller_role in ("admin", "exco")

    # Strip PII when an unprivileged user views someone else's profile
    projection: dict = {"passwordHash": 0}
    if not is_privileged and not is_own_profile:
        for field in (
            "dateOfBirth", "phone", "matricNumber", "lastLogin",
            "emailVerified", "hasCompletedOnboarding", "admissionYear",
            "createdAt", "updatedAt", "notificationChannels", "notificationCategories",
        ):
            projection[field] = 0

    user = await users.find_one({"_id": ObjectId(user_id)}, projection)

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
    
    # C1: Prevent self-role-elevation
    admin_id = str(admin_user.get("_id") or admin_user.get("id", ""))
    if user_id == admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
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
    
    # M3: Bust permissions cache after role change
    from app.core.permissions import invalidate_permissions_cache
    invalidate_permissions_cache(user_id)
    
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


async def _delete_user_account_data(db, user_id: str) -> None:
    """Delete user account and related data across collections."""
    users = db["users"]

    user_doc = await users.find_one({"_id": ObjectId(user_id)})
    firebase_uid = user_doc.get("firebaseUid") if user_doc else None
    if firebase_uid:
        try:
            from firebase_admin import auth as fb_auth
            import asyncio
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, fb_auth.delete_user, firebase_uid)
        except Exception as e:
            import logging
            logging.warning(f"Failed to delete Firebase user {firebase_uid}: {e}")

    await db["enrollments"].delete_many({"studentId": user_id})
    await db["notifications"].delete_many({"userId": user_id})
    await db["bankTransfers"].delete_many({"studentId": user_id})
    await db["growth_data"].delete_many({"userId": user_id})
    await db["ai_rate_limits"].delete_many({"userId": user_id})
    await db["roles"].delete_many({"userId": user_id})
    await db["unit_applications"].delete_many({"userId": user_id})
    await db["push_subscriptions"].delete_many({"userId": user_id})
    await db["paystackTransactions"].update_many(
        {"studentId": user_id},
        {"$set": {"studentName": "[deleted]", "studentEmail": "[deleted]"}},
    )

    await db["study_groups"].update_many(
        {"members.userId": user_id},
        {"$pull": {"members": {"userId": user_id}}},
    )

    await users.delete_one({"_id": ObjectId(user_id)})


@router.delete("/{user_id}")
async def delete_user_by_admin(
    user_id: str,
    request: Request,
    admin_user: dict = Depends(require_permission("user:delete")),
):
    """Permanently delete a user account as an admin."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    admin_id = str(admin_user.get("_id") or admin_user.get("id", ""))
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account via admin endpoint")

    db = get_database()
    users = db["users"]
    target_user = await users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    await _delete_user_account_data(db, user_id)

    await AuditLogger.log(
        action="user.deleted_by_admin",
        actor_id=admin_user.get("_id") or admin_user.get("id", "unknown"),
        actor_email=admin_user.get("email", "unknown"),
        resource_type="user",
        resource_id=user_id,
        details={
            "target_email": target_user.get("email"),
            "target_name": f"{target_user.get('firstName', '')} {target_user.get('lastName', '')}".strip(),
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": "User deleted successfully"}


@router.delete("/me")
async def delete_account(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """
    Permanently delete the current user's account and all associated data.

    Firebase Auth user is also deleted so they can't log in again.
    """
    db = get_database()
    user_id = str(user["_id"])

    db_user = await db["users"].find_one(
        {"_id": ObjectId(user_id)},
        {"role": 1},
    )
    current_role = db_user.get("role", "") if db_user else ""
    if current_role == "student":
        await AuditLogger.log(
            action="user.self_delete_blocked",
            actor_id=user_id,
            actor_email=user.get("email", "unknown"),
            resource_type="user",
            resource_id=user_id,
            details={"reason": "student_account_not_allowed", "role": current_role},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        raise HTTPException(
            status_code=403,
            detail="Account deletion is not available for student accounts",
        )

    await _delete_user_account_data(db, user_id)

    await AuditLogger.log(
        action="user.self_deleted",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="user",
        resource_id=user_id,
        details={"role": current_role or "unknown"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": "Account deleted successfully"}