"""
Resource Library Router - Google Drive & YouTube integration
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
import os
import re
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import json
import base64

from ..core.security import verify_token
from ..core.database import get_database

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])

# Google Drive configuration
GOOGLE_DRIVE_ENABLED = False
DRIVE_SERVICE = None

try:
    # Check for service account credentials
    service_account_b64 = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64", "")
    
    if service_account_b64:
        # Decode base64 service account JSON
        service_account_json = base64.b64decode(service_account_b64).decode('utf-8')
        service_account_info = json.loads(service_account_json)
        
        # Create credentials
        SCOPES = ['https://www.googleapis.com/auth/drive']
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info, scopes=SCOPES
        )
        
        # Build Drive service
        DRIVE_SERVICE = build('drive', 'v3', credentials=credentials)
        GOOGLE_DRIVE_ENABLED = True
        print("✅ Google Drive API configured successfully")
    else:
        print("⚠️  Google Drive not configured. Will use direct links only.")
except Exception as e:
    print(f"⚠️  Google Drive configuration failed: {e}")
    GOOGLE_DRIVE_ENABLED = False


# Pydantic Models
class ResourceResponse(BaseModel):
    id: str = Field(alias="_id")
    sessionId: str
    title: str
    description: str
    type: str  # "slide", "pastQuestion", "note", "textbook", "video"
    courseCode: str
    level: int
    url: str  # Google Drive link or YouTube URL
    driveFileId: Optional[str] = None  # For Google Drive files
    youtubeVideoId: Optional[str] = None  # For YouTube videos
    fileType: Optional[str] = None  # "pdf", "pptx", "docx", etc.
    fileSize: Optional[int] = None  # bytes (if available)
    uploadedBy: str
    uploaderName: str
    tags: List[str]
    downloadCount: int
    viewCount: int
    isApproved: bool
    approvedBy: Optional[str] = None
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


class AddResourceRequest(BaseModel):
    title: str
    description: str
    type: str  # slide, pastQuestion, video, textbook, note
    courseCode: str
    level: int
    tags: str  # Comma-separated
    url: str  # Google Drive shareable link or YouTube URL


# Helper functions
def check_permission(user: dict, permission: str) -> bool:
    """Check if user has specific permission"""
    permissions = user.get("permissions", [])
    return permission in permissions or "admin:all" in permissions


async def get_current_session(db: AsyncIOMotorDatabase):
    """Get the current active session"""
    sessions = db["sessions"]
    session = await sessions.find_one({"isCurrent": True})
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
    user: dict = Depends(verify_token),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Add a new resource with Google Drive link or YouTube URL.
    Requires 'resource:upload' permission (Academic Committee only).
    """
    # Check permissions
    if not check_permission(user, "resource:upload"):
        raise HTTPException(status_code=403, detail="You don't have permission to upload resources")
    
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
    
    # Get user info
    users = db["users"]
    uploader = await users.find_one({"_id": user["_id"]})
    uploader_name = f"{uploader.get('firstName', 'Unknown')} {uploader.get('lastName', 'User')}"
    
    # Create resource document
    resources = db["resources"]
    resource_doc = {
        "sessionId": session["_id"],
        "title": resource_data.title,
        "description": resource_data.description,
        "type": resource_data.type,
        "courseCode": resource_data.courseCode.upper(),
        "level": resource_data.level,
        "url": resource_data.url,
        "driveFileId": drive_file_id,
        "youtubeVideoId": youtube_video_id,
        "fileType": file_type,
        "fileSize": None,  # Not available for Drive/YouTube links
        "uploadedBy": user["_id"],
        "uploaderName": uploader_name,
        "tags": tag_list,
        "downloadCount": 0,
        "viewCount": 0,
        "isApproved": check_permission(user, "admin:all"),  # Auto-approve for admins
        "approvedBy": user["_id"] if check_permission(user, "admin:all") else None,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
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


@router.get("", response_model=ResourceListResponse)
async def list_resources(
    level: Optional[int] = Query(None, description="Filter by level (100-500)"),
    courseCode: Optional[str] = Query(None, description="Filter by course code"),
    type: Optional[str] = Query(None, description="Filter by resource type"),
    approved: Optional[bool] = Query(True, description="Show only approved resources"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(verify_token),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get list of resources with filters"""
    resources = db["resources"]
    
    # Build query
    query = {}
    
    # Get current session
    session = await get_current_session(db)
    query["sessionId"] = session["_id"]
    
    if level:
        query["level"] = level
    
    if courseCode:
        query["courseCode"] = courseCode.upper()
    
    if type:
        query["type"] = type
    
    # Show unapproved only to admins/academic committee
    if approved is not None:
        if not check_permission(user, "resource:approve"):
            query["isApproved"] = True
        else:
            query["isApproved"] = approved
    
    # Get total count
    total = await resources.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * pageSize
    cursor = resources.find(query).sort("createdAt", -1).skip(skip).limit(pageSize)
    
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


@router.get("/{resource_id}", response_model=ResourceResponse)
async def get_resource(
    resource_id: str,
    user: dict = Depends(verify_token),
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
    if not resource.get("isApproved") and not check_permission(user, "resource:approve"):
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Increment view count
    await resources.update_one(
        {"_id": ObjectId(resource_id)},
        {"$inc": {"viewCount": 1}}
    )
    resource["viewCount"] += 1
    
    # Convert ObjectIds to strings
    resource["_id"] = str(resource["_id"])
    resource["sessionId"] = str(resource["sessionId"])
    resource["uploadedBy"] = str(resource["uploadedBy"])
    if resource.get("approvedBy"):
        resource["approvedBy"] = str(resource["approvedBy"])
    
    return ResourceResponse(**resource)


@router.post("/{resource_id}/download")
async def track_download(
    resource_id: str,
    user: dict = Depends(verify_token),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Track resource download/view"""
    from bson import ObjectId
    
    resources = db["resources"]
    
    try:
        result = await resources.update_one(
            {"_id": ObjectId(resource_id), "isApproved": True},
            {"$inc": {"downloadCount": 1}}
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid resource ID")
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    return {"message": "Download tracked"}


@router.patch("/{resource_id}/approve", response_model=dict)
async def approve_resource(
    resource_id: str,
    approve_data: ApproveResourceRequest,
    user: dict = Depends(verify_token),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Approve or reject a resource (Academic Committee/Admin only)"""
    from bson import ObjectId
    
    if not check_permission(user, "resource:approve"):
        raise HTTPException(status_code=403, detail="You don't have permission to approve resources")
    
    resources = db["resources"]
    
    try:
        result = await resources.update_one(
            {"_id": ObjectId(resource_id)},
            {
                "$set": {
                    "isApproved": approve_data.approved,
                    "approvedBy": user["_id"] if approve_data.approved else None,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid resource ID")
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    return {
        "message": f"Resource {'approved' if approve_data.approved else 'rejected'} successfully",
        "isApproved": approve_data.approved
    }


@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: str,
    user: dict = Depends(verify_token),
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
    
    # Check permissions (owner or admin)
    if str(resource["uploadedBy"]) != str(user["_id"]) and not check_permission(user, "admin:all"):
        raise HTTPException(status_code=403, detail="You don't have permission to delete this resource")
    
    # Delete from database (no file deletion needed for Drive/YouTube links)
    await resources.delete_one({"_id": ObjectId(resource_id)})
    
    return {"message": "Resource deleted successfully"}
