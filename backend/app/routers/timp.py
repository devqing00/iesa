"""TIMP — The IESA Mentoring Project routes."""

from datetime import datetime, timezone
from typing import Optional
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..core.permissions import get_current_user, get_current_session, require_permission
from ..core.security import require_ipe_student
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
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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
# ADMIN: ENRICHED MENTOR & MENTEE CANDIDATE DATA
# ═══════════════════════════════════════════════════════════════════


@router.get("/admin/mentors")
async def get_enriched_mentors(
    search: Optional[str] = Query(None, description="Search by name"),
    user: dict = Depends(require_ipe_student),
    session: dict = Depends(get_current_session),
    _perm=Depends(require_permission("timp:manage")),
):
    """
    Get approved mentors with full user details + active pair counts.
    Used by the TIMP admin assignment page.
    """
    db = get_database()
    sid = str(session["_id"])

    query: dict = {"sessionId": sid, "status": "approved"}
    if search:
        query["userName"] = {"$regex": re.escape(search), "$options": "i"}

    apps = await db.timpApplications.find(query).sort("userName", 1).to_list(length=500)

    # Batch-fetch user docs and pair counts
    user_ids = [a["userId"] for a in apps]
    user_oids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
    users_cursor = db.users.find({"_id": {"$in": user_oids}})
    users_map = {str(u["_id"]): u async for u in users_cursor}

    # Count active pairs per mentor
    pipeline = [
        {"$match": {"mentorId": {"$in": user_ids}, "sessionId": sid, "status": "active"}},
        {"$group": {"_id": "$mentorId", "count": {"$sum": 1}}},
    ]
    pair_counts = {doc["_id"]: doc["count"] async for doc in db.timpPairs.aggregate(pipeline)}

    result = []
    for a in apps:
        u = users_map.get(a["userId"], {})
        result.append({
            "applicationId": str(a["_id"]),
            "userId": a["userId"],
            "userName": a["userName"],
            "email": u.get("email", ""),
            "matricNumber": u.get("matricNumber", ""),
            "level": u.get("currentLevel") or a.get("userLevel"),
            "phone": u.get("phone"),
            "skills": a["skills"],
            "availability": a["availability"],
            "motivation": a["motivation"],
            "maxMentees": a["maxMentees"],
            "activePairs": pair_counts.get(a["userId"], 0),
            "isFull": pair_counts.get(a["userId"], 0) >= a["maxMentees"],
            "profilePictureUrl": u.get("profilePictureUrl"),
        })

    return {"items": result, "total": len(result)}


@router.get("/admin/mentee-candidates")
async def get_mentee_candidates(
    search: Optional[str] = Query(None, description="Search by name or matric"),
    user: dict = Depends(require_ipe_student),
    session: dict = Depends(get_current_session),
    _perm=Depends(require_permission("timp:manage")),
):
    """
    Get 100L freshmen who are potential mentees.
    Excludes students already paired as mentees in the current session.
    """
    db = get_database()
    sid = str(session["_id"])

    # Get all 100L students
    user_query: dict = {"currentLevel": "100L"}
    if search:
        search_regex = {"$regex": re.escape(search), "$options": "i"}
        user_query["$or"] = [
            {"firstName": search_regex},
            {"lastName": search_regex},
            {"matricNumber": search_regex},
            {"email": search_regex},
        ]

    freshmen = await db.users.find(
        user_query,
        {"_id": 1, "firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1,
         "currentLevel": 1, "phone": 1, "profilePictureUrl": 1}
    ).sort("firstName", 1).to_list(length=1000)

    # Get IDs of students already paired as mentees this session
    paired_cursor = db.timpPairs.find(
        {"sessionId": sid, "status": {"$in": ["active", "paused"]}},
        {"menteeId": 1}
    )
    paired_ids = {doc["menteeId"] async for doc in paired_cursor}

    result = []
    for f in freshmen:
        uid = str(f["_id"])
        result.append({
            "userId": uid,
            "firstName": f.get("firstName", ""),
            "lastName": f.get("lastName", ""),
            "email": f.get("email", ""),
            "matricNumber": f.get("matricNumber", ""),
            "level": f.get("currentLevel", "100L"),
            "phone": f.get("phone"),
            "profilePictureUrl": f.get("profilePictureUrl"),
            "alreadyPaired": uid in paired_ids,
        })

    return {"items": result, "total": len(result)}


@router.get("/admin/user/{user_id}")
async def get_timp_user_details(
    user_id: str,
    user: dict = Depends(require_ipe_student),
    session: dict = Depends(get_current_session),
    _perm=Depends(require_permission("timp:manage")),
):
    """Get detailed info about a student for the TIMP admin view."""
    db = get_database()
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    sid = str(session["_id"])

    # Get TIMP application if exists
    app_doc = await db.timpApplications.find_one({"userId": user_id, "sessionId": sid})

    # Get active pairs
    pairs_cursor = db.timpPairs.find({
        "$or": [{"mentorId": user_id}, {"menteeId": user_id}],
        "sessionId": sid,
    })
    pairs = await pairs_cursor.to_list(length=20)

    return {
        "userId": user_id,
        "firstName": target.get("firstName", ""),
        "lastName": target.get("lastName", ""),
        "email": target.get("email", ""),
        "matricNumber": target.get("matricNumber", ""),
        "level": target.get("currentLevel"),
        "phone": target.get("phone"),
        "bio": target.get("bio"),
        "skills": target.get("skills", []),
        "profilePictureUrl": target.get("profilePictureUrl"),
        "application": _app_to_response(app_doc) if app_doc else None,
        "pairs": [_pair_to_response(p) for p in pairs],
    }


