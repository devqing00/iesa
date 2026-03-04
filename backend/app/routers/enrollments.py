"""
Enrollment Management Router

Handles student enrollment in academic sessions with their level (100L-500L).
Admins can view, create, update, and delete enrollments.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from bson import ObjectId
from datetime import datetime, timezone

from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.models.enrollment import Enrollment, EnrollmentCreate, EnrollmentUpdate
from app.models.user import User
from app.db import get_database
from app.core.audit import AuditLogger

router = APIRouter(prefix="/api/v1/enrollments", tags=["enrollments"])


@router.post("/", response_model=Enrollment, dependencies=[Depends(require_permission("enrollment:create"))])
async def create_enrollment(
    enrollment: EnrollmentCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new enrollment (assign student to session with level).
    Requires enrollment:create permission.
    """
    db = get_database()
    enrollments = db["enrollments"]
    users = db["users"]
    sessions = db["sessions"]
    
    # Verify student exists
    if not ObjectId.is_valid(enrollment.studentId):
        raise HTTPException(status_code=400, detail="Invalid student ID")
    student = await users.find_one({"_id": ObjectId(enrollment.studentId)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Verify session exists
    if not ObjectId.is_valid(enrollment.sessionId):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    session = await sessions.find_one({"_id": ObjectId(enrollment.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if enrollment already exists
    existing = await enrollments.find_one({
        "studentId": enrollment.studentId,
        "sessionId": enrollment.sessionId
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Student already enrolled in session {session['name']}"
        )
    
    # Create enrollment
    enrollment_data = enrollment.model_dump()
    enrollment_data["enrollmentDate"] = datetime.now(timezone.utc)
    enrollment_data["isActive"] = True
    enrollment_data["createdAt"] = datetime.now(timezone.utc)
    enrollment_data["updatedAt"] = datetime.now(timezone.utc)
    
    result = await enrollments.insert_one(enrollment_data)
    created_enrollment = await enrollments.find_one({"_id": result.inserted_id})
    
    # Convert ObjectId to string
    created_enrollment["id"] = str(created_enrollment.pop("_id"))
    
    await AuditLogger.log(
        action=AuditLogger.ENROLLMENT_CREATED,
        actor_id=str(current_user.get("_id", "") if isinstance(current_user, dict) else getattr(current_user, "_id", "")),
        actor_email=str(current_user.get("email", "") if isinstance(current_user, dict) else getattr(current_user, "email", "")),
        resource_type="enrollment",
        resource_id=str(result.inserted_id),
        session_id=enrollment.sessionId,
        details={"student_id": enrollment.studentId, "level": enrollment.level}
    )
    from app.routers.sse import publish
    from app.core.cache import cache_delete
    publish("enrollment_created", {"id": str(result.inserted_id), "level": enrollment.level})
    await cache_delete("admin_stats")
    return Enrollment(**created_enrollment)


@router.get("/", dependencies=[Depends(require_permission("enrollment:view"))])
async def list_enrollments(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    student_id: Optional[str] = Query(None, description="Filter by student ID"),
    level: Optional[str] = Query(None, description="Filter by level (100L-500L)"),
    search: Optional[str] = Query(None, description="Search by student name, email or matric"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user)
):
    """
    List enrollments with optional filters.
    Only admins and excos can view all enrollments.
    Returns enrollments with populated student and session details.
    """
    db = get_database()
    enrollments = db["enrollments"]
    users = db["users"]
    sessions = db["sessions"]
    
    # Build query
    query = {}
    if session_id:
        query["sessionId"] = session_id
    if student_id:
        query["studentId"] = student_id
    if level:
        query["level"] = level
    
    # If search is provided, we need to match against student names/email —
    # first find matching user IDs, then filter enrollments.
    matching_student_ids = None
    if search:
        search_regex = {"$regex": re.escape(search), "$options": "i"}
        user_query = {"$or": [
            {"firstName": search_regex},
            {"lastName": search_regex},
            {"email": search_regex},
            {"matricNumber": search_regex},
        ]}
        matching_users = await users.find(user_query, {"_id": 1}).to_list(length=5000)
        matching_student_ids = [str(u["_id"]) for u in matching_users]
        query["studentId"] = {"$in": matching_student_ids}

    # Get total count first
    total = await enrollments.count_documents(query)
    
    # Fetch paginated enrollments
    cursor = enrollments.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    enrollments_list = await cursor.to_list(length=limit)
    
    # Populate student and session details (batch to avoid N+1)
    all_student_ids = set()
    all_session_ids = set()
    for enrollment in enrollments_list:
        sid = enrollment.get("studentId")
        if sid:
            all_student_ids.add(str(sid) if isinstance(sid, ObjectId) else sid)
        ssid = enrollment.get("sessionId")
        if ssid:
            all_session_ids.add(str(ssid) if isinstance(ssid, ObjectId) else ssid)

    # Batch-fetch users
    student_oids = [ObjectId(s) for s in all_student_ids if ObjectId.is_valid(s)]
    student_map = {}
    if student_oids:
        async for u in users.find({"_id": {"$in": student_oids}}, {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1}):
            student_map[str(u["_id"])] = u

    # Batch-fetch sessions
    session_oids = [ObjectId(s) for s in all_session_ids if ObjectId.is_valid(s)]
    session_map = {}
    if session_oids:
        async for s in sessions.find({"_id": {"$in": session_oids}}, {"name": 1, "isActive": 1}):
            session_map[str(s["_id"])] = s

    result = []
    for enrollment in enrollments_list:
        try:
            student_id_str = str(enrollment["studentId"]) if isinstance(enrollment["studentId"], ObjectId) else enrollment["studentId"]
            session_id_str = str(enrollment["sessionId"]) if isinstance(enrollment["sessionId"], ObjectId) else enrollment["sessionId"]

            student = student_map.get(student_id_str)
            student_info = {
                "id": str(student["_id"]),
                "firstName": student.get("firstName", ""),
                "lastName": student.get("lastName", ""),
                "email": student.get("email", ""),
                "matricNumber": student.get("matricNumber", "")
            } if student else None

            session = session_map.get(session_id_str)
            session_info = {
                "id": str(session["_id"]),
                "name": session.get("name", ""),
                "isActive": session.get("isActive", False)
            } if session else None

            enrollment["id"] = str(enrollment.pop("_id"))
            enrollment["studentId"] = student_id_str
            enrollment["sessionId"] = session_id_str
            enrollment["student"] = student_info
            enrollment["session"] = session_info

            result.append(enrollment)
        except Exception:
            continue
    
    return {"items": result, "total": total}


@router.get("/my-enrollments")
async def get_my_enrollments(current_user: User = Depends(get_current_user)):
    """
    Get enrollments for the current user.
    Students can view their own enrollments.
    """
    db = get_database()
    enrollments = db["enrollments"]
    sessions = db["sessions"]
    
    # Fetch user's enrollments
    cursor = enrollments.find({"studentId": current_user.get("_id", "")}).sort("createdAt", -1)
    enrollments_list = await cursor.to_list(length=None)
    
    # Populate session details (batch)
    session_ids = list({e["sessionId"] for e in enrollments_list if e.get("sessionId")})
    session_oids = [ObjectId(s) for s in session_ids if ObjectId.is_valid(s)]
    session_map = {}
    if session_oids:
        async for s in sessions.find({"_id": {"$in": session_oids}}, {"name": 1, "isActive": 1, "startDate": 1, "endDate": 1, "currentSemester": 1}):
            session_map[str(s["_id"])] = s

    result = []
    for enrollment in enrollments_list:
        session = session_map.get(enrollment.get("sessionId", ""))
        session_info = {
            "id": str(session["_id"]),
            "name": session.get("name", ""),
            "isActive": session.get("isActive", False),
            "startDate": session.get("startDate"),
            "endDate": session.get("endDate"),
            "currentSemester": session.get("currentSemester")
        } if session else None

        enrollment["id"] = str(enrollment.pop("_id"))
        enrollment["session"] = session_info
        result.append(enrollment)
    
    return result


@router.get("/{enrollment_id}", dependencies=[Depends(require_permission("enrollment:view"))])
async def get_enrollment(
    enrollment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific enrollment by ID"""
    db = get_database()
    enrollments = db["enrollments"]
    users = db["users"]
    sessions = db["sessions"]
    
    try:
        enrollment = await enrollments.find_one({"_id": ObjectId(enrollment_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid enrollment ID")
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Populate student and session
    student = await users.find_one({"_id": ObjectId(enrollment["studentId"])})
    session = await sessions.find_one({"_id": ObjectId(enrollment["sessionId"])})
    
    enrollment["id"] = str(enrollment.pop("_id"))
    enrollment["student"] = {
        "id": str(student["_id"]),
        "firstName": student.get("firstName", ""),
        "lastName": student.get("lastName", ""),
        "email": student.get("email", ""),
        "matricNumber": student.get("matricNumber", "")
    } if student else None
    
    enrollment["session"] = {
        "id": str(session["_id"]),
        "name": session.get("name", ""),
        "isActive": session.get("isActive", False)
    } if session else None
    
    return enrollment


@router.patch("/{enrollment_id}", dependencies=[Depends(require_permission("enrollment:edit"))])
async def update_enrollment(
    enrollment_id: str,
    enrollment_update: EnrollmentUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update an enrollment (mainly to change level).
    Only admins and excos can update enrollments.
    """
    db = get_database()
    enrollments = db["enrollments"]
    
    try:
        existing = await enrollments.find_one({"_id": ObjectId(enrollment_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid enrollment ID")
    
    if not existing:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Update only provided fields
    update_data = enrollment_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    await enrollments.update_one(
        {"_id": ObjectId(enrollment_id)},
        {"$set": update_data}
    )
    
    updated_enrollment = await enrollments.find_one({"_id": ObjectId(enrollment_id)})
    updated_enrollment["id"] = str(updated_enrollment.pop("_id"))
    
    await AuditLogger.log(
        action=AuditLogger.ENROLLMENT_UPDATED,
        actor_id=str(current_user.get("_id", "") if isinstance(current_user, dict) else getattr(current_user, "_id", "")),
        actor_email=str(current_user.get("email", "") if isinstance(current_user, dict) else getattr(current_user, "email", "")),
        resource_type="enrollment",
        resource_id=enrollment_id,
        details={"updated_fields": list(update_data.keys())}
    )
    return Enrollment(**updated_enrollment)


@router.delete("/{enrollment_id}", dependencies=[Depends(require_permission("enrollment:delete"))])
async def delete_enrollment(
    enrollment_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete an enrollment.
    Only admins can delete enrollments.
    """
    db = get_database()
    enrollments = db["enrollments"]
    
    try:
        result = await enrollments.delete_one({"_id": ObjectId(enrollment_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid enrollment ID")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    actor_id = str(current_user.get("_id", "") if isinstance(current_user, dict) else getattr(current_user, "_id", ""))
    actor_email = str(current_user.get("email", "") if isinstance(current_user, dict) else getattr(current_user, "email", ""))
    await AuditLogger.log(
        action=AuditLogger.ENROLLMENT_DELETED,
        actor_id=actor_id,
        actor_email=actor_email,
        resource_type="enrollment",
        resource_id=enrollment_id,
    )
    from app.routers.sse import publish
    from app.core.cache import cache_delete
    publish("enrollment_deleted", {"id": enrollment_id})
    await cache_delete("admin_stats")
    return {"message": "Enrollment deleted successfully"}


@router.post("/bulk", dependencies=[Depends(require_permission("enrollment:create"))])
async def bulk_enroll_students(
    enrollments: List[EnrollmentCreate],
    current_user: User = Depends(get_current_user)
):
    """
    Bulk enroll students in a session.
    Useful for importing students from CSV.
    """
    db = get_database()
    enrollments_collection = db["enrollments"]
    users = db["users"]
    sessions = db["sessions"]
    
    created = []
    errors = []
    
    for idx, enrollment in enumerate(enrollments):
        try:
            # Verify student exists
            student = await users.find_one({"_id": ObjectId(enrollment.studentId)})
            if not student:
                errors.append({"index": idx, "error": "Student not found"})
                continue
            
            # Verify session exists
            session = await sessions.find_one({"_id": ObjectId(enrollment.sessionId)})
            if not session:
                errors.append({"index": idx, "error": "Session not found"})
                continue
            
            # Check if already enrolled
            existing = await enrollments_collection.find_one({
                "studentId": enrollment.studentId,
                "sessionId": enrollment.sessionId
            })
            if existing:
                errors.append({"index": idx, "error": "Already enrolled"})
                continue
            
            # Create enrollment
            enrollment_data = enrollment.model_dump()
            enrollment_data["createdAt"] = datetime.now(timezone.utc)
            enrollment_data["updatedAt"] = datetime.now(timezone.utc)
            
            result = await enrollments_collection.insert_one(enrollment_data)
            created.append(str(result.inserted_id))
            
        except Exception as e:
            errors.append({"index": idx, "error": str(e)})
    
    return {
        "created": len(created),
        "errors": len(errors),
        "createdIds": created,
        "errorDetails": errors
    }
