"""
Admin Stats Router

Single aggregation endpoint that returns all dashboard metrics in one trip.
Replaces the pattern where the frontend does 7+ parallel full-collection dumps.
"""

from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.core.permissions import require_any_permission
from app.core.cache import cache_get, cache_set
from app.db import get_database

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Stats"])

CACHE_KEY = "admin_stats"
CACHE_TTL = 60  # seconds


@router.get("/stats")
async def get_admin_stats(
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_any_permission([
        "user:view_all", "payment:view_all", "enrollment:view", "audit:view"
    ])),
):
    """
    Aggregate dashboard statistics in a single database round-trip.

    Returns counts, chart breakdowns, active session info, and recent audit logs.
    Results are cached in Redis for 60 s.
    """
    # Try cache first
    cached = await cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    db = get_database()

    # --- Run all lightweight count / aggregation queries in parallel ---
    import asyncio
    from datetime import datetime, timedelta, timezone

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    (
        total_students,
        total_enrollments,
        total_payments,
        total_events,
        total_announcements,
        active_session_doc,
        enrollments_by_level,
        payments_by_status,
        recent_audit_logs,
        external_students_count,
        ipe_students_count,
        announcements_by_audience,
        # ── Engagement metrics ──
        total_study_groups,
        total_resources,
        total_press_articles,
        total_ai_chats,
        total_growth_entries,
        registrations_7d,
    ) = await asyncio.gather(
        # Counts
        db["users"].count_documents({}),
        db["enrollments"].count_documents({}),
        db["payments"].count_documents({}),
        db["events"].count_documents({}),
        db["announcements"].count_documents({}),
        # Active session (single document)
        db["sessions"].find_one({"isActive": True}, {"_id": 0, "name": 1}),
        # Enrollments grouped by level
        db["enrollments"].aggregate([
            {"$group": {"_id": "$level", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]).to_list(length=100),
        # Payments grouped by status
        db["payments"].aggregate([
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]).to_list(length=20),
        # 5 most recent audit log entries
        db["audit_logs"].find(
            {},
            {
                "_id": 1,
                "action": 1,
                "actor": 1,
                "resource": 1,
                "timestamp": 1,
            },
        ).sort("timestamp", -1).to_list(length=5),
        # Department breakdown
        db["users"].count_documents({"isExternalStudent": True}),
        db["users"].count_documents({"$or": [
            {"isExternalStudent": False},
            {"isExternalStudent": {"$exists": False}},
        ]}),
        # Announcements by target audience
        db["announcements"].aggregate([
            {"$group": {"_id": {"$ifNull": ["$targetAudience", "all"]}, "count": {"$sum": 1}}},
        ]).to_list(length=10),
        # ── Engagement metrics ────────────────────────────────────
        db["study_groups"].count_documents({}),
        db["resources"].count_documents({}),
        db["press_articles"].count_documents({}),
        db["ai_rate_limits"].count_documents({}),
        db["growth_data"].count_documents({}),
        # Registrations in last 7 days (grouped by day)
        db["users"].aggregate([
            {"$match": {"createdAt": {"$gte": seven_days_ago}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ]).to_list(length=10),
    )

    # --- Normalise enrollments by level into ordered list ---
    level_order = ["100L", "200L", "300L", "400L", "500L"]
    level_map = {doc["_id"]: doc["count"] for doc in enrollments_by_level if doc["_id"]}
    ordered_levels = [
        {"level": lvl, "count": level_map.pop(lvl, 0)}
        for lvl in level_order
        if lvl in level_map or False  # only include levels with data
    ]
    # Pop trick not ideal—rebuild:
    level_map_full = {doc["_id"]: doc["count"] for doc in enrollments_by_level if doc["_id"]}
    ordered_levels = []
    for lvl in level_order:
        if lvl in level_map_full:
            ordered_levels.append({"level": lvl, "count": level_map_full[lvl]})
    # Append any extra levels not in the standard order
    for lvl, cnt in level_map_full.items():
        if lvl not in level_order:
            ordered_levels.append({"level": lvl, "count": cnt})

    # --- Normalise payments by status ---
    status_data = [
        {"name": doc["_id"] or "unknown", "value": doc["count"]}
        for doc in payments_by_status
        if doc["_id"]
    ]

    # --- Normalise audit logs (stringify _id) ---
    logs = []
    for log in recent_audit_logs:
        logs.append({
            "id": str(log["_id"]),
            "action": log.get("action", ""),
            "actor": log.get("actor", {}),
            "resource": log.get("resource", {}),
            "timestamp": log.get("timestamp", "").isoformat()
            if hasattr(log.get("timestamp", ""), "isoformat")
            else str(log.get("timestamp", "")),
        })

    # --- Normalise announcements by audience ---
    audience_map = {doc["_id"]: doc["count"] for doc in announcements_by_audience}

    result = {
        "totalStudents": total_students,
        "totalEnrollments": total_enrollments,
        "totalPayments": total_payments,
        "totalEvents": total_events,
        "totalAnnouncements": total_announcements,
        "activeSession": active_session_doc["name"] if active_session_doc else None,
        "enrollmentsByLevel": ordered_levels,
        "paymentsByStatus": status_data,
        "recentActivity": logs,
        # Department breakdown
        "ipeStudents": ipe_students_count,
        "externalStudents": external_students_count,
        # Announcements by audience
        "announcementsByAudience": {
            "all": audience_map.get("all", 0),
            "ipe": audience_map.get("ipe", 0),
            "external": audience_map.get("external", 0),
        },
        # ── Engagement metrics ──
        "engagement": {
            "studyGroups": total_study_groups,
            "resources": total_resources,
            "pressArticles": total_press_articles,
            "aiChats": total_ai_chats,
            "growthEntries": total_growth_entries,
            "registrations7d": [
                {"date": doc["_id"], "count": doc["count"]}
                for doc in registrations_7d
            ],
        },
    }

    # Store in cache
    await cache_set(CACHE_KEY, result, ttl=CACHE_TTL)

    return result
