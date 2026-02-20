"""
Pytest Fixtures for IESA Backend Tests

Provides:
- FastAPI test client
- Mock MongoDB database
- Mock Firebase authentication
- Sample data fixtures
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone
import os

# Set test environment before importing app
os.environ["ENVIRONMENT"] = "test"
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"
os.environ["DATABASE_NAME"] = "iesa_test_db"

from app.main import app


# ============================================
# Application Fixtures
# ============================================

@pytest.fixture
async def client():
    """Create an async HTTP client for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_verify_token():
    """Mock Firebase token verification."""
    with patch("app.core.security.verify_token") as mock:
        mock.return_value = {
            "uid": "test-user-id",
            "email": "test@example.com",
            "name": "Test User",
            "role": "student",
        }
        yield mock


@pytest.fixture
def mock_admin_token():
    """Mock admin user token."""
    with patch("app.core.security.verify_token") as mock:
        mock.return_value = {
            "uid": "admin-user-id",
            "email": "admin@example.com",
            "name": "Admin User",
            "role": "admin",
        }
        yield mock


# ============================================
# Sample Data Fixtures
# ============================================

@pytest.fixture
def sample_user():
    """Sample user data."""
    return {
        "_id": "test-user-id",
        "email": "test@example.com",
        "displayName": "Test User",
        "role": "student",
        "matricNumber": "123456",
        "level": "200L",
        "phone": "+234800000000",
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }


@pytest.fixture
def sample_session():
    """Sample academic session data."""
    return {
        "_id": "test-session-id",
        "name": "2024/2025",
        "startDate": "2024-09-01",
        "endDate": "2025-07-31",
        "currentSemester": "first",
        "isActive": True,
        "createdAt": datetime.now(timezone.utc),
    }


@pytest.fixture
def sample_announcement():
    """Sample announcement data."""
    return {
        "_id": "test-announcement-id",
        "title": "Test Announcement",
        "content": "This is a test announcement",
        "priority": "normal",
        "category": "general",
        "sessionId": "test-session-id",
        "createdBy": "admin-user-id",
        "createdAt": datetime.now(timezone.utc),
        "isActive": True,
    }


@pytest.fixture
def sample_event():
    """Sample event data."""
    return {
        "_id": "test-event-id",
        "title": "Test Event",
        "description": "This is a test event",
        "eventType": "workshop",
        "startDate": "2024-12-01T10:00:00Z",
        "endDate": "2024-12-01T14:00:00Z",
        "location": "Engineering Building",
        "sessionId": "test-session-id",
        "createdBy": "admin-user-id",
        "createdAt": datetime.now(timezone.utc),
    }


@pytest.fixture
def sample_payment():
    """Sample payment data."""
    return {
        "_id": "test-payment-id",
        "userId": "test-user-id",
        "amount": 5000,
        "type": "dues",
        "status": "completed",
        "reference": "PAY-TEST-123",
        "sessionId": "test-session-id",
        "createdAt": datetime.now(timezone.utc),
    }


# ============================================
# Database Mock Fixtures
# ============================================

@pytest.fixture
def mock_db():
    """Mock MongoDB database."""
    db = MagicMock()
    
    # Setup async mock methods
    db.users = MagicMock()
    db.users.find_one = AsyncMock()
    db.users.find = MagicMock()
    db.users.insert_one = AsyncMock()
    db.users.update_one = AsyncMock()
    db.users.delete_one = AsyncMock()
    
    db.sessions = MagicMock()
    db.sessions.find_one = AsyncMock()
    db.sessions.find = MagicMock()
    db.sessions.insert_one = AsyncMock()
    db.sessions.update_one = AsyncMock()
    
    db.announcements = MagicMock()
    db.announcements.find_one = AsyncMock()
    db.announcements.find = MagicMock()
    db.announcements.insert_one = AsyncMock()
    db.announcements.update_one = AsyncMock()
    
    db.events = MagicMock()
    db.events.find_one = AsyncMock()
    db.events.find = MagicMock()
    db.events.insert_one = AsyncMock()
    db.events.update_one = AsyncMock()
    
    db.payments = MagicMock()
    db.payments.find_one = AsyncMock()
    db.payments.find = MagicMock()
    db.payments.insert_one = AsyncMock()
    db.payments.update_one = AsyncMock()
    
    return db
