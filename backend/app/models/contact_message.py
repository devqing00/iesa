"""
Contact Message Models

Messages submitted via the public contact form.
Not session-scoped — these are general inquiries.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal
from datetime import datetime
from bson import ObjectId


MessageStatus = Literal["unread", "read", "replied", "archived"]


class ContactMessageCreate(BaseModel):
    """Public contact form submission"""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(...)
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=10, max_length=5000)


class ContactMessageUpdate(BaseModel):
    """Admin update (mark read, add note, archive)"""
    status: Optional[MessageStatus] = None
    adminNote: Optional[str] = Field(None, max_length=2000)


class ContactMessage(BaseModel):
    """Full contact message response"""
    id: str = Field(alias="_id")
    name: str
    email: str
    subject: str
    message: str
    status: MessageStatus = "unread"
    adminNote: Optional[str] = None
    repliedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
