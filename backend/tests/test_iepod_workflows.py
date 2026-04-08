from datetime import datetime, timedelta, timezone
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.core.permissions import get_current_session, get_current_user
from app.routers import iepod as iepod_router


class ToListCursor:
    def __init__(self, items):
        self.items = items

    async def to_list(self, length=None):
        if length is None:
            return self.items
        return self.items[:length]


@pytest.fixture
def sync_client():
    ws_app = FastAPI()
    ws_app.include_router(iepod_router._ws_router)
    with TestClient(ws_app) as tc:
        yield tc


@pytest.fixture(autouse=True)
def override_iepod_dependencies():
    async def _mock_user():
        return {
            "_id": "507f1f77bcf86cd799439011",
            "firstName": "Test",
            "lastName": "Student",
            "email": "test@student.ui.edu.ng",
        }

    async def _mock_session():
        return {
            "_id": ObjectId("507f1f77bcf86cd799439012"),
            "name": "2025/2026",
        }

    app.dependency_overrides[get_current_user] = _mock_user
    app.dependency_overrides[get_current_session] = _mock_session
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_iepod_resubmit_moves_rejected_to_pending(client):
    reg_id = ObjectId("507f1f77bcf86cd799439021")
    existing_rejected = {
        "_id": reg_id,
        "userId": "507f1f77bcf86cd799439011",
        "sessionId": "507f1f77bcf86cd799439012",
        "status": "rejected",
        "adminNote": "Needs more clarity",
    }
    refreshed = {
        "_id": reg_id,
        "userId": "507f1f77bcf86cd799439011",
        "sessionId": "507f1f77bcf86cd799439012",
        "status": "pending",
        "adminNote": None,
        "resubmissionCount": 1,
        "resubmittedAt": datetime.now(timezone.utc),
    }

    iepod_registrations = MagicMock()
    iepod_registrations.find_one = AsyncMock(side_effect=[existing_rejected, refreshed])
    iepod_registrations.update_one = AsyncMock()

    db = MagicMock()
    db.iepod_registrations = iepod_registrations

    with patch("app.routers.iepod.get_database", return_value=db):
        res = await client.post(
            "/api/v1/iepod/register/resubmit",
            json={
                "interests": ["Data Science"],
                "whyJoin": "I have refined my motivation for joining IEPOD.",
                "priorExperience": "Hackathon participation",
                "preferredSocietyId": "soc-1",
            },
        )

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "pending"
    assert data["reason"] == "resubmitted"
    iepod_registrations.update_one.assert_awaited_once()

    update_payload = iepod_registrations.update_one.await_args.args[1]
    assert update_payload["$set"]["status"] == "pending"
    assert update_payload["$set"]["adminNote"] is None
    assert "$inc" in update_payload
    assert update_payload["$inc"]["resubmissionCount"] == 1


@pytest.mark.asyncio
async def test_iepod_join_team_logs_failure_when_not_registered(client):
    iepod_registrations = MagicMock()
    iepod_registrations.find_one = AsyncMock(return_value=None)

    db = MagicMock()
    db.iepod_registrations = iepod_registrations
    db.iepod_teams = MagicMock()

    with (
        patch("app.routers.iepod.get_database", return_value=db),
        patch("app.routers.iepod.AuditLogger.log", new_callable=AsyncMock) as log_mock,
    ):
        res = await client.post("/api/v1/iepod/teams/507f1f77bcf86cd799439031/join")

    assert res.status_code == 400
    log_mock.assert_awaited_once()
    assert log_mock.await_args is not None
    kwargs = log_mock.await_args.kwargs
    assert kwargs["action"] == "iepod.team_join_failed"
    assert kwargs["details"]["reason"] == "not_registered"


@pytest.mark.asyncio
async def test_iepod_leaderboard_returns_rank_phase_and_society_name(client):
    iepod_points = MagicMock()
    iepod_points.aggregate = MagicMock(
        return_value=ToListCursor(
            [
                {"_id": "u1", "userName": "Alice", "totalPoints": 80},
                {"_id": "u2", "userName": "Bob", "totalPoints": 55},
            ]
        )
    )

    iepod_registrations = MagicMock()
    iepod_registrations.find = MagicMock(
        return_value=ToListCursor(
            [
                {"userId": "u1", "phase": "carve", "societyId": "507f1f77bcf86cd799439041"},
                {"userId": "u2", "phase": "stimulate", "societyId": None},
            ]
        )
    )

    iepod_societies = MagicMock()
    iepod_societies.find = MagicMock(
        return_value=ToListCursor(
            [
                {"_id": ObjectId("507f1f77bcf86cd799439041"), "name": "IEEE"},
            ]
        )
    )

    db = MagicMock()
    db.iepod_points = iepod_points
    db.iepod_registrations = iepod_registrations
    db.iepod_societies = iepod_societies

    with patch("app.routers.iepod.get_database", return_value=db):
        res = await client.get("/api/v1/iepod/leaderboard?limit=10")

    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["rank"] == 1
    assert data[0]["userName"] == "Alice"
    assert data[0]["phase"] == "carve"
    assert data[0]["societyName"] == "IEEE"
    assert data[1]["rank"] == 2
    assert data[1]["societyName"] is None

    iepod_registrations.find.assert_called_once()
    iepod_societies.find.assert_called_once()


