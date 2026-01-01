"""
Enrollment Management Router

Handles student enrollment in academic sessions with their level (100L-500L).
Admins can view, create, update, and delete enrollments.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.models.enrollment import Enrollment, EnrollmentCreate, EnrollmentUpdate
from app.models.user import User
from app.db import get_database

router = APIRouter(prefix="/api/enrollments", tags=["enrollments"])


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
    student = await users.find_one({"_id": ObjectId(enrollment.studentId)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Verify session exists
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
    enrollment_data["createdAt"] = datetime.utcnow()
    enrollment_data["updatedAt"] = datetime.utcnow()
    
    result = await enrollments.insert_one(enrollment_data)
    created_enrollment = await enrollments.find_one({"_id": result.inserted_id})
    
    # Convert ObjectId to string
    created_enrollment["id"] = str(created_enrollment.pop("_id"))
    
    return Enrollment(**created_enrollment)


@router.get("/", dependencies=[Depends(require_permission("enrollment:view"))])
async def list_enrollments(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    student_id: Optional[str] = Query(None, description="Filter by student ID"),
    level: Optional[str] = Query(None, description="Filter by level (100L-500L)"),
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
    
    # Fetch enrollments
    cursor = enrollments.find(query).sort("createdAt", -1)
    enrollments_list = await cursor.to_list(length=None)
    
    # Populate student and session details
    result = []
    for enrollment in enrollments_list:
        # Get student details
        student = await users.find_one({"_id": ObjectId(enrollment["studentId"])})
        student_info = {
            "id": str(student["_id"]),
            "firstName": student.get("firstName", ""),
            "lastName": student.get("lastName", ""),
            "email": student.get("email", ""),
            "matricNumber": student.get("matricNumber", "")
        } if student else None
        
        # Get session details
        session = await sessions.find_one({"_id": ObjectId(enrollment["sessionId"])})
        session_info = {
            "id": str(session["_id"]),
            "name": session.get("name", ""),
            "isActive": session.get("isActive", False)
        } if session else None
        
        # Build response
        enrollment["id"] = str(enrollment.pop("_id"))
        enrollment["student"] = student_info
        enrollment["session"] = session_info
        
        result.append(enrollment)
    
    return result


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
    cursor = enrollments.find({"studentId": current_user.id}).sort("createdAt", -1)
    enrollments_list = await cursor.to_list(length=None)
    
    # Populate session details
    result = []
    for enrollment in enrollments_list:
        # Get session details
        session = await sessions.find_one({"_id": ObjectId(enrollment["sessionId"])})
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
    
    update_data["updatedAt"] = datetime.utcnow()
    
    await enrollments.update_one(
        {"_id": ObjectId(enrollment_id)},
        {"$set": update_data}
    )
    
    updated_enrollment = await enrollments.find_one({"_id": ObjectId(enrollment_id)})
    updated_enrollment["id"] = str(updated_enrollment.pop("_id"))
    
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
            enrollment_data["createdAt"] = datetime.utcnow()
            enrollment_data["updatedAt"] = datetime.utcnow()
            
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
