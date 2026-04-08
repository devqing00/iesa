"""
IEPOD Router — IESA Professional Development Hub

"Forge the Future Series" – Process Drivers: Your Process, Our Progress.

Endpoint groups:
  /api/v1/iepod/societies       — Campus society CRUD
  /api/v1/iepod/register        — Student intake registration
  /api/v1/iepod/registrations   — Admin: manage registrations
  /api/v1/iepod/niche-audit     — Student niche-audit worksheet
  /api/v1/iepod/teams           — Hackathon team management
  /api/v1/iepod/submissions     — Iteration submissions
  /api/v1/iepod/quizzes         — Quiz / challenge CRUD + participation
  /api/v1/iepod/points          — Gamification points + leaderboard
  /api/v1/iepod/my              — Student's own IEPOD profile
  /api/v1/iepod/stats           — Admin dashboard aggregations
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List
import re
import random
import string
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status, WebSocket, WebSocketDisconnect
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field

from ..core.permissions import (
    get_current_user,
    get_current_session,
    require_permission,
)
from ..core.sanitization import sanitize_html, validate_no_scripts
from ..core.audit import AuditLogger
from ..core.security import verify_firebase_id_token_raw
from ..core.ws_security import is_ws_origin_allowed
from ..db import get_database
from ..models.iepod import (
    # Societies
    SocietyCreate, SocietyUpdate, Society,
    # Registrations
    RegistrationCreate, RegistrationUpdate, Registration,
    # Niche Audit
    NicheAuditCreate, NicheAuditUpdate, NicheAudit,
    # Teams
    TeamCreate, TeamUpdate, Team, TeamMember,
    # Submissions
    SubmissionCreate, SubmissionReview, Submission,
    # Quizzes
    QuizCreate, QuizUpdate, Quiz, QuizPublic, QuizQuestionPublic,
    QuizResponseCreate, QuizResponse, QuizAnswer,
    # Points
    PointEntry, PointAward, PointReversal, LeaderboardEntry,
    IepodMemberLookupResponse, IepodResetUserDataRequest,
)

router = APIRouter(prefix="/api/v1/iepod", tags=["IEPOD Hub"])
_ws_router = APIRouter(prefix="/api/v1/iepod", tags=["IEPOD Hub WS"])


class LiveAnswerIn(BaseModel):
    questionIndex: int = Field(..., ge=0)
    selectedOption: int = Field(..., ge=0)
    confidence: Optional[str] = Field(default="medium")


class LiveReadyIn(BaseModel):
    ready: bool = True

class LiveQuizWSManager:
    """Maintains active live quiz websocket connections per join code."""

    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, join_code: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(join_code, []).append(ws)

    def disconnect(self, join_code: str, ws: WebSocket):
        conns = self.connections.get(join_code)
        if not conns:
            return
        self.connections[join_code] = [c for c in conns if c is not ws]
        if not self.connections[join_code]:
            self.connections.pop(join_code, None)

    async def broadcast(self, join_code: str, message: dict):
        conns = self.connections.get(join_code, [])
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(join_code, ws)


live_ws_manager = LiveQuizWSManager()

LIVE_PHASE_WAITING = "waiting"
LIVE_PHASE_QUESTION_INTRO = "question_intro"
LIVE_PHASE_QUESTION_ANSWERING = "question_answering"
LIVE_PHASE_ANSWER_REVEAL = "answer_reveal"
LIVE_PHASE_LEADERBOARD_REVEAL = "leaderboard_reveal"
LIVE_PHASE_ENDED = "ended"
LIVE_PHASE_TIMED = {
    LIVE_PHASE_QUESTION_INTRO,
    LIVE_PHASE_QUESTION_ANSWERING,
    LIVE_PHASE_ANSWER_REVEAL,
    LIVE_PHASE_LEADERBOARD_REVEAL,
}

LIVE_PHASE_WATCHDOG_GRACE_SECONDS = 2
LIVE_ACTION_ID_TTL_SECONDS = 45
LIVE_TRANSITION_LOCK_TTL_SECONDS = 5

_PHASE_ORDER = ["stimulate", "carve", "pitch"]


def _phase_index(phase: str | None) -> int:
    if not phase:
        return -1
    try:
        return _PHASE_ORDER.index(phase)
    except ValueError:
        return -1


def _user_id_variants(user_id: str | ObjectId) -> list:
    user_id_str = str(user_id).strip()
    variants: list = [user_id_str]
    if ObjectId.is_valid(user_id_str):
        variants.append(ObjectId(user_id_str))
    return variants


def _build_join_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def _state_version_from_doc(doc: dict, now: Optional[datetime] = None) -> int:
    updated_at = doc.get("updatedAt") if isinstance(doc, dict) else None
    if isinstance(updated_at, datetime):
        return int(updated_at.timestamp() * 1000)
    point = now or datetime.now(timezone.utc)
    return int(point.timestamp() * 1000)


def _legacy_phase_from_server_phase(phase: str) -> str:
    if phase == LIVE_PHASE_QUESTION_INTRO or phase == LIVE_PHASE_QUESTION_ANSWERING:
        return "question"
    if phase == LIVE_PHASE_ANSWER_REVEAL:
        return "reveal"
    if phase == LIVE_PHASE_LEADERBOARD_REVEAL:
        return "leaderboard"
    if phase == LIVE_PHASE_ENDED:
        return "ended"
    return "waiting"


def _status_from_server_phase(phase: str) -> str:
    if phase == LIVE_PHASE_ENDED:
        return "ended"
    if phase == LIVE_PHASE_WAITING:
        return "waiting"
    return "live"


def _phase_remaining_seconds(live_doc: dict, now: datetime) -> int:
    if bool(live_doc.get("isPaused", False)):
        return max(0, int(live_doc.get("pausedRemainingSeconds") or 0))
    phase_ends_at = live_doc.get("phaseEndsAt")
    if isinstance(phase_ends_at, datetime):
        return max(0, int((phase_ends_at - now).total_seconds()))
    return 0


def _parse_expected_state_version(request: Optional[Request]) -> Optional[int]:
    if request is None:
        return None
    raw = (request.headers.get("x-live-state-version") or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        raise HTTPException(400, "Invalid x-live-state-version header")


def _parse_action_id(request: Optional[Request], prefix: str) -> str:
    if request is not None:
        header_value = (request.headers.get("x-action-id") or "").strip()
        if header_value:
            return header_value[:80]
    return f"{prefix}-{uuid4().hex[:12]}"


async def _enforce_live_state_freshness(db, live_doc: dict, expected_state_version: Optional[int]):
    if expected_state_version is None:
        return
    current_version = _state_version_from_doc(live_doc)
    if expected_state_version >= current_version:
        return
    latest_payload = await _build_live_state_payload(db, live_doc)
    raise HTTPException(
        status_code=409,
        detail={
            "code": "stale_state",
            "message": "Live state is stale. Refresh and retry.",
            "expectedStateVersion": expected_state_version,
            "currentStateVersion": current_version,
            "latestState": latest_payload.get("data"),
        },
    )


async def _register_host_action_id(db, live_doc: dict, action_scope: str, action_id: str):
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=LIVE_ACTION_ID_TTL_SECONDS)

    # MongoDB rejects $pull + $push on the same array path in one update (code 40).
    # Clean expired receipts first, then insert the new receipt with duplicate guard.
    await db.iepod_live_quiz_sessions.update_one(
        {"_id": live_doc.get("_id")},
        {"$pull": {"recentActionReceipts": {"expiresAt": {"$lte": now}}}},
    )

    result = await db.iepod_live_quiz_sessions.update_one(
        {
            "_id": live_doc.get("_id"),
            "$nor": [
                {
                    "recentActionReceipts": {
                        "$elemMatch": {
                            "scope": action_scope,
                            "actionId": action_id,
                            "expiresAt": {"$gt": now},
                        }
                    }
                }
            ],
        },
        {
            "$push": {
                "recentActionReceipts": {
                    "scope": action_scope,
                    "actionId": action_id,
                    "expiresAt": expires_at,
                    "recordedAt": now,
                }
            },
        },
    )
    if getattr(result, "modified_count", 1) == 0:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_action",
                "message": "Duplicate host action id detected.",
                "actionId": action_id,
                "scope": action_scope,
            },
        )


async def _run_live_phase_watchdog(db, live_doc: dict) -> tuple[dict, bool]:
    if str(live_doc.get("status")) != "live":
        return live_doc, False
    if bool(live_doc.get("isPaused", False)):
        return live_doc, False
    phase = str(live_doc.get("phase") or "")
    if phase not in LIVE_PHASE_TIMED:
        return live_doc, False
    phase_ends_at = live_doc.get("phaseEndsAt")
    if not isinstance(phase_ends_at, datetime):
        return live_doc, False

    now = datetime.now(timezone.utc)
    if now <= phase_ends_at + timedelta(seconds=LIVE_PHASE_WATCHDOG_GRACE_SECONDS):
        return live_doc, False

    force_at = phase_ends_at + timedelta(seconds=LIVE_PHASE_WATCHDOG_GRACE_SECONDS)
    result = await db.iepod_live_quiz_sessions.update_one(
        {
            "_id": live_doc.get("_id"),
            "phase": phase,
            "phaseEndsAt": phase_ends_at,
            "isPaused": {"$ne": True},
        },
        {
            "$set": {
                "phaseEndsAt": force_at,
                "updatedAt": now,
                "watchdogLastTriggeredAt": now,
                "watchdogForcedPhase": phase,
            },
            "$inc": {"watchdogForceCount": 1},
        },
    )
    if getattr(result, "modified_count", 1) == 0:
        return live_doc, False

    refreshed = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    return (refreshed or live_doc), True


async def _resolve_live_session(db, join_code: str, session_id: str) -> dict:
    doc = await db.iepod_live_quiz_sessions.find_one(
        {"joinCode": join_code.strip().upper(), "sessionId": session_id}
    )
    if not doc:
        raise HTTPException(404, "Live session not found")
    if not bool(doc.get("autoAdvance", False)):
        now = datetime.now(timezone.utc)
        await db.iepod_live_quiz_sessions.update_one(
            {"_id": doc.get("_id")},
            {"$set": {"autoAdvance": True, "updatedAt": now}},
        )
        doc["autoAdvance"] = True

    # Backfill explicit phase model for legacy docs.
    if not doc.get("phase"):
        now = datetime.now(timezone.utc)
        status = str(doc.get("status") or "")
        current_idx = int(doc.get("currentQuestionIndex", -1))
        question_started_at = doc.get("questionStartedAt")
        reveal_question_index = doc.get("revealQuestionIndex")
        reveal_started_at = doc.get("revealStartedAt")
        reveal_ends_at = doc.get("revealEndsAt")
        question_window_seconds = int(doc.get("questionWindowSeconds", 20))
        reveal_seconds = int(doc.get("revealResultsSeconds", 6))
        intermission_seconds = int(doc.get("intermissionSeconds", 8))

        phase = LIVE_PHASE_WAITING
        phase_started_at: Optional[datetime] = None
        phase_duration_seconds = 0
        phase_ends_at: Optional[datetime] = None

        if status == "ended":
            phase = LIVE_PHASE_ENDED
        elif status == "waiting" or current_idx < 0:
            phase = LIVE_PHASE_WAITING
        elif isinstance(reveal_question_index, int) and reveal_question_index == current_idx:
            if isinstance(reveal_ends_at, datetime) and reveal_ends_at > now:
                phase = LIVE_PHASE_ANSWER_REVEAL
                phase_started_at = reveal_started_at if isinstance(reveal_started_at, datetime) else (reveal_ends_at - timedelta(seconds=reveal_seconds))
                phase_duration_seconds = reveal_seconds
                phase_ends_at = reveal_ends_at
            else:
                phase = LIVE_PHASE_LEADERBOARD_REVEAL
                phase_started_at = reveal_ends_at if isinstance(reveal_ends_at, datetime) else now
                phase_duration_seconds = intermission_seconds
                phase_ends_at = phase_started_at + timedelta(seconds=intermission_seconds)
        elif isinstance(question_started_at, datetime):
            question_ends_at = question_started_at + timedelta(seconds=question_window_seconds)
            if question_ends_at > now:
                phase = LIVE_PHASE_QUESTION_ANSWERING
                phase_started_at = question_started_at
                phase_duration_seconds = question_window_seconds
                phase_ends_at = question_ends_at
            else:
                phase = LIVE_PHASE_LEADERBOARD_REVEAL
                phase_started_at = question_ends_at
                phase_duration_seconds = intermission_seconds
                phase_ends_at = question_ends_at + timedelta(seconds=intermission_seconds)

        patch = {
            "phase": phase,
            "phaseStartedAt": phase_started_at,
            "phaseDurationSeconds": int(phase_duration_seconds),
            "phaseEndsAt": phase_ends_at,
            "status": _status_from_server_phase(phase),
            "updatedAt": now,
        }
        await db.iepod_live_quiz_sessions.update_one({"_id": doc.get("_id")}, {"$set": patch})
        doc.update(patch)
    return doc


async def _compute_live_leaderboard(db, live_session_id: str, limit: int = 50) -> list[dict]:
    rows = await db.iepod_live_quiz_participants.find(
        {"liveSessionId": live_session_id}
    ).sort([("totalScore", -1), ("joinedAt", 1)]).limit(limit).to_list(length=limit)

    leaderboard = []
    for i, row in enumerate(rows, 1):
        leaderboard.append({
            "rank": i,
            "userId": row.get("userId"),
            "userName": row.get("userName"),
            "totalScore": int(row.get("totalScore") or 0),
            "answersCount": int(row.get("answersCount") or 0),
        })
    return leaderboard


async def _process_live_auto_transitions(db, live_doc: dict, quiz: Optional[dict] = None) -> tuple[dict, bool]:
    """Advance timed live phases when autoAdvance is enabled.

    This keeps server state authoritative for both auto and manual modes.
    """
    started = datetime.now(timezone.utc)
    changed = False
    transitions_applied = 0
    skip_reason: Optional[str] = None
    working = live_doc
    quiz_doc = quiz
    lock_token = uuid4().hex[:10]
    lock_now = datetime.now(timezone.utc)
    lock_result = await db.iepod_live_quiz_sessions.update_one(
        {
            "_id": live_doc.get("_id"),
            "$or": [
                {"transitionLock": {"$exists": False}},
                {"transitionLock.expiresAt": {"$lte": lock_now}},
            ],
        },
        {
            "$set": {
                "transitionLock": {
                    "owner": lock_token,
                    "expiresAt": lock_now + timedelta(seconds=LIVE_TRANSITION_LOCK_TTL_SECONDS),
                    "acquiredAt": lock_now,
                }
            }
        },
    )
    if getattr(lock_result, "modified_count", 1) == 0:
        await db.iepod_live_quiz_sessions.update_one(
            {"_id": live_doc.get("_id")},
            {
                "$set": {
                    "lastTransitionSkipReason": "lock_busy",
                },
                "$inc": {"skippedTransitionCount": 1},
            },
        )
        return live_doc, False

    try:
        for _ in range(4):
            if str(working.get("status")) != "live":
                skip_reason = "not_live"
                break

            auto_advance = bool(working.get("autoAdvance", False))
            if not auto_advance or bool(working.get("isPaused", False)):
                skip_reason = "auto_off_or_paused"
                break

            if quiz_doc is None:
                quiz_id = str(working.get("quizId") or "")
                if not quiz_id:
                    skip_reason = "missing_quiz_id"
                    break
                quiz_doc = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
            if not quiz_doc:
                skip_reason = "quiz_missing"
                break

            questions = quiz_doc.get("questions", [])
            current_idx = int(working.get("currentQuestionIndex", -1))
            explicit_phase = str(working.get("phase") or "")
            phase = explicit_phase
            now = datetime.now(timezone.utc)

            if not phase:
                started_at = working.get("questionStartedAt")
                question_window_seconds = int(working.get("questionWindowSeconds", 20) or 20)
                reveal_question_index = working.get("revealQuestionIndex")
                reveal_ends_at = working.get("revealEndsAt") if isinstance(working.get("revealEndsAt"), datetime) else None

                if current_idx < 0 or not isinstance(started_at, datetime):
                    phase = LIVE_PHASE_WAITING
                else:
                    elapsed = (now - started_at).total_seconds()
                    if elapsed < question_window_seconds:
                        phase = LIVE_PHASE_QUESTION_ANSWERING
                        working = {
                            **working,
                            "phase": phase,
                            "phaseStartedAt": started_at,
                            "phaseDurationSeconds": question_window_seconds,
                            "phaseEndsAt": started_at + timedelta(seconds=question_window_seconds),
                        }
                    elif reveal_question_index == current_idx and reveal_ends_at and reveal_ends_at > now:
                        phase = LIVE_PHASE_ANSWER_REVEAL
                        reveal_started_at = working.get("revealStartedAt") if isinstance(working.get("revealStartedAt"), datetime) else now
                        reveal_duration = max(0, int((reveal_ends_at - reveal_started_at).total_seconds()))
                        working = {
                            **working,
                            "phase": phase,
                            "phaseStartedAt": reveal_started_at,
                            "phaseDurationSeconds": reveal_duration,
                            "phaseEndsAt": reveal_ends_at,
                        }
                    elif reveal_question_index == current_idx and reveal_ends_at is not None:
                        phase = LIVE_PHASE_LEADERBOARD_REVEAL
                        intermission_seconds = int(working.get("intermissionSeconds", 8) or 8)
                        working = {
                            **working,
                            "phase": phase,
                            "phaseStartedAt": reveal_ends_at,
                            "phaseDurationSeconds": intermission_seconds,
                            "phaseEndsAt": reveal_ends_at + timedelta(seconds=intermission_seconds),
                        }
                    else:
                        # No reveal has happened yet in legacy docs; seed as answering so auto-transition promotes to reveal first.
                        phase = LIVE_PHASE_QUESTION_ANSWERING
                        working = {
                            **working,
                            "phase": phase,
                            "phaseStartedAt": started_at,
                            "phaseDurationSeconds": question_window_seconds,
                            "phaseEndsAt": started_at + timedelta(seconds=question_window_seconds),
                        }

            if phase in (LIVE_PHASE_WAITING, LIVE_PHASE_ENDED, ""):
                skip_reason = "terminal_or_waiting"
                break

            if current_idx < 0 or current_idx >= len(questions):
                skip_reason = "question_index_oob"
                break

            phase_ends_at = working.get("phaseEndsAt")
            if not isinstance(phase_ends_at, datetime):
                skip_reason = "phase_end_missing"
                break

            if phase_ends_at > now:
                skip_reason = "phase_not_elapsed"
                break

            reveal_seconds = int(working.get("revealResultsSeconds", 6))
            intermission_seconds = int(working.get("intermissionSeconds", 8))
            intro_seconds = int(working.get("questionIntroSeconds", 3))

            if phase == LIVE_PHASE_QUESTION_INTRO:
                question_window_seconds = int(questions[current_idx].get("timeLimitSeconds", working.get("questionWindowSeconds", 20)))
                await db.iepod_live_quiz_sessions.update_one(
                    {"_id": working.get("_id")},
                    {
                        "$set": {
                            "phase": LIVE_PHASE_QUESTION_ANSWERING,
                            "phaseStartedAt": now,
                            "phaseDurationSeconds": question_window_seconds,
                            "phaseEndsAt": now + timedelta(seconds=question_window_seconds),
                            "status": "live",
                            "questionStartedAt": now,
                            "questionWindowSeconds": question_window_seconds,
                            "updatedAt": now,
                        }
                    },
                )
                changed = True
                transitions_applied += 1
                refreshed = await db.iepod_live_quiz_sessions.find_one({"_id": working.get("_id")})
                if not refreshed:
                    break
                working = refreshed
                continue

            if phase == LIVE_PHASE_QUESTION_ANSWERING:
                await db.iepod_live_quiz_sessions.update_one(
                    {"_id": working.get("_id")},
                    {
                        "$set": {
                            "phase": LIVE_PHASE_ANSWER_REVEAL,
                            "phaseStartedAt": now,
                            "phaseDurationSeconds": reveal_seconds,
                            "phaseEndsAt": now + timedelta(seconds=reveal_seconds),
                            "status": "live",
                            "revealQuestionIndex": current_idx,
                            "revealStartedAt": now,
                            "revealEndsAt": now + timedelta(seconds=reveal_seconds),
                            "updatedAt": now,
                        }
                    },
                )
                changed = True
                transitions_applied += 1
                refreshed = await db.iepod_live_quiz_sessions.find_one({"_id": working.get("_id")})
                if not refreshed:
                    break
                working = refreshed
                continue

            if phase == LIVE_PHASE_ANSWER_REVEAL:
                await db.iepod_live_quiz_sessions.update_one(
                    {"_id": working.get("_id")},
                    {
                        "$set": {
                            "phase": LIVE_PHASE_LEADERBOARD_REVEAL,
                            "phaseStartedAt": now,
                            "phaseDurationSeconds": intermission_seconds,
                            "phaseEndsAt": now + timedelta(seconds=intermission_seconds),
                            "status": "live",
                            "updatedAt": now,
                        }
                    },
                )
                changed = True
                transitions_applied += 1
                refreshed = await db.iepod_live_quiz_sessions.find_one({"_id": working.get("_id")})
                if not refreshed:
                    break
                working = refreshed
                continue

            if phase != LIVE_PHASE_LEADERBOARD_REVEAL:
                skip_reason = "phase_not_supported"
                break

            next_idx = current_idx + 1
            if next_idx >= len(questions):
                await db.iepod_live_quiz_sessions.update_one(
                    {"_id": working.get("_id")},
                    {
                        "$set": {
                            "phase": LIVE_PHASE_ENDED,
                            "phaseStartedAt": now,
                            "phaseDurationSeconds": 0,
                            "phaseEndsAt": None,
                            "status": "ended",
                            "endedAt": now,
                            "updatedAt": now,
                        }
                    },
                )
                changed = True
                transitions_applied += 1
                refreshed = await db.iepod_live_quiz_sessions.find_one({"_id": working.get("_id")})
                if not refreshed:
                    break
                working = refreshed
                continue

            next_question = questions[next_idx]
            next_window_seconds = int(next_question.get("timeLimitSeconds", working.get("questionWindowSeconds", 20)))
            await db.iepod_live_quiz_sessions.update_one(
                {"_id": working.get("_id")},
                {
                    "$set": {
                        "status": "live",
                        "phase": LIVE_PHASE_QUESTION_INTRO,
                        "phaseStartedAt": now,
                        "phaseDurationSeconds": intro_seconds,
                        "phaseEndsAt": now + timedelta(seconds=intro_seconds),
                        "currentQuestionIndex": next_idx,
                        "questionStartedAt": None,
                        "questionWindowSeconds": next_window_seconds,
                        "currentQuestionAnswersCount": 0,
                        "revealQuestionIndex": None,
                        "revealStartedAt": None,
                        "revealEndsAt": None,
                        "updatedAt": now,
                    }
                },
            )
            changed = True
            transitions_applied += 1
            refreshed = await db.iepod_live_quiz_sessions.find_one({"_id": working.get("_id")})
            if not refreshed:
                break
            working = refreshed
    finally:
        duration_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        summary_update: dict = {
            "$set": {
                "lastTransitionDurationMs": duration_ms,
                "lastTransitionSkipReason": skip_reason,
            }
        }

        if transitions_applied > 0:
            # Only bump updatedAt/state version when a real phase transition happened.
            summary_update["$set"]["updatedAt"] = datetime.now(timezone.utc)
            summary_update["$inc"] = {"transitionCount": int(transitions_applied)}
        else:
            summary_update["$inc"] = {"skippedTransitionCount": 1}

        await db.iepod_live_quiz_sessions.update_one(
            {"_id": live_doc.get("_id")},
            summary_update,
        )
        await db.iepod_live_quiz_sessions.update_one(
            {"_id": live_doc.get("_id"), "transitionLock.owner": lock_token},
            {"$unset": {"transitionLock": ""}},
        )

    return working, changed


async def _build_live_state_payload(db, live_doc: dict) -> dict:
    quiz_id = str(live_doc.get("quizId") or "")
    quiz = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)}) if quiz_id else None
    total_questions = len(quiz.get("questions", [])) if quiz else 0
    current_idx = int(live_doc.get("currentQuestionIndex", -1))

    question = None
    now = datetime.now(timezone.utc)
    explicit_phase = str(live_doc.get("phase") or "")
    phase = explicit_phase or LIVE_PHASE_WAITING
    is_paused = bool(live_doc.get("isPaused", False))
    phase_remaining_seconds = _phase_remaining_seconds(live_doc, now)
    remaining_seconds = phase_remaining_seconds if phase == LIVE_PHASE_QUESTION_ANSWERING else 0
    question_phase = _legacy_phase_from_server_phase(phase)
    can_reveal_results = phase == LIVE_PHASE_QUESTION_ANSWERING and phase_remaining_seconds <= 0
    should_auto_advance = bool(live_doc.get("autoAdvance", False)) and (not is_paused) and phase in {
        LIVE_PHASE_QUESTION_INTRO,
        LIVE_PHASE_QUESTION_ANSWERING,
        LIVE_PHASE_ANSWER_REVEAL,
        LIVE_PHASE_LEADERBOARD_REVEAL,
    } and phase_remaining_seconds <= 0
    if quiz and 0 <= current_idx < total_questions:
        q = quiz["questions"][current_idx]
        correct_index = int(q.get("correctIndex", -1))
        options = q.get("options", [])
        question_window_seconds = int(q.get("timeLimitSeconds", live_doc.get("questionWindowSeconds", 20)))
        question = {
            "index": current_idx,
            "question": q.get("question"),
            "options": options,
            "points": q.get("points", 10),
            "timeLimitSeconds": question_window_seconds,
        }
        started_at = live_doc.get("questionStartedAt")
        if isinstance(started_at, datetime) and (
            not explicit_phase
            or explicit_phase in (LIVE_PHASE_QUESTION_INTRO, LIVE_PHASE_QUESTION_ANSWERING)
        ):
            elapsed = (now - started_at).total_seconds()
            remaining_seconds = max(0, int(question_window_seconds - elapsed))
            intermission_seconds = int(live_doc.get("intermissionSeconds", 8))
            reveal_question_index = live_doc.get("revealQuestionIndex")
            reveal_ends_at = live_doc.get("revealEndsAt")
            reveal_end_dt = reveal_ends_at if isinstance(reveal_ends_at, datetime) else None
            reveal_has_started = reveal_question_index == current_idx
            reveal_active = (
                reveal_has_started
                and reveal_end_dt is not None
                and reveal_end_dt > now
            )

            if reveal_active:
                question_phase = "reveal"
                phase = LIVE_PHASE_ANSWER_REVEAL
                phase_remaining_seconds = max(0, int((reveal_end_dt - now).total_seconds())) if reveal_end_dt else 0
                can_reveal_results = False
            elif reveal_has_started and reveal_end_dt is not None:
                question_phase = "leaderboard"
                phase = LIVE_PHASE_LEADERBOARD_REVEAL
                intermission_elapsed = (now - reveal_end_dt).total_seconds()
                phase_remaining_seconds = max(0, int(intermission_seconds - intermission_elapsed))
                can_reveal_results = False
            elif elapsed < question_window_seconds:
                question_phase = "question"
                phase = LIVE_PHASE_QUESTION_ANSWERING
                phase_remaining_seconds = remaining_seconds
                can_reveal_results = False
            else:
                question_phase = "leaderboard"
                phase = LIVE_PHASE_LEADERBOARD_REVEAL
                intermission_anchor = started_at + timedelta(seconds=question_window_seconds)
                intermission_elapsed = (now - intermission_anchor).total_seconds()
                phase_remaining_seconds = max(0, int(intermission_seconds - intermission_elapsed))
                can_reveal_results = True

            should_auto_advance = bool(live_doc.get("autoAdvance", False)) and phase_remaining_seconds <= 0

        if question_phase in ("leaderboard", "reveal", "ended") and 0 <= correct_index < len(options):
            question["correctIndex"] = correct_index
            question["correctOption"] = options[correct_index]

        if question_phase in ("leaderboard", "reveal", "ended") and options:
            answered_rows = await db.iepod_live_quiz_answers.find(
                {
                    "liveSessionId": str(live_doc.get("_id")),
                    "questionIndex": current_idx,
                },
                {"selectedOption": 1},
            ).to_list(length=10000)
            option_counts = [0 for _ in options]
            for row in answered_rows:
                selected = row.get("selectedOption")
                if isinstance(selected, int) and 0 <= selected < len(option_counts):
                    option_counts[selected] += 1
            total_answers_for_question = max(1, sum(option_counts))
            question["optionDistribution"] = [
                {
                    "optionIndex": idx,
                    "option": options[idx],
                    "count": int(option_counts[idx]),
                    "percent": round((option_counts[idx] / total_answers_for_question) * 100, 1),
                }
                for idx in range(len(options))
            ]

    if phase == LIVE_PHASE_ENDED or str(live_doc.get("status")) == "ended":
        question_phase = "ended"
        phase = LIVE_PHASE_ENDED
        phase_remaining_seconds = 0

    recent_window_start = now.replace(microsecond=0)
    recent_window_start = recent_window_start - timedelta(seconds=10)
    recent_velocity = await db.iepod_live_quiz_answers.count_documents(
        {
            "liveSessionId": str(live_doc.get("_id")),
            "submittedAt": {"$gte": recent_window_start},
        }
    )

    trend_window_seconds = 60
    trend_bucket_seconds = 10
    trend_bucket_count = trend_window_seconds // trend_bucket_seconds
    trend_start = now - timedelta(seconds=trend_window_seconds)
    trend_buckets = [0 for _ in range(trend_bucket_count)]
    recent_answers = await db.iepod_live_quiz_answers.find(
        {
            "liveSessionId": str(live_doc.get("_id")),
            "submittedAt": {"$gte": trend_start},
        },
        {"submittedAt": 1},
    ).to_list(length=5000)
    for ans in recent_answers:
        submitted_at = ans.get("submittedAt")
        if not isinstance(submitted_at, datetime):
            continue
        if submitted_at.tzinfo is None:
            submitted_at = submitted_at.replace(tzinfo=timezone.utc)
        age_seconds = (now - submitted_at).total_seconds()
        if age_seconds < 0 or age_seconds > trend_window_seconds:
            continue
        bucket_index = int((submitted_at - trend_start).total_seconds() // trend_bucket_seconds)
        bucket_index = max(0, min(trend_bucket_count - 1, bucket_index))
        trend_buckets[bucket_index] += 1

    question_answers_count = int(live_doc.get("currentQuestionAnswersCount", 0) or 0)
    participants_count = int(live_doc.get("participantsCount", 0) or 0)
    question_completion_percent = (
        round((question_answers_count / participants_count) * 100, 1)
        if participants_count > 0
        else 0.0
    )

    leaderboard = await _compute_live_leaderboard(db, str(live_doc.get("_id")), limit=20)
    ready_participants_count = await db.iepod_live_quiz_participants.count_documents(
        {
            "liveSessionId": str(live_doc.get("_id")),
            "readyForStart": True,
        }
    )
    updated_at = live_doc.get("updatedAt")
    state_version = int(updated_at.timestamp() * 1000) if isinstance(updated_at, datetime) else int(now.timestamp() * 1000)
    return {
        "type": "live_state",
        "data": {
            "joinCode": live_doc.get("joinCode"),
            "status": live_doc.get("status"),
            "quizId": live_doc.get("quizId"),
            "quizTitle": live_doc.get("quizTitle"),
            "currentQuestionIndex": current_idx,
            "totalQuestions": total_questions,
            "questionWindowSeconds": int(live_doc.get("questionWindowSeconds", 20)),
            "intermissionSeconds": int(live_doc.get("intermissionSeconds", 8)),
            "revealResultsSeconds": int(live_doc.get("revealResultsSeconds", 6)),
            "autoAdvance": bool(live_doc.get("autoAdvance", False)),
            "phase": phase,
            "isPaused": is_paused,
            "pausedAt": live_doc.get("pausedAt").isoformat() if isinstance(live_doc.get("pausedAt"), datetime) else None,
            "pausedRemainingSeconds": int(live_doc.get("pausedRemainingSeconds", 0) or 0),
            "phaseStartedAt": live_doc.get("phaseStartedAt").isoformat() if isinstance(live_doc.get("phaseStartedAt"), datetime) else None,
            "phaseDurationSeconds": int(live_doc.get("phaseDurationSeconds", 0) or 0),
            "phaseEndsAt": live_doc.get("phaseEndsAt").isoformat() if isinstance(live_doc.get("phaseEndsAt"), datetime) else None,
            "remainingSeconds": remaining_seconds,
            "questionPhase": question_phase,
            "phaseRemainingSeconds": phase_remaining_seconds,
            "canRevealResults": can_reveal_results,
            "shouldAutoAdvance": should_auto_advance,
            "question": question,
            "participantsCount": participants_count,
            "readyParticipantsCount": int(ready_participants_count),
            "answersCount": int(live_doc.get("answersCount", 0)),
            "currentQuestionAnswersCount": question_answers_count,
            "questionCompletionPercent": question_completion_percent,
            "recentAnswerVelocityPer10s": int(recent_velocity),
            "recentAnswerTrendPer10s": trend_buckets,
            "finalPodiumRevealed": bool(live_doc.get("finalPodiumRevealed", False)),
            "stateVersion": state_version,
            "leaderboard": leaderboard,
        },
    }


async def _broadcast_live_state(db, live_doc: dict):
    payload = await _build_live_state_payload(db, live_doc)
    await live_ws_manager.broadcast(str(live_doc.get("joinCode", "")).upper(), payload)


def _scaled_quiz_base_points(points: int | float | None) -> int:
    # Keep base award in hundreds (100-600) regardless of raw question points.
    raw = max(1, int(points or 10)) * 10
    return max(100, min(600, raw))


def _max_question_award(base_points: int) -> int:
    # Absolute cap per question must stay in hundreds (< 1000).
    return min(900, base_points + max(50, base_points // 2))


async def _build_live_replay_timeline(db, live_doc: dict) -> list[dict]:
    quiz_id = str(live_doc.get("quizId") or "")
    quiz = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)}) if quiz_id else None
    if not quiz:
        return []

    questions = quiz.get("questions", [])
    live_session_id = str(live_doc.get("_id"))
    answers = await db.iepod_live_quiz_answers.find(
        {"liveSessionId": live_session_id},
        {"questionIndex": 1, "selectedOption": 1, "pointsAwarded": 1, "userId": 1, "userName": 1},
    ).sort([("questionIndex", 1), ("submittedAt", 1)]).to_list(length=100000)

    answer_by_question: dict[int, list[dict]] = {}
    for row in answers:
        qi = int(row.get("questionIndex", -1))
        if qi < 0:
            continue
        answer_by_question.setdefault(qi, []).append(row)

    cumulative_scores: dict[str, int] = {}
    user_names: dict[str, str] = {}
    timeline: list[dict] = []

    for qi, q in enumerate(questions):
        options = q.get("options", [])
        correct_idx = int(q.get("correctIndex", -1))
        rows = answer_by_question.get(qi, [])

        option_counts = [0 for _ in options]
        wrong_counts = [0 for _ in options]
        per_question_gain: dict[str, int] = {}

        for row in rows:
            uid = str(row.get("userId") or "")
            uname = str(row.get("userName") or "Student")
            if uid:
                user_names[uid] = uname

            selected = row.get("selectedOption")
            if isinstance(selected, int) and 0 <= selected < len(option_counts):
                option_counts[selected] += 1
                if selected != correct_idx:
                    wrong_counts[selected] += 1

            awarded = int(row.get("pointsAwarded") or 0)
            if uid:
                per_question_gain[uid] = per_question_gain.get(uid, 0) + awarded
                cumulative_scores[uid] = cumulative_scores.get(uid, 0) + awarded

        wrong_total = sum(wrong_counts)
        dominant_wrong = max(wrong_counts) if wrong_counts else 0
        confusion_index = round((dominant_wrong / wrong_total), 3) if wrong_total > 0 else 0.0

        total_answers = max(1, sum(option_counts))
        distribution = [
            {
                "optionIndex": idx,
                "option": options[idx],
                "count": int(option_counts[idx]),
                "percent": round((option_counts[idx] / total_answers) * 100, 1),
            }
            for idx in range(len(options))
        ]

        gainers = sorted(
            [{"userId": uid, "userName": user_names.get(uid, "Student"), "points": pts} for uid, pts in per_question_gain.items()],
            key=lambda x: (-x["points"], x["userName"]),
        )[:5]

        board = sorted(
            [{"userId": uid, "userName": user_names.get(uid, "Student"), "totalScore": total} for uid, total in cumulative_scores.items()],
            key=lambda x: (-x["totalScore"], x["userName"]),
        )
        leaderboard_top = []
        for idx, row in enumerate(board[:10], start=1):
            leaderboard_top.append({"rank": idx, **row})

        timeline.append(
            {
                "questionIndex": qi,
                "question": q.get("question"),
                "correctIndex": correct_idx,
                "correctOption": options[correct_idx] if 0 <= correct_idx < len(options) else None,
                "distribution": distribution,
                "confusionIndex": confusion_index,
                "dominantWrongShare": round((dominant_wrong / total_answers), 3) if total_answers > 0 else 0.0,
                "topGainers": gainers,
                "leaderboardTop": leaderboard_top,
            }
        )

    return timeline


@_ws_router.websocket("/quizzes/live/{join_code}/ws")
async def live_quiz_ws(
    join_code: str,
    ws: WebSocket,
    token: str = Query(..., description="JWT access token"),
    spectator: bool = Query(False, description="Allow watch-only websocket access for non-participants"),
):
    """Realtime stream for live quiz state and leaderboard updates."""
    origin = ws.headers.get("origin")
    if not is_ws_origin_allowed(origin):
        await ws.close(code=1008)
        return

    try:
        user_data = await verify_firebase_id_token_raw(token)
    except Exception:
        await ws.close(code=4001)
        return

    user_id = user_data.get("sub")
    if not user_id:
        await ws.close(code=4001)
        return

    db = get_database()
    join_code_normalized = join_code.strip().upper()
    live_doc = await db.iepod_live_quiz_sessions.find_one(
        {"joinCode": join_code_normalized},
        sort=[("createdAt", -1)],
    )
    if not live_doc:
        await ws.close(code=4004)
        return

    user_doc = None
    if ObjectId.is_valid(str(user_id)):
        user_doc = await db["users"].find_one(
            {"_id": ObjectId(str(user_id))},
            {"role": 1, "firstName": 1, "lastName": 1, "email": 1},
        )
    if not user_doc and user_data.get("email"):
        user_doc = await db["users"].find_one(
            {"email": user_data.get("email")},
            {"role": 1, "firstName": 1, "lastName": 1, "email": 1},
        )

    role = (user_doc or {}).get("role", "student")
    if role != "admin":
        participant = await db.iepod_live_quiz_participants.find_one(
            {
                "liveSessionId": str(live_doc.get("_id")),
                "userId": str(user_id),
            }
        )
        if not participant and not spectator:
            await ws.close(code=4003)
            return

    await live_ws_manager.connect(join_code_normalized, ws)
    try:
        await ws.send_json(await _build_live_state_payload(db, live_doc))
        while True:
            try:
                data = await ws.receive_json()
            except ValueError:
                continue
            if data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        live_ws_manager.disconnect(join_code_normalized, ws)


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════

def _oid(val: str) -> ObjectId:
    try:
        return ObjectId(val)
    except Exception:
        raise HTTPException(400, "Invalid ID format")


async def _award_points(
    db, user_id: str, user_name: str, session_id: str,
    action: str, pts: int, description: str = "", ref_id: str | None = None,
):
    """Credit points to a student and update their registration total."""
    entry = {
        "userId": user_id,
        "userName": user_name,
        "sessionId": session_id,
        "action": action,
        "points": pts,
        "description": description,
        "referenceId": ref_id,
        "awardedAt": datetime.now(timezone.utc),
    }
    await db.iepod_points.insert_one(entry)
    await db.iepod_registrations.update_one(
        {"userId": user_id, "sessionId": session_id},
        {"$inc": {"points": pts}},
    )

    if int(pts) != 0:
        try:
            from app.routers.notifications import create_notification

            await create_notification(
                user_id=str(user_id),
                type="iepod",
                title="IEPOD Points Updated",
                message=f"{description or 'Points update'} ({'+' if int(pts) > 0 else ''}{int(pts)} pts)",
                link="/dashboard/iepod",
                category="iepod",
            )
        except Exception:
            pass


async def _record_quiz_points(
    db,
    user_id: str,
    user_name: str,
    session_id: str,
    points: int,
    source: str,
    description: str = "",
    ref_id: str | None = None,
):
    """Record quiz-system points in a dedicated ledger (never in general IEPOD points)."""
    entry = {
        "userId": user_id,
        "userName": user_name,
        "sessionId": session_id,
        "source": source,
        "points": int(points),
        "description": description,
        "referenceId": ref_id,
        "awardedAt": datetime.now(timezone.utc),
    }
    await db.iepod_quiz_points.insert_one(entry)

    if int(points) != 0:
        try:
            from app.routers.notifications import create_notification

            await create_notification(
                user_id=str(user_id),
                type="iepod",
                title="IEPOD Quiz Points Updated",
                message=f"{description or 'Quiz points update'} ({'+' if int(points) > 0 else ''}{int(points)} pts)",
                link="/dashboard/iepod/quizzes",
                category="iepod",
            )
        except Exception:
            pass


async def _get_registration(
    db,
    user_id: str | ObjectId,
    session_id: str,
    user_email: str | None = None,
) -> dict | None:
    user_id_str = str(user_id).strip()
    user_id_candidates: list = [user_id_str]
    if ObjectId.is_valid(user_id_str):
        user_id_candidates.append(ObjectId(user_id_str))

    or_filters: list[dict] = [
        {"userId": {"$in": user_id_candidates}},
        {"studentId": {"$in": user_id_candidates}},
    ]

    if user_email:
        normalized_email = str(user_email).strip().lower()
        if normalized_email:
            or_filters.append({"userEmail": normalized_email})
            or_filters.append({"userEmail": {"$regex": f"^{re.escape(normalized_email)}$", "$options": "i"}})

    query: dict = {
        "sessionId": session_id,
        "$or": or_filters,
    }

    return await db.iepod_registrations.find_one(query)


async def _require_pitch_team_phase(db, user: dict, session_id: str) -> dict | None:
    """Block student team ecosystem access until Phase 3 (Pitch)."""
    if str(user.get("role") or "").strip().lower() != "student":
        return None

    reg = await _get_registration(db, user.get("_id"), session_id)
    if not reg:
        raise HTTPException(400, "You must register for IEPOD first")
    if reg.get("status") != "approved":
        raise HTTPException(400, "Your IEPOD registration must be approved before accessing team features")
    if _phase_index(reg.get("phase")) < _phase_index("pitch"):
        raise HTTPException(403, "Hackathon teams unlock in Phase 3 (Pitch Your Process)")
    return reg


# ═══════════════════════════════════════════════════════════════════
# SOCIETIES — Public read, Admin write
# ═══════════════════════════════════════════════════════════════════

@router.get("/societies")
async def list_societies(
    active_only: bool = Query(True),
    user: dict = Depends(get_current_user),
):
    """List campus societies linked to IEPOD."""
    db = get_database()
    active_session = await db.sessions.find_one({"isActive": True}, {"_id": 1})
    active_session_id = str(active_session["_id"]) if active_session and active_session.get("_id") else None

    hub_lead_by_society: dict[str, dict] = {}
    if active_session_id:
        role_docs = await db.roles.find(
            {
                "sessionId": active_session_id,
                "position": "iepod_hub_lead",
                "isActive": True,
                "societyId": {"$exists": True, "$ne": None},
            },
            {
                "userId": 1,
                "societyId": 1,
                "societyName": 1,
                "createdAt": 1,
            },
        ).to_list(length=500)

        user_ids = [
            ObjectId(str(r.get("userId")))
            for r in role_docs
            if r.get("userId") and ObjectId.is_valid(str(r.get("userId")))
        ]
        users_map: dict[str, dict] = {}
        if user_ids:
            users = await db.users.find(
                {"_id": {"$in": user_ids}},
                {"firstName": 1, "lastName": 1, "email": 1, "institutionalEmail": 1},
            ).to_list(length=1000)
            users_map = {str(u["_id"]): u for u in users}

        for role_doc in role_docs:
            society_id = str(role_doc.get("societyId") or "").strip()
            user_id = str(role_doc.get("userId") or "").strip()
            if not society_id or not user_id:
                continue

            existing = hub_lead_by_society.get(society_id)
            existing_created = existing.get("_createdAt") if existing else None
            created_at = role_doc.get("createdAt")
            if existing and existing_created and created_at and existing_created > created_at:
                continue

            u = users_map.get(user_id)
            full_name = ""
            email = ""
            if u:
                full_name = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()
                email = u.get("institutionalEmail") or u.get("email") or ""

            hub_lead_by_society[society_id] = {
                "userId": user_id,
                "name": full_name,
                "email": email,
                "societyName": str(role_doc.get("societyName") or "").strip() or None,
                "_createdAt": created_at,
            }

    query = {"isActive": True} if active_only else {}
    cursor = db.iepod_societies.find(query).sort("name", 1)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Get member count
        count = await db.iepod_registrations.count_documents(
            {"societyId": str(doc["_id"]), "status": "approved"}
        )
        doc["memberCount"] = count
        lead = hub_lead_by_society.get(doc["_id"])
        if lead:
            doc["hubLead"] = {
                "userId": lead.get("userId"),
                "name": lead.get("name") or "Unassigned",
                "email": lead.get("email") or "",
            }
            doc["hubLeadName"] = lead.get("name") or None
            doc["hubLeadEmail"] = lead.get("email") or None
        else:
            doc["hubLead"] = None
            doc["hubLeadName"] = None
            doc["hubLeadEmail"] = None
        items.append(doc)
    return items


@router.post("/societies", status_code=201)
async def create_society(
    data: SocietyCreate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    """Admin: Create a new society."""
    db = get_database()
    if not validate_no_scripts(data.name) or not validate_no_scripts(data.description):
        raise HTTPException(400, "Invalid characters detected")
    doc = data.model_dump()
    # Manual flow is retired; all quizzes run auto-advance sequencing.
    doc["autoAdvance"] = True
    doc["memberCount"] = 0
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)
    result = await db.iepod_societies.insert_one(doc)
    created = await db.iepod_societies.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])

    await AuditLogger.log(
        action="iepod.society_created",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_society",
        resource_id=str(result.inserted_id),
        details={"name": data.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return created


@router.patch("/societies/{society_id}")
async def update_society(
    society_id: str,
    data: SocietyUpdate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.iepod_societies.update_one({"_id": _oid(society_id)}, {"$set": updates})
    updated = await db.iepod_societies.find_one({"_id": _oid(society_id)})
    if not updated:
        raise HTTPException(404, "Society not found")
    updated["_id"] = str(updated["_id"])

    await AuditLogger.log(
        action="iepod.society_updated",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_society",
        resource_id=society_id,
        details={"name": updated.get("name"), "fields": list(updates.keys())},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return updated


@router.delete("/societies/{society_id}", status_code=204)
async def delete_society(
    society_id: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    doc = await db.iepod_societies.find_one({"_id": _oid(society_id)})
    result = await db.iepod_societies.delete_one({"_id": _oid(society_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Society not found")

    # Nullify societyId on registrations referencing this society
    await db.iepod_registrations.update_many(
        {"societyId": society_id},
        {"$set": {"societyId": None}},
    )

    await AuditLogger.log(
        action="iepod.society_deleted",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_society",
        resource_id=society_id,
        details={"name": doc.get("name") if doc else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


# ═══════════════════════════════════════════════════════════════════
# STUDENT REGISTRATION / INTAKE
# ═══════════════════════════════════════════════════════════════════

@router.post("/register", status_code=201)
async def register_for_iepod(
    data: RegistrationCreate,
    response: Response,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student registers for the IEPOD program in the current session."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = str(user["_id"])
    user_email = str(user.get("email") or "").strip().lower()

    block = await db.iepod_registration_blocks.find_one(
        {
            "sessionId": session_id,
            "$or": [
                {"userId": {"$in": _user_id_variants(user_id)}},
                {"userEmail": user_email},
            ],
        },
        {"reason": 1},
    )
    if block:
        reason = str(block.get("reason") or "Your previous registration was reset by an administrator.")
        raise HTTPException(403, f"IEPOD registration is blocked for this account. {reason}")

    # Check for duplicate
    existing = await _get_registration(db, user_id, session_id, user_email=user_email)
    if existing:
        existing["_id"] = str(existing["_id"])
        response.status_code = status.HTTP_200_OK
        existing["alreadyRegistered"] = True
        existing["reason"] = "already_registered"
        return existing

    doc = data.model_dump()
    doc["whyJoin"] = sanitize_html(doc.get("whyJoin", ""))
    if len((doc.get("whyJoin") or "").strip()) < 10:
        raise HTTPException(400, "Please provide a clearer motivation statement (at least 10 characters)")
    if doc.get("priorExperience"):
        doc["priorExperience"] = sanitize_html(doc.get("priorExperience", ""))
    doc["userId"] = user_id
    doc["userName"] = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    doc["userEmail"] = user_email
    doc["phone"] = user.get("phone")
    doc["studentId"] = user_id
    doc["sessionId"] = session_id
    doc["level"] = user.get("currentLevel") or user.get("level") or "N/A"
    doc["department"] = user.get("department", "Industrial Engineering")
    doc["isExternalStudent"] = doc["department"] != "Industrial Engineering"
    doc["externalFaculty"] = None
    doc["status"] = "pending"
    doc["phase"] = "stimulate"
    doc["points"] = 0
    doc["completedPhases"] = []
    doc["societyId"] = None
    doc["nicheAuditId"] = None
    doc["teamId"] = None
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    try:
        result = await db.iepod_registrations.insert_one(doc)
    except DuplicateKeyError:
        existing = await _get_registration(db, user_id, session_id, user_email=user_email)
        if existing:
            existing["_id"] = str(existing["_id"])
            response.status_code = status.HTTP_200_OK
            existing["alreadyRegistered"] = True
            existing["reason"] = "already_registered"
            return existing
        raise HTTPException(400, "Unable to complete registration at the moment. Please try again.")
    created = await db.iepod_registrations.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])

    # Points are awarded when admin approves the registration (not here)

    return created


@router.post("/register/resubmit")
async def resubmit_iepod_registration(
    data: RegistrationCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student resubmits a previously rejected IEPOD registration in the current session."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = str(user["_id"])
    user_email = str(user.get("email") or "").strip().lower()

    existing = await _get_registration(db, user_id, session_id, user_email=user_email)
    if not existing:
        raise HTTPException(404, "No IEPOD registration found for this session")
    if existing.get("status") != "rejected":
        raise HTTPException(400, "Only rejected registrations can be resubmitted")

    updates = data.model_dump()
    updates["whyJoin"] = sanitize_html(updates.get("whyJoin", ""))
    if len((updates.get("whyJoin") or "").strip()) < 10:
        raise HTTPException(400, "Please provide a clearer motivation statement (at least 10 characters)")
    if updates.get("priorExperience"):
        updates["priorExperience"] = sanitize_html(updates.get("priorExperience", ""))

    updates["status"] = "pending"
    updates["adminNote"] = None
    updates["updatedAt"] = datetime.now(timezone.utc)
    updates["resubmittedAt"] = datetime.now(timezone.utc)

    await db.iepod_registrations.update_one(
        {"_id": existing["_id"]},
        {
            "$set": updates,
            "$inc": {"resubmissionCount": 1},
        },
    )

    refreshed = await db.iepod_registrations.find_one({"_id": existing["_id"]})
    refreshed["_id"] = str(refreshed["_id"])
    refreshed["alreadyRegistered"] = False
    refreshed["reason"] = "resubmitted"
    return refreshed


@router.get("/my")
async def get_my_iepod_profile(
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get the logged-in student's full IEPOD profile for the current session."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]
    user_id_candidates = _user_id_variants(user_id)
    user_email = str(user.get("email") or "").strip().lower()

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        return {"registered": False}

    reg["_id"] = str(reg["_id"])

    # Grab linked data
    society = None
    if reg.get("societyId"):
        s = await db.iepod_societies.find_one({"_id": _oid(reg["societyId"])})
        if s:
            s["_id"] = str(s["_id"])
            society = s

    niche = None
    if reg.get("nicheAuditId"):
        n = await db.iepod_niche_audits.find_one({"_id": _oid(reg["nicheAuditId"])})
        if n:
            n["_id"] = str(n["_id"])
            niche = n

    team = None
    if reg.get("teamId"):
        t = await db.iepod_teams.find_one({"_id": _oid(reg["teamId"])})
        if t:
            t["_id"] = str(t["_id"])
            team = t

    # Recent points
    points_query = {"sessionId": session_id, "userId": {"$in": user_id_candidates}}
    points_cursor = db.iepod_points.find(points_query).sort("awardedAt", -1).limit(20)
    points_history = []
    async for p in points_cursor:
        p["_id"] = str(p["_id"])
        points_history.append(p)

    quiz_points_cursor = db.iepod_quiz_points.find(points_query).sort("awardedAt", -1).limit(30)
    quiz_points_history = []
    async for qp in quiz_points_cursor:
        qp["_id"] = str(qp["_id"])
        quiz_points_history.append(qp)

    # Quiz results
    quiz_query: dict = {"sessionId": session_id, "userId": {"$in": user_id_candidates}}
    if user_email:
        quiz_query = {
            "sessionId": session_id,
            "$or": [
                {"userId": {"$in": user_id_candidates}},
                {"userEmail": user_email},
            ],
        }
    quiz_cursor = db.iepod_quiz_responses.find(quiz_query).sort("submittedAt", -1).limit(10)
    quiz_results = []
    async for q in quiz_cursor:
        q["_id"] = str(q["_id"])
        quiz_results.append(q)

    return {
        "registered": True,
        "registration": reg,
        "society": society,
        "nicheAudit": niche,
        "team": team,
        "pointsHistory": points_history,
        "quizPointsHistory": quiz_points_history,
        "quizResults": quiz_results,
    }


# ═══════════════════════════════════════════════════════════════════
# ADMIN: REGISTRATION MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

@router.get("/registrations")
async def list_registrations(
    status_filter: Optional[str] = Query(None, alias="status"),
    phase: Optional[str] = None,
    department: Optional[str] = Query(None, description="Filter by department: 'ipe' for Industrial Engineering, 'external' for non-IPE"),
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: List all IEPOD registrations."""
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if status_filter:
        query["status"] = status_filter
    if phase:
        query["phase"] = phase
    if department == "ipe":
        query["isExternalStudent"] = {"$ne": True}
    elif department == "external":
        query["isExternalStudent"] = True
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"userName": {"$regex": escaped, "$options": "i"}},
            {"userEmail": {"$regex": escaped, "$options": "i"}},
        ]
    cursor = db.iepod_registrations.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)

    # Backfill missing phone values from users collection so exports stay populated
    # for registrations created before phone was persisted on registration docs.
    missing_phone_user_ids: list[ObjectId] = []
    for item in items:
        if item.get("phone"):
            continue
        user_id = str(item.get("userId") or "").strip()
        if ObjectId.is_valid(user_id):
            missing_phone_user_ids.append(ObjectId(user_id))

    missing_phone_emails: list[str] = []
    for item in items:
        if item.get("phone"):
            continue
        user_email = str(item.get("userEmail") or "").strip().lower()
        if user_email:
            missing_phone_emails.append(user_email)

    if missing_phone_user_ids or missing_phone_emails:
        user_lookup_or: list[dict] = []
        if missing_phone_user_ids:
            user_lookup_or.append({"_id": {"$in": missing_phone_user_ids}})
        if missing_phone_emails:
            user_lookup_or.append({"email": {"$in": missing_phone_emails}})

        user_rows = await db.users.find(
            {"$or": user_lookup_or},
            {"phone": 1, "email": 1},
        ).to_list(length=max(len(missing_phone_user_ids), len(missing_phone_emails), 1) * 2)
        phone_by_user_id = {str(row.get("_id")): row.get("phone") for row in user_rows}
        phone_by_email = {str(row.get("email") or "").strip().lower(): row.get("phone") for row in user_rows}
        for item in items:
            if item.get("phone"):
                continue
            by_id = phone_by_user_id.get(str(item.get("userId") or ""))
            by_email = phone_by_email.get(str(item.get("userEmail") or "").strip().lower())
            item["phone"] = by_id or by_email

    total = await db.iepod_registrations.count_documents(query)
    return {"registrations": items, "total": total}