def test_iepod_live_ws_rejects_invalid_token(sync_client):
    with (
        patch("app.routers.iepod.is_ws_origin_allowed", return_value=True),
        patch("app.routers.iepod.verify_firebase_id_token_raw", new_callable=AsyncMock, side_effect=Exception("bad token")),
    ):
        with pytest.raises(WebSocketDisconnect) as exc:
            with sync_client.websocket_connect(
                "/api/v1/iepod/quizzes/live/ABC123/ws?token=bad",
                headers={"origin": "http://localhost:3000"},
            ):
                pass
    assert exc.value.code == 4001


def test_iepod_live_ws_rejects_non_participant_student(sync_client):
    db = MagicMock()
    db.iepod_live_quiz_sessions.find_one = AsyncMock(return_value={"_id": ObjectId(), "joinCode": "ABC123"})
    users_collection = MagicMock()
    users_collection.find_one = AsyncMock(return_value={"role": "student", "email": "student@example.com"})
    db.users = users_collection
    db.iepod_live_quiz_participants.find_one = AsyncMock(return_value=None)
    db.__getitem__.side_effect = lambda key: {
        "users": users_collection,
    }[key]

    with (
        patch("app.routers.iepod.is_ws_origin_allowed", return_value=True),
        patch("app.routers.iepod.verify_firebase_id_token_raw", new_callable=AsyncMock, return_value={"sub": "u-1", "email": "student@example.com"}),
        patch("app.routers.iepod.get_database", return_value=db),
    ):
        with pytest.raises(WebSocketDisconnect) as exc:
            with sync_client.websocket_connect(
                "/api/v1/iepod/quizzes/live/ABC123/ws?token=ok",
                headers={"origin": "http://localhost:3000"},
            ):
                pass
    assert exc.value.code == 4003


def test_iepod_live_ws_allows_spectator_for_non_participant_student(sync_client):
    db = MagicMock()
    db.iepod_live_quiz_sessions.find_one = AsyncMock(return_value={"_id": ObjectId(), "joinCode": "ABC123"})
    users_collection = MagicMock()
    users_collection.find_one = AsyncMock(return_value={"role": "student", "email": "student@example.com"})
    db.users = users_collection
    db.iepod_live_quiz_participants.find_one = AsyncMock(return_value=None)
    db.__getitem__.side_effect = lambda key: {
        "users": users_collection,
    }[key]

    initial = {
        "type": "live_state",
        "data": {
            "joinCode": "ABC123",
            "status": "waiting",
            "currentQuestionIndex": -1,
            "participantsCount": 0,
            "leaderboard": [],
        },
    }

    with (
        patch("app.routers.iepod.is_ws_origin_allowed", return_value=True),
        patch("app.routers.iepod.verify_firebase_id_token_raw", new_callable=AsyncMock, return_value={"sub": "u-2", "email": "student@example.com"}),
        patch("app.routers.iepod.get_database", return_value=db),
        patch("app.routers.iepod._build_live_state_payload", new_callable=AsyncMock, return_value=initial),
    ):
        with sync_client.websocket_connect(
            "/api/v1/iepod/quizzes/live/ABC123/ws?token=ok&spectator=true",
            headers={"origin": "http://localhost:3000"},
        ) as ws:
            first = ws.receive_json()
            assert first["type"] == "live_state"
            assert first["data"]["status"] == "waiting"


