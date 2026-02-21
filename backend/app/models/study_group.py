"""
Study Group Models

Study groups allow students to find and join study partners
for specific courses or topics.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class StudyGroupBase(BaseModel):
    """Base model for study groups"""
    name: str = Field(..., min_length=1, max_length=100, description="Group name")
    courseCode: str = Field(..., min_length=2, max_length=20, description="Course code, e.g. IEN 301")
    courseName: Optional[str] = Field(None, max_length=200, description="Full course name")
    description: Optional[str] = Field(None, max_length=500, description="What the group is studying")
    maxMembers: int = Field(default=8, ge=2, le=20, description="Maximum members")
    meetingDay: Optional[str] = Field(None, description="Preferred meeting day")
    meetingTime: Optional[str] = Field(None, description="Preferred meeting time")
    meetingLocation: Optional[str] = Field(None, max_length=200, description="Where the group meets")
    level: Optional[Literal["100L", "200L", "300L", "400L", "500L"]] = None
    tags: list[str] = Field(default_factory=list, max_length=5, description="Study topics or tags")
    isOpen: bool = Field(default=True, description="Whether new members can join")


class StudyGroupCreate(StudyGroupBase):
    """Model for creating a study group"""
    pass


class StudyGroupUpdate(BaseModel):
    """Model for updating a study group"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    maxMembers: Optional[int] = Field(None, ge=2, le=20)
    meetingDay: Optional[str] = None
    meetingTime: Optional[str] = None
    meetingLocation: Optional[str] = Field(None, max_length=200)
    tags: Optional[list[str]] = None
    isOpen: Optional[bool] = None


class StudyGroupMember(BaseModel):
    """Embedded member info"""
    userId: str
    firstName: str
    lastName: str
    matricNumber: Optional[str] = None
    joinedAt: datetime = Field(default_factory=datetime.utcnow)


class StudyGroupInDB(StudyGroupBase):
    """Full study group document as stored in MongoDB"""
    createdBy: str  # user_id
    creatorName: str
    members: list[StudyGroupMember] = Field(default_factory=list)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
