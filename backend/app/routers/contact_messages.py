"""
Contact Messages Router

Public endpoint for submitting contact form messages.
Admin endpoints for viewing, managing, and responding to messages.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from typing import Optional
from datetime import datetime
from bson import ObjectId
import logging

from app.models.contact_message import (
    ContactMessageCreate,
    ContactMessageUpdate,
    ContactMessage,
)
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.core.sanitization import sanitize_string, validate_no_scripts
from app.core.rate_limiting import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/contact", tags=["Contact Messages"])

COLLECTION = "contact_messages"


# ── Public endpoint ─────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def submit_contact_message(request: Request, payload: ContactMessageCreate):
    """
    Submit a message via the public contact form.
    Rate-limited to 3 per minute per IP.
    """
    db = get_database()

    # Sanitize inputs
    name = sanitize_string(payload.name, max_length=100)
    subject = sanitize_string(payload.subject, max_length=200)
    message = sanitize_string(payload.message, max_length=5000)

    if not validate_no_scripts(name) or not validate_no_scripts(subject) or not validate_no_scripts(message):
        raise HTTPException(status_code=400, detail="Invalid input detected")

    now = datetime.utcnow()
    doc = {
        "name": name,
        "email": str(payload.email).strip().lower(),
        "subject": subject,
        "message": message,
        "status": "unread",
        "adminNote": None,
        "repliedAt": None,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db[COLLECTION].insert_one(doc)
    logger.info(f"Contact message submitted: {result.inserted_id}")

    return {"message": "Your message has been sent. We'll get back to you soon!", "id": str(result.inserted_id)}


# ── Admin endpoints ─────────────────────────────────────────

def _serialize(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-safe dict."""
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("")
async def list_contact_messages(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user=Depends(require_permission("contact:view")),
):
    """
    List all contact messages (admin only).
    """
    db = get_database()
    query: dict = {}
    if status_filter and status_filter in ("unread", "read", "replied", "archived"):
        query["status"] = status_filter

    total = await db[COLLECTION].count_documents(query)
    cursor = db[COLLECTION].find(query).sort("createdAt", -1).skip((page - 1) * pageSize).limit(pageSize)
    messages = [_serialize(doc) async for doc in cursor]

    # Counts by status
    unread_count = await db[COLLECTION].count_documents({"status": "unread"})

    return {
        "messages": messages,
        "total": total,
        "unreadCount": unread_count,
        "page": page,
        "pageSize": pageSize,
    }


@router.get("/stats")
async def contact_message_stats(
    user=Depends(require_permission("contact:view")),
):
    """Get message counts by status."""
    db = get_database()
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    counts = {}
    async for doc in db[COLLECTION].aggregate(pipeline):
        counts[doc["_id"]] = doc["count"]

    return {
        "total": sum(counts.values()),
        "unread": counts.get("unread", 0),
        "read": counts.get("read", 0),
        "replied": counts.get("replied", 0),
        "archived": counts.get("archived", 0),
    }


@router.get("/{message_id}")
async def get_contact_message(
    message_id: str,
    user=Depends(require_permission("contact:view")),
):
    """Get a single contact message and auto-mark as read if unread."""
    db = get_database()
    try:
        oid = ObjectId(message_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    doc = await db[COLLECTION].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Message not found")

    # Auto-mark as read on first view
    if doc.get("status") == "unread":
        await db[COLLECTION].update_one(
            {"_id": oid},
            {"$set": {"status": "read", "updatedAt": datetime.utcnow()}},
        )
        doc["status"] = "read"

    return _serialize(doc)


@router.patch("/{message_id}")
async def update_contact_message(
    message_id: str,
    payload: ContactMessageUpdate,
    user=Depends(require_permission("contact:manage")),
):
    """Update message status or add admin note."""
    db = get_database()
    try:
        oid = ObjectId(message_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    doc = await db[COLLECTION].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Message not found")

    update: dict = {"updatedAt": datetime.utcnow()}

    if payload.status is not None:
        update["status"] = payload.status
        if payload.status == "replied":
            update["repliedAt"] = datetime.utcnow()

    if payload.adminNote is not None:
        note = sanitize_string(payload.adminNote, max_length=2000)
        if not validate_no_scripts(note):
            raise HTTPException(status_code=400, detail="Invalid input detected")
        update["adminNote"] = note

    await db[COLLECTION].update_one({"_id": oid}, {"$set": update})
    updated_doc = await db[COLLECTION].find_one({"_id": oid})
    return _serialize(updated_doc)


@router.delete("/{message_id}")
async def delete_contact_message(
    message_id: str,
    user=Depends(require_permission("contact:manage")),
):
    """Delete a contact message permanently."""
    db = get_database()
    try:
        oid = ObjectId(message_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    result = await db[COLLECTION].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")

    logger.info(f"Contact message deleted: {message_id}")
    return {"message": "Message deleted"}
