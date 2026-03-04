from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pymongo.errors import OperationFailure
import os
from app.core.security import verify_token
from app.core.rate_limiting import setup_rate_limiting
from app.core.error_handling import setup_exception_handlers, setup_logging
from app.routers import sessions, users, payments, events, announcements, enrollments, roles, students, iesa_ai, resources, timetable, paystack, audit_logs, auth, study_groups, press, unit_applications, academic_calendar, timp, bank_transfers, settings, contact_messages, iepod, admin_stats, student_dashboard, sse, notifications, search, growth
from app.db import connect_to_mongo, close_mongo_connection

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Request-Id"],
    max_age=86400,  # 24h — browsers cache preflight so OPTIONS doesn't fly every request
)

# Setup rate limiting
limiter = setup_rate_limiting(app)

# Setup centralized error handling
setup_exception_handlers(app)

@app.get("/")
async def root():
    return {"message": "Welcome to IESA Backend"}


@app.get("/health")
async def health():
    return {"status": "ok"}


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

@app.get("/api/protected")
async def protected_route(user_data: dict = Depends(verify_token)):
    return {
        "message": "You are authenticated!",
        "user_id": user_data.get("sub"),
        "email": user_data.get("email")
    }

