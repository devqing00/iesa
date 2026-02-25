"""
Tests for Notification Router

Tests the notification CRUD endpoints and helper functions.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from bson import ObjectId

from app.routers.notifications import create_notification, create_bulk_notifications


# ============================================
# Helper Function Tests
# ============================================


@pytest.mark.asyncio
async def test_create_notification():
    """Test the create_notification helper inserts a document."""
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.inserted_id = ObjectId()
    mock_db.notifications = MagicMock()
    mock_db.notifications.insert_one = AsyncMock(return_value=mock_result)

    with patch("app.routers.notifications.get_database", return_value=mock_db):
        result = await create_notification(
            user_id="user-1",
            type="announcement",
            title="Test",
            message="Test message",
            link="/dashboard",
            related_id="ann-1",
        )

    assert result == str(mock_result.inserted_id)
    mock_db.notifications.insert_one.assert_awaited_once()
    doc = mock_db.notifications.insert_one.call_args[0][0]
    assert doc["userId"] == "user-1"
    assert doc["type"] == "announcement"
    assert doc["title"] == "Test"
    assert doc["message"] == "Test message"
    assert doc["link"] == "/dashboard"
    assert doc["relatedId"] == "ann-1"
    assert doc["isRead"] is False
    assert isinstance(doc["createdAt"], datetime)


@pytest.mark.asyncio
async def test_create_notification_minimal():
    """Test create_notification with only required fields."""
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.inserted_id = ObjectId()
    mock_db.notifications = MagicMock()
    mock_db.notifications.insert_one = AsyncMock(return_value=mock_result)

    with patch("app.routers.notifications.get_database", return_value=mock_db):
        result = await create_notification(
            user_id="user-2",
            type="system",
            title="System Update",
            message="Maintenance scheduled",
        )

    doc = mock_db.notifications.insert_one.call_args[0][0]
    assert doc["link"] is None
    assert doc["relatedId"] is None


@pytest.mark.asyncio
async def test_create_bulk_notifications():
    """Test bulk notification creation for multiple users."""
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.inserted_ids = [ObjectId(), ObjectId(), ObjectId()]
    mock_db.notifications = MagicMock()
    mock_db.notifications.insert_many = AsyncMock(return_value=mock_result)

    with patch("app.routers.notifications.get_database", return_value=mock_db):
        count = await create_bulk_notifications(
            user_ids=["u1", "u2", "u3"],
            type="announcement",
            title="New Announcement",
            message="Check it out",
            link="/dashboard/announcements",
            related_id="ann-1",
        )

    assert count == 3
    mock_db.notifications.insert_many.assert_awaited_once()
    docs = mock_db.notifications.insert_many.call_args[0][0]
    assert len(docs) == 3
    assert docs[0]["userId"] == "u1"
    assert docs[1]["userId"] == "u2"
    assert docs[2]["userId"] == "u3"
    # All should share the same createdAt
    assert docs[0]["createdAt"] == docs[1]["createdAt"]


@pytest.mark.asyncio
async def test_create_bulk_notifications_empty_list():
    """Test bulk notification creation with empty user list returns 0."""
    mock_db = MagicMock()

    with patch("app.routers.notifications.get_database", return_value=mock_db):
        count = await create_bulk_notifications(
            user_ids=[],
            type="system",
            title="Test",
            message="Test",
        )

    assert count == 0


# ============================================
# Endpoint Tests
# ============================================


@pytest.mark.asyncio
async def test_list_notifications_unauthenticated(client):
    """Test that listing notifications requires auth."""
    response = await client.get("/api/v1/notifications/")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_unread_count_unauthenticated(client):
    """Test that unread count endpoint requires auth."""
    response = await client.get("/api/v1/notifications/unread-count")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_mark_read_invalid_id(client):
    """Test marking read with invalid notification ID."""
    from app.core.security import get_current_user
    from app.main import app as test_app

    async def mock_current_user():
        return {"_id": "test-user-id", "uid": "test-user-id", "role": "student"}

    test_app.dependency_overrides[get_current_user] = mock_current_user
    
    try:
        response = await client.patch("/api/v1/notifications/invalid-id/read")
        assert response.status_code == 400
        body = response.json()
        assert "Invalid" in body.get("detail", body.get("message", str(body)))
    finally:
        test_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_delete_invalid_id(client):
    """Test deleting with invalid notification ID."""
    from app.core.security import get_current_user
    from app.main import app as test_app

    async def mock_current_user():
        return {"_id": "test-user-id", "uid": "test-user-id", "role": "student"}

    test_app.dependency_overrides[get_current_user] = mock_current_user
    
    try:
        response = await client.delete("/api/v1/notifications/invalid-id")
        assert response.status_code == 400
        body = response.json()
        assert "Invalid" in body.get("detail", body.get("message", str(body)))
    finally:
        test_app.dependency_overrides.clear()
