"""
Pydantic Models for IESA ERP System

This package contains all data models used throughout the application.
Each model enforces the Session-First Design principle where applicable.
"""

from .user import User, UserCreate, UserUpdate, UserInDB
from .session import Session, SessionCreate, SessionUpdate
from .enrollment import Enrollment, EnrollmentCreate
from .payment import Payment, PaymentCreate, PaymentUpdate, Transaction, TransactionCreate
from .event import Event, EventCreate, EventUpdate, EventRegistration
from .announcement import Announcement, AnnouncementCreate, AnnouncementUpdate
from .grade import Grade, GradeCreate, Course, Semester
from .role import Role, RoleCreate, PositionType

__all__ = [
    # User models
    "User",
    "UserCreate",
    "UserUpdate",
    "UserInDB",
    # Session models
    "Session",
    "SessionCreate",
    "SessionUpdate",
    # Enrollment models
    "Enrollment",
    "EnrollmentCreate",
    # Payment models
    "Payment",
    "PaymentCreate",
    "PaymentUpdate",
    "Transaction",
    "TransactionCreate",
    # Event models
    "Event",
    "EventCreate",
    "EventUpdate",
    "EventRegistration",
    # Announcement models
    "Announcement",
    "AnnouncementCreate",
    "AnnouncementUpdate",
    # Grade models
    "Grade",
    "GradeCreate",
    "Course",
    "Semester",
    # Role models
    "Role",
    "RoleCreate",
    "PositionType",
]
