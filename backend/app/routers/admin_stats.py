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
import asyncio
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Stats"])

CACHE_KEY = "admin_stats"


async def _const(value):
    """Async helper returning a constant — replaces asyncio.coroutine (removed in Python 3.11+)."""
    return value
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


# ═══════════════════════════════════════════════════════════════════
# ENGAGEMENT ANALYTICS — Actionable metrics beyond totals
# ═══════════════════════════════════════════════════════════════════

@router.get("/engagement")
async def get_engagement_analytics(
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_any_permission([
        "user:view_all", "audit:view"
    ])),
):
    """
    Detailed engagement metrics:
    - Inactive students (no login in 30+ days)
    - Unenrolled students for current session
    - IEPOD completion rates
    - Library upload/download velocity (last 30 days)
    """
    db = get_database()
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    # Get active session
    active_session = await db["sessions"].find_one({"isActive": True})
    session_id = str(active_session["_id"]) if active_session else None

    # Run all queries in parallel
    inactive_students, total_users, unenrolled_count, iepod_stats, library_30d, library_7d, ai_7d, login_activity = await asyncio.gather(
        # Students who haven't logged in for 30+ days
        db["users"].count_documents({
            "role": "student",
            "$or": [
                {"lastLogin": {"$lt": thirty_days_ago}},
                {"lastLogin": {"$exists": False}},
            ],
        }),
        db["users"].count_documents({"role": "student"}),
        # Students not enrolled in current session
        _count_unenrolled(db, session_id) if session_id else _const(0),
        # IEPOD completion stats
        _iepod_stats(db, session_id) if session_id else _const({}),

        # Library uploads last 30 days
        db["resources"].count_documents({"createdAt": {"$gte": thirty_days_ago}}),
        # Library uploads last 7 days
        db["resources"].count_documents({"createdAt": {"$gte": seven_days_ago}}),
        # AI usage last 7 days
        db["ai_rate_limits"].count_documents({"updatedAt": {"$gte": seven_days_ago}}),
        # Login activity last 7 days (distinct users)
        db["users"].count_documents({
            "role": "student",
            "lastLogin": {"$gte": seven_days_ago},
        }),
    )

    return {
        "inactiveStudents": inactive_students,
        "totalStudents": total_users,
        "activeStudents7d": login_activity,
        "unenrolledStudents": unenrolled_count,
        "iepod": iepod_stats,
        "library": {
            "uploads30d": library_30d,
            "uploads7d": library_7d,
        },
        "aiUsage7d": ai_7d,
    }


async def _count_unenrolled(db, session_id: str) -> int:
    """Count students who have an account but no active enrollment for the session."""
    enrolled_ids = set()
    cursor = db["enrollments"].find({"sessionId": session_id, "isActive": True}, {"studentId": 1, "userId": 1})
    async for e in cursor:
        sid = e.get("studentId") or e.get("userId")
        if sid:
            enrolled_ids.add(sid)
    total_students = await db["users"].count_documents({"role": "student"})
    return max(0, total_students - len(enrolled_ids))


async def _iepod_stats(db, session_id: str) -> dict:
    """Get IEPOD completion rates for the session."""
    total_regs = await db["iepod_registrations"].count_documents({"sessionId": session_id})
    if total_regs == 0:
        return {"totalRegistrations": 0, "completionRate": 0, "byPhase": {}}
    pipeline = [
        {"$match": {"sessionId": session_id}},
        {"$group": {"_id": "$currentPhase", "count": {"$sum": 1}}},
    ]
    by_phase = {doc["_id"]: doc["count"] async for doc in db["iepod_registrations"].aggregate(pipeline)}
    completed = by_phase.get("completed", 0) + by_phase.get("pitch", 0)
    return {
        "totalRegistrations": total_regs,
        "completionRate": round(completed / total_regs * 100, 1) if total_regs else 0,
        "byPhase": by_phase,
    }


