from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pymongo.errors import OperationFailure
import os
import time
from app.core.security import verify_token
from app.core.permissions import require_permission as _require_permission
from app.core.rate_limiting import setup_rate_limiting
from app.core.error_handling import setup_exception_handlers, setup_logging
from app.core.scheduler import start_scheduler, stop_scheduler
from app.routers import sessions, users, payments, events, announcements, enrollments, roles, students, iesa_ai, resources, timetable, paystack, audit_logs, auth, study_groups, press, team_applications, teams, academic_calendar, timp, bank_transfers, settings, contact_messages, iepod, admin_stats, student_dashboard, sse, notifications, search, growth, messages, class_rep, team_head, push_notifications, drive
from app.db import connect_to_mongo, close_mongo_connection, get_database

# Setup logging first
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    await connect_to_mongo()

    # Initialise Firebase Admin SDK
    from app.core.auth import init_firebase
    init_firebase()

    # Ensure TTL index on article_views for automatic cleanup (24h)
    from app.db import get_database
    db = get_database()
    await db["article_views"].create_index(
        "viewedAt", expireAfterSeconds=86400, background=True
    )
    # Compound index for deduplication check (articleId + fingerprint + viewedAt)
    await db["article_views"].create_index(
        [("articleId", 1), ("fingerprint", 1), ("viewedAt", -1)], background=True
    )

    # Press articles — indexes for common query patterns
    await db["press_articles"].create_index("status", background=True)
    await db["press_articles"].create_index("authorId", background=True)
    try:
        await db["press_articles"].create_index("slug", unique=True, sparse=True, background=True)
    except Exception:
        pass  # Ignore if duplicate key issue on existing data
    await db["press_articles"].create_index(
        [("status", 1), ("publishedAt", -1)], background=True  # public blog listing
    )

    # AI rate limits — unique userId index for fast upserts
    await db["ai_rate_limits"].create_index("userId", unique=True, background=True)

    # Users — unique index on firebaseUid for fast token→user lookups
    try:
        await db["users"].create_index("firebaseUid", unique=True, sparse=True, background=True)
    except Exception as e:
        # IndexKeySpecsConflict (code 86): stale index exists without unique=True — drop and recreate
        if getattr(e, "code", None) == 86:
            await db["users"].drop_index("firebaseUid_1")
            await db["users"].create_index("firebaseUid", unique=True, sparse=True, background=True)

    # DM rate limits — TTL auto-cleanup after 2 hours
    await db["dm_rate_limits"].create_index("createdAt", expireAfterSeconds=7200, background=True)

    # DM connections — compound index for fast pair lookups
    await db["dm_connections"].create_index(
        [("fromUserId", 1), ("toUserId", 1)], unique=True, background=True
    )
    await db["dm_connections"].create_index(
        [("toUserId", 1), ("status", 1)], background=True
    )

    # DM blocks — compound index for blocker/blocked lookups
    await db["dm_blocks"].create_index(
        [("blockerId", 1), ("blockedId", 1)], unique=True, background=True
    )

    # DM message requests — sender+recipient+status
    await db["dm_message_requests"].create_index(
        [("recipientId", 1), ("status", 1)], background=True
    )

    # DM reports — pending status for admin queue
    await db["dm_reports"].create_index("status", background=True)

    # DM mutes — userId + active mute lookup
    await db["dm_mutes"].create_index("userId", unique=True, background=True)

    # Direct messages — conversationKey for fast conversation fetches
    await db["direct_messages"].create_index(
        [("conversationKey", 1), ("createdAt", -1)], background=True
    )
    await db["direct_messages"].create_index(
        [("senderId", 1), ("createdAt", -1)], background=True
    )
    await db["direct_messages"].create_index(
        [("recipientId", 1), ("createdAt", -1)], background=True
    )

    # Transaction records — unique reference for idempotent webhook/verify upserts.
    # If the index exists without sparse=True (code 86 = IndexKeySpecsConflict),
    # drop it and recreate with the correct spec.
    try:
        await db["transactions"].create_index("reference", unique=True, sparse=True, background=True)
    except OperationFailure as e:
        if e.code == 86:  # IndexKeySpecsConflict — drop stale index and recreate
            import logging as _log
            _log.getLogger("iesa_backend").info(
                "transactions.reference index spec mismatch — dropping and recreating with sparse=True."
            )
            await db["transactions"].drop_index("reference_1")
            await db["transactions"].create_index("reference", unique=True, sparse=True, background=True)
        else:
            raise

    # Push notification subscriptions — compound index for user+endpoint dedup
    await db["push_subscriptions"].create_index(
        [("userId", 1), ("endpoint", 1)], unique=True, background=True
    )

    # Drive progress — compound index for fast user+file lookups
    await db["drive_progress"].create_index(
        [("userId", 1), ("fileId", 1)], unique=True, background=True
    )
    await db["drive_progress"].create_index(
        [("userId", 1), ("lastOpenedAt", -1)], background=True
    )
    # Drive bookmarks — compound index for user+file
    await db["drive_bookmarks"].create_index(
        [("userId", 1), ("fileId", 1)], background=True
    )
    # Drive cache — TTL auto-cleanup (10 min default, configurable via DRIVE_CACHE_TTL)
    await db["drive_cache"].create_index(
        "expiresAt", expireAfterSeconds=0, background=True
    )

    # Press / blog indexes
    await db["press_articles"].create_index("status", background=True)
    await db["press_articles"].create_index("authorId", background=True)
    await db["press_articles"].create_index("slug", unique=True, sparse=True, background=True)
    await db["press_articles"].create_index(
        [("status", 1), ("publishedAt", -1)], background=True
    )

    # ── Startup migration: backfill null-level enrollments ──────────────────
    # Enrollments created during Google sign-up have level=null because the
    # user's level is unknown at that point. Once they complete onboarding their
    # currentLevel is set on the user doc; this migration propagates it to the
    # enrollment record so the admin panel and profile page show the correct level.
    import logging as _mig_log
    _mig_logger = _mig_log.getLogger("iesa_backend")
    try:
        null_enrollments = await db["enrollments"].find(
            {"level": None}, {"_id": 1, "studentId": 1}
        ).to_list(length=1000)
        if null_enrollments:
            fixed = 0
            for enr in null_enrollments:
                sid = enr.get("studentId")
                if not sid:
                    continue
                from bson import ObjectId as _ObjId
                user_doc = await db["users"].find_one(
                    {"_id": _ObjId(sid)}, {"currentLevel": 1}
                )
                if user_doc and user_doc.get("currentLevel"):
                    await db["enrollments"].update_one(
                        {"_id": enr["_id"]},
                        {"$set": {"level": user_doc["currentLevel"]}}
                    )
                    fixed += 1
            if fixed:
                _mig_logger.info("Startup migration: backfilled level on %d enrollment(s)", fixed)
    except Exception as _mig_e:
        _mig_logger.warning("Startup migration (enrollment level backfill) failed: %s", _mig_e)

    # Start background scheduler (birthday wishes, event/payment reminders, planner alerts)
    start_scheduler()

    yield
    # Shutdown
    stop_scheduler()
    await close_mongo_connection()


