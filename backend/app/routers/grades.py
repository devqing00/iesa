"""
Grades Router - Session-Aware Academic Records (CGPA Tracking)

CRITICAL: All grades are session-scoped.
A student's grades are tied to specific sessions and levels.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.models.grade import Grade, GradeCreate, CGPAResponse, Course, Semester
from app.db import get_database
from app.core.security import get_current_user, require_role

router = APIRouter(prefix="/api/grades", tags=["Grades"])


@router.post("/", response_model=Grade, status_code=status.HTTP_201_CREATED)
async def create_or_update_grades(
    grade_data: GradeCreate,
    user: dict = Depends(get_current_user)
):
    """
    Create or update grade record for a session.
    
    Students can only update their own grades.
    Admins/excos can update anyone's grades.
    """
    db = get_database()
    grades = db["grades"]
    
    # Verify session exists
    sessions = db["sessions"]
    session = await sessions.find_one({"_id": ObjectId(grade_data.sessionId)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {grade_data.sessionId} not found"
        )
    
    # Students can only update their own grades
    if user.get("role") == "student" and grade_data.studentId != user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only update their own grades"
        )
    
    # Check if grade record exists for this student + session
    existing_grade = await grades.find_one({
        "studentId": grade_data.studentId,
        "sessionId": grade_data.sessionId
    })
    
    if existing_grade:
        # Update existing record
        update_data = grade_data.model_dump()
        update_data["updatedAt"] = datetime.utcnow()
        
        await grades.update_one(
            {"_id": existing_grade["_id"]},
            {"$set": update_data}
        )
        
        updated_grade = await grades.find_one({"_id": existing_grade["_id"]})
        updated_grade["_id"] = str(updated_grade["_id"])
        
        return Grade(**updated_grade)
    
    else:
        # Create new record
        grade_dict = grade_data.model_dump()
        grade_dict["createdAt"] = datetime.utcnow()
        grade_dict["updatedAt"] = datetime.utcnow()
        
        result = await grades.insert_one(grade_dict)
        created_grade = await grades.find_one({"_id": result.inserted_id})
        created_grade["_id"] = str(created_grade["_id"])
        
        return Grade(**created_grade)


@router.get("/", response_model=List[Grade])
async def list_grades(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    student_id: Optional[str] = Query(None, description="Filter by student ID"),
    user: dict = Depends(get_current_user)
):
    """
    List grade records.
    
    Students can only see their own grades.
    Admins/excos can see all grades.
    """
    db = get_database()
    grades = db["grades"]
    
    # Build query
    query = {}
    
    if session_id:
        query["sessionId"] = session_id
    
    if student_id:
        # Verify permission
        if user.get("role") == "student" and student_id != user["_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students can only view their own grades"
            )
        query["studentId"] = student_id
    else:
        # If no student_id specified and user is student, show their grades only
        if user.get("role") == "student":
            query["studentId"] = user["_id"]
    
    cursor = grades.find(query).sort("createdAt", -1)
    grade_list = await cursor.to_list(length=None)
    
    return [
        Grade(**{**g, "_id": str(g["_id"])})
        for g in grade_list
    ]


@router.get("/cgpa", response_model=CGPAResponse)
async def calculate_cgpa(
    student_id: Optional[str] = Query(None, description="Student ID (defaults to current user)"),
    user: dict = Depends(get_current_user)
):
    """
    Calculate cumulative GPA across all sessions.
    
    Students can only calculate their own CGPA.
    Admins/excos can calculate for any student.
    """
    db = get_database()
    grades = db["grades"]
    sessions = db["sessions"]
    
    # Determine target student
    target_student_id = student_id or user["_id"]
    
    # Verify permission
    if user.get("role") == "student" and target_student_id != user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own CGPA"
        )
    
    # Get all grade records for this student
    cursor = grades.find({"studentId": target_student_id}).sort("createdAt", 1)
    grade_records = await cursor.to_list(length=None)
    
    if not grade_records:
        return CGPAResponse(
            studentId=target_student_id,
            cgpa=0.0,
            totalUnits=0,
            sessions=[]
        )
    
    # Calculate cumulative totals
    cumulative_points = 0.0
    cumulative_units = 0
    session_summaries = []
    
    for record in grade_records:
        session_points = 0.0
        session_units = 0
        
        # Calculate for each semester in the session
        for semester in record.get("semesters", []):
            for course_data in semester.get("courses", []):
                course = Course(**course_data)
                session_points += course.grade_point * course.units
                session_units += course.units
        
        # Add to cumulative
        cumulative_points += session_points
        cumulative_units += session_units
        
        # Get session name
        session = await sessions.find_one({"_id": ObjectId(record["sessionId"])})
        session_name = session.get("name", "Unknown") if session else "Unknown"
        
        session_gpa = round(session_points / session_units, 2) if session_units > 0 else 0.0
        
        session_summaries.append({
            "sessionId": record["sessionId"],
            "sessionName": session_name,
            "level": record.get("level"),
            "gpa": session_gpa,
            "units": session_units
        })
    
    # Calculate CGPA
    cgpa = round(cumulative_points / cumulative_units, 2) if cumulative_units > 0 else 0.0
    
    return CGPAResponse(
        studentId=target_student_id,
        cgpa=cgpa,
        totalUnits=cumulative_units,
        sessions=session_summaries
    )


@router.get("/{grade_id}", response_model=Grade)
async def get_grade(
    grade_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific grade record by ID"""
    db = get_database()
    grades = db["grades"]
    
    if not ObjectId.is_valid(grade_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid grade ID format"
        )
    
    grade = await grades.find_one({"_id": ObjectId(grade_id)})
    
    if not grade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grade record {grade_id} not found"
        )
    
    # Verify permission
    if user.get("role") == "student" and grade["studentId"] != user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own grades"
        )
    
    grade["_id"] = str(grade["_id"])
    return Grade(**grade)


@router.delete("/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grade(
    grade_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Delete a grade record.
    Students can delete their own records, admins can delete any.
    """
    db = get_database()
    grades = db["grades"]
    
    if not ObjectId.is_valid(grade_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid grade ID format"
        )
    
    # Get the grade to check ownership
    grade = await grades.find_one({"_id": ObjectId(grade_id)})
    if not grade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grade record {grade_id} not found"
        )
    
    # Verify permission
    if user.get("role") == "student" and grade["studentId"] != user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only delete their own grades"
        )
    
    await grades.delete_one({"_id": ObjectId(grade_id)})
    
    return None
