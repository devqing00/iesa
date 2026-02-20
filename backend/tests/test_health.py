"""
Tests for Health and Root Endpoints

Tests the basic API health check and root endpoints.
"""

import pytest


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """Test the root endpoint returns welcome message."""
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to IESA Backend"}


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Test the health endpoint returns ok status."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
