"""
Event Models - Session-scoped event management

CRITICAL: All events MUST have session_id.
Events from different sessions are completely separate.
"""

from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from datetime import datetime
from bson import ObjectId


EventCategory = Literal["Academic", "Social", "Career", "Workshop", "Competition", "Other"]


class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    sessionId: str = Field(..., description="REQUIRED: Links event to academic session")
    date: datetime
    location: str = Field(..., min_length=1, max_length=200)
    category: EventCategory = Field(default="Other")
    description: str = Field(..., max_length=2000)
    maxAttendees: Optional[int] = Field(None, gt=0, description="Maximum number of attendees (null = unlimited)")
    registrationDeadline: Optional[datetime] = None
    imageUrl: Optional[str] = None
    requiresPayment: bool = Field(default=False)
    paymentAmount: Optional[float] = Field(None, ge=0)


class EventCreate(EventBase):
    """Model for creating a new event"""
    createdBy: str = Field(..., description="User ID of event creator")


class EventUpdate(BaseModel):
    """Model for updating event details"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    date: Optional[datetime] = None
    location: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[EventCategory] = None
    description: Optional[str] = Field(None, max_length=2000)
    maxAttendees: Optional[int] = Field(None, gt=0)
    registrationDeadline: Optional[datetime] = None
    imageUrl: Optional[str] = None


class Event(EventBase):
    """Event response model"""
    id: str = Field(alias="_id")
    createdBy: Optional[str] = Field(None)
    registrations: List[str] = Field(default_factory=list, description="List of User IDs registered")
    attendees: List[str] = Field(default_factory=list, description="List of User IDs who attended")
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class EventWithStatus(Event):
    """Event with user's registration status"""
    isRegistered: bool = Field(default=False)
    hasAttended: bool = Field(default=False)
    isFull: bool = Field(default=False)


class EventRegistration(BaseModel):
    """Model for registering for an event"""
    eventId: str
    studentId: str
    registeredAt: datetime = Field(default_factory=datetime.utcnow)
