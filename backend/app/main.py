from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from pymongo import MongoClient
from app.core.security import verify_token
from app.core.rate_limiting import setup_rate_limiting
from app.core.error_handling import setup_exception_handlers, setup_logging
from app.core.monitoring import init_sentry
from app.routers import sessions, users, payments, events, announcements, grades, enrollments, roles, students, iesa_ai, resources, timetable, paystack, id_card, telegram_webhook, audit_logs, auth
from app.db import connect_to_mongo, close_mongo_connection

# Setup logging first
setup_logging()

# Synchronous MongoDB client for compatibility with some routers
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")
sync_client = MongoClient(MONGODB_URL)
db = sync_client[DATABASE_NAME]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()


app = FastAPI(
    title="IESA ERP Backend",
    description="Session-Aware Enterprise Resource Planning System for Industrial Engineering Department",
    version="2.0.0",  # Phase 1 with Permission-based RBAC
    lifespan=lifespan,
    redirect_slashes=False,  # Prevent 307 redirects that drop Authorization headers
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
    expose_headers=["*"],
    max_age=3600,
)

# Setup rate limiting
limiter = setup_rate_limiting(app)

# Setup centralized error handling
setup_exception_handlers(app)

# Setup performance monitoring (Sentry)
init_sentry(app)

@app.get("/")
async def root():
    return {"message": "Welcome to IESA Backend"}


@app.get("/health")
async def health():
    return {"status": "ok"}

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
app.include_router(grades.router)
app.include_router(iesa_ai.router)  # IESA AI Assistant
app.include_router(resources.router)  # Resource Library
app.include_router(timetable.router)  # Timetable System
app.include_router(paystack.router)  # Paystack Payment Integration
app.include_router(id_card.router)  # Digital ID Cards
app.include_router(telegram_webhook.router)  # Telegram Bot Webhook
app.include_router(audit_logs.router)  # Audit Logs (Admin Only)

@app.get("/api/protected")
async def protected_route(user_data: dict = Depends(verify_token)):
    return {
        "message": "You are authenticated!",
        "user_id": user_data.get("sub"),
        "email": user_data.get("email")
    }

