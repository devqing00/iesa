from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from pymongo import MongoClient
from app.core.security import verify_token
from app.routers import sessions, users, payments, events, announcements, grades, enrollments, roles, students, iesa_ai, resources, timetable, paystack, id_card
from app.db import connect_to_mongo, close_mongo_connection

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
    lifespan=lifespan
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
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to IESA Backend"}


@app.get("/health")
async def health():
    return {"status": "ok"}

# Register routers with versioned API prefix
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

# Legacy routes (backward compatibility) - removed to avoid conflicts
app.include_router(announcements.router, tags=["Legacy"])
app.include_router(grades.router, tags=["Legacy"])

@app.get("/api/protected")
async def protected_route(user_data: dict = Depends(verify_token)):
    return {
        "message": "You are authenticated!",
        "user_id": user_data.get("uid"),
        "email": user_data.get("email")
    }

