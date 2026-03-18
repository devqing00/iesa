import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from bson import ObjectId

from app.main import app
from app.core.security import verify_token


class AsyncCursor:
    def __init__(self, items):
        self.items = items

    def __aiter__(self):
        async def gen():
            for item in self.items:
                yield item

        return gen()


class ToListCursor:
    def __init__(self, items):
        self.items = items

    async def to_list(self, length=None):
        return self.items[:length] if length else self.items


class MockDB:
    def __init__(self, collections):
        self._collections = collections

    def __getitem__(self, key):
        return self._collections[key]


@pytest.fixture(autouse=True)
def override_verify_token():
    async def _mock_user():
        return {"sub": "507f1f77bcf86cd799439011", "uid": "u1", "role": "student"}

    app.dependency_overrides[verify_token] = _mock_user
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_rewards_snapshot_initializes_record(client):
    rewards = MagicMock()
    rewards.find_one = AsyncMock(return_value=None)
    rewards.insert_one = AsyncMock()

    db = MockDB({
        "engagement_rewards": rewards,
    })

    with patch("app.routers.growth.get_database", return_value=db):
        res = await client.get("/api/v1/growth/rewards")

    assert res.status_code == 200
    data = res.json()
    assert data["weeklyUsefulActions"] == 0
    assert data["visitStreak"] == 1
    assert data["privacyOptIn"] is False
    assert "recognitionLevel" in data
    rewards.insert_one.assert_awaited_once()


@pytest.mark.asyncio
async def test_rewards_action_tracks_and_returns_chain(client):
    reward_id = ObjectId()
    existing = {
        "_id": reward_id,
        "userId": "507f1f77bcf86cd799439011",
        "weekKey": "2026-W11",
        "visitStreak": 3,
        "weeklyUsefulActions": 5,
        "totalUsefulActions": 10,
        "privacyOptIn": False,
        "priorityPins": [],
    }
    updated = {
        **existing,
        "weeklyUsefulActions": 6,
        "totalUsefulActions": 11,
    }

    rewards = MagicMock()
    rewards.find_one = AsyncMock(side_effect=[existing, updated])
    rewards.update_one = AsyncMock()

    db = MockDB({
        "engagement_rewards": rewards,
    })

    with patch("app.routers.growth.get_database", return_value=db):
        res = await client.post("/api/v1/growth/rewards/action", json={"actionType": "payment_due"})

    assert res.status_code == 200
    data = res.json()
    assert data["weeklyUsefulActions"] == 6
    assert data["totalUsefulActions"] == 11
    assert data["nextChain"]["href"] == "/dashboard/timetable"
    rewards.update_one.assert_awaited_once()


@pytest.mark.asyncio
async def test_rewards_privacy_opt_in_updates_state(client):
    rewards = MagicMock()
    rewards.update_one = AsyncMock()

    db = MockDB({
        "engagement_rewards": rewards,
    })

    with patch("app.routers.growth.get_database", return_value=db):
        res = await client.patch("/api/v1/growth/rewards/privacy", json={"optIn": True})

    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["privacyOptIn"] is True
    rewards.update_one.assert_awaited_once()


@pytest.mark.asyncio
async def test_rewards_leaderboard_cohort_returns_opted_in_users(client):
    me_id = "507f1f77bcf86cd799439011"
    u2 = str(ObjectId())
    u3 = str(ObjectId())

    rewards = MagicMock()
    rewards.find = MagicMock(return_value=ToListCursor([
        {"userId": u2, "weeklyUsefulActions": 9, "visitStreak": 4},
        {"userId": u3, "weeklyUsefulActions": 7, "visitStreak": 8},
    ]))

    users = MagicMock()
    users.find_one = AsyncMock(return_value={"_id": ObjectId(me_id), "currentLevel": "300L"})
    users.find = MagicMock(side_effect=[
        AsyncCursor([
            {"_id": ObjectId(me_id), "firstName": "Me", "lastName": "User"},
            {"_id": ObjectId(u2), "firstName": "Ada", "lastName": "N"},
            {"_id": ObjectId(u3), "firstName": "Kunle", "lastName": "O"},
        ]),
        AsyncCursor([
            {"_id": ObjectId(u2), "firstName": "Ada", "lastName": "N"},
            {"_id": ObjectId(u3), "firstName": "Kunle", "lastName": "O"},
        ]),
    ])

    db = MockDB({
        "engagement_rewards": rewards,
        "users": users,
        "roles": MagicMock(),
        "sessions": MagicMock(),
    })

    with patch("app.routers.growth.get_database", return_value=db):
        res = await client.get("/api/v1/growth/rewards/leaderboard?scope=cohort&limit=5")

    assert res.status_code == 200
    data = res.json()
    assert data["scope"] == "cohort"
    assert len(data["items"]) == 2
    assert data["items"][0]["name"] == "Ada N"
    assert data["items"][0]["weeklyUsefulActions"] == 9


@pytest.mark.asyncio
async def test_rewards_pins_requires_unlock_threshold(client):
    now = datetime.now(timezone.utc)
    current_week = f"{now.isocalendar().year}-W{str(now.isocalendar().week).zfill(2)}"

    rewards = MagicMock()
    rewards.find_one = AsyncMock(return_value={
        "_id": ObjectId(),
        "userId": "507f1f77bcf86cd799439011",
        "weekKey": current_week,
        "weeklyUsefulActions": 5,
    })
    rewards.update_one = AsyncMock()

    db = MockDB({
        "engagement_rewards": rewards,
    })

    with patch("app.routers.growth.get_database", return_value=db):
        res = await client.patch("/api/v1/growth/rewards/pins", json={"pins": ["/dashboard/payments"]})

    assert res.status_code == 403
    rewards.update_one.assert_not_awaited()


@pytest.mark.asyncio
async def test_rewards_pins_updates_when_unlocked(client):
    now = datetime.now(timezone.utc)
    current_week = f"{now.isocalendar().year}-W{str(now.isocalendar().week).zfill(2)}"

    rewards = MagicMock()
    rewards.find_one = AsyncMock(return_value={
        "_id": ObjectId(),
        "userId": "507f1f77bcf86cd799439011",
        "weekKey": current_week,
        "weeklyUsefulActions": 12,
        "priorityPins": [],
    })
    rewards.update_one = AsyncMock()

    db = MockDB({
        "engagement_rewards": rewards,
    })

    with patch("app.routers.growth.get_database", return_value=db):
        res = await client.patch(
            "/api/v1/growth/rewards/pins",
            json={"pins": ["/dashboard/payments", "/dashboard/timetable"]},
        )

    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["priorityPins"] == ["/dashboard/payments", "/dashboard/timetable"]
    rewards.update_one.assert_awaited_once()