app = FastAPI(
    title="IESA ERP Backend",
    description="Session-Aware Enterprise Resource Planning System for Industrial Engineering Department",
    version="2.0.0",  # Phase 1 with Permission-based RBAC
    lifespan=lifespan,
)

# API Version prefix
API_V1_PREFIX = "/api/v1"

def _get_origins():
    """Get allowed origins from environment variable with production-safe defaults."""
    env = os.getenv("ENVIRONMENT", "development")

    raw = os.getenv("ALLOWED_ORIGINS", "")
    configured = [o.strip() for o in raw.split(",") if o.strip()]

    if env == "production":
        defaults = [
            "https://www.iesaui.org",
            "https://iesaui.org",
            "https://iesa-seven.vercel.app",
            "https://iesa-ui-zzyme.ondigitalocean.app",
        ]
    else:
        defaults = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    # Preserve order while de-duplicating
    merged = []
    for origin in [*configured, *defaults]:
        if origin not in merged:
            merged.append(origin)
    return merged


def _get_origin_regex() -> str | None:
    """Allow trusted wildcard subdomains in production."""
    env = os.getenv("ENVIRONMENT", "development")
    if env != "production":
        return None
    return r"^https://([a-z0-9-]+\.)*iesaui\.org$|^https://[a-z0-9-]+\.ondigitalocean\.app$"

origins = _get_origins()
origin_regex = _get_origin_regex()

# ── Request body size limit middleware ──────────────────────
MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB — covers image uploads; rejects mega payloads


