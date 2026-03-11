"""
Resource Library Router - Google Drive & YouTube integration
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import ReturnDocument
import os
import re
import json
import base64

from ..core.security import get_current_user, require_ipe_student
from ..core.database import get_database
from ..core.permissions import get_user_permissions, require_permission

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])

# Google Drive configuration (lazy-loaded to save memory)
GOOGLE_DRIVE_ENABLED = False
DRIVE_SERVICE = None
_drive_initialized = False


def _get_drive_service():
    """Lazy-initialize Google Drive service on first use."""
    global GOOGLE_DRIVE_ENABLED, DRIVE_SERVICE, _drive_initialized
    if _drive_initialized:
        return DRIVE_SERVICE
    _drive_initialized = True

    try:
        service_account_b64 = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64", "")
        if service_account_b64:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build

            service_account_json = base64.b64decode(service_account_b64).decode('utf-8')
            service_account_info = json.loads(service_account_json)
            SCOPES = ['https://www.googleapis.com/auth/drive']
            credentials = service_account.Credentials.from_service_account_info(
                service_account_info, scopes=SCOPES
            )
            DRIVE_SERVICE = build('drive', 'v3', credentials=credentials)
            GOOGLE_DRIVE_ENABLED = True
            print("✅ Google Drive API configured successfully")
        else:
            print("⚠️  Google Drive not configured. Will use direct links only.")
    except Exception as e:
        print(f"⚠️  Google Drive configuration failed: {e}")
        GOOGLE_DRIVE_ENABLED = False

    return DRIVE_SERVICE


# Pydantic Models
class ResourceResponse(BaseModel):
    id: str = Field(alias="_id")
    sessionId: str
    title: str
    description: str
    type: str  # "slide", "pastQuestion", "note", "textbook", "video"
    courseCode: str
    level: int
    semester: Optional[str] = None  # "first" | "second" | None (all)
    url: str  # Google Drive link or YouTube URL
    driveFileId: Optional[str] = None  # For Google Drive files
    youtubeVideoId: Optional[str] = None  # For YouTube videos
    fileType: Optional[str] = None  # "pdf", "pptx", "docx", etc.
    fileSize: Optional[int] = None  # bytes (if available)
    uploadedBy: str
    uploaderName: str
    tags: List[str]
    viewCount: int
    isApproved: bool
    approvedBy: Optional[str] = None
    feedback: Optional[str] = None  # Approval/rejection feedback from reviewer
    averageRating: float = 0
    ratingCount: int = 0
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True


class ResourceListResponse(BaseModel):
    resources: List[ResourceResponse]
    total: int
    page: int
    pageSize: int


class ApproveResourceRequest(BaseModel):
    approved: bool
    feedback: Optional[str] = None


class AddResourceRequest(BaseModel):
    title: str
    description: str
    type: str  # slide, pastQuestion, video, textbook, note
    courseCode: str
    level: int
    semester: Optional[str] = None  # "first" | "second" | None
    tags: str  # Comma-separated
    url: str  # Google Drive shareable link or YouTube URL


# Helper functions
async def check_resource_permission(user: dict, permission: str, db: AsyncIOMotorDatabase) -> bool:
    """Check if user has specific permission using DB-backed role permissions"""
    user_id = str(user.get("_id", ""))
    session = await db["sessions"].find_one({"isActive": True})
    if not session:
        return False
    session_id = str(session["_id"])
    permissions = await get_user_permissions(user_id, session_id)
    return permission in permissions


async def get_current_session(db: AsyncIOMotorDatabase):
    """Get the current active session"""
    sessions = db["sessions"]
    session = await sessions.find_one({"isActive": True})
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    return session


def extract_google_drive_id(url: str) -> Optional[str]:
    """Extract file ID from Google Drive shareable link"""
    patterns = [
        r'/d/([a-zA-Z0-9_-]+)',  # /file/d/{id}/view
        r'id=([a-zA-Z0-9_-]+)',  # ?id={id}
        r'/folders/([a-zA-Z0-9_-]+)',  # /folders/{id}
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None


def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/embed/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None


def get_google_drive_direct_link(file_id: str) -> str:
    """Generate direct download link for Google Drive file"""
    return f"https://drive.google.com/uc?export=download&id={file_id}"


def get_google_drive_preview_link(file_id: str) -> str:
    """Generate preview link for Google Drive file"""
    return f"https://drive.google.com/file/d/{file_id}/preview"


def validate_resource_data(resource_type: str, url: str):
    """Validate resource type and URL"""
    if resource_type not in ["slide", "pastQuestion", "note", "textbook", "video"]:
        raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")
    
    # Video must be YouTube
    if resource_type == "video":
        if not extract_youtube_video_id(url):
            raise HTTPException(
                status_code=400,
                detail="Videos must be YouTube links (e.g., https://www.youtube.com/watch?v=...)"
            )
    else:
        # Other types must be Google Drive
        if not extract_google_drive_id(url):
            raise HTTPException(
                status_code=400,
                detail="Files must be Google Drive shareable links (e.g., https://drive.google.com/file/d/...)"
            )


# Routes

@router.post("/add", response_model=dict)
async def add_resource(
    resource_data: AddResourceRequest,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Add a new resource with Google Drive link or YouTube URL.
    Any authenticated student can submit. Resources go through approval.
    """
    # Validate level
    if resource_data.level not in [100, 200, 300, 400, 500]:
        raise HTTPException(status_code=400, detail="Invalid level. Must be 100, 200, 300, 400, or 500")
    
    # Validate URL and type
    validate_resource_data(resource_data.type, resource_data.url)
    
    # Get current session
    session = await get_current_session(db)
    
    # Extract IDs
    drive_file_id = None
    youtube_video_id = None
    file_type = None
    
    if resource_data.type == "video":
        youtube_video_id = extract_youtube_video_id(resource_data.url)
        file_type = "video"
    else:
        drive_file_id = extract_google_drive_id(resource_data.url)
        # Try to guess file type from URL or default
        if "presentation" in resource_data.url.lower() or resource_data.type == "slide":
            file_type = "pptx"
        elif resource_data.type == "textbook":
            file_type = "pdf"
        else:
            file_type = "pdf"  # default
    
    # Parse tags
    tag_list = [tag.strip() for tag in resource_data.tags.split(",") if tag.strip()]
    
    # Get user info (user is full DB doc from get_current_user)
    user_id = str(user["_id"])
    uploader_name = f"{user.get('firstName', 'Unknown')} {user.get('lastName', 'User')}"
    
    # Validate semester
    if resource_data.semester and resource_data.semester not in ["first", "second"]:
        raise HTTPException(status_code=400, detail="Semester must be 'first' or 'second'")

    # Auto-approve logic:
    # 1. Admins with resource:approve permission get auto-approved
    # 2. Trusted students (at least 1 previously approved resource) get auto-approved
    has_approve_perm = await check_resource_permission(user, "resource:approve", db)
    is_trusted_uploader = False
    if not has_approve_perm:
        prev_approved = await resources.count_documents({
            "uploadedBy": user_id,
            "isApproved": True,
        })
        is_trusted_uploader = prev_approved >= 1

    auto_approve = has_approve_perm or is_trusted_uploader

    resource_doc = {
        "sessionId": str(session["_id"]),
        "title": resource_data.title,
        "description": resource_data.description,
        "type": resource_data.type,
        "courseCode": resource_data.courseCode.upper(),
        "level": resource_data.level,
        "semester": resource_data.semester,  # "first" | "second" | None
        "url": resource_data.url,
        "driveFileId": drive_file_id,
        "youtubeVideoId": youtube_video_id,
        "fileType": file_type,
        "fileSize": None,  # Not available for Drive/YouTube links
        "uploadedBy": user_id,
        "uploaderName": uploader_name,
        "tags": tag_list,
        "viewCount": 0,
        "isApproved": auto_approve,
        "approvedBy": user_id if auto_approve else None,
        "autoApproved": is_trusted_uploader,  # flag for audit trail
        "feedback": None,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    result = await resources.insert_one(resource_doc)
    
    return {
        "message": "Resource added successfully",
        "resource": {
            "id": str(result.inserted_id),
            "title": resource_data.title,
            "url": resource_data.url,
            "isApproved": resource_doc["isApproved"]
        }
    }


@router.get("/my", response_model=List[dict])
async def get_my_submissions(
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get current user's resource submissions (including pending/rejected)"""
    resources = db["resources"]
    session = await get_current_session(db)

    cursor = resources.find({
        "uploadedBy": str(user["_id"]),
        "sessionId": str(session["_id"]),
    }).sort("createdAt", -1)

    result = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["sessionId"] = str(doc["sessionId"])
        doc["uploadedBy"] = str(doc["uploadedBy"])
        if doc.get("approvedBy"):
            doc["approvedBy"] = str(doc["approvedBy"])
        result.append(doc)

    return result


@router.get("", response_model=ResourceListResponse)
async def list_resources(
    level: Optional[int] = Query(None, description="Filter by level (100-500)"),
    courseCode: Optional[str] = Query(None, description="Filter by course code (exact)"),
    type: Optional[str] = Query(None, description="Filter by resource type"),
    semester: Optional[str] = Query(None, description="Filter by semester: first | second"),
    approved: Optional[bool] = Query(True, description="Show only approved resources"),
    search: Optional[str] = Query(None, description="Search title, courseCode, or tags"),
    sortBy: Optional[str] = Query("createdAt", description="Sort field: createdAt | viewCount | rating"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get list of resources with filters, full-text search, and sort"""
    resources = db["resources"]

    # Build query
    query = {}

    # Get current session
    session = await get_current_session(db)
    query["sessionId"] = str(session["_id"])

    if level:
        query["level"] = level

    if courseCode:
        query["courseCode"] = courseCode.upper()

    if type:
        query["type"] = type

    if semester and semester in ["first", "second"]:
        query["semester"] = semester

    # Show unapproved only to admins/academic committee
    if approved is not None:
        if not await check_resource_permission(user, "resource:approve", db):
            query["isApproved"] = True
        else:
            query["isApproved"] = approved

    # Full-text search across title, courseCode, description, and tags
    if search and search.strip():
        escaped = re.escape(search.strip())
        pattern = re.compile(escaped, re.IGNORECASE)
        query["$or"] = [
            {"title": {"$regex": pattern}},
            {"courseCode": {"$regex": pattern}},
            {"description": {"$regex": pattern}},
            {"tags": {"$elemMatch": {"$regex": pattern}}},
            {"uploaderName": {"$regex": pattern}},
        ]

    # Sort: default newest first; optionally by most viewed or top rated
    allowed_sort = {"createdAt", "viewCount", "rating"}
    sort_field = "averageRating" if sortBy == "rating" else (sortBy if sortBy in allowed_sort else "createdAt")
    sort_order = -1  # descending

    # Get total count
    total = await resources.count_documents(query)

    # Get paginated results
    skip = (page - 1) * pageSize
    cursor = resources.find(query).sort(sort_field, sort_order).skip(skip).limit(pageSize)
    
    resource_list = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["sessionId"] = str(doc["sessionId"])
        doc["uploadedBy"] = str(doc["uploadedBy"])
        if doc.get("approvedBy"):
            doc["approvedBy"] = str(doc["approvedBy"])
        resource_list.append(ResourceResponse(**doc))
    
    return ResourceListResponse(
        resources=resource_list,
        total=total,
        page=page,
        pageSize=pageSize
    )


@router.get("/bookmarked", response_model=List[dict])
async def get_bookmarked_resources(
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get all resources bookmarked by the current user."""
    user_id = str(user["_id"])
    resources = db["resources"]
    cursor = resources.find(
        {"bookmarkedBy": user_id, "isApproved": True},
    ).sort("title", 1)
    results = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["id"] = doc["_id"]
        doc["uploadedBy"] = str(doc.get("uploadedBy", ""))
        if doc.get("sessionId"):
            doc["sessionId"] = str(doc["sessionId"])
        if doc.get("approvedBy"):
            doc["approvedBy"] = str(doc["approvedBy"])
        results.append(doc)
    return results


@router.get("/{resource_id}", response_model=ResourceResponse)
async def get_resource(
    resource_id: str,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get single resource by ID"""
    from bson import ObjectId
    
    resources = db["resources"]
    
    try:
        resource = await resources.find_one({"_id": ObjectId(resource_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid resource ID")
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Check if approved (unless user is admin/academic committee)
    if not resource.get("isApproved") and not await check_resource_permission(user, "resource:approve", db):
        raise HTTPException(status_code=404, detail="Resource not found")

    # Convert ObjectIds to strings
    resource["_id"] = str(resource["_id"])
    resource["sessionId"] = str(resource["sessionId"])
    resource["uploadedBy"] = str(resource["uploadedBy"])
    if resource.get("approvedBy"):
        resource["approvedBy"] = str(resource["approvedBy"])
    
    return ResourceResponse(**resource)


@router.post("/{resource_id}/view")
async def track_view(
    resource_id: str,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Track resource view — increments viewCount each time the View/Watch button is clicked."""
    resources = db["resources"]

    try:
        updated = await resources.find_one_and_update(
            {"_id": ObjectId(resource_id), "isApproved": True},
            {"$inc": {"viewCount": 1}},
            return_document=ReturnDocument.AFTER,
            projection={"viewCount": 1},
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid resource ID")

    if not updated:
        raise HTTPException(status_code=404, detail="Resource not found")

    return {"viewCount": updated["viewCount"]}


@router.patch("/{resource_id}/approve", response_model=dict)
async def approve_resource(
    resource_id: str,
    approve_data: ApproveResourceRequest,
    request: Request,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Approve or reject a resource (Academic Committee/Admin only)"""
    from bson import ObjectId
    
    if not await check_resource_permission(user, "resource:approve", db):
        raise HTTPException(status_code=403, detail="You don't have permission to approve resources")
    
    user_id = str(user["_id"])
    resources = db["resources"]
    
    try:
        result = await resources.update_one(
            {"_id": ObjectId(resource_id)},
            {
                "$set": {
                    "isApproved": approve_data.approved,
                    "approvedBy": user_id if approve_data.approved else None,
                    "feedback": approve_data.feedback,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid resource ID")
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Notify the uploader
    try:
        resource_doc = await resources.find_one(
            {"_id": ObjectId(resource_id)},
            {"uploadedBy": 1, "title": 1},
        )
        if resource_doc and resource_doc.get("uploadedBy"):
            from app.routers.notifications import create_notification
            uploader_id = str(resource_doc["uploadedBy"])
            res_title = resource_doc.get("title", "your resource")
            if approve_data.approved:
                await create_notification(
                    user_id=uploader_id,
                    type="resource_approved",
                    title="Resource Approved",
                    message=f'Your resource "{res_title}" has been approved and is now visible in the library.',
                    link="/dashboard/library",
                    related_id=resource_id,
                    category="academic",
                )
            else:
                feedback_msg = f' Feedback: {approve_data.feedback}' if approve_data.feedback else ''
                await create_notification(
                    user_id=uploader_id,
                    type="resource_rejected",
                    title="Resource Not Approved",
                    message=f'Your resource "{res_title}" was not approved.{feedback_msg}',
                    link="/dashboard/library",
                    related_id=resource_id,
                    category="academic",
                )
    except Exception:
        pass  # Non-critical

    # Audit log
    from app.core.audit import AuditLogger
    await AuditLogger.log(
        action="resource.approved" if approve_data.approved else "resource.rejected",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="resource",
        resource_id=resource_id,
        details={"approved": approve_data.approved, "feedback": approve_data.feedback},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return {
        "message": f"Resource {'approved' if approve_data.approved else 'rejected'} successfully",
        "isApproved": approve_data.approved
    }


class BulkApproveBody(BaseModel):
    resource_ids: list[str]
    approved: bool
    feedback: Optional[str] = None


@router.post("/bulk-approve")
async def bulk_approve_resources(
    body: BulkApproveBody,
    request: Request,
    user: dict = Depends(require_permission("resource:approve")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Bulk approve or reject multiple resources at once."""
    from bson import ObjectId

    if not body.resource_ids or len(body.resource_ids) > 100:
        raise HTTPException(status_code=400, detail="Provide 1-100 resource IDs")

    valid_ids = [ObjectId(rid) for rid in body.resource_ids if ObjectId.is_valid(rid)]
    if not valid_ids:
        raise HTTPException(status_code=400, detail="No valid resource IDs")

    # Fetch uploader IDs before updating so we can notify them
    resources = db["resources"]
    uploader_map: dict[str, str] = {}  # resource_id -> uploadedBy
    title_map: dict[str, str] = {}     # resource_id -> title
    try:
        cursor = resources.find(
            {"_id": {"$in": valid_ids}},
            {"uploadedBy": 1, "title": 1},
        )
        async for doc in cursor:
            rid = str(doc["_id"])
            uploader_map[rid] = str(doc.get("uploadedBy", ""))
            title_map[rid] = doc.get("title", "a resource")
    except Exception:
        pass  # Non-critical

    resources = db["resources"]
    update_fields: dict = {"isApproved": body.approved}
    if body.feedback:
        update_fields["feedback"] = body.feedback

    result = await resources.update_many(
        {"_id": {"$in": valid_ids}},
        {"$set": update_fields},
    )

    user_id = user.get("sub") or str(user.get("_id", ""))
    from app.core.audit import AuditLogger
    await AuditLogger.log(
        action="resource.bulk_approved" if body.approved else "resource.bulk_rejected",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="resource",
        resource_id=",".join(body.resource_ids[:10]),
        details={"count": result.modified_count, "approved": body.approved},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    # Fire-and-forget notifications to uploaders
    if uploader_map:
        import asyncio
        asyncio.create_task(_notify_bulk_uploaders(uploader_map, title_map, body.approved, body.feedback))

    return {"message": f"{result.modified_count} resource(s) {'approved' if body.approved else 'rejected'}",
            "modifiedCount": result.modified_count}


# Async helper fired after bulk-approve to notify each uploader
async def _notify_bulk_uploaders(
    uploader_map: dict[str, str],
    title_map: dict[str, str],
    approved: bool,
    feedback: str | None,
):
    """Send a notification to each unique uploader in a bulk approve/reject."""
    try:
        from app.routers.notifications import create_notification

        # Deduplicate: group resource titles by uploader
        uploader_resources: dict[str, list[str]] = {}
        for rid, uid in uploader_map.items():
            if uid:
                uploader_resources.setdefault(uid, []).append(title_map.get(rid, "a resource"))

        for uid, titles in uploader_resources.items():
            names = ", ".join(f'"{t}"' for t in titles[:3])
            if len(titles) > 3:
                names += f" and {len(titles) - 3} more"
            if approved:
                await create_notification(
                    user_id=uid,
                    type="resource_approved",
                    title="Resources Approved",
                    message=f"Your resources {names} have been approved and are now visible in the library.",
                    link="/dashboard/library",
                    category="academic",
                )
            else:
                fb = f" Feedback: {feedback}" if feedback else ""
                await create_notification(
                    user_id=uid,
                    type="resource_rejected",
                    title="Resources Not Approved",
                    message=f"Your resources {names} were not approved.{fb}",
                    link="/dashboard/library",
                    category="academic",
                )
    except Exception:
        pass  # Non-critical


@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: str,
    request: Request,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a resource"""
    from bson import ObjectId
    
    resources = db["resources"]
    
    try:
        resource = await resources.find_one({"_id": ObjectId(resource_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid resource ID")
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Check permissions (owner or admin with resource:delete)
    if str(resource["uploadedBy"]) != str(user["_id"]) and not await check_resource_permission(user, "resource:delete", db):
        raise HTTPException(status_code=403, detail="You don't have permission to delete this resource")
    
    # Delete from database (no file deletion needed for Drive/YouTube links)
    await resources.delete_one({"_id": ObjectId(resource_id)})
    
    # Audit log
    from app.core.audit import AuditLogger
    await AuditLogger.log(
        action="resource.deleted",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="resource",
        resource_id=resource_id,
        details={"title": resource.get("title")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return {"message": "Resource deleted successfully"}


# ── Ratings & Bookmarks ─────────────────────────────────────────

class RatingBody(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="1–5 star rating")


@router.post("/{resource_id}/rate")
async def rate_resource(
    resource_id: str,
    body: RatingBody,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Rate a resource (1-5 stars). Re-rating updates the previous score."""
    if not ObjectId.is_valid(resource_id):
        raise HTTPException(400, "Invalid resource ID")

    resources = db["resources"]
    resource = await resources.find_one({"_id": ObjectId(resource_id)})
    if not resource:
        raise HTTPException(404, "Resource not found")

    user_id = str(user["_id"])
    ratings_coll = db["resource_ratings"]

    # Upsert the user's rating
    await ratings_coll.update_one(
        {"resourceId": resource_id, "userId": user_id},
        {"$set": {"rating": body.rating, "updatedAt": datetime.now(timezone.utc)}},
        upsert=True,
    )

    # Recalculate average
    pipeline = [
        {"$match": {"resourceId": resource_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    agg = await ratings_coll.aggregate(pipeline).to_list(length=1)
    avg = round(agg[0]["avg"], 2) if agg else 0
    count = agg[0]["count"] if agg else 0

    await resources.update_one(
        {"_id": ObjectId(resource_id)},
        {"$set": {"averageRating": avg, "ratingCount": count}},
    )

    return {"averageRating": avg, "ratingCount": count, "userRating": body.rating}


@router.post("/{resource_id}/bookmark")
async def toggle_bookmark(
    resource_id: str,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Toggle bookmark on a resource. Returns the new bookmarked state."""
    if not ObjectId.is_valid(resource_id):
        raise HTTPException(400, "Invalid resource ID")

    resources = db["resources"]
    resource = await resources.find_one({"_id": ObjectId(resource_id)}, {"bookmarkedBy": 1})
    if not resource:
        raise HTTPException(404, "Resource not found")

    user_id = str(user["_id"])
    bookmarked_by: list = resource.get("bookmarkedBy", [])

    if user_id in bookmarked_by:
        # Remove bookmark
        await resources.update_one(
            {"_id": ObjectId(resource_id)},
            {"$pull": {"bookmarkedBy": user_id}},
        )
        return {"bookmarked": False}
    else:
        # Add bookmark
        await resources.update_one(
            {"_id": ObjectId(resource_id)},
            {"$addToSet": {"bookmarkedBy": user_id}},
        )
        return {"bookmarked": True}
