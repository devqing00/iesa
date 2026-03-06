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
from app.routers import sessions, users, payments, events, announcements, enrollments, roles, students, iesa_ai, resources, timetable, paystack, audit_logs, auth, study_groups, press, unit_applications, academic_calendar, timp, bank_transfers, settings, contact_messages, iepod, admin_stats, student_dashboard, sse, notifications, search, growth, messages, two_factor
from app.db import connect_to_mongo, close_mongo_connection, get_database

# Setup logging first
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    await connect_to_mongo()

    # Ensure TTL index on article_views for automatic cleanup (24h)
    from app.db import get_database
    db = get_database()
    await db["article_views"].create_index(
        "viewedAt", expireAfterSeconds=86400, background=True
    )

    # AI rate limits — unique userId index for fast upserts
    await db["ai_rate_limits"].create_index("userId", unique=True, background=True)

    # Refresh tokens — TTL index auto-deletes expired tokens.
    # Drop any existing non-TTL index on expiresAt first (code 85 = IndexOptionsConflict),
    # then recreate it with expireAfterSeconds so tokens are actually purged by MongoDB.
    try:
        await db["refresh_tokens"].create_index(
            "expiresAt", expireAfterSeconds=0, background=True
        )
    except OperationFailure as e:
        if e.code == 85:  # IndexOptionsConflict — existing index lacks expireAfterSeconds
            import logging as _log
            _log.getLogger("iesa_backend").warning(
                "refresh_tokens.expiresAt index exists without TTL — dropping and recreating."
            )
            await db["refresh_tokens"].drop_index("expiresAt_1")
            await db["refresh_tokens"].create_index(
                "expiresAt", expireAfterSeconds=0, background=True
            )
        else:
            raise

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
    # Wrapped in try/except: if the index already exists with a slightly different
    # spec (e.g. without sparse), MongoDB returns IndexKeySpecsConflict (code 86).
    # The existing unique index still satisfies our deduplication requirement.
    try:
        await db["transactions"].create_index("reference", unique=True, sparse=True, background=True)
    except OperationFailure as e:
        if e.code == 86:  # IndexKeySpecsConflict — existing index is compatible
            import logging as _log
            _log.getLogger("iesa_backend").warning(
                "transactions.reference index already exists with a different spec — using existing index."
            )
        else:
            raise

    yield
    # Shutdown
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
    """Get allowed origins from environment variable with production defaults"""
    env = os.getenv("ENVIRONMENT", "development")
    
    if env == "production":
        # Production: Only allow production domain
        raw = os.getenv("ALLOWED_ORIGINS", "https://iesa-seven.vercel.app")
    else:
        # Development: Allow localhost
        raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    
    return [o.strip() for o in raw.split(",") if o.strip()]

origins = _get_origins()

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
        checks["services"]["email"] = {
            "status": "healthy" if email_status.get("status") == "ok" else "degraded",
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
app.include_router(unit_applications.router)  # Unit Applications
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
app.include_router(two_factor.router)          # Two-Factor Authentication (TOTP)

@app.get("/api/protected")
async def protected_route(user_data: dict = Depends(verify_token)):
    return {
        "message": "You are authenticated!",
        "user_id": user_data.get("sub"),
        "email": user_data.get("email")
    }

