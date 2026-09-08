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
TargetAudience = Literal[
    "all",
    "ipe",
    "external",
    "exco_only",
    "team_leads_only",
    "class_rep_and_assistant",
    "specific_students",
    "specific_levels",  # legacy class-rep value
    "custom_emails",
]


class Attachment(BaseModel):
    id: Optional[str] = None
    name: str
    url: str
    type: str = "document"  # "image" | "pdf" | "document" | "other"
    size: Optional[int] = None


class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1, max_length=50000)
    sessionId: str = Field(..., description="REQUIRED: Links announcement to academic session")
    priority: PriorityLevel = Field(default="normal")
    targetLevels: Optional[List[str]] = Field(None, description="Specific levels to show to (null = all)")
    targetAudience: TargetAudience = Field(default="all", description="Who sees this: all, ipe (IPE only), external (external depts only)")
    targetUserIds: Optional[List[str]] = Field(None, description="Specific user IDs to target when targetAudience is specific_students")
    customEmails: Optional[List[str]] = Field(default_factory=list, description="Custom recipient emails when targetAudience is custom_emails")
    isPinned: bool = Field(default=False, description="Pinned announcements appear at top")
    expiresAt: Optional[datetime] = Field(None, description="Auto-hide after this date")
    scheduledFor: Optional[datetime] = Field(None, description="Publish at this time (null = publish immediately)")
    sendEmail: bool = Field(default=True, description="Send email notification to targeted students")
    attachments: Optional[List[Attachment]] = Field(default_factory=list, description="Media attachments")

    def __init__(self, **data):
        # Normalise targetLevels to canonical "NL" format (e.g. "100L", "200L")
        if "targetLevels" in data and data["targetLevels"]:
            normalised = []
            for lv in data["targetLevels"]:
                s = str(lv).strip().upper().replace("LEVEL", "").strip()
                # Strip trailing L if present, then re-add to ensure consistent format
                s = s.rstrip("L")
                if s.isdigit():
                    normalised.append(f"{s}L")
                else:
                    normalised.append(str(lv))  # keep as-is for non-numeric (e.g. "PG")
            data["targetLevels"] = normalised
        super().__init__(**data)


class AnnouncementCreate(AnnouncementBase):
    """Model for creating a new announcement"""
    authorId: str = Field(..., description="User ID of announcement creator")


class AnnouncementUpdate(BaseModel):
    """Model for updating announcement"""
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1, max_length=50000)
    priority: Optional[PriorityLevel] = None
    targetLevels: Optional[List[str]] = None
    targetAudience: Optional[TargetAudience] = None
    targetUserIds: Optional[List[str]] = None
    customEmails: Optional[List[str]] = None
    isPinned: Optional[bool] = None
    expiresAt: Optional[datetime] = None
    scheduledFor: Optional[datetime] = None
    sendEmail: Optional[bool] = None
    attachments: Optional[List[Attachment]] = None
    resendNotification: Optional[bool] = Field(False, description="Whether to re-dispatch notifications and email upon update")


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
