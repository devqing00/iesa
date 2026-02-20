"""
Audit Logging System

Tracks all administrative actions for security and compliance.
Creates an immutable audit trail of who did what and when.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from bson import ObjectId
from app.db import get_database
import logging

logger = logging.getLogger("iesa_backend")


class AuditLogger:
    """Centralized audit logging for administrative actions"""
    
    # Action types
    USER_ROLE_CHANGED = "user.role_changed"
    USER_CREATED = "user.created"
    USER_DELETED = "user.deleted"
    
    SESSION_CREATED = "session.created"
    SESSION_ACTIVATED = "session.activated"
    SESSION_UPDATED = "session.updated"
    SESSION_DELETED = "session.deleted"
    
    ROLE_ASSIGNED = "role.assigned"
    ROLE_REVOKED = "role.revoked"
    
    PAYMENT_CREATED = "payment.created"
    PAYMENT_APPROVED = "payment.approved"
    PAYMENT_DELETED = "payment.deleted"
    
    ENROLLMENT_CREATED = "enrollment.created"
    ENROLLMENT_UPDATED = "enrollment.updated"
    ENROLLMENT_DELETED = "enrollment.deleted"
    
    GRADE_CREATED = "grade.created"
    GRADE_UPDATED = "grade.updated"
    GRADE_DELETED = "grade.deleted"
    
    EVENT_CREATED = "event.created"
    EVENT_UPDATED = "event.updated"
    EVENT_DELETED = "event.deleted"
    
    ANNOUNCEMENT_CREATED = "announcement.created"
    ANNOUNCEMENT_UPDATED = "announcement.updated"
    ANNOUNCEMENT_DELETED = "announcement.deleted"
    
    @staticmethod
    async def log(
        action: str,
        actor_id: str,
        actor_email: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        session_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """
        Create an audit log entry.
        
        Args:
            action: Action type (use constants above)
            actor_id: User ID of user performing action
            actor_email: Email of user performing action
            resource_type: Type of resource (user, session, payment, etc.)
            resource_id: ID of the affected resource
            session_id: Academic session context (if applicable)
            details: Additional metadata about the action
            ip_address: IP address of the actor
            user_agent: User agent string
        """
        db = get_database()
        audit_logs = db["audit_logs"]
        
        log_entry = {
            "action": action,
            "actor": {
                "id": actor_id,
                "email": actor_email
            },
            "resource": {
                "type": resource_type,
                "id": resource_id
            },
            "sessionId": session_id,
            "details": details or {},
            "metadata": {
                "ipAddress": ip_address,
                "userAgent": user_agent
            },
            "timestamp": datetime.utcnow()
        }
        
        await audit_logs.insert_one(log_entry)
        
        # Also log to application logs for real-time monitoring
        logger.info(
            f"AUDIT: {action} by {actor_email} on {resource_type}:{resource_id or 'N/A'}"
        )
    
    @staticmethod
    async def get_logs(
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        actor_id: Optional[str] = None,
        action: Optional[str] = None,
        session_id: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> list:
        """
        Query audit logs with filters.
        
        Returns list of audit log entries sorted by timestamp (newest first).
        """
        db = get_database()
        audit_logs = db["audit_logs"]
        
        # Build query
        query = {}
        if resource_type:
            query["resource.type"] = resource_type
        if resource_id:
            query["resource.id"] = resource_id
        if actor_id:
            query["actor.id"] = actor_id
        if action:
            query["action"] = action
        if session_id:
            query["sessionId"] = session_id
        
        cursor = audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        logs = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for log in logs:
            log["_id"] = str(log["_id"])
        
        return logs
    
    @staticmethod
    async def get_user_history(user_id: str, limit: int = 50) -> list:
        """Get all actions performed by a specific user"""
        return await AuditLogger.get_logs(actor_id=user_id, limit=limit)
    
    @staticmethod
    async def get_resource_history(resource_type: str, resource_id: str, limit: int = 50) -> list:
        """Get all actions performed on a specific resource"""
        return await AuditLogger.get_logs(
            resource_type=resource_type,
            resource_id=resource_id,
            limit=limit
        )


# Convenience functions for common audit events

async def audit_user_role_change(
    actor_id: str,
    actor_email: str,
    target_user_id: str,
    old_role: str,
    new_role: str,
    ip_address: Optional[str] = None
):
    """Audit a user role change"""
    await AuditLogger.log(
        action=AuditLogger.USER_ROLE_CHANGED,
        actor_id=actor_id,
        actor_email=actor_email,
        resource_type="user",
        resource_id=target_user_id,
        details={
            "oldRole": old_role,
            "newRole": new_role
        },
        ip_address=ip_address
    )


async def audit_session_activation(
    actor_id: str,
    actor_email: str,
    session_id: str,
    session_name: str,
    ip_address: Optional[str] = None
):
    """Audit a session activation"""
    await AuditLogger.log(
        action=AuditLogger.SESSION_ACTIVATED,
        actor_id=actor_id,
        actor_email=actor_email,
        resource_type="session",
        resource_id=session_id,
        details={
            "sessionName": session_name
        },
        ip_address=ip_address
    )


async def audit_role_assignment(
    actor_id: str,
    actor_email: str,
    target_user_id: str,
    session_id: str,
    position: str,
    permissions: list,
    ip_address: Optional[str] = None
):
    """Audit a role assignment"""
    await AuditLogger.log(
        action=AuditLogger.ROLE_ASSIGNED,
        actor_id=actor_id,
        actor_email=actor_email,
        resource_type="role",
        resource_id=target_user_id,
        session_id=session_id,
        details={
            "position": position,
            "permissions": permissions
        },
        ip_address=ip_address
    )


async def audit_payment_approval(
    actor_id: str,
    actor_email: str,
    payment_id: str,
    transaction_id: str,
    amount: float,
    student_id: str,
    ip_address: Optional[str] = None
):
    """Audit a payment approval"""
    await AuditLogger.log(
        action=AuditLogger.PAYMENT_APPROVED,
        actor_id=actor_id,
        actor_email=actor_email,
        resource_type="payment",
        resource_id=payment_id,
        details={
            "transactionId": transaction_id,
            "amount": amount,
            "studentId": student_id
        },
        ip_address=ip_address
    )


async def audit_resource_deletion(
    actor_id: str,
    actor_email: str,
    resource_type: str,
    resource_id: str,
    session_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
):
    """Audit a resource deletion"""
    action = f"{resource_type}.deleted"
    await AuditLogger.log(
        action=action,
        actor_id=actor_id,
        actor_email=actor_email,
        resource_type=resource_type,
        resource_id=resource_id,
        session_id=session_id,
        details=details or {},
        ip_address=ip_address
    )
