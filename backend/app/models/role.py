"""
Role Models - Session-scoped position assignments (EPHEMERAL)

CRITICAL: Roles are EPHEMERAL and MUST have session_id.
When a new executive set comes in, old roles become historical.
This is the key to solving the "Data Decay" problem.
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
from bson import ObjectId


PositionType = Literal[
    "president",
    "vice_president",
    "general_secretary",
    "assistant_secretary",
    "financial_secretary",
    "treasurer",
    "director_socials",
    "director_sports",
    "director_welfare",
    "pro",
    "class_rep",
    "assistant_class_rep",
    "other"
]


class RoleBase(BaseModel):
    userId: str = Field(..., description="Reference to User._id")
    sessionId: str = Field(..., description="REQUIRED: Roles are session-specific")
    position: PositionType
    department: str = Field(default="Industrial Engineering")
    level: Optional[str] = Field(None, description="For class reps (100L, 200L, etc.)")
    customTitle: Optional[str] = Field(None, description="For 'other' position type")
    
    # Phase 1: Permission-based RBAC
    permissions: list[str] = Field(
        default_factory=list,
        description="Fine-grained permissions (e.g., 'announcement:create', 'payment:approve', 'event:manage')"
    )


class RoleCreate(RoleBase):
    """Model for assigning a role"""
    pass


class RoleUpdate(BaseModel):
    """Model for updating a role"""
    position: Optional[PositionType] = None
    level: Optional[str] = Field(None, description="For class reps (100L, 200L, etc.)")
    customTitle: Optional[str] = Field(None, description="For 'other' position type")
    permissions: Optional[list[str]] = Field(None, description="Update permissions")
    isActive: Optional[bool] = Field(None, description="Update active status")


class Role(RoleBase):
    """Role response model"""
    id: str = Field(alias="_id")
    assignedAt: datetime
    assignedBy: str = Field(..., description="User ID of admin who assigned this role")
    isActive: bool = Field(default=True)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class RoleWithUser(Role):
    """Role with populated user details"""
    userName: str
    userEmail: str
    userMatric: Optional[str] = None
    userProfilePicture: Optional[str] = None
