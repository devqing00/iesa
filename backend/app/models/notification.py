"""
Notification Model

In-app notifications for students and admins.
Types: announcement, event, payment, transfer, role, system
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


NOTIFICATION_TYPES = Literal[
    "announcement",
    "event",
    "payment",
    "transfer_approved",
    "transfer_rejected",
    "role_assigned",
    "enrollment",
    "system",
]


class NotificationCreate(BaseModel):
    """Internal model for creating a notification (not an API model)."""
    userId: str = Field(..., description="Target user ID")
    type: NOTIFICATION_TYPES
    title: str = Field(..., max_length=200)
    message: str = Field(..., max_length=500)
    link: Optional[str] = Field(None, max_length=500, description="Frontend route to navigate to")
    relatedId: Optional[str] = Field(None, description="Related document ID (announcement, event, etc.)")


class NotificationOut(BaseModel):
    """API response model for a notification."""
    id: str = Field(alias="_id")
    userId: str
    type: str
    title: str
    message: str
    link: Optional[str] = None
    relatedId: Optional[str] = None
    isRead: bool = False
    createdAt: datetime

    class Config:
        populate_by_name = True