def test_iepod_live_ws_broadcasts_live_state_in_sequence(sync_client):
    join_code = "ABC123"
    live_id = ObjectId()
    db = MagicMock()
    db.iepod_live_quiz_sessions.find_one = AsyncMock(return_value={"_id": live_id, "joinCode": join_code})
    users_collection = MagicMock()
    users_collection.find_one = AsyncMock(return_value={"role": "student", "email": "student@example.com"})
    db.users = users_collection
    db.iepod_live_quiz_participants.find_one = AsyncMock(return_value={"liveSessionId": str(live_id), "userId": "u-1"})
    db.__getitem__.side_effect = lambda key: {
        "users": users_collection,
    }[key]

    initial = {
        "type": "live_state",
        "data": {
            "joinCode": join_code,
            "status": "waiting",
            "currentQuestionIndex": -1,
            "participantsCount": 2,
            "leaderboard": [],
        },
    }
    packet_one = {
        "type": "live_state",
        "data": {
            "joinCode": join_code,
            "status": "live",
            "currentQuestionIndex": 0,
            "participantsCount": 2,
            "leaderboard": [{"rank": 1, "userId": "u-1", "userName": "A", "totalScore": 10, "answersCount": 1}],
        },
    }
    packet_two = {
        "type": "live_state",
        "data": {
            "joinCode": join_code,
            "status": "live",
            "currentQuestionIndex": 1,
            "participantsCount": 2,
            "leaderboard": [{"rank": 1, "userId": "u-1", "userName": "A", "totalScore": 20, "answersCount": 2}],
        },
    }

    with (
        patch("app.routers.iepod.is_ws_origin_allowed", return_value=True),
        patch("app.routers.iepod.verify_firebase_id_token_raw", new_callable=AsyncMock, return_value={"sub": "u-1", "email": "student@example.com"}),
        patch("app.routers.iepod.get_database", return_value=db),
        patch("app.routers.iepod._build_live_state_payload", new_callable=AsyncMock, return_value=initial),
    ):
        with sync_client.websocket_connect(
            f"/api/v1/iepod/quizzes/live/{join_code}/ws?token=ok",
            headers={"origin": "http://localhost:3000"},
        ) as ws:
            first = ws.receive_json()
            assert first["type"] == "live_state"
            assert first["data"]["currentQuestionIndex"] == -1

            asyncio.run(iepod_router.live_ws_manager.broadcast(join_code, packet_one))
            asyncio.run(iepod_router.live_ws_manager.broadcast(join_code, packet_two))

            second = ws.receive_json()
            third = ws.receive_json()

            assert second["data"]["currentQuestionIndex"] == 0
            assert third["data"]["currentQuestionIndex"] == 1
            assert third["data"]["leaderboard"][0]["totalScore"] == 20


@pytest.mark.asyncio
async def test_live_state_payload_auto_sets_leaderboard_phase_and_question_timer():
    db = MagicMock()
    db.iepod_quizzes.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("507f1f77bcf86cd799439071"),
            "questions": [
                {
                    "question": "Q1",
                    "options": ["A", "B", "C", "D"],
                    "correctIndex": 0,
                    "points": 10,
                    "timeLimitSeconds": 35,
                }
            ],
        }
    )
    db.iepod_live_quiz_answers.count_documents = AsyncMock(return_value=3)
    db.iepod_live_quiz_answers.find = MagicMock(return_value=ToListCursor([]))
    db.iepod_live_quiz_participants.count_documents = AsyncMock(return_value=0)

    live_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439072"),
        "joinCode": "ABC123",
        "status": "live",
        "quizId": "507f1f77bcf86cd799439071",
        "quizTitle": "Live Test",
        "currentQuestionIndex": 0,
        "questionWindowSeconds": 20,
        "questionStartedAt": datetime.now(timezone.utc) - timedelta(seconds=40),
        "participantsCount": 6,
        "answersCount": 10,
        "currentQuestionAnswersCount": 4,
    }

    with patch("app.routers.iepod._compute_live_leaderboard", new_callable=AsyncMock, return_value=[]):
        payload = await iepod_router._build_live_state_payload(db, live_doc)

    data = payload["data"]
    assert data["questionPhase"] == "leaderboard"
    assert data["question"]["timeLimitSeconds"] == 35
    assert data["question"]["correctIndex"] == 0
    assert data["question"]["correctOption"] == "A"
    assert data["questionCompletionPercent"] == pytest.approx(66.7)
    assert data["recentAnswerVelocityPer10s"] == 3


@pytest.mark.asyncio
async def test_live_state_payload_sets_reveal_phase_with_remaining_seconds():
    db = MagicMock()
    db.iepod_quizzes.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("507f1f77bcf86cd799439081"),
            "questions": [
                {
                    "question": "Q1",
                    "options": ["A", "B", "C", "D"],
                    "points": 10,
                    "timeLimitSeconds": 20,
                }
            ],
        }
    )
    db.iepod_live_quiz_answers.count_documents = AsyncMock(return_value=2)
    db.iepod_live_quiz_answers.find = MagicMock(return_value=ToListCursor([]))
    db.iepod_live_quiz_participants.count_documents = AsyncMock(return_value=0)

    live_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439082"),
        "joinCode": "ABC123",
        "status": "live",
        "quizId": "507f1f77bcf86cd799439081",
        "quizTitle": "Reveal Test",
        "currentQuestionIndex": 0,
        "questionWindowSeconds": 20,
        "questionStartedAt": datetime.now(timezone.utc) - timedelta(seconds=24),
        "revealQuestionIndex": 0,
        "revealEndsAt": datetime.now(timezone.utc) + timedelta(seconds=5),
        "participantsCount": 5,
        "answersCount": 8,
        "currentQuestionAnswersCount": 3,
        "autoAdvance": True,
    }

    with patch("app.routers.iepod._compute_live_leaderboard", new_callable=AsyncMock, return_value=[]):
        payload = await iepod_router._build_live_state_payload(db, live_doc)

    data = payload["data"]
    assert data["questionPhase"] == "reveal"
    assert data["phaseRemainingSeconds"] > 0
    assert data["canRevealResults"] is False
    assert data["shouldAutoAdvance"] is False


