"""TIMP — The IESA Mentoring Project routes."""

from datetime import datetime, timezone
from typing import Optional
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..core.permissions import get_current_user, get_current_session, require_permission
from ..core.audit import AuditLogger
from ..db import get_database
from ..models.timp import (
    MentorApplicationCreate,
    MentorApplicationResponse,
    MentorApplicationReview,
    MentorApplicationStatus,
    CreatePairRequest,
    PairResponse,
    PairStatus,
    FeedbackCreate,
    FeedbackResponse,
)

router = APIRouter(prefix="/api/v1/timp", tags=["TIMP Mentoring"])


# ── Helper ────────────────────────────────────────────────────────


def _app_to_response(doc: dict) -> MentorApplicationResponse:
    return MentorApplicationResponse(
        id=str(doc["_id"]),
        userId=doc["userId"],
        userName=doc["userName"],
        userLevel=doc.get("userLevel"),
        motivation=doc["motivation"],
        skills=doc["skills"],
        availability=doc["availability"],
        maxMentees=doc["maxMentees"],
        status=doc["status"],
        feedback=doc.get("feedback"),
        sessionId=doc["sessionId"],
        reviewedBy=doc.get("reviewedBy"),
        createdAt=doc["createdAt"],
        updatedAt=doc.get("updatedAt"),
    )


def _pair_to_response(doc: dict) -> PairResponse:
    return PairResponse(
        id=str(doc["_id"]),
        mentorId=doc["mentorId"],
        mentorName=doc["mentorName"],
        menteeId=doc["menteeId"],
        menteeName=doc["menteeName"],
        status=doc["status"],
        sessionId=doc["sessionId"],
        feedbackCount=doc.get("feedbackCount", 0),
        createdAt=doc["createdAt"],
        updatedAt=doc.get("updatedAt"),
    )


def _fb_to_response(doc: dict) -> FeedbackResponse:
    return FeedbackResponse(
        id=str(doc["_id"]),
        pairId=doc["pairId"],
        submittedBy=doc["submittedBy"],
        submitterName=doc["submitterName"],
        submitterRole=doc["submitterRole"],
        rating=doc["rating"],
        notes=doc["notes"],
        concerns=doc.get("concerns"),
        topicsCovered=doc.get("topicsCovered"),
        weekNumber=doc["weekNumber"],
        createdAt=doc["createdAt"],
    )


# ═══════════════════════════════════════════════════════════════════
# SETTINGS — form open/close toggle
# ═══════════════════════════════════════════════════════════════════


