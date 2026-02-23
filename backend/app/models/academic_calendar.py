"""Academic calendar event model for semester milestones, exam periods, holidays, etc."""

from datetime import datetime
from typing import Optional
from enum import Enum

from pydantic import BaseModel, Field


class AcademicEventType(str, Enum):
    """Types of academic calendar events."""
    exam_period = "exam_period"
    registration = "registration"
    add_drop = "add_drop"
    holiday = "holiday"
    break_period = "break_period"
    orientation = "orientation"
    convocation = "convocation"
    lecture_start = "lecture_start"
    lecture_end = "lecture_end"
    deadline = "deadline"
    other = "other"


EVENT_TYPE_LABELS = {
    AcademicEventType.exam_period: "Exam Period",
    AcademicEventType.registration: "Course Registration",
    AcademicEventType.add_drop: "Add/Drop Period",
    AcademicEventType.holiday: "Holiday",
    AcademicEventType.break_period: "Break",
    AcademicEventType.orientation: "Orientation",
    AcademicEventType.convocation: "Convocation",
    AcademicEventType.lecture_start: "Lectures Begin",
    AcademicEventType.lecture_end: "Lectures End",
    AcademicEventType.deadline: "Deadline",
    AcademicEventType.other: "Other",
}


class AcademicEventCreate(BaseModel):
    """Schema for creating an academic calendar event."""
    title: str = Field(..., min_length=2, max_length=200)
    eventType: AcademicEventType
    startDate: datetime
    endDate: Optional[datetime] = None
    semester: int = Field(..., ge=1, le=2)
    description: Optional[str] = Field(None, max_length=500)


class AcademicEventUpdate(BaseModel):
    """Schema for updating an academic calendar event."""
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    eventType: Optional[AcademicEventType] = None
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    semester: Optional[int] = Field(None, ge=1, le=2)
    description: Optional[str] = Field(None, max_length=500)


class AcademicEventResponse(BaseModel):
    """Schema for academic calendar event response."""
    id: str
    title: str
    eventType: AcademicEventType
    startDate: datetime
    endDate: Optional[datetime] = None
    semester: int
    sessionId: str
    description: Optional[str] = None
    createdBy: str
    createdAt: datetime
    updatedAt: Optional[datetime] = None
