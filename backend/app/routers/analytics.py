from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.db import get_database
import asyncio
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics & Early Warning"])

@router.get("/at-risk-students")
async def get_at_risk_students(
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("admin:dashboard")),
):
    """
    Fetch students who are 'at risk' based on:
    - Missed mandatory payments
    - Inactivity (lastLogin > 14 days ago)
    - Low engagement (Not in any study groups)
    
    Returns a sorted list of students by their calculated risk score.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    fourteen_days_ago = now - timedelta(days=14)

    # 1. Fetch active session
    active_session = await db["sessions"].find_one({"isActive": True})
    if not active_session:
        return {"error": "No active session found", "students": []}
    
    session_id = str(active_session["_id"])

    # 2. Fetch all mandatory payments for the active session
    mandatory_payments = await db["payments"].find(
        {"sessionId": session_id, "mandatory": True}
    ).to_list(length=100)
    
    # 3. Fetch all active enrollments for the current session
    enrollments = await db["enrollments"].find(
        {"sessionId": session_id, "isActive": True}
    ).to_list(length=5000)

    student_ids = []
    for enr in enrollments:
        sid = enr.get("studentId") or enr.get("userId")
        if sid:
            student_ids.append(str(sid))
            
    if not student_ids:
        return {"students": []}

    # 4. Fetch the users
    from bson import ObjectId
    object_ids = []
    for sid in student_ids:
        if ObjectId.is_valid(sid):
            object_ids.append(ObjectId(sid))

    users_cursor = db["users"].find(
        {"_id": {"$in": object_ids}},
        {"firstName": 1, "lastName": 1, "email": 1, "currentLevel": 1, "lastLogin": 1, "profilePictureUrl": 1, "profilePhotoURL": 1}
    )
    users = {str(u["_id"]): u async for u in users_cursor}

    # 5. Fetch study group memberships
    groups = await db["study_groups"].find({"isActive": True}).to_list(length=1000)
    users_in_groups = set()
    for g in groups:
        for m in g.get("members", []):
            uid = m.get("userId")
            if uid:
                users_in_groups.add(str(uid))

    # 6. Calculate risk scores
    at_risk_list = []
    
    for uid_str in student_ids:
        if uid_str not in users:
            continue
            
        user = users[uid_str]
        risk_score = 0
        risk_factors = []
        
        # Factor A: Unpaid mandatory dues
        unpaid_count = 0
        for p in mandatory_payments:
            paid_by = [str(x) for x in p.get("paidBy", [])]
            if uid_str not in paid_by:
                unpaid_count += 1
                
        if unpaid_count > 0:
            risk_score += unpaid_count * 15
            risk_factors.append(f"{unpaid_count} unpaid mandatory due(s)")
            
        # Factor B: Inactivity
        last_login = user.get("lastLogin")
        if not last_login:
            risk_score += 40
            risk_factors.append("Never logged in")
        else:
            # Ensure timezone awareness for comparison
            if last_login.tzinfo is None:
                last_login = last_login.replace(tzinfo=timezone.utc)
            days_inactive = (now - last_login).days
            if days_inactive >= 14:
                risk_score += 30
                risk_factors.append(f"Inactive for {days_inactive} days")
                
        # Factor C: Low Engagement
        if uid_str not in users_in_groups:
            risk_score += 10
            risk_factors.append("Not in any study groups")
            
        # Classify risk level
        risk_level = "Low"
        if risk_score >= 40:
            risk_level = "High"
        elif risk_score >= 20:
            risk_level = "Medium"
            
        # Only include if they have some risk
        if risk_score > 0:
            at_risk_list.append({
                "id": uid_str,
                "firstName": user.get("firstName", "Unknown"),
                "lastName": user.get("lastName", "Student"),
                "email": user.get("email", ""),
                "level": user.get("currentLevel", "N/A"),
                "profileUrl": user.get("profilePictureUrl") or user.get("profilePhotoURL"),
                "riskScore": risk_score,
                "riskLevel": risk_level,
                "riskFactors": risk_factors,
                "lastLogin": last_login.isoformat() if last_login else None
            })
            
    # Sort by risk score descending
    at_risk_list.sort(key=lambda x: x["riskScore"], reverse=True)
    
    return {"students": at_risk_list[:100]}  # Top 100 at risk