@router.get("/settings")
async def get_timp_settings(
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get TIMP settings (form open status) for the current session."""
    db = get_database()
    sid = str(session["_id"])
    settings = await db.timpSettings.find_one({"sessionId": sid})
    return {"formOpen": settings.get("formOpen", True) if settings else True}


@router.patch("/settings", dependencies=[Depends(require_permission("timp:manage"))])
async def update_timp_settings(
    request: Request,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
    formOpen: bool = Query(..., description="Whether the TIMP application form is open"),
):
    """Toggle the TIMP application form open/closed. Requires timp:manage."""
    db = get_database()
    sid = str(session["_id"])
    await db.timpSettings.update_one(
        {"sessionId": sid},
        {"$set": {"formOpen": formOpen, "updatedAt": datetime.now(timezone.utc)}},
        upsert=True,
    )

    await AuditLogger.log(
        action="timp.settings_updated",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="timp_settings",
        resource_id=sid,
        details={"formOpen": formOpen},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"formOpen": formOpen}


# ═══════════════════════════════════════════════════════════════════
# MENTOR APPLICATIONS
# ═══════════════════════════════════════════════════════════════════


@router.post("/apply", response_model=MentorApplicationResponse, status_code=201)
async def apply_as_mentor(
    data: MentorApplicationCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student applies to be a TIMP mentor."""
    db = get_database()
    uid = str(user["_id"])
    sid = str(session["_id"])

    # Check if TIMP application form is open
    settings = await db.timpSettings.find_one({"sessionId": sid})
    if settings and not settings.get("formOpen", True):
        raise HTTPException(
            status_code=400,
            detail="TIMP mentor applications are currently closed",
        )

    # Check student level — only 200L and above can apply as mentors
    user_level = user.get("level") or user.get("currentLevel")
    level_num = None
    if user_level:
        try:
            level_str = str(user_level).replace("L", "").replace("l", "").strip()
            level_num = int(level_str)
        except (ValueError, TypeError):
            pass
    if level_num is not None and level_num < 200:
        raise HTTPException(
            status_code=400,
            detail="Only students in 200 level and above can apply as mentors. 100L students will be matched with mentors by the TIMP lead.",
        )

    # Check if already has pending/approved application this session
    existing = await db.timpApplications.find_one({
        "userId": uid,
        "sessionId": sid,
        "status": {"$in": ["pending", "approved"]},
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have an active mentor application for this session",
        )

    doc = {
        "userId": uid,
        "userName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "userLevel": user.get("level") or user.get("currentLevel"),
        "motivation": data.motivation,
        "skills": data.skills,
        "availability": data.availability,
        "maxMentees": data.maxMentees,
        "status": MentorApplicationStatus.pending.value,
        "feedback": None,
        "sessionId": sid,
        "reviewedBy": None,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": None,
    }
    result = await db.timpApplications.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _app_to_response(doc)


@router.get("/applications")
async def list_mentor_applications(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by applicant name"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
    _perm=Depends(require_permission("timp:manage")),
):
    """TIMP lead lists mentor applications for the current session."""
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if status:
        query["status"] = status
    if search:
        query["userName"] = {"$regex": re.escape(search), "$options": "i"}
    total = await db.timpApplications.count_documents(query)
    cursor = db.timpApplications.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"items": [_app_to_response(d) for d in docs], "total": total}


@router.patch("/applications/{app_id}/review", response_model=MentorApplicationResponse)
async def review_mentor_application(
    app_id: str,
    data: MentorApplicationReview,
    request: Request,
    user: dict = Depends(get_current_user),
    _perm=Depends(require_permission("timp:manage")),
):
    """TIMP lead approves or rejects a mentor application."""
    db = get_database()
    if not ObjectId.is_valid(app_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")

    result = await db.timpApplications.find_one_and_update(
        {"_id": ObjectId(app_id)},
        {
            "$set": {
                "status": data.status.value,
                "feedback": data.feedback,
                "reviewedBy": str(user["_id"]),
                "updatedAt": datetime.now(timezone.utc),
            }
        },
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Application not found")

    await AuditLogger.log(
        action=f"timp.application_{data.status.value}",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="timp_application",
        resource_id=app_id,
        details={"status": data.status.value, "applicant": result.get("userName"), "feedback": data.feedback},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return _app_to_response(result)


@router.get("/my-application", response_model=Optional[MentorApplicationResponse])
async def get_my_application(
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get the current user's mentor application for this session."""
    db = get_database()
    doc = await db.timpApplications.find_one({
        "userId": str(user["_id"]),
        "sessionId": str(session["_id"]),
    })
    if not doc:
        return None
    return _app_to_response(doc)


# ═══════════════════════════════════════════════════════════════════
# MENTORSHIP PAIRS
# ═══════════════════════════════════════════════════════════════════


@router.post("/pairs", response_model=PairResponse, status_code=201)
async def create_pair(
    data: CreatePairRequest,
    request: Request,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
    _perm=Depends(require_permission("timp:manage")),
):
    """TIMP lead creates a mentor-mentee pair."""
    db = get_database()
    sid = str(session["_id"])

    # Verify mentor is approved
    mentor_app = await db.timpApplications.find_one({
        "userId": data.mentorId,
        "sessionId": sid,
        "status": "approved",
    })
    if not mentor_app:
        raise HTTPException(status_code=400, detail="Mentor has no approved application")

    # Count existing active pairs for this mentor
    active_count = await db.timpPairs.count_documents({
        "mentorId": data.mentorId,
        "sessionId": sid,
        "status": PairStatus.active.value,
    })
    if active_count >= mentor_app.get("maxMentees", 2):
        raise HTTPException(
            status_code=400,
            detail=f"Mentor already has {active_count} active mentees (max: {mentor_app.get('maxMentees', 2)})",
        )

    # Check duplicate pair
    existing = await db.timpPairs.find_one({
        "mentorId": data.mentorId,
        "menteeId": data.menteeId,
        "sessionId": sid,
        "status": {"$in": ["active", "paused"]},
    })
    if existing:
        raise HTTPException(status_code=400, detail="This pair already exists")

    # Get user names
    mentor = await db.users.find_one({"_id": ObjectId(data.mentorId)})
    mentee = await db.users.find_one({"_id": ObjectId(data.menteeId)})
    if not mentor or not mentee:
        raise HTTPException(status_code=404, detail="Mentor or mentee user not found")

    doc = {
        "mentorId": data.mentorId,
        "mentorName": f"{mentor.get('firstName', '')} {mentor.get('lastName', '')}".strip(),
        "menteeId": data.menteeId,
        "menteeName": f"{mentee.get('firstName', '')} {mentee.get('lastName', '')}".strip(),
        "status": PairStatus.active.value,
        "sessionId": sid,
        "feedbackCount": 0,
        "createdBy": str(user["_id"]),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": None,
    }
    result = await db.timpPairs.insert_one(doc)
    doc["_id"] = result.inserted_id

    await AuditLogger.log(
        action="timp.pair_created",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="timp_pair",
        resource_id=str(result.inserted_id),
        details={"mentor": doc["mentorName"], "mentee": doc["menteeName"]},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return _pair_to_response(doc)


@router.get("/pairs")
async def list_pairs(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by mentor or mentee name"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """List mentorship pairs. TIMP leads see all; others see only their own."""
    db = get_database()
    uid = str(user["_id"])
    sid = str(session["_id"])
    role = user.get("role", "student")

    query: dict = {"sessionId": sid}
    if status:
        query["status"] = status
    if search:
        search_regex = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [{"mentorName": search_regex}, {"menteeName": search_regex}]

    # Non-admin/exco users only see pairs they're part of
    if role not in ("admin", "exco"):
        query["$or"] = [{"mentorId": uid}, {"menteeId": uid}]

    total = await db.timpPairs.count_documents(query)
    cursor = db.timpPairs.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"items": [_pair_to_response(d) for d in docs], "total": total}


@router.patch("/pairs/{pair_id}/status")
async def update_pair_status(
    pair_id: str,
    status: PairStatus,
    request: Request,
    user: dict = Depends(get_current_user),
    _perm=Depends(require_permission("timp:manage")),
):
    """Update pair status (pause, complete, reactivate)."""
    db = get_database()
    if not ObjectId.is_valid(pair_id):
        raise HTTPException(status_code=400, detail="Invalid pair ID")

    result = await db.timpPairs.find_one_and_update(
        {"_id": ObjectId(pair_id)},
        {"$set": {"status": status.value, "updatedAt": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Pair not found")

    await AuditLogger.log(
        action=f"timp.pair_{status.value}",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="timp_pair",
        resource_id=pair_id,
        details={"status": status.value, "mentor": result.get("mentorName"), "mentee": result.get("menteeName")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return _pair_to_response(result)


# ═══════════════════════════════════════════════════════════════════
# WEEKLY FEEDBACK
# ═══════════════════════════════════════════════════════════════════


@router.post("/pairs/{pair_id}/feedback", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    pair_id: str,
    data: FeedbackCreate,
    user: dict = Depends(get_current_user),
):
    """Submit weekly feedback for a mentorship pair."""
    db = get_database()
    if not ObjectId.is_valid(pair_id):
        raise HTTPException(status_code=400, detail="Invalid pair ID")

    pair = await db.timpPairs.find_one({"_id": ObjectId(pair_id)})
    if not pair:
        raise HTTPException(status_code=404, detail="Pair not found")

    uid = str(user["_id"])
    if uid == pair["mentorId"]:
        role = "mentor"
    elif uid == pair["menteeId"]:
        role = "mentee"
    else:
        raise HTTPException(status_code=403, detail="You are not part of this mentorship pair")

    if pair["status"] != PairStatus.active.value:
        raise HTTPException(status_code=400, detail="This pair is not currently active")

    # Calculate week number since pair creation
    days_since = (datetime.now(timezone.utc) - pair["createdAt"]).days
    week_number = (days_since // 7) + 1

    # Check if already submitted this week
    existing = await db.timpFeedback.find_one({
        "pairId": pair_id,
        "submittedBy": uid,
        "weekNumber": week_number,
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"You already submitted feedback for week {week_number}")

    doc = {
        "pairId": pair_id,
        "submittedBy": uid,
        "submitterName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "submitterRole": role,
        "rating": data.rating,
        "notes": data.notes,
        "concerns": data.concerns,
        "topicsCovered": data.topicsCovered,
        "weekNumber": week_number,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.timpFeedback.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Increment feedback count on pair
    await db.timpPairs.update_one(
        {"_id": ObjectId(pair_id)},
        {"$inc": {"feedbackCount": 1}},
    )

    return _fb_to_response(doc)


@router.get("/pairs/{pair_id}/feedback", response_model=list[FeedbackResponse])
async def get_pair_feedback(
    pair_id: str,
    user: dict = Depends(get_current_user),
):
    """Get feedback history for a mentorship pair."""
    db = get_database()
    if not ObjectId.is_valid(pair_id):
        raise HTTPException(status_code=400, detail="Invalid pair ID")

    pair = await db.timpPairs.find_one({"_id": ObjectId(pair_id)})
    if not pair:
        raise HTTPException(status_code=404, detail="Pair not found")

    uid = str(user["_id"])
    role = user.get("role", "student")
    # Only pair members or admins/exco can see feedback
    if role not in ("admin", "exco") and uid not in (pair["mentorId"], pair["menteeId"]):
        raise HTTPException(status_code=403, detail="Access denied")

    cursor = db.timpFeedback.find({"pairId": pair_id}).sort("weekNumber", 1)
    docs = await cursor.to_list(length=100)
    return [_fb_to_response(d) for d in docs]


# ═══════════════════════════════════════════════════════════════════
# MY TIMP INFO
# ═══════════════════════════════════════════════════════════════════


@router.get("/my")
async def get_my_timp_info(
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get the current user's full TIMP involvement — application + pairs."""
    db = get_database()
    uid = str(user["_id"])
    sid = str(session["_id"])

    application = await db.timpApplications.find_one({
        "userId": uid,
        "sessionId": sid,
    })

    pairs_cursor = db.timpPairs.find({
        "$or": [{"mentorId": uid}, {"menteeId": uid}],
        "sessionId": sid,
    }).sort("createdAt", -1)
    pairs = await pairs_cursor.to_list(length=20)

    # Get form open status
    settings = await db.timpSettings.find_one({"sessionId": sid})
    form_open = settings.get("formOpen", True) if settings else True

    # Get user level info
    user_level = user.get("level") or user.get("currentLevel")
    level_num = None
    if user_level:
        try:
            level_str = str(user_level).replace("L", "").replace("l", "").strip()
            level_num = int(level_str)
        except (ValueError, TypeError):
            pass

    return {
        "application": _app_to_response(application) if application else None,
        "pairs": [_pair_to_response(p) for p in pairs],
        "isMentor": application is not None and application["status"] == "approved",
        "isMentee": any(p["menteeId"] == uid for p in pairs),
        "formOpen": form_open,
        "userLevel": level_num,
    }