@pytest.mark.asyncio
async def test_live_state_payload_sets_auto_advance_after_intermission_timeout():
    db = MagicMock()
    db.iepod_quizzes.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("507f1f77bcf86cd799439091"),
            "questions": [
                {
                    "question": "Q1",
                    "options": ["A", "B", "C", "D"],
                    "points": 10,
                    "timeLimitSeconds": 20,
                }
            ],
        }
    )
    db.iepod_live_quiz_answers.count_documents = AsyncMock(return_value=1)
    db.iepod_live_quiz_answers.find = MagicMock(return_value=ToListCursor([]))
    db.iepod_live_quiz_participants.count_documents = AsyncMock(return_value=0)

    live_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439092"),
        "joinCode": "ABC123",
        "status": "live",
        "quizId": "507f1f77bcf86cd799439091",
        "quizTitle": "Auto Test",
        "currentQuestionIndex": 0,
        "questionWindowSeconds": 20,
        "questionStartedAt": datetime.now(timezone.utc) - timedelta(seconds=40),
        "intermissionSeconds": 8,
        "participantsCount": 4,
        "answersCount": 4,
        "currentQuestionAnswersCount": 4,
        "autoAdvance": True,
    }

    with patch("app.routers.iepod._compute_live_leaderboard", new_callable=AsyncMock, return_value=[]):
        payload = await iepod_router._build_live_state_payload(db, live_doc)

    data = payload["data"]
    assert data["questionPhase"] == "leaderboard"
    assert data["phaseRemainingSeconds"] == 0
    assert data["shouldAutoAdvance"] is True


@pytest.mark.asyncio
async def test_advance_live_quiz_question_uses_next_question_payload_without_name_error():
    db = MagicMock()
    live_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439101"),
        "quizId": "507f1f77bcf86cd799439102",
        "joinCode": "ABC123",
        "status": "live",
        "currentQuestionIndex": -1,
        "questionWindowSeconds": 20,
    }
    quiz = {
        "_id": ObjectId("507f1f77bcf86cd799439102"),
        "questions": [
            {
                "question": "Q1",
                "options": ["A", "B", "C", "D"],
                "points": 10,
                "timeLimitSeconds": 30,
            }
        ],
    }

    db.iepod_quizzes.find_one = AsyncMock(return_value=quiz)
    db.iepod_live_quiz_sessions.update_one = AsyncMock()
    db.iepod_live_quiz_sessions.find_one = AsyncMock(return_value=live_doc)

    request = MagicMock()
    request.client = MagicMock(host="127.0.0.1")
    request.headers = {"user-agent": "pytest"}
    user = {"_id": "admin-1", "email": "admin@example.com"}
    session = {"_id": ObjectId("507f1f77bcf86cd799439012")}

    with (
        patch("app.routers.iepod.get_database", return_value=db),
        patch("app.routers.iepod._resolve_live_session", new_callable=AsyncMock, return_value=live_doc),
        patch("app.routers.iepod._broadcast_live_state", new_callable=AsyncMock),
        patch("app.routers.iepod.AuditLogger.log", new_callable=AsyncMock),
    ):
        result = await iepod_router.advance_live_quiz_question(
            join_code="ABC123",
            request=request,
            user=user,
            session=session,
        )

    assert result["ended"] is False
    assert result["question"]["index"] == 0
    assert result["question"]["timeLimitSeconds"] == 30
    assert result["question"]["question"] == "Q1"