# ═══════════════════════════════════════════════════════════════════
# PAYMENT FINANCIAL ANALYTICS
# ═══════════════════════════════════════════════════════════════════

@router.get("/payment-analytics")
async def get_payment_analytics(
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_any_permission(["payment:view_all"])),
):
    """
    Financial-level payment analytics for the active session:
    - Total collected (Paystack + bank transfers)
    - Outstanding dues by student count
    - Collection rate by payment category
    - Monthly collection trend
    """
    db = get_database()
    active_session = await db["sessions"].find_one({"isActive": True})
    if not active_session:
        return {"error": "No active session"}
    session_id = str(active_session["_id"])
    now = datetime.now(timezone.utc)

    # Get all payment dues for session
    payments = await db["payments"].find({"sessionId": session_id}).to_list(length=200)

    total_expected = 0
    total_collected_paystack = 0
    total_collected_transfer = 0
    by_category = {}
    total_students_owing = 0

    for p in payments:
        amount = p.get("amount", 0)
        paid_by = p.get("paidBy", [])
        category = p.get("category", "General")
        total_expected += amount * await _estimate_target_count(db, session_id, p)

        # Paystack transactions for this payment
        tx_count = await db["paystackTransactions"].count_documents({
            "paymentId": str(p["_id"]),
            "status": "success",
        })
        # Bank transfers approved for this payment
        bt_count = await db["bankTransfers"].count_documents({
            "paymentId": str(p["_id"]),
            "status": "approved",
        })

        collected = amount * len(paid_by)
        if category not in by_category:
            by_category[category] = {"title": p.get("title", ""), "amount": amount, "paidCount": 0, "totalTarget": 0}
        by_category[category]["paidCount"] += len(paid_by)

    # Total collected from Paystack
    paystack_pipeline = [
        {"$match": {"status": "success", "metadata.sessionId": session_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    paystack_result = await db["paystackTransactions"].aggregate(paystack_pipeline).to_list(length=1)
    total_collected_paystack = paystack_result[0]["total"] if paystack_result else 0

    # Total collected from approved bank transfers
    bt_pipeline = [
        {"$match": {"status": "approved", "sessionId": session_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    bt_result = await db["bankTransfers"].aggregate(bt_pipeline).to_list(length=1)
    total_collected_transfer = bt_result[0]["total"] if bt_result else 0

    # Monthly trend (last 6 months)
    six_months_ago = now - timedelta(days=180)
    monthly_trend = await db["paystackTransactions"].aggregate([
        {"$match": {"status": "success", "paidAt": {"$gte": six_months_ago}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m", "date": "$paidAt"}},
            "amount": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(length=12)

    total_collected = total_collected_paystack + total_collected_transfer

    return {
        "sessionName": active_session.get("name"),
        "totalCollected": total_collected,
        "totalCollectedPaystack": total_collected_paystack,
        "totalCollectedTransfer": total_collected_transfer,
        "totalExpected": total_expected,
        "collectionRate": round(total_collected / total_expected * 100, 1) if total_expected else 0,
        "byCategory": [
            {"category": k, **v}
            for k, v in by_category.items()
        ],
        "monthlyTrend": [
            {"month": doc["_id"], "amount": doc["amount"], "count": doc["count"]}
            for doc in monthly_trend
        ],
        "paymentDues": [
            {
                "id": str(p["_id"]),
                "title": p.get("title", ""),
                "amount": p.get("amount", 0),
                "category": p.get("category", "General"),
                "paidCount": len(p.get("paidBy", [])),
                "deadline": p.get("deadline", "").isoformat() if hasattr(p.get("deadline", ""), "isoformat") else str(p.get("deadline", "")),
            }
            for p in payments
        ],
    }


async def _estimate_target_count(db, session_id: str, payment: dict) -> int:
    """Estimate how many students a payment targets."""
    # Simple: count active enrollments for the session
    count = await db["enrollments"].count_documents({"sessionId": session_id, "isActive": True})
    return max(count, 1)