@router.patch("/registrations/{reg_id}")
async def update_registration(
    reg_id: str,
    data: RegistrationUpdate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: approve/reject registration, update phase, add note."""
    db = get_database()
    session_id = str(session["_id"])

    # Fetch current registration first (needed for validation)
    current = await db.iepod_registrations.find_one({"_id": _oid(reg_id)})
    if not current:
        raise HTTPException(404, "Registration not found")

    # Session gating — prevent modifying registrations from other sessions
    if current.get("sessionId") != session_id:
        raise HTTPException(403, "Cannot modify registrations from a different session")

    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")

    # Status transition validation
    new_status = updates.get("status")
    current_status = current.get("status", "pending")
    if new_status:
        valid_transitions = {
            "pending": {"approved", "rejected"},
            "approved": {"rejected", "completed"},
            "rejected": {"approved"},
            "completed": set(),
        }
        allowed = valid_transitions.get(current_status, set())
        if new_status not in allowed:
            raise HTTPException(
                400,
                f"Cannot change status from '{current_status}' to '{new_status}'. "
                f"Allowed: {', '.join(sorted(allowed)) if allowed else 'none'}"
            )

    # Phase progression tracking — push old phase into completedPhases
    new_phase = updates.get("phase")
    mongo_ops: dict = {"$set": {}}
    if new_phase and new_phase != current.get("phase"):
        # Validate forward movement only (unless admin deliberately overrides)
        phase_order = ["stimulate", "carve", "pitch"]
        old_idx = phase_order.index(current["phase"]) if current.get("phase") in phase_order else -1
        new_idx = phase_order.index(new_phase) if new_phase in phase_order else -1
        if new_idx <= old_idx:
            raise HTTPException(400, f"Phase can only advance forward. Current: {current.get('phase')}")

        # Mark old phase as completed
        completed_phases = list(current.get("completedPhases", []))
        old_phase = current.get("phase")
        if old_phase and old_phase not in completed_phases:
            completed_phases.append(old_phase)
        mongo_ops["$set"]["completedPhases"] = completed_phases

    updates["updatedAt"] = datetime.now(timezone.utc)
    mongo_ops["$set"].update(updates)

    await db.iepod_registrations.update_one({"_id": _oid(reg_id)}, mongo_ops)
    updated = await db.iepod_registrations.find_one({"_id": _oid(reg_id)})
    updated["_id"] = str(updated["_id"])

    # If student selected a preferred society during application, auto-commit it
    # on approval so they are not asked to commit again in the dashboard.
    auto_committed_society_name: str | None = None
    auto_committed_society_id: str | None = None
    if new_status == "approved" and current_status != "approved" and not updated.get("societyId"):
        preferred_society_id = str(updated.get("preferredSocietyId") or "").strip()
        if ObjectId.is_valid(preferred_society_id):
            preferred_society = await db.iepod_societies.find_one(
                {"_id": ObjectId(preferred_society_id), "isActive": True},
                {"name": 1},
            )
            if preferred_society:
                await db.iepod_registrations.update_one(
                    {"_id": _oid(reg_id)},
                    {"$set": {"societyId": preferred_society_id, "updatedAt": datetime.now(timezone.utc)}},
                )
                updated["societyId"] = preferred_society_id
                auto_committed_society_id = preferred_society_id
                auto_committed_society_name = str(preferred_society.get("name") or "").strip() or "Selected Society"

    await AuditLogger.log(
        action=f"iepod.registration_{updates.get('status', 'updated')}",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_registration",
        resource_id=reg_id,
        details={"student": updated.get("userName"), "status": updates.get("status"), "phase": updates.get("phase")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    # Award points on approval + send notification
    student_uid = updated.get("userId")
    if new_status and student_uid:
        # Award registration points when approved (not at registration time)
        if new_status == "approved" and current_status != "approved":
            user_name = updated.get("userName", "")
            await _award_points(
                db, student_uid, user_name, session_id,
                "registration", 10, "IEPOD registration approved",
                reg_id,
            )

            if auto_committed_society_id and auto_committed_society_name:
                await _award_points(
                    db,
                    student_uid,
                    user_name,
                    session_id,
                    "society_checkin",
                    15,
                    f"Committed to {auto_committed_society_name}",
                    auto_committed_society_id,
                )

        try:
            from app.routers.notifications import create_notification
            status_labels = {"approved": "approved", "rejected": "rejected", "completed": "completed"}
            status_label = status_labels.get(new_status, "updated")
            await create_notification(
                user_id=student_uid,
                type="iepod",
                title=f"IEPOD Registration {status_label.title()}",
                message=f"Your IEPOD registration has been {status_label}.",
                link="/dashboard/iepod",
                category="iepod",
            )
        except Exception:
            pass  # Non-critical

    return updated


@router.get("/registrations/{reg_id}")
async def get_registration(
    reg_id: str,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    doc = await db.iepod_registrations.find_one({"_id": _oid(reg_id)})
    if not doc:
        raise HTTPException(404, "Registration not found")
    doc["_id"] = str(doc["_id"])
    return doc


# ═══════════════════════════════════════════════════════════════════
# SOCIETY COMMITMENT (Student picks a society in Phase 2)
# ═══════════════════════════════════════════════════════════════════

@router.post("/commit-society/{society_id}")
async def commit_to_society(
    society_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student commits to a campus society (Phase 2)."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        raise HTTPException(400, "You must register for IEPOD first")
    if reg["status"] != "approved":
        raise HTTPException(400, "Your registration hasn't been approved yet")

    society = await db.iepod_societies.find_one({"_id": _oid(society_id)})
    if not society:
        raise HTTPException(404, "Society not found")

    await db.iepod_registrations.update_one(
        {"_id": reg["_id"]},
        {"$set": {"societyId": society_id, "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points for society commitment
    if not reg.get("societyId"):  # Only award once
        user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
        await _award_points(
            db, user_id, user_name, session_id,
            "society_checkin", 15, f"Committed to {society['name']}",
            society_id,
        )

    return {"message": f"Successfully committed to {society['name']}"}


# ═══════════════════════════════════════════════════════════════════
# NICHE AUDIT (Phase 2 reflective worksheet)
# ═══════════════════════════════════════════════════════════════════

@router.post("/niche-audit", status_code=201)
async def create_niche_audit(
    data: NicheAuditCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student submits their Niche Audit worksheet."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        raise HTTPException(400, "You must register for IEPOD first")
    if reg["status"] != "approved":
        raise HTTPException(400, "Your IEPOD registration must be approved before submitting a Niche Audit")
    if _phase_index(reg.get("phase")) < _phase_index("carve"):
        raise HTTPException(403, "Niche Audit opens in Phase 2 (Carve Your Niche)")

    # Check if already exists
    existing = await db.iepod_niche_audits.find_one(
        {"userId": user_id, "sessionId": session_id}
    )
    if existing:
        raise HTTPException(400, "You have already submitted a Niche Audit. Use PATCH to update.")

    if not validate_no_scripts(data.focusProblem):
        raise HTTPException(400, "Invalid characters detected")

    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    doc = data.model_dump()
    doc["userId"] = user_id
    doc["userName"] = user_name
    doc["sessionId"] = session_id
    doc["submittedAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    result = await db.iepod_niche_audits.insert_one(doc)
    audit_id = str(result.inserted_id)

    # Link to registration
    await db.iepod_registrations.update_one(
        {"_id": reg["_id"]},
        {"$set": {"nicheAuditId": audit_id, "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points
    await _award_points(
        db, user_id, user_name, session_id,
        "niche_audit", 20, "Submitted Niche Audit",
        audit_id,
    )

    created = await db.iepod_niche_audits.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created


@router.get("/niche-audit")
async def get_my_niche_audit(
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get the logged-in student's niche audit."""
    db = get_database()
    reg = await _get_registration(db, user.get("_id"), str(session["_id"]))
    if not reg or reg.get("status") != "approved":
        raise HTTPException(403, "You need an approved IEPOD registration to access Niche Audit")
    if _phase_index(reg.get("phase")) < _phase_index("carve"):
        raise HTTPException(403, "Niche Audit opens in Phase 2 (Carve Your Niche)")

    doc = await db.iepod_niche_audits.find_one(
        {"userId": user["_id"], "sessionId": str(session["_id"])}
    )
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


@router.patch("/niche-audit")
async def update_my_niche_audit(
    data: NicheAuditUpdate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Update the logged-in student's niche audit."""
    db = get_database()
    reg = await _get_registration(db, user.get("_id"), str(session["_id"]))
    if not reg or reg.get("status") != "approved":
        raise HTTPException(403, "You need an approved IEPOD registration to access Niche Audit")
    if _phase_index(reg.get("phase")) < _phase_index("carve"):
        raise HTTPException(403, "Niche Audit opens in Phase 2 (Carve Your Niche)")

    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updatedAt"] = datetime.now(timezone.utc)
    result = await db.iepod_niche_audits.update_one(
        {"userId": user["_id"], "sessionId": str(session["_id"])},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Niche Audit not found")
    doc = await db.iepod_niche_audits.find_one(
        {"userId": user["_id"], "sessionId": str(session["_id"])}
    )
    doc["_id"] = str(doc["_id"])
    return doc


# Admin: List all niche audits
@router.get("/niche-audits")
async def list_niche_audits(
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"userName": {"$regex": escaped, "$options": "i"}},
            {"focusProblem": {"$regex": escaped, "$options": "i"}},
        ]
    cursor = db.iepod_niche_audits.find(query).sort("submittedAt", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    total = await db.iepod_niche_audits.count_documents(query)
    return {"audits": items, "total": total}


# ═══════════════════════════════════════════════════════════════════
# HACKATHON TEAMS (Phase 3)
# ═══════════════════════════════════════════════════════════════════

@router.post("/teams", status_code=201)
async def create_team(
    data: TeamCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Create a new hackathon team (must be IEPOD-registered)."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    await _require_pitch_team_phase(db, user, session_id)

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        raise HTTPException(400, "You must register for IEPOD first")
    if reg["status"] != "approved":
        raise HTTPException(400, "Your IEPOD registration must be approved before creating a team")
    if reg.get("teamId"):
        raise HTTPException(400, "You are already on a team")

    if not validate_no_scripts(data.name) or not validate_no_scripts(data.problemStatement):
        raise HTTPException(400, "Invalid characters detected")

    doc = data.model_dump()
    doc["leaderId"] = user_id
    doc["leaderName"] = user_name
    doc["sessionId"] = session_id
    doc["members"] = [{
        "userId": user_id,
        "userName": user_name,
        "role": "lead",
        "joinedAt": datetime.now(timezone.utc),
    }]
    doc["status"] = "forming"
    doc["submissionCount"] = 0
    doc["mentorId"] = None
    doc["mentorName"] = None
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    result = await db.iepod_teams.insert_one(doc)
    team_id = str(result.inserted_id)

    # Link to registration
    await db.iepod_registrations.update_one(
        {"_id": reg["_id"]},
        {"$set": {"teamId": team_id, "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points
    await _award_points(
        db, user_id, user_name, session_id,
        "team_formed", 15, f"Created team '{data.name}'",
        team_id,
    )

    created = await db.iepod_teams.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created


@router.get("/teams")
async def list_teams(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """List hackathon teams."""
    db = get_database()
    await _require_pitch_team_phase(db, user, str(session["_id"]))
    query: dict = {"sessionId": str(session["_id"])}
    if status_filter:
        query["status"] = status_filter
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"problemStatement": {"$regex": escaped, "$options": "i"}},
        ]
    cursor = db.iepod_teams.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)

    user_ids: list[ObjectId] = []
    for team_doc in items:
        for member in team_doc.get("members", []):
            member_uid = str(member.get("userId") or "")
            if ObjectId.is_valid(member_uid):
                user_ids.append(ObjectId(member_uid))

    users_map: dict[str, dict] = {}
    if user_ids:
        users = await db.users.find(
            {"_id": {"$in": list(set(user_ids))}},
            {
                "firstName": 1,
                "lastName": 1,
                "email": 1,
                "institutionalEmail": 1,
                "matricNumber": 1,
                "currentLevel": 1,
                "department": 1,
                "phone": 1,
            },
        ).to_list(length=5000)
        users_map = {str(u["_id"]): u for u in users}

    for team_doc in items:
        enriched_members = []
        for member in team_doc.get("members", []):
            member_uid = str(member.get("userId") or "")
            user_doc = users_map.get(member_uid)
            enriched_members.append({
                **member,
                "email": (user_doc.get("institutionalEmail") or user_doc.get("email")) if user_doc else None,
                "matricNumber": user_doc.get("matricNumber") if user_doc else None,
                "level": user_doc.get("currentLevel") if user_doc else None,
                "department": user_doc.get("department") if user_doc else None,
                "phone": user_doc.get("phone") if user_doc else None,
            })
        team_doc["members"] = enriched_members

    total = await db.iepod_teams.count_documents(query)
    return {"teams": items, "total": total}


@router.get("/teams/{team_id}")
async def get_team(
    team_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    db = get_database()
    await _require_pitch_team_phase(db, user, str(session["_id"]))
    doc = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not doc:
        raise HTTPException(404, "Team not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.post("/teams/{team_id}/join")
async def join_team(
    team_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Join an existing hackathon team."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    await _require_pitch_team_phase(db, user, session_id)

    async def _log_join_failure(reason: str, message: str, team_name: str | None = None):
        await AuditLogger.log(
            action="iepod.team_join_failed",
            actor_id=str(user_id),
            actor_email=user.get("email", "unknown"),
            resource_type="iepod_team",
            resource_id=team_id,
            details={"reason": reason, "message": message, "teamName": team_name},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        await _log_join_failure("not_registered", "You must register for IEPOD first")
        raise HTTPException(400, "You must register for IEPOD first")
    if reg["status"] != "approved":
        await _log_join_failure("registration_not_approved", "Registration must be approved before joining a team")
        raise HTTPException(400, "Your IEPOD registration must be approved before joining a team")
    if reg.get("teamId"):
        await _log_join_failure("already_in_team", "User is already on a team")
        raise HTTPException(400, "You are already on a team")

    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        await _log_join_failure("team_not_found", "Team not found")
        raise HTTPException(404, "Team not found")
    if team["status"] != "forming":
        await _log_join_failure("team_closed", "Team is no longer accepting members", team_name=team.get("name"))
        raise HTTPException(400, "This team is no longer accepting members")
    if any(m.get("userId") == user_id for m in team.get("members", [])):
        await _log_join_failure("already_member", "User is already a member of this team", team_name=team.get("name"))
        raise HTTPException(400, "You are already a member of this team")
    if len(team["members"]) >= team["maxMembers"]:
        await _log_join_failure("team_full", "This team is full", team_name=team.get("name"))
        raise HTTPException(400, "This team is full")

    member = {
        "userId": user_id,
        "userName": user_name,
        "role": "member",
        "joinedAt": datetime.now(timezone.utc),
    }

    update_result = await db.iepod_teams.update_one(
        {
            "_id": _oid(team_id),
            "status": "forming",
            "members.userId": {"$ne": user_id},
            "$expr": {"$lt": [{"$size": "$members"}, "$maxMembers"]},
        },
        {"$push": {"members": member}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
    )
    if update_result.modified_count == 0:
        await _log_join_failure(
            "atomic_join_failed",
            "Could not join team due to concurrent update or eligibility mismatch",
            team_name=team.get("name"),
        )
        raise HTTPException(400, "Could not join team. It may already be full or closed")
    await db.iepod_registrations.update_one(
        {"_id": reg["_id"]},
        {"$set": {"teamId": team_id, "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points for joining a team
    await _award_points(
        db, user_id, user_name, session_id,
        "team_formed", 10, f"Joined team '{team['name']}'",
        team_id,
    )

    return {"message": f"Joined team '{team['name']}'"}


@router.post("/teams/{team_id}/leave")
async def leave_team(
    team_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Leave a hackathon team. Leader cannot leave (must disband)."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    await _require_pitch_team_phase(db, user, session_id)

    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")
    if team["leaderId"] == user_id:
        raise HTTPException(400, "Team leader cannot leave. Disband the team instead or transfer leadership.")

    await db.iepod_teams.update_one(
        {"_id": _oid(team_id)},
        {
            "$pull": {"members": {"userId": user_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )
    await db.iepod_registrations.update_one(
        {"userId": user_id, "sessionId": session_id},
        {"$set": {"teamId": None, "updatedAt": datetime.now(timezone.utc)}},
    )
    return {"message": "Left the team"}


@router.patch("/teams/{team_id}")
async def update_team(
    team_id: str,
    data: TeamUpdate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Update team details (leader or admin only)."""
    db = get_database()
    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")

    # Check if leader or admin (use permission check, not stale JWT role)
    is_admin = False
    try:
        from ..core.permissions import get_user_permissions
        active_session = await db.sessions.find_one({"isActive": True})
        if active_session:
            perms = await get_user_permissions(str(user["_id"]), str(active_session["_id"]))
            is_admin = "iepod:manage" in perms
    except Exception:
        pass
    if team["leaderId"] != user["_id"] and not is_admin:
        raise HTTPException(403, "Only the team leader or admins can edit the team")

    if not is_admin:
        await _require_pitch_team_phase(db, user, str(session["_id"]))

    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.iepod_teams.update_one({"_id": _oid(team_id)}, {"$set": updates})
    updated = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    updated["_id"] = str(updated["_id"])
    return updated


# Admin: assign mentor to team
@router.post("/teams/{team_id}/assign-mentor")
async def assign_mentor_to_team(
    team_id: str,
    request: Request,
    mentor_user_id: str = Query(..., description="User ID of the mentor"),
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")

    # Look up mentor name
    mentor = await db.users.find_one({"_id": _oid(mentor_user_id)})
    mentor_name = "Unknown"
    if mentor:
        mentor_name = f"{mentor.get('firstName', '')} {mentor.get('lastName', '')}".strip()

    await db.iepod_teams.update_one(
        {"_id": _oid(team_id)},
        {"$set": {"mentorId": mentor_user_id, "mentorName": mentor_name, "updatedAt": datetime.now(timezone.utc)}},
    )

    await AuditLogger.log(
        action="iepod.mentor_assigned",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_team",
        resource_id=team_id,
        details={"mentor": mentor_name, "team": team.get("name")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": f"Assigned {mentor_name} as mentor"}


# ═══════════════════════════════════════════════════════════════════
# SUBMISSIONS (Iterative — "Pitch Your Process")
# ═══════════════════════════════════════════════════════════════════

@router.post("/teams/{team_id}/submissions", status_code=201)
async def create_submission(
    team_id: str,
    data: SubmissionCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Submit an iteration for your hackathon team."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    await _require_pitch_team_phase(db, user, session_id)

    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")

    # Must be a team member
    is_member = any(m["userId"] == user_id for m in team.get("members", []))
    if not is_member:
        raise HTTPException(403, "You are not a member of this team")

    if not validate_no_scripts(data.title) or not validate_no_scripts(data.description):
        raise HTTPException(400, "Invalid characters detected")

    doc = data.model_dump()
    doc["teamId"] = team_id
    doc["teamName"] = team["name"]
    doc["sessionId"] = session_id
    doc["status"] = "draft"
    doc["feedback"] = None
    doc["score"] = None
    doc["reviewedBy"] = None
    doc["submittedAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    result = await db.iepod_submissions.insert_one(doc)

    # Increment team submission count
    await db.iepod_teams.update_one(
        {"_id": _oid(team_id)},
        {"$inc": {"submissionCount": 1}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
    )

    created = await db.iepod_submissions.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created


@router.get("/teams/{team_id}/submissions")
async def list_team_submissions(
    team_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """List all submissions for a team."""
    db = get_database()
    await _require_pitch_team_phase(db, user, str(session["_id"]))

    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")

    is_member = any(m.get("userId") == user.get("_id") for m in team.get("members", []))
    is_admin = False
    if not is_member:
        try:
            from ..core.permissions import get_user_permissions
            perms = await get_user_permissions(str(user["_id"]), str(session["_id"]))
            is_admin = "iepod:manage" in perms
        except Exception:
            is_admin = False
    if not is_member and not is_admin:
        raise HTTPException(403, "You are not allowed to view this team's submissions")

    cursor = db.iepod_submissions.find(
        {"teamId": team_id}
    ).sort("iterationNumber", 1)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    return items


@router.patch("/submissions/{sub_id}/submit")
async def submit_iteration(
    sub_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Mark a draft submission as submitted."""
    db = get_database()
    await _require_pitch_team_phase(db, user, str(session["_id"]))
    doc = await db.iepod_submissions.find_one({"_id": _oid(sub_id)})
    if not doc:
        raise HTTPException(404, "Submission not found")
    if doc["status"] != "draft":
        raise HTTPException(400, "Only draft submissions can be submitted")

    # Must be a team member
    team = await db.iepod_teams.find_one({"_id": _oid(doc["teamId"])})
    if not team or not any(m["userId"] == user["_id"] for m in team.get("members", [])):
        raise HTTPException(403, "You are not a member of this team")

    await db.iepod_submissions.update_one(
        {"_id": _oid(sub_id)},
        {"$set": {"status": "submitted", "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points to all team members
    session_id = str(session["_id"])
    for member in team.get("members", []):
        await _award_points(
            db, member["userId"], member["userName"], session_id,
            "submission", 20,
            f"Iteration #{doc['iterationNumber']} submitted",
            sub_id,
        )

    return {"message": "Submission marked as submitted"}


# Admin: review a submission
@router.patch("/submissions/{sub_id}/review")
async def review_submission(
    sub_id: str,
    data: SubmissionReview,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    doc = await db.iepod_submissions.find_one({"_id": _oid(sub_id)})
    if not doc:
        raise HTTPException(404, "Submission not found")

    updates = data.model_dump(exclude_unset=True)
    updates["reviewedBy"] = user["_id"]
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.iepod_submissions.update_one({"_id": _oid(sub_id)}, {"$set": updates})
    updated = await db.iepod_submissions.find_one({"_id": _oid(sub_id)})
    updated["_id"] = str(updated["_id"])

    await AuditLogger.log(
        action="iepod.submission_reviewed",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_submission",
        resource_id=sub_id,
        details={"status": updates.get("status"), "score": updates.get("score"), "teamId": doc.get("teamId")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return updated


# Admin: list all submissions
@router.get("/submissions")
async def list_all_submissions(
    team_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if team_id:
        query["teamId"] = team_id
    if status_filter:
        query["status"] = status_filter
    cursor = db.iepod_submissions.find(query).sort("submittedAt", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    total = await db.iepod_submissions.count_documents(query)
    return {"submissions": items, "total": total}


# ═══════════════════════════════════════════════════════════════════
# QUIZZES & CHALLENGES
# ═══════════════════════════════════════════════════════════════════

@router.post("/quizzes", status_code=201)
async def create_quiz(
    data: QuizCreate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: Create a new quiz / challenge."""
    db = get_database()
    if not validate_no_scripts(data.title):
        raise HTTPException(400, "Invalid characters detected")

    for idx, q in enumerate(data.questions):
        options = [str(opt).strip() for opt in q.options]
        if any(not opt for opt in options):
            raise HTTPException(400, f"Question {idx + 1} has empty options")
        if len(set(options)) < 2:
            raise HTTPException(400, f"Question {idx + 1} options must not all be the same")
        if q.correctIndex >= len(options):
            raise HTTPException(400, f"Question {idx + 1} correct answer index is out of range")

    doc = data.model_dump()
    doc["sessionId"] = str(session["_id"])
    doc["createdBy"] = user["_id"]
    doc["participantCount"] = 0
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    result = await db.iepod_quizzes.insert_one(doc)
    created = await db.iepod_quizzes.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])

    await AuditLogger.log(
        action="iepod.quiz_created",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_quiz",
        resource_id=str(result.inserted_id),
        details={"title": data.title, "type": data.quizType},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return created


@router.get("/quizzes")
async def list_quizzes(
    live_only: bool = Query(False),
    quiz_type: Optional[str] = None,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """List quizzes. Students see public info only; admins see full details."""
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if live_only:
        query["isLive"] = True
    if quiz_type:
        query["quizType"] = quiz_type

    # Check admin via permissions (not stale JWT role)
    is_admin = False
    try:
        from ..core.permissions import get_user_permissions
        perms = await get_user_permissions(str(user["_id"]), str(session["_id"]))
        is_admin = "iepod:manage" in perms
    except Exception:
        pass
    cursor = db.iepod_quizzes.find(query).sort("createdAt", -1)
    items = []
    admin_quiz_ids: list[str] = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if not is_admin:
            # Strip correct answers for students
            items.append({
                "id": doc["_id"],
                "title": doc["title"],
                "description": doc.get("description"),
                "quizType": doc["quizType"],
                "timeLimitMinutes": doc.get("timeLimitMinutes"),
                "phase": doc.get("phase"),
                "questionCount": len(doc.get("questions", [])),
                "isLive": doc.get("isLive", False),
                "createdAt": doc["createdAt"],
            })
        else:
            admin_quiz_ids.append(doc["_id"])
            items.append(doc)

    if is_admin and admin_quiz_ids:
        live_cursor = db.iepod_live_quiz_sessions.find(
            {
                "sessionId": str(session["_id"]),
                "quizId": {"$in": admin_quiz_ids},
                "status": {"$ne": "ended"},
            },
            {
                "quizId": 1,
                "joinCode": 1,
                "status": 1,
                "_id": 1,
                "createdAt": 1,
            },
        ).sort("createdAt", -1)
        live_rows = await live_cursor.to_list(length=500)
        live_by_quiz: dict[str, dict] = {}
        for row in live_rows:
            quiz_id = str(row.get("quizId") or "")
            if quiz_id and quiz_id not in live_by_quiz:
                live_by_quiz[quiz_id] = row

        for item in items:
            qid = str(item.get("_id") or "")
            active_live = live_by_quiz.get(qid)
            if active_live:
                item["activeLiveSessionId"] = str(active_live.get("_id"))
                item["activeLiveJoinCode"] = active_live.get("joinCode")
                item["activeLiveStatus"] = active_live.get("status")
    return items


@router.get("/quizzes/{quiz_id}")
async def get_quiz(
    quiz_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get quiz details. Students get questions without answers."""
    db = get_database()
    doc = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
    if not doc:
        raise HTTPException(404, "Quiz not found")

    # Check admin via permissions (not stale JWT role)
    is_admin = False
    try:
        from ..core.permissions import get_user_permissions
        active_session = await db.sessions.find_one({"isActive": True})
        if active_session:
            perms = await get_user_permissions(str(user["_id"]), str(active_session["_id"]))
            is_admin = "iepod:manage" in perms
    except Exception:
        pass

    if is_admin:
        doc["_id"] = str(doc["_id"])
        return doc

    session_id = str(session["_id"])
    if doc.get("sessionId") != session_id:
        raise HTTPException(404, "Quiz not found")
    if not doc.get("isLive", False):
        raise HTTPException(403, "This quiz is not published yet")

    if doc.get("quizType") == "live":
        raise HTTPException(400, "Live quiz questions can only be played in the live arena")

    # Check if student already took this quiz
    existing = await db.iepod_quiz_responses.find_one(
        {"quizId": quiz_id, "userId": {"$in": _user_id_variants(user.get("_id"))}}
    )
    if existing:
        existing["_id"] = str(existing["_id"])
        return {"alreadyTaken": True, "result": existing}

    # Return questions without correct answers
    questions = []
    for i, q in enumerate(doc.get("questions", [])):
        questions.append({
            "index": i,
            "question": q["question"],
            "options": q["options"],
            "points": q["points"],
            "timeLimitSeconds": int(q.get("timeLimitSeconds", 20)),
        })

    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "description": doc.get("description"),
        "quizType": doc["quizType"],
        "timeLimitMinutes": doc.get("timeLimitMinutes"),
        "questions": questions,
        "alreadyTaken": False,
    }


@router.post("/quizzes/{quiz_id}/answer", status_code=201)
async def submit_quiz_answers(
    quiz_id: str,
    data: QuizResponseCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student submits their quiz answers; auto-graded immediately."""
    db = get_database()
    user_id = str(user.get("_id"))

    quiz = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
    if not quiz:
        raise HTTPException(404, "Quiz not found")

    # Must have an approved IEPOD registration
    session_id = str(session["_id"])
    if quiz.get("sessionId") != session_id:
        raise HTTPException(404, "Quiz not found")
    if not quiz.get("isLive", False):
        raise HTTPException(403, "This quiz is not published yet")

    if quiz.get("quizType") == "live":
        raise HTTPException(400, "Live quiz answers must be submitted through the live arena")

    reg = await _get_registration(db, user_id, session_id)
    if not reg or reg["status"] != "approved":
        raise HTTPException(400, "You must have an approved IEPOD registration to take quizzes")

    # Prevent double-take
    existing = await db.iepod_quiz_responses.find_one(
        {"quizId": quiz_id, "userId": {"$in": _user_id_variants(user_id)}}
    )
    if existing:
        raise HTTPException(400, "You have already taken this quiz")

    questions = quiz.get("questions", [])
    score = 0
    max_score = sum(_max_question_award(_scaled_quiz_base_points(q.get("points", 10))) for q in questions)
    scored_answers: list[dict] = []

    for ans in data.answers:
        if 0 <= ans.questionIndex < len(questions):
            q = questions[ans.questionIndex]
            if ans.selectedOption == q["correctIndex"]:
                base_points = _scaled_quiz_base_points(q.get("points", 10))
                window_seconds = int(q.get("timeLimitSeconds", 20))
                response_ms = getattr(ans, "responseMs", None)
                if isinstance(response_ms, int):
                    elapsed_seconds = max(0.0, min(window_seconds, response_ms / 1000))
                else:
                    elapsed_seconds = float(window_seconds)
                max_bonus = max(50, base_points // 2)
                raw_speed_bonus = int(max_bonus * max(0.0, (window_seconds - elapsed_seconds) / max(1, window_seconds)))
                speed_bonus = raw_speed_bonus
                awarded = min(_max_question_award(base_points), base_points + speed_bonus)
                score += awarded
                scored_answers.append({
                    "questionIndex": ans.questionIndex,
                    "basePoints": base_points,
                    "speedBonusRaw": raw_speed_bonus,
                    "speedBonus": speed_bonus,
                    "awarded": awarded,
                    "responseMs": response_ms,
                })

    percentage = (score / max_score * 100) if max_score > 0 else 0
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    response_doc = {
        "quizId": quiz_id,
        "userId": user_id,
        "userName": user_name,
        "sessionId": session_id,
        "answers": [a.model_dump() for a in data.answers],
        "score": score,
        "maxScore": max_score,
        "percentage": round(percentage, 1),
        "timeTakenSeconds": None,
        "scoredAnswers": scored_answers,
        "submittedAt": datetime.now(timezone.utc),
    }

    result = await db.iepod_quiz_responses.insert_one(response_doc)

    # Update participant count
    await db.iepod_quizzes.update_one(
        {"_id": _oid(quiz_id)},
        {"$inc": {"participantCount": 1}},
    )

    # Record in dedicated quiz-system ledger only.
    if score > 0:
        await _record_quiz_points(
            db,
            str(user_id),
            user_name,
            session_id,
            int(score),
            "practice_quiz",
            f"Quiz '{quiz['title']}' — {score}/{max_score}",
            str(result.inserted_id),
        )

    created = await db.iepod_quiz_responses.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created


@router.post("/quizzes/{quiz_id}/live/start")
async def start_live_quiz_session(
    quiz_id: str,
    request: Request,
    question_window_seconds: int = Query(20, ge=5, le=120),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Host starts a live quiz session with a join code."""
    db = get_database()
    session_id = str(session["_id"])

    quiz = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
    if not quiz or quiz.get("sessionId") != session_id:
        raise HTTPException(404, "Quiz not found")

    questions = quiz.get("questions", [])
    if not questions:
        raise HTTPException(400, "Live quiz requires at least one question")

    await db.iepod_live_quiz_sessions.update_many(
        {"quizId": quiz_id, "sessionId": session_id, "status": {"$ne": "ended"}},
        {"$set": {"status": "ended", "endedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}},
    )

    join_code = None
    for _ in range(8):
        candidate = _build_join_code()
        existing = await db.iepod_live_quiz_sessions.find_one(
            {"joinCode": candidate, "sessionId": session_id, "status": {"$ne": "ended"}}
        )
        if not existing:
            join_code = candidate
            break
    if not join_code:
        raise HTTPException(500, "Could not allocate live join code")

    now = datetime.now(timezone.utc)
    intro_seconds = int(quiz.get("questionIntroSeconds", 3) or 3)
    live_doc = {
        "quizId": quiz_id,
        "quizTitle": quiz.get("title"),
        "sessionId": session_id,
        "hostId": str(user.get("_id")),
        "hostName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get("email", "Host"),
        "joinCode": join_code,
        "status": "waiting",
        "questionWindowSeconds": int(questions[0].get("timeLimitSeconds", question_window_seconds)),
        "questionIntroSeconds": intro_seconds,
        "intermissionSeconds": int(quiz.get("intermissionSeconds", 8)),
        "revealResultsSeconds": int(quiz.get("revealResultsSeconds", 6)),
        # Force auto-only pacing even for legacy quizzes saved with manual mode.
        "autoAdvance": True,
        # Host must explicitly start Question 1. Keep room in waiting mode first.
        "currentQuestionIndex": -1,
        "phase": LIVE_PHASE_WAITING,
        "phaseStartedAt": now,
        "phaseDurationSeconds": 0,
        "phaseEndsAt": None,
        "isPaused": False,
        "pausedAt": None,
        "pausedRemainingSeconds": 0,
        "questionStartedAt": None,
        "revealQuestionIndex": None,
        "revealStartedAt": None,
        "revealEndsAt": None,
        "finalPodiumRevealed": False,
        "participantsCount": 0,
        "answersCount": 0,
        "currentQuestionAnswersCount": 0,
        "awardsApplied": False,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.iepod_live_quiz_sessions.insert_one(live_doc)
    live_doc["_id"] = result.inserted_id

    await AuditLogger.log(
        action="iepod.live_quiz_started",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_live_quiz",
        resource_id=str(result.inserted_id),
        details={"quizId": quiz_id, "joinCode": join_code, "questionWindowSeconds": question_window_seconds},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await _broadcast_live_state(db, live_doc)

    action_id = f"live-start-{uuid4().hex[:12]}"
    ack_at = datetime.now(timezone.utc).isoformat()
    return {
        "liveSessionId": str(result.inserted_id),
        "quizId": quiz_id,
        "quizTitle": quiz.get("title"),
        "joinCode": join_code,
        "status": "waiting",
        "resultingPhase": LIVE_PHASE_WAITING,
        "stateVersion": _state_version_from_doc(live_doc, now),
        "questionWindowSeconds": int(live_doc.get("questionWindowSeconds", question_window_seconds)),
        "actionId": action_id,
        "ackAt": ack_at,
    }


@router.post("/quizzes/live/{join_code}/join")
async def join_live_quiz_session(
    join_code: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student joins a live quiz session by join code."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = str(user.get("_id"))
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get("email", "Student")

    reg = await _get_registration(db, user_id, session_id)
    if not reg or reg.get("status") != "approved":
        raise HTTPException(403, "Only approved IEPOD participants can join live quizzes")

    live_doc = await _resolve_live_session(db, join_code, session_id)
    if live_doc.get("status") == "ended":
        raise HTTPException(400, "This live session has ended")
    if bool(live_doc.get("isPaused", False)):
        raise HTTPException(400, "Session is paused. Resume before advancing")

    participant_filter = {"liveSessionId": str(live_doc.get("_id")), "userId": user_id}
    participant = await db.iepod_live_quiz_participants.find_one(participant_filter)
    participant_added = False
    if not participant:
        await db.iepod_live_quiz_participants.insert_one(
            {
                "liveSessionId": str(live_doc.get("_id")),
                "quizId": live_doc.get("quizId"),
                "sessionId": session_id,
                "userId": user_id,
                "userName": user_name,
                "totalScore": 0,
                "answersCount": 0,
                "readyForStart": False,
                "readyAt": None,
                "joinedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            }
        )
        await db.iepod_live_quiz_sessions.update_one(
            {"_id": live_doc.get("_id")},
            {"$inc": {"participantsCount": 1}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
        )
        participant_added = True

    if participant_added:
        live_doc = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
        if live_doc:
            await _broadcast_live_state(db, live_doc)

    return {
        "joined": True,
        "joinCode": live_doc.get("joinCode"),
        "status": live_doc.get("status"),
        "quizId": live_doc.get("quizId"),
        "quizTitle": live_doc.get("quizTitle"),
        "currentQuestionIndex": int(live_doc.get("currentQuestionIndex", -1)),
        "questionWindowSeconds": int(live_doc.get("questionWindowSeconds", 20)),
        "participantReady": bool((participant or {}).get("readyForStart", False)),
    }


@router.post("/quizzes/live/{join_code}/ready")
async def set_live_quiz_ready_state(
    join_code: str,
    data: LiveReadyIn,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Participant marks ready/not-ready in live waitroom."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = str(user.get("_id"))
    live_doc = await _resolve_live_session(db, join_code, session_id)

    participant = await db.iepod_live_quiz_participants.find_one(
        {"liveSessionId": str(live_doc.get("_id")), "userId": user_id}
    )
    if not participant:
        raise HTTPException(403, "Join the live session first")

    now = datetime.now(timezone.utc)
    await db.iepod_live_quiz_participants.update_one(
        {"_id": participant.get("_id")},
        {
            "$set": {
                "readyForStart": bool(data.ready),
                "readyAt": now if bool(data.ready) else None,
                "updatedAt": now,
            }
        },
    )

    updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    if updated_live:
        await _broadcast_live_state(db, updated_live)

    ready_count = await db.iepod_live_quiz_participants.count_documents(
        {"liveSessionId": str(live_doc.get("_id")), "readyForStart": True}
    )
    return {
        "joinCode": live_doc.get("joinCode"),
        "ready": bool(data.ready),
        "readyParticipantsCount": int(ready_count),
    }


@router.get("/quizzes/live/{join_code}/participants")
async def get_live_quiz_participants(
    join_code: str,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Host view of waitroom/player roster and ready state."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)

    rows = await db.iepod_live_quiz_participants.find(
        {"liveSessionId": str(live_doc.get("_id"))},
        {
            "_id": 0,
            "userId": 1,
            "userName": 1,
            "totalScore": 1,
            "answersCount": 1,
            "readyForStart": 1,
            "readyAt": 1,
            "joinedAt": 1,
        },
    ).sort([("readyForStart", -1), ("joinedAt", 1)]).to_list(length=300)

    ready_count = sum(1 for r in rows if r.get("readyForStart"))
    participants = []
    for r in rows:
        ready_at = r.get("readyAt")
        joined_at = r.get("joinedAt")
        participants.append(
            {
                "userId": r.get("userId"),
                "userName": r.get("userName"),
                "totalScore": int(r.get("totalScore") or 0),
                "answersCount": int(r.get("answersCount") or 0),
                "readyForStart": bool(r.get("readyForStart", False)),
                "readyAt": ready_at.isoformat() if isinstance(ready_at, datetime) else None,
                "joinedAt": joined_at.isoformat() if isinstance(joined_at, datetime) else None,
            }
        )

    return {
        "joinCode": live_doc.get("joinCode"),
        "status": live_doc.get("status"),
        "participantsCount": len(participants),
        "readyParticipantsCount": int(ready_count),
        "participants": participants,
    }


@router.get("/quizzes/live/{join_code}/state")
async def get_live_quiz_state(
    join_code: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Returns live quiz state for host and participants."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)
    live_doc, watchdog_forced = await _run_live_phase_watchdog(db, live_doc)
    live_doc, transitioned = await _process_live_auto_transitions(db, live_doc)
    if transitioned or watchdog_forced:
        await _broadcast_live_state(db, live_doc)
    payload = await _build_live_state_payload(db, live_doc)
    return payload["data"]


@router.post("/quizzes/live/{join_code}/next")
async def advance_live_quiz_question(
    join_code: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Host advances to next question."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)
    expected_state_version = _parse_expected_state_version(request)
    await _enforce_live_state_freshness(db, live_doc, expected_state_version)
    action_id = _parse_action_id(request, "live-next")
    await _register_host_action_id(db, live_doc, "next", action_id)
    ack_at = datetime.now(timezone.utc).isoformat()
    if live_doc.get("status") == "ended":
        raise HTTPException(400, "This live session has ended")

    quiz = await db.iepod_quizzes.find_one({"_id": _oid(live_doc.get("quizId"))})
    if not quiz:
        raise HTTPException(404, "Quiz not found")

    current_idx = int(live_doc.get("currentQuestionIndex", -1))
    explicit_phase = str(live_doc.get("phase") or "")
    phase = explicit_phase or LIVE_PHASE_WAITING
    now = datetime.now(timezone.utc)
    phase_remaining_seconds = _phase_remaining_seconds(live_doc, now)

    if not explicit_phase:
        started_at = live_doc.get("questionStartedAt")
        question_window_seconds = int(live_doc.get("questionWindowSeconds", 20) or 20)
        reveal_question_index = live_doc.get("revealQuestionIndex")
        if isinstance(started_at, datetime):
            elapsed = (now - started_at).total_seconds()
            if elapsed < question_window_seconds:
                phase = LIVE_PHASE_QUESTION_ANSWERING
                phase_remaining_seconds = max(0, int(question_window_seconds - elapsed))
            elif reveal_question_index != current_idx:
                # Backward-compatible guard for legacy docs before explicit phase migration.
                raise HTTPException(400, "Reveal results before advancing to the next question")
            else:
                phase = LIVE_PHASE_LEADERBOARD_REVEAL
    elif phase == LIVE_PHASE_ANSWER_REVEAL:
        reveal_ends_at = live_doc.get("revealEndsAt")
        if isinstance(reveal_ends_at, datetime) and reveal_ends_at <= now:
            phase = LIVE_PHASE_LEADERBOARD_REVEAL
            intermission_seconds = int(live_doc.get("intermissionSeconds", 8) or 8)
            intermission_elapsed = (now - reveal_ends_at).total_seconds()
            phase_remaining_seconds = max(0, int(intermission_seconds - intermission_elapsed))

    if phase in (LIVE_PHASE_QUESTION_INTRO, LIVE_PHASE_QUESTION_ANSWERING, LIVE_PHASE_ANSWER_REVEAL):
        label = "question intro" if phase == LIVE_PHASE_QUESTION_INTRO else "question" if phase == LIVE_PHASE_QUESTION_ANSWERING else "answer reveal"
        raise HTTPException(400, f"{label.title()} is active. Wait for leaderboard before advancing.")

    if phase == LIVE_PHASE_LEADERBOARD_REVEAL and phase_remaining_seconds > 0:
        raise HTTPException(400, f"Leaderboard is active. Wait {max(1, phase_remaining_seconds)}s before advancing.")

    next_idx = int(live_doc.get("currentQuestionIndex", -1)) + 1
    if next_idx >= len(quiz.get("questions", [])):
        ended_at = datetime.now(timezone.utc)
        await db.iepod_live_quiz_sessions.update_one(
            {"_id": live_doc.get("_id")},
            {"$set": {
                "status": "ended",
                "phase": LIVE_PHASE_ENDED,
                "phaseStartedAt": ended_at,
                "phaseDurationSeconds": 0,
                "phaseEndsAt": None,
                "endedAt": ended_at,
                "updatedAt": ended_at,
            }},
        )
        updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
        if updated_live:
            await _broadcast_live_state(db, updated_live)
        return {
            "ended": True,
            "message": "Quiz session completed",
            "resultingPhase": LIVE_PHASE_ENDED,
            "stateVersion": _state_version_from_doc(updated_live or {}, ended_at),
            "actionId": action_id,
            "ackAt": ack_at,
        }

    q = quiz.get("questions", [])[next_idx]
    question_window_seconds = int(q.get("timeLimitSeconds", live_doc.get("questionWindowSeconds", 20)))
    intro_seconds = int(live_doc.get("questionIntroSeconds", 3) or 3)

    await db.iepod_live_quiz_sessions.update_one(
        {"_id": live_doc.get("_id")},
        {
            "$set": {
                "status": "live",
                "phase": LIVE_PHASE_QUESTION_INTRO,
                "phaseStartedAt": now,
                "phaseDurationSeconds": intro_seconds,
                "phaseEndsAt": now + timedelta(seconds=intro_seconds),
                "currentQuestionIndex": next_idx,
                "questionStartedAt": None,
                "questionWindowSeconds": question_window_seconds,
                "currentQuestionAnswersCount": 0,
                "revealQuestionIndex": None,
                "revealStartedAt": None,
                "revealEndsAt": None,
                "updatedAt": now,
            }
        },
    )

    await AuditLogger.log(
        action="iepod.live_quiz_question_started",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_live_quiz",
        resource_id=str(live_doc.get("_id")),
        details={"quizId": live_doc.get("quizId"), "questionIndex": next_idx},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    if updated_live:
        await _broadcast_live_state(db, updated_live)

    return {
        "ended": False,
        "resultingPhase": LIVE_PHASE_QUESTION_INTRO,
        "stateVersion": _state_version_from_doc(updated_live or {}, now),
        "question": {
            "index": next_idx,
            "question": q.get("question"),
            "options": q.get("options", []),
            "points": q.get("points", 10),
            "timeLimitSeconds": question_window_seconds,
        },
        "questionWindowSeconds": question_window_seconds,
        "totalQuestions": len(quiz.get("questions", [])),
        "actionId": action_id,
        "ackAt": ack_at,
    }


@router.post("/quizzes/live/{join_code}/reveal")
async def reveal_live_quiz_results(
    join_code: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Host triggers results reveal beat for the current question."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)
    expected_state_version = _parse_expected_state_version(request)
    await _enforce_live_state_freshness(db, live_doc, expected_state_version)
    action_id = _parse_action_id(request, "live-reveal")
    await _register_host_action_id(db, live_doc, "reveal", action_id)
    ack_at = datetime.now(timezone.utc).isoformat()
    if live_doc.get("status") != "live":
        raise HTTPException(400, "Live session is not active")
    if bool(live_doc.get("isPaused", False)):
        raise HTTPException(400, "Session is paused. Resume before revealing results")

    current_idx = int(live_doc.get("currentQuestionIndex", -1))
    if current_idx < 0:
        raise HTTPException(400, "No active question to reveal")

    explicit_phase = str(live_doc.get("phase") or "")
    phase = explicit_phase
    started_at = live_doc.get("questionStartedAt")
    question_window_seconds = int(live_doc.get("questionWindowSeconds", 20) or 20)
    legacy_timing_applicable = isinstance(started_at, datetime) and (
        not explicit_phase or explicit_phase in (LIVE_PHASE_QUESTION_INTRO, LIVE_PHASE_QUESTION_ANSWERING)
    )
    if legacy_timing_applicable:
        elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
        if elapsed < question_window_seconds:
            raise HTTPException(400, "Reveal is available only after question timer ends")
        phase = LIVE_PHASE_QUESTION_ANSWERING

    if phase != LIVE_PHASE_QUESTION_ANSWERING:
        if phase == LIVE_PHASE_ANSWER_REVEAL:
            return {
                "revealed": True,
                "questionIndex": current_idx,
                "revealResultsSeconds": int(live_doc.get("revealResultsSeconds", 6)),
                "resultingPhase": LIVE_PHASE_ANSWER_REVEAL,
                "stateVersion": _state_version_from_doc(live_doc),
                "actionId": action_id,
                "ackAt": ack_at,
            }
        raise HTTPException(400, "Reveal is available only after question timer ends")

    phase_ends_at = live_doc.get("phaseEndsAt")
    now = datetime.now(timezone.utc)
    if (not legacy_timing_applicable) and isinstance(phase_ends_at, datetime) and phase_ends_at > now:
        remaining = max(1, int((phase_ends_at - now).total_seconds()))
        raise HTTPException(400, f"Question timer is active. Wait {remaining}s before revealing")

    reveal_question_index = live_doc.get("revealQuestionIndex")
    if isinstance(reveal_question_index, int) and reveal_question_index == current_idx and live_doc.get("revealEndsAt"):
        return {
            "revealed": True,
            "questionIndex": current_idx,
            "revealResultsSeconds": int(live_doc.get("revealResultsSeconds", 6)),
            "resultingPhase": LIVE_PHASE_ANSWER_REVEAL,
            "stateVersion": _state_version_from_doc(live_doc),
            "actionId": action_id,
            "ackAt": ack_at,
        }

    reveal_seconds = int(live_doc.get("revealResultsSeconds", 6))
    reveal_ends_at = now + timedelta(seconds=reveal_seconds)
    await db.iepod_live_quiz_sessions.update_one(
        {"_id": live_doc.get("_id")},
        {
            "$set": {
                "phase": LIVE_PHASE_ANSWER_REVEAL,
                "phaseStartedAt": now,
                "phaseDurationSeconds": reveal_seconds,
                "phaseEndsAt": reveal_ends_at,
                "revealQuestionIndex": current_idx,
                "revealStartedAt": now,
                "revealEndsAt": reveal_ends_at,
                "updatedAt": now,
            }
        },
    )

    await AuditLogger.log(
        action="iepod.live_quiz_results_revealed",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_live_quiz",
        resource_id=str(live_doc.get("_id")),
        details={"quizId": live_doc.get("quizId"), "questionIndex": current_idx, "joinCode": live_doc.get("joinCode")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    if updated_live:
        await _broadcast_live_state(db, updated_live)

    return {
        "revealed": True,
        "questionIndex": current_idx,
        "revealResultsSeconds": reveal_seconds,
        "resultingPhase": LIVE_PHASE_ANSWER_REVEAL,
        "stateVersion": _state_version_from_doc(updated_live or {}, now),
        "actionId": action_id,
        "ackAt": ack_at,
    }


@router.post("/quizzes/live/{join_code}/reveal-final")
async def reveal_live_quiz_final_podium(
    join_code: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Host triggers final top-3 podium reveal after live session has ended."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)

    # Final podium reveal is idempotent (False -> True once). We intentionally do not
    # enforce strict stale-state rejection here to avoid host-facing 409 races caused by
    # harmless background state hydration/version drift.
    action_id = _parse_action_id(request, "live-reveal-final")
    await _register_host_action_id(db, live_doc, "reveal-final", action_id)
    ack_at = datetime.now(timezone.utc).isoformat()
    if live_doc.get("status") != "ended":
        raise HTTPException(400, "Final podium reveal is only available after the live session ends")

    if bool(live_doc.get("finalPodiumRevealed", False)):
        existing_updated_at = live_doc.get("updatedAt")
        return {
            "revealed": True,
            "finalPodiumRevealed": True,
            "resultingPhase": LIVE_PHASE_ENDED,
            "stateVersion": _state_version_from_doc(live_doc),
            "actionId": action_id,
            "ackAt": ack_at,
            "updatedAt": existing_updated_at.isoformat() if isinstance(existing_updated_at, datetime) else None,
        }

    now = datetime.now(timezone.utc)
    await db.iepod_live_quiz_sessions.update_one(
        {"_id": live_doc.get("_id")},
        {
            "$set": {
                "finalPodiumRevealed": True,
                "updatedAt": now,
            }
        },
    )

    await AuditLogger.log(
        action="iepod.live_quiz_final_podium_revealed",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_live_quiz",
        resource_id=str(live_doc.get("_id")),
        details={"quizId": live_doc.get("quizId"), "joinCode": live_doc.get("joinCode")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    if updated_live:
        await _broadcast_live_state(db, updated_live)

    return {
        "revealed": True,
        "finalPodiumRevealed": True,
        "resultingPhase": LIVE_PHASE_ENDED,
        "stateVersion": _state_version_from_doc(updated_live or {}, now),
        "actionId": action_id,
        "ackAt": ack_at,
        "updatedAt": now.isoformat(),
    }


@router.post("/quizzes/live/{join_code}/answer")
async def submit_live_quiz_answer(
    join_code: str,
    data: LiveAnswerIn,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student submits one timed answer for the current live question with anti-cheat checks."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = str(user.get("_id"))
    live_doc = await _resolve_live_session(db, join_code, session_id)

    if live_doc.get("status") != "live":
        raise HTTPException(400, "Live question is not active")
    if bool(live_doc.get("isPaused", False)):
        raise HTTPException(400, "Session is paused. Answers are temporarily locked")
    if int(live_doc.get("currentQuestionIndex", -1)) != data.questionIndex:
        raise HTTPException(400, "This is not the active question")
    if str(live_doc.get("phase") or "") != LIVE_PHASE_QUESTION_ANSWERING:
        raise HTTPException(400, "Answers are accepted only during question answering phase")

    participant = await db.iepod_live_quiz_participants.find_one(
        {"liveSessionId": str(live_doc.get("_id")), "userId": user_id}
    )
    if not participant:
        raise HTTPException(403, "Join the live session first")

    existing = await db.iepod_live_quiz_answers.find_one(
        {
            "liveSessionId": str(live_doc.get("_id")),
            "userId": user_id,
            "questionIndex": data.questionIndex,
        }
    )
    if existing:
        raise HTTPException(409, "You already answered this question")

    quiz = await db.iepod_quizzes.find_one({"_id": _oid(live_doc.get("quizId"))})
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    if data.questionIndex >= len(quiz.get("questions", [])):
        raise HTTPException(400, "Invalid question index")

    started_at = live_doc.get("questionStartedAt")
    if not started_at:
        raise HTTPException(400, "Question has not started")
    elapsed_seconds = (datetime.now(timezone.utc) - started_at).total_seconds()
    window_seconds = int(live_doc.get("questionWindowSeconds", 20))
    if elapsed_seconds > window_seconds:
        raise HTTPException(400, "Answer window has closed")

    question = quiz["questions"][data.questionIndex]
    is_correct = int(data.selectedOption) == int(question.get("correctIndex", -1))
    base_points = _scaled_quiz_base_points(question.get("points", 10)) if is_correct else 0
    speed_bonus = 0
    if is_correct:
        max_bonus = max(50, base_points // 2)
        raw_speed_bonus = int(max_bonus * max(0, (window_seconds - elapsed_seconds) / max(1, window_seconds)))
        speed_bonus = raw_speed_bonus
    awarded = min(_max_question_award(base_points), base_points + speed_bonus) if is_correct else 0

    now = datetime.now(timezone.utc)
    await db.iepod_live_quiz_answers.insert_one(
        {
            "liveSessionId": str(live_doc.get("_id")),
            "quizId": live_doc.get("quizId"),
            "sessionId": session_id,
            "userId": user_id,
            "userName": participant.get("userName"),
            "questionIndex": data.questionIndex,
            "selectedOption": data.selectedOption,
            "isCorrect": is_correct,
            "pointsAwarded": awarded,
            "responseMs": int(elapsed_seconds * 1000),
            "submittedAt": now,
        }
    )

    await db.iepod_live_quiz_participants.update_one(
        {"_id": participant.get("_id")},
        {
            "$inc": {"totalScore": awarded, "answersCount": 1},
            "$set": {"updatedAt": now, "lastAnswerAt": now},
        },
    )
    await db.iepod_live_quiz_sessions.update_one(
        {"_id": live_doc.get("_id")},
        {"$inc": {"answersCount": 1, "currentQuestionAnswersCount": 1}, "$set": {"updatedAt": now}},
    )

    updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    if updated_live:
        await _broadcast_live_state(db, updated_live)

    return {
        "accepted": True,
        "isCorrect": is_correct,
        "pointsAwarded": awarded,
        "elapsedMs": int(elapsed_seconds * 1000),
    }


@router.get("/quizzes/live/{join_code}/leaderboard")
async def get_live_quiz_leaderboard(
    join_code: str,
    limit: int = Query(20, ge=3, le=100),
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get real-time leaderboard for a live quiz session."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)
    items = await _compute_live_leaderboard(db, str(live_doc.get("_id")), limit=limit)
    return {
        "joinCode": live_doc.get("joinCode"),
        "status": live_doc.get("status"),
        "items": items,
    }


@router.post("/quizzes/live/{join_code}/end")
async def end_live_quiz_session(
    join_code: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Host ends the live session and records quiz-system points once."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)
    expected_state_version = _parse_expected_state_version(request)
    await _enforce_live_state_freshness(db, live_doc, expected_state_version)
    action_id = _parse_action_id(request, "live-end")
    await _register_host_action_id(db, live_doc, "end", action_id)
    ack_at = datetime.now(timezone.utc).isoformat()

    now = datetime.now(timezone.utc)
    replay_timeline = await _build_live_replay_timeline(db, live_doc)
    telemetry = [
        {
            "questionIndex": step.get("questionIndex"),
            "confusionIndex": step.get("confusionIndex", 0.0),
            "dominantWrongShare": step.get("dominantWrongShare", 0.0),
        }
        for step in replay_timeline
    ]
    await db.iepod_live_quiz_sessions.update_one(
        {"_id": live_doc.get("_id")},
        {"$set": {
            "status": "ended",
            "phase": LIVE_PHASE_ENDED,
            "phaseStartedAt": now,
            "phaseDurationSeconds": 0,
            "phaseEndsAt": None,
            "endedAt": now,
            "updatedAt": now,
            "questionTelemetry": telemetry,
            "replayTimeline": replay_timeline,
        }},
    )

    if not live_doc.get("awardsApplied", False):
        participants = await db.iepod_live_quiz_participants.find(
            {"liveSessionId": str(live_doc.get("_id"))}
        ).to_list(length=5000)
        for p in participants:
            total_score = int(p.get("totalScore") or 0)
            if total_score <= 0:
                continue
            await _record_quiz_points(
                db,
                str(p.get("userId")),
                p.get("userName", "Student"),
                session_id,
                int(total_score),
                "live_quiz",
                f"Live quiz {join_code.strip().upper()} score",
                str(live_doc.get("_id")),
            )

        await db.iepod_live_quiz_sessions.update_one(
            {"_id": live_doc.get("_id")},
            {"$set": {"awardsApplied": True, "updatedAt": datetime.now(timezone.utc)}},
        )

    updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    if updated_live:
        await _broadcast_live_state(db, updated_live)

    await AuditLogger.log(
        action="iepod.live_quiz_ended",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_live_quiz",
        resource_id=str(live_doc.get("_id")),
        details={"quizId": live_doc.get("quizId"), "joinCode": live_doc.get("joinCode")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {
        "ended": True,
        "joinCode": live_doc.get("joinCode"),
        "resultingPhase": LIVE_PHASE_ENDED,
        "stateVersion": _state_version_from_doc(updated_live or {}, now),
        "actionId": action_id,
        "ackAt": ack_at,
    }


@router.post("/quizzes/live/{join_code}/pause")
async def pause_live_quiz_session(
    join_code: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Host pauses timed progression and freezes remaining seconds server-side."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)
    # Pause is idempotent and safe against stale snapshots; avoid host-facing 409s.
    action_id = _parse_action_id(request, "live-pause")
    await _register_host_action_id(db, live_doc, "pause", action_id)
    ack_at = datetime.now(timezone.utc).isoformat()

    status = str(live_doc.get("status") or "")
    if status == "ended":
        raise HTTPException(400, "Ended live sessions cannot be paused")
    if status not in {"waiting", "live"}:
        raise HTTPException(400, f"Live session cannot be paused from status '{status or 'unknown'}'")

    if bool(live_doc.get("isPaused", False)):
        return {
            "paused": True,
            "resultingPhase": str(live_doc.get("phase") or LIVE_PHASE_WAITING),
            "stateVersion": _state_version_from_doc(live_doc),
            "actionId": action_id,
            "ackAt": ack_at,
        }

    now = datetime.now(timezone.utc)
    remaining = _phase_remaining_seconds(live_doc, now)
    await db.iepod_live_quiz_sessions.update_one(
        {"_id": live_doc.get("_id")},
        {
            "$set": {
                "isPaused": True,
                "pausedAt": now,
                "pausedRemainingSeconds": remaining,
                "phaseEndsAt": None,
                "updatedAt": now,
            }
        },
    )

    updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    if updated_live:
        await _broadcast_live_state(db, updated_live)

    return {
        "paused": True,
        "resultingPhase": str((updated_live or live_doc).get("phase") or LIVE_PHASE_WAITING),
        "stateVersion": _state_version_from_doc(updated_live or live_doc, now),
        "actionId": action_id,
        "ackAt": ack_at,
    }


@router.post("/quizzes/live/{join_code}/resume")
async def resume_live_quiz_session(
    join_code: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Host resumes timed progression by reconstructing phase end from frozen remaining seconds."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)
    # Resume is idempotent and safe against stale snapshots; avoid host-facing 409s.
    action_id = _parse_action_id(request, "live-resume")
    await _register_host_action_id(db, live_doc, "resume", action_id)
    ack_at = datetime.now(timezone.utc).isoformat()

    status = str(live_doc.get("status") or "")
    if status == "ended":
        raise HTTPException(400, "Ended live sessions cannot be resumed")
    if status not in {"waiting", "live"}:
        raise HTTPException(400, f"Live session cannot be resumed from status '{status or 'unknown'}'")

    if not bool(live_doc.get("isPaused", False)):
        return {
            "paused": False,
            "resultingPhase": str(live_doc.get("phase") or LIVE_PHASE_WAITING),
            "stateVersion": _state_version_from_doc(live_doc),
            "actionId": action_id,
            "ackAt": ack_at,
        }

    now = datetime.now(timezone.utc)
    remaining = max(0, int(live_doc.get("pausedRemainingSeconds") or 0))
    phase = str(live_doc.get("phase") or LIVE_PHASE_WAITING)
    phase_ends_at = None
    if phase in LIVE_PHASE_TIMED:
        # If remaining is 0, resume should immediately allow the transition engine
        # to move phase forward instead of leaving the timer unset/stuck.
        phase_ends_at = now + timedelta(seconds=max(0, remaining))

    await db.iepod_live_quiz_sessions.update_one(
        {"_id": live_doc.get("_id")},
        {
            "$set": {
                "isPaused": False,
                "pausedAt": None,
                "pausedRemainingSeconds": 0,
                "phaseEndsAt": phase_ends_at,
                "updatedAt": now,
            }
        },
    )

    updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    if updated_live:
        updated_live, transitioned = await _process_live_auto_transitions(db, updated_live)
        await _broadcast_live_state(db, updated_live)

    return {
        "paused": False,
        "resultingPhase": str((updated_live or live_doc).get("phase") or LIVE_PHASE_WAITING),
        "stateVersion": _state_version_from_doc(updated_live or live_doc, now),
        "actionId": action_id,
        "ackAt": ack_at,
    }


@router.post("/quizzes/live/{join_code}/resync")
async def force_resync_live_quiz(
    join_code: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Host-forced push of authoritative live state to all connected clients."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)
    expected_state_version = _parse_expected_state_version(request)
    await _enforce_live_state_freshness(db, live_doc, expected_state_version)
    action_id = _parse_action_id(request, "live-resync")
    await _register_host_action_id(db, live_doc, "resync", action_id)
    ack_at = datetime.now(timezone.utc).isoformat()

    await db.iepod_live_quiz_sessions.update_one(
        {"_id": live_doc.get("_id")},
        {"$set": {"lastForcedResyncAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}},
    )
    updated_live = await db.iepod_live_quiz_sessions.find_one({"_id": live_doc.get("_id")})
    if updated_live:
        await _broadcast_live_state(db, updated_live)

    return {
        "resynced": True,
        "joinCode": live_doc.get("joinCode"),
        "resultingPhase": str((updated_live or live_doc).get("phase") or LIVE_PHASE_WAITING),
        "stateVersion": _state_version_from_doc(updated_live or live_doc),
        "actionId": action_id,
        "ackAt": ack_at,
    }


@router.get("/quizzes/live/{join_code}/replay")
async def get_live_quiz_replay(
    join_code: str,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin replay timeline with per-question telemetry and leaderboard movement."""
    db = get_database()
    session_id = str(session["_id"])
    live_doc = await _resolve_live_session(db, join_code, session_id)

    timeline = live_doc.get("replayTimeline")
    if not isinstance(timeline, list) or not timeline:
        timeline = await _build_live_replay_timeline(db, live_doc)

    return {
        "joinCode": live_doc.get("joinCode"),
        "quizId": live_doc.get("quizId"),
        "quizTitle": live_doc.get("quizTitle"),
        "status": live_doc.get("status"),
        "timeline": timeline,
        "questionTelemetry": live_doc.get("questionTelemetry") or [
            {
                "questionIndex": step.get("questionIndex"),
                "confusionIndex": step.get("confusionIndex", 0.0),
                "dominantWrongShare": step.get("dominantWrongShare", 0.0),
            }
            for step in timeline
        ],
    }


async def _build_general_leaderboard_page(db, session_id: str, *, limit: int, skip: int):
    aggregate = [
        {"$match": {"sessionId": session_id}},
        {
            "$group": {
                "_id": "$userId",
                "userName": {"$first": "$userName"},
                "totalPoints": {"$sum": "$points"},
            }
        },
        {"$sort": {"totalPoints": -1, "userName": 1}},
        {
            "$facet": {
                "items": [
                    {"$skip": skip},
                    {"$limit": limit},
                ],
                "meta": [{"$count": "total"}],
            }
        },
    ]
    bucket = await db.iepod_points.aggregate(aggregate).to_list(length=1)
    payload = bucket[0] if bucket else {"items": [], "meta": []}
    rows = payload.get("items") or []
    meta = payload.get("meta") or []
    total = int(meta[0].get("total", 0)) if meta else 0

    user_ids = [str(entry.get("_id") or "") for entry in rows if entry.get("_id")]
    regs = await db.iepod_registrations.find(
        {"sessionId": session_id, "userId": {"$in": user_ids}},
        {"userId": 1, "phase": 1, "societyId": 1},
    ).to_list(length=max(len(user_ids), 1))
    reg_map = {str(reg.get("userId")): reg for reg in regs if reg.get("userId")}

    society_oids: list[ObjectId] = []
    for reg in regs:
        society_id = reg.get("societyId")
        if isinstance(society_id, str) and ObjectId.is_valid(society_id):
            society_oids.append(ObjectId(society_id))

    societies = []
    if society_oids:
        societies = await db.iepod_societies.find(
            {"_id": {"$in": society_oids}},
            {"name": 1},
        ).to_list(length=len(society_oids))
    society_map = {str(doc.get("_id")): doc.get("name") for doc in societies}

    items = []
    for idx, row in enumerate(rows, start=1):
        entry_user_id = str(row.get("_id") or "")
        reg = reg_map.get(entry_user_id)
        society_name = society_map.get(str(reg.get("societyId"))) if reg else None
        items.append(
            {
                "userId": entry_user_id,
                "userName": row.get("userName") or "Student",
                "totalPoints": int(row.get("totalPoints") or 0),
                "rank": skip + idx,
                "phase": reg.get("phase") if reg else None,
                "societyName": society_name,
            }
        )

    return items, total


async def _build_quiz_leaderboard_page(db, session_id: str, *, limit: int, skip: int):
    aggregate = [
        {"$match": {"sessionId": session_id}},
        {
            "$group": {
                "_id": "$userId",
                "userName": {"$first": "$userName"},
                "totalPoints": {"$sum": "$points"},
            }
        },
        {"$sort": {"totalPoints": -1, "userName": 1}},
        {
            "$facet": {
                "items": [
                    {"$skip": skip},
                    {"$limit": limit},
                ],
                "meta": [{"$count": "total"}],
            }
        },
    ]
    bucket = await db.iepod_quiz_points.aggregate(aggregate).to_list(length=1)
    payload = bucket[0] if bucket else {"items": [], "meta": []}
    rows = payload.get("items") or []
    meta = payload.get("meta") or []
    total = int(meta[0].get("total", 0)) if meta else 0

    items = []
    for idx, row in enumerate(rows, start=1):
        items.append(
            {
                "userId": str(row.get("_id") or ""),
                "userName": row.get("userName") or "Student",
                "totalPoints": int(row.get("totalPoints") or 0),
                "rank": skip + idx,
            }
        )
    return items, total


async def _build_member_lookup_items(db, session_id: str, query: str, limit: int):
    q = query.strip()
    if len(q) < 2:
        return []

    rx = {"$regex": re.escape(q), "$options": "i"}
    merged: dict[str, dict] = {}

    reg_docs = await db.iepod_registrations.find(
        {
            "sessionId": session_id,
            "$or": [
                {"userName": rx},
                {"userEmail": rx},
            ],
        },
        {
            "userId": 1,
            "userName": 1,
            "userEmail": 1,
            "status": 1,
            "points": 1,
            "department": 1,
            "level": 1,
        },
    ).to_list(length=limit)
    for reg in reg_docs:
        user_id = str(reg.get("userId") or "").strip()
        if user_id:
            merged[user_id] = reg

    user_docs = await db.users.find(
        {
            "$or": [
                {"firstName": rx},
                {"lastName": rx},
                {"email": rx},
                {"institutionalEmail": rx},
                {"matricNumber": rx},
            ]
        },
        {
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "institutionalEmail": 1,
            "matricNumber": 1,
            "department": 1,
            "currentLevel": 1,
        },
    ).to_list(length=max(limit * 3, 12))

    user_id_map = {str(doc.get("_id")): doc for doc in user_docs if doc.get("_id")}
    if user_id_map:
        regs_for_users = await db.iepod_registrations.find(
            {"sessionId": session_id, "userId": {"$in": list(user_id_map.keys())}},
            {
                "userId": 1,
                "userName": 1,
                "userEmail": 1,
                "status": 1,
                "points": 1,
                "department": 1,
                "level": 1,
            },
        ).to_list(length=max(len(user_id_map), 1))
        for reg in regs_for_users:
            reg_user_id = str(reg.get("userId") or "").strip()
            if reg_user_id:
                merged[reg_user_id] = reg

    items = []
    for user_id, reg in merged.items():
        u = user_id_map.get(user_id)
        full_name = str(reg.get("userName") or "").strip()
        if not full_name and u:
            full_name = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()

        items.append(
            {
                "userId": user_id,
                "userName": full_name or "Student",
                "email": reg.get("userEmail") or (u.get("institutionalEmail") if u else None) or (u.get("email") if u else None),
                "matricNumber": (u.get("matricNumber") if u else None),
                "level": reg.get("level") or (u.get("currentLevel") if u else None),
                "department": reg.get("department") or (u.get("department") if u else None),
                "status": reg.get("status"),
                "points": int(reg.get("points") or 0),
            }
        )

    def _sort_key(item: dict):
        name = str(item.get("userName") or "").lower()
        starts = 0 if name.startswith(q.lower()) else 1
        return (starts, name)

    items.sort(key=_sort_key)
    return items[:limit]


@router.get("/leaderboard/quiz")
@router.get("/quizzes/leaderboard")
async def get_quiz_system_leaderboard(
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Dedicated quiz-system leaderboard (separate from general IEPOD leaderboard)."""
    db = get_database()
    session_id = str(session["_id"])

    items, _ = await _build_quiz_leaderboard_page(db, session_id, limit=limit, skip=skip)
    return items


@router.get("/quizzes/leaderboard/admin")
async def get_quiz_system_leaderboard_admin(
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: paginated quiz-system leaderboard with total count."""
    db = get_database()
    session_id = str(session["_id"])

    items, total = await _build_quiz_leaderboard_page(db, session_id, limit=limit, skip=skip)
    return {"items": items, "total": total}


@router.patch("/quizzes/{quiz_id}")
async def update_quiz(
    quiz_id: str,
    data: QuizUpdate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    # Manual flow is retired; keep quizzes in auto mode.
    updates["autoAdvance"] = True
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.iepod_quizzes.update_one({"_id": _oid(quiz_id)}, {"$set": updates})
    updated = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
    if not updated:
        raise HTTPException(404, "Quiz not found")
    updated["_id"] = str(updated["_id"])

    await AuditLogger.log(
        action="iepod.quiz_updated",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_quiz",
        resource_id=quiz_id,
        details={"title": updated.get("title"), "fields": list(updates.keys())},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return updated


@router.delete("/quizzes/{quiz_id}", status_code=204)
async def delete_quiz(
    quiz_id: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    doc = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
    result = await db.iepod_quizzes.delete_one({"_id": _oid(quiz_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Quiz not found")

    # Clean up quiz responses
    await db.iepod_quiz_responses.delete_many({"quizId": quiz_id})

    await AuditLogger.log(
        action="iepod.quiz_deleted",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_quiz",
        resource_id=quiz_id,
        details={"title": doc.get("title") if doc else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


# Admin: quiz results
@router.get("/quizzes/{quiz_id}/results")
async def get_quiz_results(
    quiz_id: str,
    user: dict = Depends(require_permission("iepod:manage")),
):
    """Admin: View all responses for a quiz."""
    db = get_database()
    cursor = db.iepod_quiz_responses.find(
        {"quizId": quiz_id}
    ).sort("score", -1)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    return items


# ═══════════════════════════════════════════════════════════════════
# POINTS & LEADERBOARD
# ═══════════════════════════════════════════════════════════════════

@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get the IEPOD leaderboard for the current session."""
    db = get_database()
    session_id = str(session["_id"])

    items, _ = await _build_general_leaderboard_page(db, session_id, limit=limit, skip=skip)
    return items


@router.get("/leaderboard/admin")
async def get_leaderboard_admin(
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: paginated general IEPOD leaderboard with total count."""
    db = get_database()
    session_id = str(session["_id"])

    items, total = await _build_general_leaderboard_page(db, session_id, limit=limit, skip=skip)
    return {"items": items, "total": total}


@router.get("/members/search", response_model=IepodMemberLookupResponse)
async def search_iepod_members(
    q: str = Query(..., min_length=2, max_length=64),
    limit: int = Query(8, ge=1, le=20),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: search registered IEPOD members by name, email, or matric number."""
    db = get_database()
    session_id = str(session["_id"])
    items = await _build_member_lookup_items(db, session_id, q, limit)
    return {"items": items}


@router.get("/points/bonus-history")
async def list_bonus_points_history(
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: list bonus awards and reversals for audit/recovery workflows."""
    db = get_database()
    session_id = str(session["_id"])

    query = {
        "sessionId": session_id,
        "action": {"$in": ["bonus", "bonus_reversal"]},
    }
    total = await db.iepod_points.count_documents(query)
    docs = await db.iepod_points.find(query).sort("awardedAt", -1).skip(skip).limit(limit).to_list(length=limit)

    visible_bonus_ids = [str(doc.get("_id")) for doc in docs if doc.get("action") == "bonus" and doc.get("_id")]
    reversal_docs = []
    if visible_bonus_ids:
        reversal_docs = await db.iepod_points.find(
            {
                "sessionId": session_id,
                "action": "bonus_reversal",
                "referenceId": {"$in": visible_bonus_ids},
            },
            {"referenceId": 1},
        ).to_list(length=len(visible_bonus_ids))
    reversal_refs = {str(doc.get("referenceId")) for doc in reversal_docs if doc.get("referenceId")}

    items = []
    for doc in docs:
        point_id = str(doc.get("_id"))
        action = str(doc.get("action") or "")
        items.append(
            {
                "id": point_id,
                "userId": str(doc.get("userId") or ""),
                "userName": doc.get("userName") or "Student",
                "action": action,
                "points": int(doc.get("points") or 0),
                "description": doc.get("description") or "",
                "awardedAt": doc.get("awardedAt"),
                "referenceId": doc.get("referenceId"),
                "isReversible": action == "bonus" and int(doc.get("points") or 0) > 0 and point_id not in reversal_refs,
            }
        )

    return {"items": items, "total": total}


# Admin: award bonus points
@router.post("/points/award")
async def award_bonus_points(
    data: PointAward,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: Award bonus points to a student."""
    db = get_database()
    session_id = str(session["_id"])

    # Look up student
    student = await db.users.find_one({"_id": _oid(data.userId)})
    if not student:
        raise HTTPException(404, "Student not found")

    student_name = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip()
    await _award_points(
        db, data.userId, student_name, session_id,
        "bonus", data.points, data.description,
    )

    created = await db.iepod_points.find_one(
        {
            "userId": data.userId,
            "sessionId": session_id,
            "action": "bonus",
            "points": data.points,
            "description": data.description,
        },
        sort=[("awardedAt", -1)],
    )

    await AuditLogger.log(
        action="iepod.bonus_points_awarded",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_points",
        resource_id=data.userId,
        details={"student": student_name, "points": data.points, "description": data.description},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {
        "message": f"Awarded {data.points} points to {student_name}",
        "pointEntryId": str(created.get("_id")) if created else None,
    }


@router.post("/points/{point_id}/reverse")
async def reverse_bonus_points(
    point_id: str,
    data: PointReversal,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: reverse a previously awarded bonus entry with an audit trail."""
    db = get_database()
    session_id = str(session["_id"])

    original = await db.iepod_points.find_one({"_id": _oid(point_id), "sessionId": session_id})
    if not original:
        raise HTTPException(404, "Point entry not found")
    if original.get("action") != "bonus" or int(original.get("points") or 0) <= 0:
        raise HTTPException(400, "Only positive bonus awards can be reversed")

    existing_reverse = await db.iepod_points.find_one(
        {
            "sessionId": session_id,
            "action": "bonus_reversal",
            "referenceId": str(original.get("_id")),
        }
    )
    if existing_reverse:
        raise HTTPException(409, "This bonus award has already been reversed")

    user_id = str(original.get("userId") or "")
    user_name = str(original.get("userName") or "Student")
    amount = int(original.get("points") or 0)
    reason = data.reason.strip()

    await _award_points(
        db,
        user_id,
        user_name,
        session_id,
        "bonus_reversal",
        -abs(amount),
        f"Reversal of bonus #{point_id}: {reason}",
        ref_id=str(original.get("_id")),
    )

    await db.iepod_points.update_one(
        {"_id": original.get("_id")},
        {
            "$set": {
                "reversedAt": datetime.now(timezone.utc),
                "reversedReason": reason,
                "reversedByUserId": str(user.get("_id")),
                "reversedByEmail": user.get("email"),
            }
        },
    )

    await AuditLogger.log(
        action="iepod.bonus_points_reversed",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_points",
        resource_id=point_id,
        details={"student": user_name, "points": amount, "reason": reason},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": f"Reversed {amount} bonus points for {user_name}"}


@router.post("/admin/users/{user_id}/reset")
async def reset_iepod_user_data(
    user_id: str,
    data: IepodResetUserDataRequest,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: remove a user's IEPOD artifacts for the current session and optionally block rejoin."""
    db = get_database()
    session_id = str(session["_id"])
    user_id_clean = user_id.strip()
    user_id_variants = _user_id_variants(user_id_clean)

    target_user = None
    if ObjectId.is_valid(user_id_clean):
        target_user = await db.users.find_one({"_id": ObjectId(user_id_clean)}, {"firstName": 1, "lastName": 1, "email": 1})
    if not target_user:
        target_user = await db.users.find_one({"_id": {"$in": [v for v in user_id_variants if isinstance(v, ObjectId)]}}, {"firstName": 1, "lastName": 1, "email": 1})

    reg = await db.iepod_registrations.find_one(
        {
            "sessionId": session_id,
            "$or": [
                {"userId": {"$in": user_id_variants}},
                {"studentId": {"$in": user_id_variants}},
            ],
        },
        {"_id": 1, "userId": 1, "userName": 1, "userEmail": 1},
    )
    canonical_user_id = str(reg.get("userId")) if reg and reg.get("userId") else user_id_clean
    canonical_variants = _user_id_variants(canonical_user_id)

    team_docs = await db.iepod_teams.find(
        {"sessionId": session_id, "members.userId": canonical_user_id},
        {"_id": 1, "name": 1, "leaderId": 1, "members": 1},
    ).to_list(length=200)

    deleted_team_ids: list[str] = []
    updated_team_ids: list[str] = []
    for team in team_docs:
        members = team.get("members") or []
        remaining = [m for m in members if str(m.get("userId") or "") != canonical_user_id]
        team_id = str(team.get("_id"))

        if not remaining:
            await db.iepod_submissions.delete_many({"sessionId": session_id, "teamId": team_id})
            await db.iepod_teams.delete_one({"_id": team.get("_id")})
            deleted_team_ids.append(team_id)
            continue

        updates = {
            "members": remaining,
            "updatedAt": datetime.now(timezone.utc),
        }
        if str(team.get("leaderId") or "") == canonical_user_id:
            updates["leaderId"] = str(remaining[0].get("userId") or "")
            updates["leaderName"] = remaining[0].get("userName") or "Team Lead"
        await db.iepod_teams.update_one({"_id": team.get("_id")}, {"$set": updates})
        updated_team_ids.append(team_id)

    await db.iepod_niche_audits.delete_many({"sessionId": session_id, "userId": canonical_user_id})
    await db.iepod_quiz_responses.delete_many({"sessionId": session_id, "userId": canonical_user_id})
    await db.iepod_live_quiz_participants.delete_many({"sessionId": session_id, "userId": canonical_user_id})
    await db.iepod_live_quiz_answers.delete_many({"sessionId": session_id, "userId": canonical_user_id})
    await db.iepod_points.delete_many({"sessionId": session_id, "userId": canonical_user_id})
    await db.iepod_quiz_points.delete_many({"sessionId": session_id, "userId": canonical_user_id})
    await db.iepod_registrations.delete_many(
        {
            "sessionId": session_id,
            "$or": [
                {"userId": {"$in": canonical_variants}},
                {"studentId": {"$in": canonical_variants}},
            ],
        }
    )

    if deleted_team_ids:
        await db.iepod_registrations.update_many(
            {"sessionId": session_id, "teamId": {"$in": deleted_team_ids}},
            {"$set": {"teamId": None, "updatedAt": datetime.now(timezone.utc)}},
        )

    if data.blockRejoin:
        await db.iepod_registration_blocks.update_one(
            {"sessionId": session_id, "userId": canonical_user_id},
            {
                "$set": {
                    "sessionId": session_id,
                    "userId": canonical_user_id,
                    "userEmail": (reg.get("userEmail") if reg else None) or (target_user.get("email") if target_user else None),
                    "reason": data.reason.strip(),
                    "blockedByUserId": str(user.get("_id")),
                    "blockedByEmail": user.get("email"),
                    "updatedAt": datetime.now(timezone.utc),
                },
                "$setOnInsert": {
                    "createdAt": datetime.now(timezone.utc),
                },
            },
            upsert=True,
        )
    else:
        await db.iepod_registration_blocks.delete_many({"sessionId": session_id, "userId": canonical_user_id})

    target_name = str(reg.get("userName") if reg else "").strip()
    if not target_name and target_user:
        target_name = f"{target_user.get('firstName', '')} {target_user.get('lastName', '')}".strip()

    await AuditLogger.log(
        action="iepod.user_data_reset",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_registration",
        resource_id=canonical_user_id,
        details={
            "student": target_name or canonical_user_id,
            "reason": data.reason.strip(),
            "blockRejoin": data.blockRejoin,
            "deletedTeams": deleted_team_ids,
            "updatedTeams": updated_team_ids,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {
        "message": "User IEPOD data reset completed",
        "userId": canonical_user_id,
        "userName": target_name or None,
        "blockRejoin": data.blockRejoin,
        "deletedTeams": len(deleted_team_ids),
        "updatedTeams": len(updated_team_ids),
    }


# ═══════════════════════════════════════════════════════════════════
# ADMIN STATS / DASHBOARD
# ═══════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_iepod_stats(
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: Get IEPOD program statistics."""
    db = get_database()
    session_id = str(session["_id"])

    reg_query = {"sessionId": session_id}

    total_registrations = await db.iepod_registrations.count_documents(reg_query)
    pending = await db.iepod_registrations.count_documents({**reg_query, "status": "pending"})
    approved = await db.iepod_registrations.count_documents({**reg_query, "status": "approved"})
    rejected = await db.iepod_registrations.count_documents({**reg_query, "status": "rejected"})
    completed = await db.iepod_registrations.count_documents({**reg_query, "status": "completed"})

    # Phase breakdown
    phase_stimulate = await db.iepod_registrations.count_documents({**reg_query, "phase": "stimulate"})
    phase_carve = await db.iepod_registrations.count_documents({**reg_query, "phase": "carve"})
    phase_pitch = await db.iepod_registrations.count_documents({**reg_query, "phase": "pitch"})

    total_teams = await db.iepod_teams.count_documents({"sessionId": session_id})
    total_submissions = await db.iepod_submissions.count_documents({"sessionId": session_id})
    total_quizzes = await db.iepod_quizzes.count_documents({"sessionId": session_id})
    total_niche_audits = await db.iepod_niche_audits.count_documents({"sessionId": session_id})
    total_societies = await db.iepod_societies.count_documents({"isActive": True})

    # Society breakdown
    society_pipeline = [
        {"$match": {**reg_query, "societyId": {"$ne": None}}},
        {"$group": {"_id": "$societyId", "count": {"$sum": 1}}},
    ]
    society_stats_raw = await db.iepod_registrations.aggregate(society_pipeline).to_list(100)

    hub_roles = await db.roles.find(
        {
            "sessionId": session_id,
            "position": "iepod_hub_lead",
            "isActive": True,
            "societyId": {"$exists": True, "$ne": None},
        },
        {"userId": 1, "societyId": 1, "createdAt": 1},
    ).to_list(length=500)
    hub_user_ids = [
        ObjectId(str(r.get("userId")))
        for r in hub_roles
        if r.get("userId") and ObjectId.is_valid(str(r.get("userId")))
    ]
    hub_user_map: dict[str, dict] = {}
    if hub_user_ids:
        hub_users = await db.users.find(
            {"_id": {"$in": hub_user_ids}},
            {"firstName": 1, "lastName": 1, "email": 1, "institutionalEmail": 1},
        ).to_list(length=1000)
        hub_user_map = {str(u["_id"]): u for u in hub_users}

    hub_by_society: dict[str, dict] = {}
    for role_doc in hub_roles:
        society_id = str(role_doc.get("societyId") or "").strip()
        user_id = str(role_doc.get("userId") or "").strip()
        if not society_id or not user_id:
            continue
        existing = hub_by_society.get(society_id)
        existing_created = existing.get("_createdAt") if existing else None
        created_at = role_doc.get("createdAt")
        if existing and existing_created and created_at and existing_created > created_at:
            continue

        user_doc = hub_user_map.get(user_id)
        full_name = ""
        email = ""
        if user_doc:
            full_name = f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip()
            email = user_doc.get("institutionalEmail") or user_doc.get("email") or ""

        hub_by_society[society_id] = {
            "name": full_name or None,
            "email": email or None,
            "_createdAt": created_at,
        }

    society_stats = []
    for s in society_stats_raw:
        soc = await db.iepod_societies.find_one({"_id": _oid(s["_id"])})
        lead = hub_by_society.get(str(s.get("_id") or ""))
        society_stats.append({
            "societyId": s["_id"],
            "societyName": soc["name"] if soc else "Unknown",
            "memberCount": s["count"],
            "hubLeadName": lead.get("name") if lead else None,
            "hubLeadEmail": lead.get("email") if lead else None,
        })

    return {
        "totalRegistrations": total_registrations,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "completed": completed,
        "phases": {
            "stimulate": phase_stimulate,
            "carve": phase_carve,
            "pitch": phase_pitch,
        },
        "totalTeams": total_teams,
        "totalSubmissions": total_submissions,
        "totalQuizzes": total_quizzes,
        "totalNicheAudits": total_niche_audits,
        "totalSocieties": total_societies,
        "societyBreakdown": society_stats,
    }
