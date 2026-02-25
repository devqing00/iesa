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

from app.core.security import get_current_user
from app.db import get_database

logger = logging.getLogger("iesa_backend")

router = APIRouter(prefix="/api/v1/search", tags=["Search"])


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=2, max_length=200, description="Search query"),
    types: str = Query(
        "announcements,events,resources",
        description="Comma-separated: announcements,events,resources"
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
