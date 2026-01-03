"""
Grade Models - Session-scoped academic records (CGPA tracking)

CRITICAL: All grades MUST have session_id.
A student's grades are tied to specific sessions.
"""

from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
from bson import ObjectId


class Course(BaseModel):
    """Individual course within a semester"""
    code: str = Field(..., min_length=1, max_length=20, description="e.g., IEN 301")
    title: str = Field(..., min_length=1, max_length=200)
    units: int = Field(..., ge=1, le=6, description="Credit units (1-6)")
    score: float = Field(..., ge=0, le=100, description="Score out of 100")

    @property
    def grade_point(self) -> float:
        """Calculate grade point based on 5.0 scale"""
        if self.score >= 70:
            return 5.0
        elif self.score >= 60:
            return 4.0
        elif self.score >= 50:
            return 3.0
        elif self.score >= 45:
            return 2.0
        elif self.score >= 40:
            return 1.0
        else:
            return 0.0


class Semester(BaseModel):
    """Semester data within a session"""
    semesterNumber: int = Field(..., ge=1, le=2, description="1 or 2")
    courses: List[Course] = Field(default_factory=list)

    @property
    def gpa(self) -> float:
        """Calculate GPA for this semester"""
        if not self.courses:
            return 0.0
        total_points = sum(course.grade_point * course.units for course in self.courses)
        total_units = sum(course.units for course in self.courses)
        return round(total_points / total_units, 2) if total_units > 0 else 0.0


class GradeBase(BaseModel):
    studentId: str = Field(..., description="Reference to User._id")
    sessionId: str = Field(..., description="REQUIRED: Links grades to academic session")
    level: str = Field(..., description="Student's level in this session (100L, 200L, etc.)")
    semesters: List[Semester] = Field(default_factory=list, max_length=2)


class GradeCreate(GradeBase):
    """Model for creating/updating grade records"""
    pass


class Grade(GradeBase):
    """Grade response model"""
    id: str = Field(alias="_id")
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

    @property
    def session_gpa(self) -> float:
        """Calculate GPA across all semesters in this session"""
        if not self.semesters:
            return 0.0
        all_courses = [course for sem in self.semesters for course in sem.courses]
        if not all_courses:
            return 0.0
        total_points = sum(course.grade_point * course.units for course in all_courses)
        total_units = sum(course.units for course in all_courses)
        return round(total_points / total_units, 2) if total_units > 0 else 0.0


class CGPAResponse(BaseModel):
    """Response model for cumulative GPA calculation"""
    studentId: str
    cgpa: float
    totalUnits: int
    sessions: List[dict]  # List of session summaries with GPAs