class LimitRequestBodyMiddleware(BaseHTTPMiddleware):
    """Reject requests whose Content-Length exceeds MAX_BODY_SIZE."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": f"Request body too large (max {MAX_BODY_SIZE // (1024 * 1024)} MB)"},
            )
        return await call_next(request)


app.add_middleware(LimitRequestBodyMiddleware)

# Setup rate limiting
limiter = setup_rate_limiting(app)

# Setup centralized error handling
setup_exception_handlers(app)

# CORS middleware MUST be outermost (added last) so every response
# — including errors from inner middleware — gets CORS headers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Request-Id"],
    max_age=86400,  # 24h — browsers cache preflight so OPTIONS doesn't fly every request
)

@app.get("/")
async def root():
    return {"message": "Welcome to IESA Backend"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/detailed")
async def health_detailed(user: dict = Depends(_require_permission("system:health"))):
    """Detailed system health — super admin only."""
    import time
    import sys

    checks: dict = {"timestamp": datetime.now(timezone.utc).isoformat(), "services": {}}

    # MongoDB check
    try:
        db = get_database()
        t0 = time.monotonic()
        await db.command("ping")
        latency = round((time.monotonic() - t0) * 1000, 1)
        collections = await db.list_collection_names()
        checks["services"]["mongodb"] = {
            "status": "healthy",
            "latency_ms": latency,
            "collections": len(collections),
        }
    except Exception as e:
        checks["services"]["mongodb"] = {"status": "unhealthy", "error": str(e)[:100]}

    # Email SMTP check
    try:
        from app.core.email import check_email_health
        email_status = await check_email_health()
        email_service_status = "healthy" if email_status.get("healthy") else (
            "degraded" if email_status.get("provider") == "console" else "unhealthy"
        )
        checks["services"]["email"] = {
            "status": email_service_status,
            "details": email_status,
        }
    except Exception as e:
        checks["services"]["email"] = {"status": "unhealthy", "error": str(e)[:100]}

    # Collection stats
    try:
        db = get_database()
        stats_collections = ["users", "payments", "paystackTransactions", "bankTransfers",
                             "announcements", "events", "classSessions", "studyGroups",
                             "resources", "enrollments", "notifications", "auditLogs"]
        collection_stats = {}
        for coll_name in stats_collections:
            try:
                count = await db[coll_name].estimated_document_count()
                collection_stats[coll_name] = count
            except Exception:
                collection_stats[coll_name] = -1
        checks["collections"] = collection_stats
    except Exception:
        pass

    # System info
    checks["system"] = {
        "python_version": sys.version.split()[0],
        "environment": os.environ.get("ENVIRONMENT", "development"),
    }

    # Overall status
    statuses = [s.get("status") for s in checks["services"].values()]
    if all(s == "healthy" for s in statuses):
        checks["overall"] = "healthy"
    elif any(s == "unhealthy" for s in statuses):
        checks["overall"] = "unhealthy"
    else:
        checks["overall"] = "degraded"

    return checks


@app.get("/health/email")
async def email_health(user: dict = Depends(verify_token)):
    """Email service diagnostic — admin only."""
    role = user.get("role", "student")
    if role not in ("admin",):
        from fastapi import HTTPException as _H
        raise _H(status_code=403, detail="Admin only")
    from app.core.email import check_email_health
    return await check_email_health()

# Register routers with versioned API prefix
app.include_router(auth.router)  # Auth: register, login, refresh, logout
app.include_router(users.router)
app.include_router(students.router)  # Already has /api/v1/students prefix
app.include_router(sessions.router)
app.include_router(enrollments.router)
app.include_router(roles.router)
app.include_router(payments.router)
app.include_router(events.router)
app.include_router(announcements.router)
app.include_router(iesa_ai.router)  # IESA AI Assistant
app.include_router(resources.router)  # Resource Library
app.include_router(timetable.router)  # Timetable System
app.include_router(paystack.router)  # Paystack Payment Integration
app.include_router(audit_logs.router)  # Audit Logs (Admin Only)
app.include_router(study_groups.router)  # Study Group Finder
app.include_router(press.router)  # Association Press / Blog
app.include_router(team_applications.router)  # Team Applications
app.include_router(teams.router)              # Teams Management
app.include_router(academic_calendar.router)  # Academic Calendar Events
app.include_router(timp.router)  # TIMP Mentoring Project
app.include_router(bank_transfers.router)  # Bank Transfer Payments
app.include_router(settings.router)        # Platform Settings (admin toggles)
app.include_router(contact_messages.router) # Public Contact Form Messages
app.include_router(iepod.router)            # IEPOD Professional Development Hub
app.include_router(admin_stats.router)       # Admin Dashboard Stats (aggregated)
app.include_router(student_dashboard.router) # Student Dashboard Stats (aggregated)
app.include_router(sse.router)               # Real-time SSE notifications
app.include_router(notifications.router)     # In-app Notification System
app.include_router(search.router)              # Global Search
app.include_router(growth.router)              # Growth Hub Tools (personal data)
app.include_router(messages.router)            # Student Direct Messages
app.include_router(messages._admin_router)     # Admin Message Reports & Mutes
app.include_router(messages._ws_router)        # Messages WebSocket (no HTTTPBearer dep)
app.include_router(study_groups._ws_router)    # Study Groups WebSocket (no HTTPBearer dep)
app.include_router(class_rep.router)             # Class Rep Portal
app.include_router(team_head.router)               # Team Head Portal
app.include_router(push_notifications.router)        # Web Push Notifications
app.include_router(drive.router)                       # Google Drive Resource Browser

@app.get("/api/protected")
async def protected_route(user_data: dict = Depends(verify_token)):
    return {
        "message": "You are authenticated!",
        "user_id": user_data.get("sub"),
        "email": user_data.get("email")
    }

