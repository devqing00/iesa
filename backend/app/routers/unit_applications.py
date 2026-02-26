"""
Unit Applications Router

Endpoints:
  POST   /api/v1/unit-applications/          — Student submits an application
  GET    /api/v1/unit-applications/my         — Student views their own applications
  GET    /api/v1/unit-applications/            — Admin/unit head views all applications (filterable)
  PATCH  /api/v1/unit-applications/{id}/review — Unit head reviews (accept/reject)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId

from app.core.security import get_current_user
from app.core.permissions import get_current_session, require_permission
from app.core.audit import AuditLogger
from app.db import get_database
from app.models.unit_application import (
    UnitApplicationCreate,
    UnitApplicationReview,
    UnitApplicationResponse,
    UnitType,
    UNIT_LABELS,
)

router = APIRouter(prefix="/api/v1/unit-applications", tags=["unit-applications"])


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc["_id"])
    doc["unitLabel"] = UNIT_LABELS.get(doc.get("unit", ""), doc.get("unit", ""))
    return doc


@router.post("/", response_model=UnitApplicationResponse)
async def create_application(
    body: UnitApplicationCreate,
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    # Check if user already has a pending/accepted application for this unit in this session
    existing = await db["unit_applications"].find_one({
        "userId": user_id,
        "unit": body.unit.value,
        "sessionId": session_id,
        "status": {"$in": ["pending", "accepted"]},
    })
    if existing:
        if existing["status"] == "pending":
            raise HTTPException(400, "You already have a pending application for this unit")
        else:
            raise HTTPException(400, "You are already a member of this unit")

    now = datetime.now(timezone.utc)
    doc = {
        "userId": user_id,
        "userName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "userEmail": user.get("email", ""),
        "userLevel": user.get("currentLevel") or user.get("level"),
        "unit": body.unit.value,
        "motivation": body.motivation,
        "skills": body.skills,
        "status": "pending",
        "feedback": None,
        "reviewedBy": None,
        "reviewerName": None,
        "sessionId": session_id,
        "createdAt": now,
        "reviewedAt": None,
    }

    result = await db["unit_applications"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return UnitApplicationResponse(**_serialize(doc))


@router.get("/my", response_model=list[UnitApplicationResponse])
async def my_applications(
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    cursor = db["unit_applications"].find({
        "userId": user_id,
        "sessionId": session_id,
    }).sort("createdAt", -1)

    docs = await cursor.to_list(length=100)
    return [UnitApplicationResponse(**_serialize(d)) for d in docs]


@router.get("/", response_model=None)
async def list_applications(
    unit: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by student name or email"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user=Depends(require_permission("unit_application:review")),
    session=Depends(get_current_session),
):
    """List applications. Requires unit_application:review permission."""
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    query: dict = {"sessionId": session_id}

    if unit:
        query["unit"] = unit
    if status:
        query["status"] = status
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"userName": search_regex},
            {"userEmail": search_regex},
        ]

    total = await db["unit_applications"].count_documents(query)
    cursor = db["unit_applications"].find(query).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"items": [UnitApplicationResponse(**_serialize(d)) for d in docs], "total": total}


@router.patch("/{application_id}/review", response_model=UnitApplicationResponse)
async def review_application(
    application_id: str,
    body: UnitApplicationReview,
    request: Request,
    user=Depends(require_permission("unit_application:review")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = user.get("_id") or user.get("id")

    if body.status.value == "pending":
        raise HTTPException(400, "Cannot set status back to pending")

    try:
        oid = ObjectId(application_id)
    except Exception:
        raise HTTPException(400, "Invalid application ID")

    app_doc = await db["unit_applications"].find_one({"_id": oid})
    if not app_doc:
        raise HTTPException(404, "Application not found")

    if app_doc["status"] != "pending":
        raise HTTPException(400, f"Application already {app_doc['status']}")

    now = datetime.now(timezone.utc)
    reviewer_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    update = {
        "$set": {
            "status": body.status.value,
            "feedback": body.feedback,
            "reviewedBy": user_id,
            "reviewerName": reviewer_name,
            "reviewedAt": now,
        }
    }

    await db["unit_applications"].update_one({"_id": oid}, update)

    # If accepted, grant unit member role with appropriate permissions
    if body.status.value == "accepted":
        unit = app_doc["unit"]
        # Map unit → role position and permissions
        UNIT_ROLE_MAP = {
            "press": {
                "position": "press_member",
                "permissions": ["press:access", "press:create"],
            },
            "committee_academic": {
                "position": "committee_academic_member",
                "permissions": ["announcement:view", "event:view"],
            },
            "committee_welfare": {
                "position": "committee_welfare_member",
                "permissions": ["announcement:view"],
            },
            "committee_sports": {
                "position": "committee_sports_member",
                "permissions": ["announcement:view", "event:view"],
            },
            "committee_socials": {
                "position": "committee_socials_member",
                "permissions": ["announcement:view", "event:view"],
            },
        }
        role_info = UNIT_ROLE_MAP.get(unit)
        if role_info:
            existing_role = await db["roles"].find_one({
                "userId": app_doc["userId"],
                "sessionId": app_doc["sessionId"],
                "position": role_info["position"],
                "isActive": True,
            })
            if not existing_role:
                await db["roles"].insert_one({
                    "userId": app_doc["userId"],
                    "sessionId": app_doc["sessionId"],
                    "position": role_info["position"],
                    "permissions": role_info["permissions"],
                    "assignedBy": user_id,
                    "isActive": True,
                    "createdAt": now,
                    "updatedAt": now,
                })

    updated = await db["unit_applications"].find_one({"_id": oid})
    
    # Audit log
    await AuditLogger.log(
        action=f"unit_application.{body.status.value}",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="unit_application",
        resource_id=application_id,
        session_id=app_doc.get("sessionId"),
        details={"unit": app_doc["unit"], "status": body.status.value, "feedback": body.feedback},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return UnitApplicationResponse(**_serialize(updated))