@pytest.mark.asyncio
async def test_reveal_live_quiz_results_requires_elapsed_question_timer():
    db = MagicMock()
    live_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439111"),
        "quizId": "507f1f77bcf86cd799439112",
        "joinCode": "ABC123",
        "status": "live",
        "currentQuestionIndex": 0,
        "questionStartedAt": datetime.now(timezone.utc) - timedelta(seconds=5),
        "questionWindowSeconds": 20,
        "revealResultsSeconds": 6,
    }
    request = MagicMock()
    request.client = MagicMock(host="127.0.0.1")
    request.headers = {"user-agent": "pytest"}
    user = {"_id": "admin-1", "email": "admin@example.com"}
    session = {"_id": ObjectId("507f1f77bcf86cd799439012")}
    db.iepod_live_quiz_sessions.update_one = AsyncMock()

    with (
        patch("app.routers.iepod.get_database", return_value=db),
        patch("app.routers.iepod._resolve_live_session", new_callable=AsyncMock, return_value=live_doc),
    ):
        with pytest.raises(HTTPException) as exc:
            await iepod_router.reveal_live_quiz_results(
                join_code="ABC123",
                request=request,
                user=user,
                session=session,
            )

    assert exc.value.status_code == 400
    assert "only after question timer ends" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_advance_live_quiz_question_requires_reveal_after_timer_elapsed():
    db = MagicMock()
    live_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439151"),
        "quizId": "507f1f77bcf86cd799439152",
        "joinCode": "ABC123",
        "status": "live",
        "currentQuestionIndex": 0,
        "questionStartedAt": datetime.now(timezone.utc) - timedelta(seconds=35),
        "questionWindowSeconds": 20,
        "revealQuestionIndex": None,
    }
    quiz = {
        "_id": ObjectId("507f1f77bcf86cd799439152"),
        "questions": [
            {
                "question": "Q1",
                "options": ["A", "B", "C", "D"],
                "points": 10,
                "timeLimitSeconds": 20,
            },
            {
                "question": "Q2",
                "options": ["A2", "B2", "C2", "D2"],
                "points": 10,
                "timeLimitSeconds": 20,
            },
        ],
    }

    db.iepod_quizzes.find_one = AsyncMock(return_value=quiz)
    db.iepod_live_quiz_sessions.update_one = AsyncMock()

    request = MagicMock()
    request.client = MagicMock(host="127.0.0.1")
    request.headers = {"user-agent": "pytest"}
    user = {"_id": "admin-1", "email": "admin@example.com"}
    session = {"_id": ObjectId("507f1f77bcf86cd799439012")}

    with (
        patch("app.routers.iepod.get_database", return_value=db),
        patch("app.routers.iepod._resolve_live_session", new_callable=AsyncMock, return_value=live_doc),
    ):
        with pytest.raises(HTTPException) as exc:
            await iepod_router.advance_live_quiz_question(
                join_code="ABC123",
                request=request,
                user=user,
                session=session,
            )

    assert exc.value.status_code == 400
    assert "Reveal results" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_reveal_live_quiz_results_updates_state_and_broadcasts():
    db = MagicMock()
    live_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439121"),
        "quizId": "507f1f77bcf86cd799439122",
        "joinCode": "ABC123",
        "status": "live",
        "currentQuestionIndex": 0,
        "questionStartedAt": datetime.now(timezone.utc) - timedelta(seconds=30),
        "questionWindowSeconds": 20,
        "revealResultsSeconds": 7,
    }
    request = MagicMock()
    request.client = MagicMock(host="127.0.0.1")
    request.headers = {"user-agent": "pytest"}
    user = {"_id": "admin-1", "email": "admin@example.com"}
    session = {"_id": ObjectId("507f1f77bcf86cd799439012")}

    db.iepod_live_quiz_sessions.update_one = AsyncMock()
    db.iepod_live_quiz_sessions.find_one = AsyncMock(return_value=live_doc)

    with (
        patch("app.routers.iepod.get_database", return_value=db),
        patch("app.routers.iepod._resolve_live_session", new_callable=AsyncMock, return_value=live_doc),
        patch("app.routers.iepod._broadcast_live_state", new_callable=AsyncMock) as broadcast_mock,
        patch("app.routers.iepod.AuditLogger.log", new_callable=AsyncMock),
    ):
        result = await iepod_router.reveal_live_quiz_results(
            join_code="ABC123",
            request=request,
            user=user,
            session=session,
        )

    assert result["revealed"] is True
    assert result["questionIndex"] == 0
    assert result["revealResultsSeconds"] == 7
    assert db.iepod_live_quiz_sessions.update_one.await_count >= 1
    broadcast_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_live_quiz_state_exposes_auto_advance_signal_after_intermission():
    db = MagicMock()
    live_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439131"),
        "quizId": "507f1f77bcf86cd799439132",
        "joinCode": "ABC123",
        "status": "live",
        "currentQuestionIndex": 0,
        "questionStartedAt": datetime.now(timezone.utc) - timedelta(seconds=50),
        "questionWindowSeconds": 20,
        "intermissionSeconds": 8,
        "autoAdvance": True,
        "participantsCount": 5,
        "currentQuestionAnswersCount": 5,
    }
    quiz_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439132"),
        "questions": [
            {
                "question": "Q1",
                "options": ["A", "B", "C", "D"],
                "points": 10,
                "timeLimitSeconds": 20,
            }
        ],
    }
    db.iepod_quizzes.find_one = AsyncMock(return_value=quiz_doc)
    db.iepod_live_quiz_answers.count_documents = AsyncMock(return_value=1)
    db.iepod_live_quiz_answers.find = MagicMock(return_value=ToListCursor([]))
    db.iepod_live_quiz_participants.count_documents = AsyncMock(return_value=0)

    async def _update_live_session(_filter, update):
        for k, v in update.get("$set", {}).items():
            live_doc[k] = v
        for k, v in update.get("$inc", {}).items():
            live_doc[k] = int(live_doc.get(k, 0)) + int(v)

    db.iepod_live_quiz_sessions.update_one = AsyncMock(side_effect=_update_live_session)
    db.iepod_live_quiz_sessions.find_one = AsyncMock(side_effect=lambda *_args, **_kwargs: live_doc.copy())

    user = {"_id": "student-1"}
    session = {"_id": ObjectId("507f1f77bcf86cd799439012")}

    with (
        patch("app.routers.iepod.get_database", return_value=db),
        patch("app.routers.iepod._resolve_live_session", new_callable=AsyncMock, return_value=live_doc),
        patch("app.routers.iepod._compute_live_leaderboard", new_callable=AsyncMock, return_value=[]),
    ):
        state = await iepod_router.get_live_quiz_state(
            join_code="ABC123",
            user=user,
            session=session,
        )

    # Auto-transition now promotes state server-side (question -> reveal).
    assert state["questionPhase"] == "reveal"
    assert state["shouldAutoAdvance"] is False


