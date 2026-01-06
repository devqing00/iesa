"""
Audit Logs Router

Provides endpoints for viewing audit trail.
Only accessible to admins for security monitoring and compliance.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.core.audit import AuditLogger

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


class AuditLogResponse(BaseModel):
    """Audit log entry response model"""
    id: str
    action: str
    actor: dict
    resource: dict
    sessionId: Optional[str]
    details: dict
    metadata: dict
    timestamp: datetime
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "action": "user.role_changed",
                "actor": {
                    "id": "firebase_uid_123",
                    "email": "admin@iesa.com"
                },
                "resource": {
                    "type": "user",
                    "id": "507f191e810c19729de860ea"
                },
                "sessionId": "507f191e810c19729de860eb",
                "details": {
                    "oldRole": "student",
                    "newRole": "admin"
                },
                "metadata": {
                    "ipAddress": "192.168.1.1",
                    "userAgent": "Mozilla/5.0..."
                },
                "timestamp": "2026-01-05T10:30:00Z"
            }
        }


@router.get("/", response_model=List[AuditLogResponse])
async def get_audit_logs(
    resource_type: Optional[str] = Query(None, description="Filter by resource type (user, session, payment, etc.)"),
    resource_id: Optional[str] = Query(None, description="Filter by specific resource ID"),
    actor_id: Optional[str] = Query(None, description="Filter by actor (user who performed action)"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    session_id: Optional[str] = Query(None, description="Filter by academic session"),
    limit: int = Query(100, ge=1, le=1000, description="Number of logs to return"),
    skip: int = Query(0, ge=0, description="Number of logs to skip (pagination)"),
    user: dict = Depends(require_permission("audit:view"))
):
    """
    Get audit logs with optional filters.
    
    Requires audit:view permission (admin only).
    Returns logs sorted by timestamp (newest first).
    """
    logs = await AuditLogger.get_logs(
        resource_type=resource_type,
        resource_id=resource_id,
        actor_id=actor_id,
        action=action,
        session_id=session_id,
        limit=limit,
        skip=skip
    )
    
    return [
        AuditLogResponse(
            id=log["_id"],
            action=log["action"],
            actor=log["actor"],
            resource=log["resource"],
            sessionId=log.get("sessionId"),
            details=log.get("details", {}),
            metadata=log.get("metadata", {}),
            timestamp=log["timestamp"]
        )
        for log in logs
    ]


@router.get("/user/{user_id}", response_model=List[AuditLogResponse])
async def get_user_audit_history(
    user_id: str,
    limit: int = Query(50, ge=1, le=500),
    admin: dict = Depends(require_permission("audit:view"))
):
    """
    Get all actions performed by a specific user.
    
    Useful for investigating suspicious activity or compliance reviews.
    """
    logs = await AuditLogger.get_user_history(user_id, limit=limit)
    
    return [
        AuditLogResponse(
            id=log["_id"],
            action=log["action"],
            actor=log["actor"],
            resource=log["resource"],
            sessionId=log.get("sessionId"),
            details=log.get("details", {}),
            metadata=log.get("metadata", {}),
            timestamp=log["timestamp"]
        )
        for log in logs
    ]


@router.get("/resource/{resource_type}/{resource_id}", response_model=List[AuditLogResponse])
async def get_resource_audit_history(
    resource_type: str,
    resource_id: str,
    limit: int = Query(50, ge=1, le=500),
    admin: dict = Depends(require_permission("audit:view"))
):
    """
    Get all actions performed on a specific resource.
    
    Examples:
    - /audit-logs/resource/user/507f191e810c19729de860ea
    - /audit-logs/resource/session/507f191e810c19729de860eb
    - /audit-logs/resource/payment/507f191e810c19729de860ec
    """
    logs = await AuditLogger.get_resource_history(resource_type, resource_id, limit=limit)
    
    return [
        AuditLogResponse(
            id=log["_id"],
            action=log["action"],
            actor=log["actor"],
            resource=log["resource"],
            sessionId=log.get("sessionId"),
            details=log.get("details", {}),
            metadata=log.get("metadata", {}),
            timestamp=log["timestamp"]
        )
        for log in logs
    ]


@router.get("/me", response_model=List[AuditLogResponse])
async def get_my_audit_history(
    limit: int = Query(50, ge=1, le=500),
    user: dict = Depends(get_current_user)
):
    """
    Get your own audit history (actions you performed).
    
    Available to all users to see what actions they've taken.
    """
    logs = await AuditLogger.get_user_history(user["_id"], limit=limit)
    
    return [
        AuditLogResponse(
            id=log["_id"],
            action=log["action"],
            actor=log["actor"],
            resource=log["resource"],
            sessionId=log.get("sessionId"),
            details=log.get("details", {}),
            metadata=log.get("metadata", {}),
            timestamp=log["timestamp"]
        )
        for log in logs
    ]