# ═══════════════════════════════════════════════════════════════════
# MENTORSHIP PAIRS
# ═══════════════════════════════════════════════════════════════════


@router.post("/pairs", response_model=PairResponse, status_code=201)
async def create_pair(
    data: CreatePairRequest,
    request: Request,
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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


# ═══════════════════════════════════════════════════════════════════
# ADMIN ANALYTICS
# ═══════════════════════════════════════════════════════════════════

@router.get("/analytics")
async def get_timp_analytics(
    user: dict = Depends(require_permission("timp:manage")),
):
    """TIMP programme health dashboard."""
    db = get_database()
    session = await get_current_session(db)
    sid = str(session["_id"])

    import asyncio

    (
        total_apps,
        pending_apps,
        approved_apps,
        rejected_apps,
        active_pairs,
        paused_pairs,
        completed_pairs,
        total_feedback,
        avg_rating_result,
    ) = await asyncio.gather(
        db.timpApplications.count_documents({"sessionId": sid}),
        db.timpApplications.count_documents({"sessionId": sid, "status": "pending"}),
        db.timpApplications.count_documents({"sessionId": sid, "status": "approved"}),
        db.timpApplications.count_documents({"sessionId": sid, "status": "rejected"}),
        db.timpPairs.count_documents({"sessionId": sid, "status": "active"}),
        db.timpPairs.count_documents({"sessionId": sid, "status": "paused"}),
        db.timpPairs.count_documents({"sessionId": sid, "status": "completed"}),
        db.timpFeedback.count_documents({"sessionId": sid}),
        db.timpFeedback.aggregate([
            {"$match": {"sessionId": sid}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}}},
        ]).to_list(length=1),
    )

    avg_rating = round(avg_rating_result[0]["avg"], 1) if avg_rating_result else 0

    return {
        "applications": {
            "total": total_apps,
            "pending": pending_apps,
            "approved": approved_apps,
            "rejected": rejected_apps,
            "approvalRate": round(approved_apps / total_apps * 100, 1) if total_apps else 0,
        },
        "pairs": {
            "active": active_pairs,
            "paused": paused_pairs,
            "completed": completed_pairs,
            "total": active_pairs + paused_pairs + completed_pairs,
        },
        "feedback": {
            "total": total_feedback,
            "averageRating": avg_rating,
        },
    }


# ═══════════════════════════════════════════════════════════════════
# MENTOR-MENTEE MESSAGING
# ═══════════════════════════════════════════════════════════════════

class TimpMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


@router.post("/pairs/{pair_id}/messages")
async def send_pair_message(
    pair_id: str,
    data: TimpMessageCreate,
    user: dict = Depends(require_ipe_student),
):
    """Send a message within a mentor-mentee pair."""
    db = get_database()
    uid = str(user["_id"])

    if not ObjectId.is_valid(pair_id):
        raise HTTPException(status_code=400, detail="Invalid pair ID")

    pair = await db.timpPairs.find_one({"_id": ObjectId(pair_id)})
    if not pair:
        raise HTTPException(status_code=404, detail="Pair not found")

    # Only mentor or mentee of this pair can send messages
    if uid not in (pair["mentorId"], pair["menteeId"]):
        raise HTTPException(status_code=403, detail="You are not part of this pair")

    msg = {
        "pairId": pair_id,
        "senderId": uid,
        "senderName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "senderRole": "mentor" if uid == pair["mentorId"] else "mentee",
        "content": data.content,
        "createdAt": datetime.now(timezone.utc),
    }
    await db.timpMessages.insert_one(msg)

    # Notify the other party
    recipient_id = pair["menteeId"] if uid == pair["mentorId"] else pair["mentorId"]
    try:
        from app.routers.notifications import create_notification
        await create_notification(
            user_id=recipient_id,
            type="timp_message",
            title=f"New message from {msg['senderName']}",
            message=data.content[:100],
            link="/dashboard/timp",
            category="mentoring",
        )
    except Exception:
        pass

    return {"message": "Message sent"}


@router.get("/pairs/{pair_id}/messages")
async def get_pair_messages(
    pair_id: str,
    user: dict = Depends(require_ipe_student),
    limit: int = Query(50, ge=1, le=200),
):
    """Get messages for a mentor-mentee pair."""
    db = get_database()
    uid = str(user["_id"])

    if not ObjectId.is_valid(pair_id):
        raise HTTPException(status_code=400, detail="Invalid pair ID")

    pair = await db.timpPairs.find_one({"_id": ObjectId(pair_id)})
    if not pair:
        raise HTTPException(status_code=404, detail="Pair not found")

    # Only mentor, mentee, or admin can read messages
    has_manage = False
    try:
        from ..core.permissions import get_user_permissions
        perms = await get_user_permissions(uid)
        has_manage = "timp:manage" in perms
    except Exception:
        pass

    if uid not in (pair["mentorId"], pair["menteeId"]) and not has_manage:
        raise HTTPException(status_code=403, detail="Access denied")

    cursor = db.timpMessages.find({"pairId": pair_id}).sort("createdAt", -1).limit(limit)
    messages = []
    async for m in cursor:
        m["_id"] = str(m["_id"])
        messages.append(m)
    messages.reverse()  # chronological order
    return messages