@pytest.mark.asyncio
async def test_live_flow_waiting_to_question_leaderboard_reveal_and_next_question():
    live_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439141"),
        "quizId": "507f1f77bcf86cd799439142",
        "joinCode": "ABC123",
        "status": "waiting",
        "quizTitle": "Flow Test",
        "currentQuestionIndex": -1,
        "questionWindowSeconds": 20,
        "intermissionSeconds": 8,
        "revealResultsSeconds": 6,
        "participantsCount": 3,
        "answersCount": 0,
        "currentQuestionAnswersCount": 0,
    }
    quiz_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439142"),
        "questions": [
            {
                "question": "Q1",
                "options": ["A", "B", "C", "D"],
                "correctIndex": 1,
                "points": 10,
                "timeLimitSeconds": 20,
            },
            {
                "question": "Q2",
                "options": ["A2", "B2", "C2", "D2"],
                "correctIndex": 2,
                "points": 12,
                "timeLimitSeconds": 25,
            },
        ],
    }

    db = MagicMock()
    db.iepod_quizzes.find_one = AsyncMock(return_value=quiz_doc)
    db.iepod_live_quiz_answers.count_documents = AsyncMock(return_value=0)
    db.iepod_live_quiz_answers.find = MagicMock(return_value=ToListCursor([]))
    db.iepod_live_quiz_participants.count_documents = AsyncMock(return_value=0)

    async def _update_live_session(_filter, update):
        for k, v in update.get("$set", {}).items():
            live_doc[k] = v
        for k, v in update.get("$inc", {}).items():
            live_doc[k] = int(live_doc.get(k, 0)) + int(v)

    db.iepod_live_quiz_sessions.update_one = AsyncMock(side_effect=_update_live_session)
    db.iepod_live_quiz_sessions.find_one = AsyncMock(side_effect=lambda *_args, **_kwargs: live_doc.copy())

    request = MagicMock()
    request.client = MagicMock(host="127.0.0.1")
    request.headers = {"user-agent": "pytest"}
    user = {"_id": "admin-1", "email": "admin@example.com"}
    session = {"_id": ObjectId("507f1f77bcf86cd799439012")}

    with (
        patch("app.routers.iepod.get_database", return_value=db),
        patch("app.routers.iepod._resolve_live_session", new_callable=AsyncMock, return_value=live_doc),
        patch("app.routers.iepod._compute_live_leaderboard", new_callable=AsyncMock, return_value=[]),
        patch("app.routers.iepod._broadcast_live_state", new_callable=AsyncMock),
        patch("app.routers.iepod.AuditLogger.log", new_callable=AsyncMock),
    ):
        waiting_state = await iepod_router.get_live_quiz_state(
            join_code="ABC123",
            user={"_id": "student-1"},
            session=session,
        )
        assert waiting_state["questionPhase"] == "waiting"

        q1 = await iepod_router.advance_live_quiz_question(
            join_code="ABC123",
            request=request,
            user=user,
            session=session,
        )
        assert q1["ended"] is False
        assert q1["question"]["index"] == 0

        live_doc["questionStartedAt"] = datetime.now(timezone.utc) - timedelta(seconds=35)
        leaderboard_state = await iepod_router.get_live_quiz_state(
            join_code="ABC123",
            user={"_id": "student-1"},
            session=session,
        )
        assert leaderboard_state["questionPhase"] == "leaderboard"

        reveal = await iepod_router.reveal_live_quiz_results(
            join_code="ABC123",
            request=request,
            user=user,
            session=session,
        )
        assert reveal["revealed"] is True

        reveal_state = await iepod_router.get_live_quiz_state(
            join_code="ABC123",
            user={"_id": "student-1"},
            session=session,
        )
        assert reveal_state["questionPhase"] == "reveal"

        live_doc["revealEndsAt"] = datetime.now(timezone.utc) - timedelta(
            seconds=int(live_doc.get("intermissionSeconds", 8)) + 1
        )
        q2 = await iepod_router.advance_live_quiz_question(
            join_code="ABC123",
            request=request,
            user=user,
            session=session,
        )
        assert q2["ended"] is False
        assert q2["question"]["index"] == 1


    @pytest.mark.asyncio
    async def test_pause_and_resume_freezes_and_restores_phase_timer():
        db = MagicMock()
        now = datetime.now(timezone.utc)
        live_doc = {
            "_id": ObjectId("507f1f77bcf86cd799439501"),
            "quizId": "507f1f77bcf86cd799439502",
            "joinCode": "PAUSE1",
            "status": "live",
            "phase": iepod_router.LIVE_PHASE_QUESTION_ANSWERING,
            "phaseStartedAt": now - timedelta(seconds=4),
            "phaseDurationSeconds": 20,
            "phaseEndsAt": now + timedelta(seconds=9),
            "questionStartedAt": now - timedelta(seconds=4),
            "questionWindowSeconds": 20,
            "isPaused": False,
            "pausedAt": None,
            "pausedRemainingSeconds": 0,
            "updatedAt": now,
        }

        async def _update(_filter, update):
            for k, v in update.get("$set", {}).items():
                live_doc[k] = v

        db.iepod_live_quiz_sessions.update_one = AsyncMock(side_effect=_update)
        db.iepod_live_quiz_sessions.find_one = AsyncMock(side_effect=lambda *_a, **_k: live_doc.copy())

        request = MagicMock()
        request.headers = {}
        session = {"_id": ObjectId("507f1f77bcf86cd799439012")}
        user = {"_id": "admin-1", "email": "admin@example.com"}

        with (
            patch("app.routers.iepod.get_database", return_value=db),
            patch("app.routers.iepod._resolve_live_session", new_callable=AsyncMock, return_value=live_doc),
            patch("app.routers.iepod._register_host_action_id", new_callable=AsyncMock),
            patch("app.routers.iepod._broadcast_live_state", new_callable=AsyncMock),
        ):
            paused = await iepod_router.pause_live_quiz_session("PAUSE1", request, user, session)
            assert paused["paused"] is True
            assert live_doc["isPaused"] is True
            frozen = int(live_doc.get("pausedRemainingSeconds") or 0)
            assert frozen >= 0
            assert live_doc.get("phaseEndsAt") is None

            resumed = await iepod_router.resume_live_quiz_session("PAUSE1", request, user, session)
            assert resumed["paused"] is False
            assert live_doc["isPaused"] is False
            assert isinstance(live_doc.get("phaseEndsAt"), datetime)


    @pytest.mark.asyncio
    async def test_stale_state_returns_typed_payload_with_latest_state():
        db = MagicMock()
        now = datetime.now(timezone.utc)
        live_doc = {
            "_id": ObjectId("507f1f77bcf86cd799439511"),
            "quizId": "507f1f77bcf86cd799439512",
            "joinCode": "STALE1",
            "status": "live",
            "phase": iepod_router.LIVE_PHASE_QUESTION_ANSWERING,
            "phaseStartedAt": now - timedelta(seconds=1),
            "phaseDurationSeconds": 20,
            "phaseEndsAt": now + timedelta(seconds=19),
            "updatedAt": now,
        }

        payload = {
            "data": {
                "joinCode": "STALE1",
                "status": "live",
                "phase": iepod_router.LIVE_PHASE_QUESTION_ANSWERING,
                "stateVersion": iepod_router._state_version_from_doc(live_doc),
                "question": None,
                "quizId": "507f1f77bcf86cd799439512",
                "quizTitle": "Quiz",
                "currentQuestionIndex": 0,
                "totalQuestions": 1,
                "questionWindowSeconds": 20,
                "remainingSeconds": 0,
                "participantsCount": 0,
            }
        }

        with patch("app.routers.iepod._build_live_state_payload", new_callable=AsyncMock, return_value=payload):
            with pytest.raises(HTTPException) as exc:
                await iepod_router._enforce_live_state_freshness(
                    db,
                    live_doc,
                    expected_state_version=1,
                )

        assert exc.value.status_code == 409
        detail = exc.value.detail
        assert detail["code"] == "stale_state"
        assert "latestState" in detail


    @pytest.mark.asyncio
    async def test_get_live_state_reconciliation_converges_in_single_hydration_cycle():
        db = MagicMock()
        now = datetime.now(timezone.utc)
        live_doc = {
            "_id": ObjectId("507f1f77bcf86cd799439521"),
            "quizId": "507f1f77bcf86cd799439522",
            "joinCode": "REC1",
            "status": "live",
            "autoAdvance": True,
            "currentQuestionIndex": 0,
            "phase": iepod_router.LIVE_PHASE_QUESTION_ANSWERING,
            "phaseStartedAt": now - timedelta(seconds=30),
            "phaseDurationSeconds": 20,
            "phaseEndsAt": now - timedelta(seconds=12),
            "questionStartedAt": now - timedelta(seconds=30),
            "questionWindowSeconds": 20,
            "revealResultsSeconds": 6,
            "intermissionSeconds": 8,
            "participantsCount": 3,
            "currentQuestionAnswersCount": 3,
            "updatedAt": now - timedelta(seconds=12),
        }
        quiz_doc = {
            "_id": ObjectId("507f1f77bcf86cd799439522"),
            "questions": [
                {
                    "question": "Q1",
                    "options": ["A", "B", "C", "D"],
                    "points": 10,
                    "timeLimitSeconds": 20,
                    "correctIndex": 1,
                }
            ],
        }

        db.iepod_quizzes.find_one = AsyncMock(return_value=quiz_doc)
        db.iepod_live_quiz_answers.count_documents = AsyncMock(return_value=0)
        db.iepod_live_quiz_answers.find = MagicMock(return_value=ToListCursor([]))
        db.iepod_live_quiz_participants.count_documents = AsyncMock(return_value=0)

        async def _update(_filter, update):
            for k, v in update.get("$set", {}).items():
                live_doc[k] = v
            for k, v in update.get("$inc", {}).items():
                live_doc[k] = int(live_doc.get(k, 0)) + int(v)

        db.iepod_live_quiz_sessions.update_one = AsyncMock(side_effect=_update)
        db.iepod_live_quiz_sessions.find_one = AsyncMock(side_effect=lambda *_a, **_k: live_doc.copy())

        session = {"_id": ObjectId("507f1f77bcf86cd799439012")}
        user = {"_id": "student-1"}

        with (
            patch("app.routers.iepod.get_database", return_value=db),
            patch("app.routers.iepod._resolve_live_session", new_callable=AsyncMock, return_value=live_doc),
            patch("app.routers.iepod._compute_live_leaderboard", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.iepod._broadcast_live_state", new_callable=AsyncMock),
        ):
            state = await iepod_router.get_live_quiz_state(join_code="REC1", user=user, session=session)

        assert state["status"] == "live"
        assert state["phase"] in {iepod_router.LIVE_PHASE_ANSWER_REVEAL, iepod_router.LIVE_PHASE_LEADERBOARD_REVEAL}


    @pytest.mark.asyncio
    async def test_get_live_state_reconciliation_converges_in_single_hydration_cycle():
        db = MagicMock()
        now = datetime.now(timezone.utc)
        live_doc = {
            "_id": ObjectId("507f1f77bcf86cd799439521"),
            "quizId": "507f1f77bcf86cd799439522",
            "joinCode": "REC1",
            "status": "live",
            "autoAdvance": True,
            "currentQuestionIndex": 0,
            "phase": iepod_router.LIVE_PHASE_QUESTION_ANSWERING,
            "phaseStartedAt": now - timedelta(seconds=30),
            "phaseDurationSeconds": 20,
            "phaseEndsAt": now - timedelta(seconds=12),
            "questionStartedAt": now - timedelta(seconds=30),
            "questionWindowSeconds": 20,
            "revealResultsSeconds": 6,
            "intermissionSeconds": 8,
            "participantsCount": 3,
            "currentQuestionAnswersCount": 3,
            "updatedAt": now - timedelta(seconds=12),
        }
        quiz_doc = {
            "_id": ObjectId("507f1f77bcf86cd799439522"),
            "questions": [
                {
                    "question": "Q1",
                    "options": ["A", "B", "C", "D"],
                    "points": 10,
                    "timeLimitSeconds": 20,
                    "correctIndex": 1,
                }
            ],
        }

        db.iepod_quizzes.find_one = AsyncMock(return_value=quiz_doc)
        db.iepod_live_quiz_answers.count_documents = AsyncMock(return_value=0)
        db.iepod_live_quiz_answers.find = MagicMock(return_value=ToListCursor([]))
        db.iepod_live_quiz_participants.count_documents = AsyncMock(return_value=0)

        async def _update(_filter, update):
            for k, v in update.get("$set", {}).items():
                live_doc[k] = v
            for k, v in update.get("$inc", {}).items():
                live_doc[k] = int(live_doc.get(k, 0)) + int(v)

        db.iepod_live_quiz_sessions.update_one = AsyncMock(side_effect=_update)
        db.iepod_live_quiz_sessions.find_one = AsyncMock(side_effect=lambda *_a, **_k: live_doc.copy())

        session = {"_id": ObjectId("507f1f77bcf86cd799439012")}
        user = {"_id": "student-1"}

        with (
            patch("app.routers.iepod.get_database", return_value=db),
            patch("app.routers.iepod._resolve_live_session", new_callable=AsyncMock, return_value=live_doc),
            patch("app.routers.iepod._compute_live_leaderboard", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.iepod._broadcast_live_state", new_callable=AsyncMock),
        ):
            state = await iepod_router.get_live_quiz_state(join_code="REC1", user=user, session=session)

        assert state["status"] == "live"
        assert state["phase"] in {iepod_router.LIVE_PHASE_ANSWER_REVEAL, iepod_router.LIVE_PHASE_LEADERBOARD_REVEAL}
