"""
Session Management Router

Handles academic session CRUD operations and session switching.
This is the core of the "time travel" feature.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from datetime import datetime
from bson import ObjectId

from app.models.session import Session, SessionCreate, SessionUpdate, SessionSummary
from app.db import get_database
from app.core.security import verify_token
from app.core.permissions import require_permission

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post("/", response_model=Session, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    user_data: dict = Depends(require_permission("session:create"))
):
    """
    Create a new academic session.
    Requires session:create permission.
    
    If isActive=True, all other sessions will be set to inactive.
    """
    db = get_database()
    sessions = db["sessions"]
    
    # Check if session with this name already exists
    existing = await sessions.find_one({"name": session_data.name})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session {session_data.name} already exists"
        )
    
    # If this session is marked active, deactivate all others
    if session_data.isActive:
        await sessions.update_many({}, {"$set": {"isActive": False}})
    
    # Create session document
    session_dict = session_data.model_dump()
    session_dict["createdAt"] = datetime.utcnow()
    session_dict["updatedAt"] = datetime.utcnow()
    
    result = await sessions.insert_one(session_dict)
    created_session = await sessions.find_one({"_id": result.inserted_id})
    
    # Convert ObjectId to string
    created_session["_id"] = str(created_session["_id"])
    
    return Session(**created_session)


@router.get("/", response_model=List[SessionSummary])
async def list_sessions(
    active_only: bool = False,
    limit: int = None
):
    """
    List all academic sessions.
    Returns lightweight summaries for dropdowns.
    
    Public endpoint - no authentication required for read-only access.
    Query params:
    - active_only: Filter to only active sessions
    - limit: Limit number of results
    """
    db = get_database()
    sessions = db["sessions"]
    
    # Build query
    query = {}
    if active_only:
        query["isActive"] = True
    
    cursor = sessions.find(query).sort("startDate", -1)  # Most recent first
    
    if limit:
        cursor = cursor.limit(limit)
    
    session_list = await cursor.to_list(length=None)
    
    return [
        SessionSummary(
            id=str(s["_id"]),
            name=s["name"],
            isActive=s.get("isActive", False),
            currentSemester=s.get("currentSemester", 1)
        )
        for s in session_list
    ]


@router.get("/active", response_model=Session)
async def get_active_session(user_data: dict = Depends(verify_token)):
    """
    Get the currently active academic session.
    This is the default session for all operations.
    """
    db = get_database()
    sessions = db["sessions"]
    
    active_session = await sessions.find_one({"isActive": True})
    
    if not active_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active session found. Please contact an administrator."
        )
    
    active_session["_id"] = str(active_session["_id"])
    return Session(**active_session)


@router.get("/{session_id}", response_model=Session)
async def get_session(
    session_id: str,
    user_data: dict = Depends(verify_token)
):
    """Get a specific session by ID"""
    db = get_database()
    sessions = db["sessions"]
    
    if not ObjectId.is_valid(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format"
        )
    
    session = await sessions.find_one({"_id": ObjectId(session_id)})
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    session["_id"] = str(session["_id"])
    return Session(**session)


@router.patch("/{session_id}", response_model=Session)
async def update_session(
    session_id: str,
    session_update: SessionUpdate,
    user_data: dict = Depends(require_permission("session:edit"))
):
    """
    Update session details.
    Requires session:edit permission.
    
    If setting isActive=True, all other sessions will be deactivated.
    """
    db = get_database()
    sessions = db["sessions"]
    
    if not ObjectId.is_valid(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format"
        )
    
    # Get existing session
    existing = await sessions.find_one({"_id": ObjectId(session_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    # If activating this session, deactivate others
    update_data = session_update.model_dump(exclude_unset=True)
    if update_data.get("isActive") is True:
        await sessions.update_many(
            {"_id": {"$ne": ObjectId(session_id)}},
            {"$set": {"isActive": False}}
        )
    
    # Update session
    update_data["updatedAt"] = datetime.utcnow()
    await sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": update_data}
    )
    
    # Return updated session
    updated_session = await sessions.find_one({"_id": ObjectId(session_id)})
    updated_session["_id"] = str(updated_session["_id"])
    
    return Session(**updated_session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    user_data: dict = Depends(require_permission("session:delete"))
):
    """
    Delete a session.
    Requires session:delete permission.
    
    WARNING: This will also delete all session-scoped data
    (payments, events, announcements, grades, roles).
    """
    db = get_database()
    sessions = db["sessions"]
    
    if not ObjectId.is_valid(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format"
        )
    
    # Check if session exists
    session = await sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    # Don't allow deleting the active session
    if session.get("isActive"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the active session. Please activate another session first."
        )
    
    # Delete the session
    await sessions.delete_one({"_id": ObjectId(session_id)})
    
    # TODO: Also delete all session-scoped data
    # This should be done in a transaction for data integrity
    await db["payments"].delete_many({"sessionId": session_id})
    await db["events"].delete_many({"sessionId": session_id})
    await db["announcements"].delete_many({"sessionId": session_id})
    await db["grades"].delete_many({"sessionId": session_id})
    await db["roles"].delete_many({"sessionId": session_id})
    await db["enrollments"].delete_many({"sessionId": session_id})
    
    return None
