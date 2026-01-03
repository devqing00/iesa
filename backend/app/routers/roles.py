"""
Role Management Router

Handles assignment of executive positions to students for specific sessions.
Admins can create, view, update, and delete role assignments.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.models.role import Role, RoleCreate, RoleUpdate
from app.models.user import User
from app.db import get_database

router = APIRouter(prefix="/api/roles", tags=["roles"])


@router.post("/", response_model=Role, dependencies=[Depends(require_permission("role:create"))])
async def create_role(
    role: RoleCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Assign a role to a user for a specific session.
    Only admins can create role assignments.
    """
    db = get_database()
    roles = db["roles"]
    users = db["users"]
    sessions = db["sessions"]
    
    # Verify user exists
    user = await users.find_one({"_id": ObjectId(role.userId)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify session exists
    session = await sessions.find_one({"_id": ObjectId(role.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if position already filled for this session
    existing = await roles.find_one({
        "sessionId": role.sessionId,
        "position": role.position
    })
    if existing:
        # Get current holder's name for error message
        current_holder = await users.find_one({"_id": ObjectId(existing["userId"])})
        holder_name = f"{current_holder.get('firstName', '')} {current_holder.get('lastName', '')}" if current_holder else "Unknown"
        raise HTTPException(
            status_code=400,
            detail=f"Position '{role.position}' is already held by {holder_name} in session {session['name']}"
        )
    
    # Create role assignment
    role_data = role.model_dump()
    role_data["createdAt"] = datetime.utcnow()
    role_data["updatedAt"] = datetime.utcnow()
    
    result = await roles.insert_one(role_data)
    created_role = await roles.find_one({"_id": result.inserted_id})
    
    # Convert ObjectId to string
    created_role["id"] = str(created_role.pop("_id"))
    
    return Role(**created_role)


@router.get("/")
async def list_roles(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    position: Optional[str] = Query(None, description="Filter by position"),
    current_user: User = Depends(get_current_user)
):
    """
    List role assignments with optional filters.
    Returns roles with populated user and session details.
    """
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]
    
    # Build query
    query = {}
    if session_id:
        query["sessionId"] = session_id
    if user_id:
        query["userId"] = user_id
    if position:
        query["position"] = position
    
    # Fetch roles
    cursor = roles_collection.find(query).sort("createdAt", -1)
    roles_list = await cursor.to_list(length=None)
    
    # Populate user and session details
    result = []
    for role in roles_list:
        # Get user details
        user = await users.find_one({"_id": ObjectId(role["userId"])})
        user_info = {
            "id": str(user["_id"]),
            "firstName": user.get("firstName", ""),
            "lastName": user.get("lastName", ""),
            "email": user.get("email", ""),
            "matricNumber": user.get("matricNumber", ""),
            "profilePhotoURL": user.get("profilePhotoURL", "")
        } if user else None
        
        # Get session details
        session = await sessions.find_one({"_id": ObjectId(role["sessionId"])})
        session_info = {
            "id": str(session["_id"]),
            "name": session.get("name", ""),
            "isActive": session.get("isActive", False)
        } if session else None
        
        # Build response
        role["id"] = str(role.pop("_id"))
        role["user"] = user_info
        role["session"] = session_info
        
        result.append(role)
    
    return result


@router.get("/executives")
async def get_executives(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    current_user: User = Depends(get_current_user)
):
    """
    Get executive team for a session.
    If no session_id provided, returns excos for active session.
    """
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]
    
    # If no session_id, get active session
    if not session_id:
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            return []
        session_id = str(active_session["_id"])
    
    # Define executive positions hierarchy
    exec_positions = [
        "president",
        "vice_president",
        "general_secretary",
        "assistant_general_secretary",
        "financial_secretary",
        "treasurer",
        "director_of_socials",
        "director_of_sports",
        "pro"
    ]
    
    # Fetch roles for session
    cursor = roles_collection.find({"sessionId": session_id})
    roles_list = await cursor.to_list(length=None)
    
    # Organize by position
    executives = {}
    for role in roles_list:
        if role["position"] in exec_positions:
            # Get user details
            user = await users.find_one({"_id": ObjectId(role["userId"])})
            if user:
                executives[role["position"]] = {
                    "position": role["position"],
                    "user": {
                        "id": str(user["_id"]),
                        "firstName": user.get("firstName", ""),
                        "lastName": user.get("lastName", ""),
                        "email": user.get("email", ""),
                        "matricNumber": user.get("matricNumber", ""),
                        "profilePhotoURL": user.get("profilePhotoURL", "")
                    },
                    "assignedAt": role.get("createdAt")
                }
    
    # Return in hierarchy order
    result = []
    for position in exec_positions:
        if position in executives:
            result.append(executives[position])
    
    return result


@router.get("/{role_id}", dependencies=[Depends(require_permission("role:view"))])
async def get_role(
    role_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific role assignment by ID"""
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]
    
    try:
        role = await roles_collection.find_one({"_id": ObjectId(role_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Populate user and session
    user = await users.find_one({"_id": ObjectId(role["userId"])})
    session = await sessions.find_one({"_id": ObjectId(role["sessionId"])})
    
    role["id"] = str(role.pop("_id"))
    role["user"] = {
        "id": str(user["_id"]),
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "email": user.get("email", ""),
        "matricNumber": user.get("matricNumber", "")
    } if user else None
    
    role["session"] = {
        "id": str(session["_id"]),
        "name": session.get("name", ""),
        "isActive": session.get("isActive", False)
    } if session else None
    
    return role


@router.patch("/{role_id}", dependencies=[Depends(require_permission("role:edit"))])
async def update_role(
    role_id: str,
    role_update: RoleUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update a role assignment.
    Only admins can update roles.
    """
    db = get_database()
    roles = db["roles"]
    
    try:
        existing = await roles.find_one({"_id": ObjectId(role_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Update only provided fields
    update_data = role_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # If changing position, check if new position is available
    if "position" in update_data:
        conflict = await roles.find_one({
            "sessionId": existing["sessionId"],
            "position": update_data["position"],
            "_id": {"$ne": ObjectId(role_id)}
        })
        if conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Position '{update_data['position']}' is already filled"
            )
    
    update_data["updatedAt"] = datetime.utcnow()
    
    await roles.update_one(
        {"_id": ObjectId(role_id)},
        {"$set": update_data}
    )
    
    updated_role = await roles.find_one({"_id": ObjectId(role_id)})
    updated_role["id"] = str(updated_role.pop("_id"))
    
    return Role(**updated_role)


@router.delete("/{role_id}", dependencies=[Depends(require_permission("role:delete"))])
async def delete_role(
    role_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Remove a role assignment.
    Only admins can delete roles.
    """
    db = get_database()
    roles = db["roles"]
    
    try:
        result = await roles.delete_one({"_id": ObjectId(role_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {"message": "Role assignment deleted successfully"}


@router.get("/my-roles/current")
async def get_my_roles(current_user: User = Depends(get_current_user)):
    """
    Get current user's role assignments across all sessions.
    """
    db = get_database()
    roles_collection = db["roles"]
    sessions = db["sessions"]
    
    # Fetch user's roles
    cursor = roles_collection.find({"userId": current_user.id}).sort("createdAt", -1)
    roles_list = await cursor.to_list(length=None)
    
    # Populate session details
    result = []
    for role in roles_list:
        # Get session details
        session = await sessions.find_one({"_id": ObjectId(role["sessionId"])})
        session_info = {
            "id": str(session["_id"]),
            "name": session.get("name", ""),
            "isActive": session.get("isActive", False)
        } if session else None
        
        role["id"] = str(role.pop("_id"))
        role["session"] = session_info
        
        result.append(role)
    
    return result
