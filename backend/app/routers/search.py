"""
Global Search Router

Unified search across announcements, events, and resources.
Enables students to quickly find content across the platform.
"""

from fastapi import APIRouter, Depends, Query
from bson import ObjectId
from datetime import datetime
import re
import logging

from app.core.security import get_current_user, require_ipe_student, _is_external_student
from app.db import get_database

logger = logging.getLogger("iesa_backend")

router = APIRouter(prefix="/api/v1/search", tags=["Search"])


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=2, max_length=200, description="Search query"),
    types: str = Query(
        "announcements,events,resources,notifications",
        description="Comma-separated: announcements,events,resources,notifications"
    ),
    limit: int = Query(20, ge=1, le=50, description="Max results per type"),
    current_user: dict = Depends(get_current_user),
):
    """
    Search across multiple collections.
    Returns grouped results by type (max `limit` per type).
    """
    db = get_database()
    search_types = [t.strip() for t in types.split(",") if t.strip()]

    # External students can only search announcements + own notifications
    is_external = _is_external_student(current_user)
    if is_external:
        search_types = [t for t in search_types if t in {"announcements", "notifications"}]

    # Build a case-insensitive regex for partial matching
    pattern = re.compile(re.escape(q), re.IGNORECASE)

    results: dict = {}

    if "announcements" in search_types:
        try:
            cursor = db["announcements"].find(
                {"$or": [
                    {"title": {"$regex": pattern}},
                    {"content": {"$regex": pattern}},
                ]},
                {"title": 1, "content": 1, "priority": 1, "sessionId": 1, "createdAt": 1}
            ).sort("createdAt", -1).limit(limit)
            items = []
            async for doc in cursor:
                items.append({
                    "id": str(doc["_id"]),
                    "title": doc.get("title", ""),
                    "snippet": _snippet(doc.get("content", ""), q),
                    "priority": doc.get("priority"),
                    "createdAt": doc.get("createdAt"),
                    "type": "announcement",
                    "link": f"/dashboard/announcements?highlight={doc['_id']}",
                })
            results["announcements"] = items
        except Exception as e:
            logger.error(f"Search announcements error: {e}")
            results["announcements"] = []

    if "events" in search_types:
        try:
            cursor = db["events"].find(
                {"$or": [
                    {"title": {"$regex": pattern}},
                    {"description": {"$regex": pattern}},
                    {"location": {"$regex": pattern}},
                ]},
                {"title": 1, "description": 1, "startDate": 1, "location": 1, "category": 1, "createdAt": 1}
            ).sort("startDate", -1).limit(limit)
            items = []
            async for doc in cursor:
                items.append({
                    "id": str(doc["_id"]),
                    "title": doc.get("title", ""),
                    "snippet": _snippet(doc.get("description", ""), q),
                    "category": doc.get("category"),
                    "startDate": doc.get("startDate"),
                    "location": doc.get("location"),
                    "type": "event",
                    "link": f"/dashboard/events/{doc['_id']}",
                })
            results["events"] = items
        except Exception as e:
            logger.error(f"Search events error: {e}")
            results["events"] = []

    if "resources" in search_types:
        try:
            cursor = db["resources"].find(
                {"$or": [
                    {"title": {"$regex": pattern}},
                    {"description": {"$regex": pattern}},
                    {"tags": {"$regex": pattern}},
                ]},
                {"title": 1, "description": 1, "tags": 1, "category": 1, "createdAt": 1}
            ).sort("createdAt", -1).limit(limit)
            items = []
            async for doc in cursor:
                items.append({
                    "id": str(doc["_id"]),
                    "title": doc.get("title", ""),
                    "snippet": _snippet(doc.get("description", ""), q),
                    "category": doc.get("category"),
                    "tags": doc.get("tags", []),
                    "type": "resource",
                    "link": f"/dashboard/library?highlight={doc['_id']}",
                })
            results["resources"] = items
        except Exception as e:
            logger.error(f"Search resources error: {e}")
            results["resources"] = []

    if "notifications" in search_types:
        try:
            user_id = current_user.get("uid") or current_user.get("_id")
            id_variants = [user_id]
            if ObjectId.is_valid(str(user_id)):
                id_variants.append(ObjectId(str(user_id)))

            cursor = db["notifications"].find(
                {
                    "userId": {"$in": id_variants},
                    "$or": [
                        {"title": {"$regex": pattern}},
                        {"message": {"$regex": pattern}},
                    ],
                },
                {"title": 1, "message": 1, "type": 1, "link": 1, "createdAt": 1}
            ).sort("createdAt", -1).limit(limit)
            items = []
            async for doc in cursor:
                items.append({
                    "id": str(doc["_id"]),
                    "title": doc.get("title", "Notice"),
                    "snippet": _snippet(doc.get("message", ""), q),
                    "createdAt": doc.get("createdAt"),
                    "category": doc.get("type", "notification"),
                    "type": "notification",
                    "link": doc.get("link") or "/dashboard/announcements",
                })
            results["notifications"] = items
        except Exception as e:
            logger.error(f"Search notifications error: {e}")
            results["notifications"] = []

    total = sum(len(v) for v in results.values())
    return {"query": q, "total": total, "results": results}


def _snippet(text: str, query: str, ctx: int = 80) -> str:
    """Extract a short snippet around the first match of `query` in `text`."""
    if not text:
        return ""
    idx = text.lower().find(query.lower())
    if idx == -1:
        return text[:ctx * 2] + ("..." if len(text) > ctx * 2 else "")
    start = max(0, idx - ctx)
    end = min(len(text), idx + len(query) + ctx)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""
    return prefix + text[start:end] + suffix
