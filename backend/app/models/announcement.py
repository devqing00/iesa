"""
Announcement Models - Session-scoped communications

CRITICAL: All announcements MUST have session_id.
Announcements are specific to an academic session.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from bson import ObjectId


PriorityLevel = Literal["low", "normal", "high", "urgent"]


class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=5000)
    sessionId: str = Field(..., description="REQUIRED: Links announcement to academic session")
    priority: PriorityLevel = Field(default="normal")
    targetLevels: Optional[List[str]] = Field(None, description="Specific levels to show to (null = all)")
    isPinned: bool = Field(default=False, description="Pinned announcements appear at top")
    expiresAt: Optional[datetime] = Field(None, description="Auto-hide after this date")


class AnnouncementCreate(AnnouncementBase):
    """Model for creating a new announcement"""
    authorId: str = Field(..., description="User ID of announcement creator")


class AnnouncementUpdate(BaseModel):
    """Model for updating announcement"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=5000)
    priority: Optional[PriorityLevel] = None
    targetLevels: Optional[List[str]] = None
    isPinned: Optional[bool] = None
    expiresAt: Optional[datetime] = None


class Announcement(AnnouncementBase):
    """Announcement response model"""
    id: str = Field(alias="_id")
    authorId: str
    authorName: str = Field(default="Admin")
    readBy: List[str] = Field(default_factory=list, description="List of User IDs who read this")
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class AnnouncementWithStatus(Announcement):
    """Announcement with user's read status"""
    isRead: bool = Field(default=False)
