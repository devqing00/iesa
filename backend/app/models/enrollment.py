"""
Enrollment Models - Links students to sessions

Enrollments track which session a student is participating in
and their current level for that session.
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
from bson import ObjectId


LevelType = Literal["100L", "200L", "300L", "400L", "500L"]


class EnrollmentBase(BaseModel):
    studentId: str = Field(..., description="Reference to User._id")
    sessionId: str = Field(..., description="Reference to Session._id (REQUIRED)")
    level: LevelType = Field(..., description="Student's level in this session")


class EnrollmentCreate(EnrollmentBase):
    """Model for enrolling a student in a session"""
    pass


class EnrollmentUpdate(BaseModel):
    """Model for updating an enrollment"""
    level: Optional[LevelType] = Field(None, description="Update student's level")
    isActive: Optional[bool] = Field(None, description="Update enrollment active status")


class Enrollment(EnrollmentBase):
    """Enrollment response model"""
    id: str = Field(alias="_id")
    enrollmentDate: datetime
    isActive: bool = Field(default=True)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class EnrollmentWithDetails(Enrollment):
    """Enrollment with populated student and session details"""
    studentName: str
    studentMatric: str
    sessionName: str
