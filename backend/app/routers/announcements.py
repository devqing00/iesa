"""
Announcements Router - Session-Aware Communications

CRITICAL: All announcements are session-scoped.
Announcements are specific to an academic session and can be targeted to specific levels.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import asyncio
import logging
import re
from pydantic import BaseModel
from app.core.error_handling import fire_and_forget

from app.models.announcement import (
    Announcement, AnnouncementCreate, AnnouncementUpdate, AnnouncementWithStatus, Attachment
)
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission, require_any_permission
from app.core.sanitization import sanitize_html, validate_no_scripts
from app.core.audit import AuditLogger
from app.core.email import send_announcement_email
from app.core.notification_utils import get_notification_emails, should_send_email, should_send_in_app
from app.models.team_application import TEAM_TO_HEAD_POSITION
from app.utils.cloudinary_config import upload_announcement_media

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/announcements", tags=["Announcements"])

def _normalize_levels(levels: list) -> list:
    """
    Normalise level values to canonical '\u202fNL' string format.
    Handles legacy integer levels (300 → '300L') and existing strings ('300L' → '300L').
    """
    out = []
    for lv in levels:
        s = str(lv).strip()
        if s.isdigit():
            out.append(f"{s}L")
        elif s.upper().endswith("L") and s[:-1].isdigit():
            out.append(s)  # already canonical
        else:
            out.append(s)
    return out


TEAM_HEAD_POSITIONS = set(TEAM_TO_HEAD_POSITION.values())


def _is_team_lead_position(position: str) -> bool:
    return position in TEAM_HEAD_POSITIONS or position.startswith("team_head_custom_")


def _position_matches_audience(position: str, target_audience: str) -> bool:
    if target_audience == "team_leads_only":
        return _is_team_lead_position(position)
    if target_audience == "class_rep_and_assistant":
        return position.startswith("class_rep_") or position.startswith("asst_class_rep_")
    return False


async def _resolve_target_user_ids(
    db,
    *,
    session_id: str,
    target_levels: list[str],
    target_audience: str,
    target_user_ids: list[str],
    custom_emails: list[str] | None = None,
) -> list[str]:
    users_col = db["users"]
    enrollments_col = db["enrollments"]
    roles_col = db["roles"]

    if target_audience == "custom_emails":
        if not custom_emails:
            return []
        cleaned_emails = [e.strip().lower() for e in custom_emails if e and "@" in e]
        if not cleaned_emails:
            return []
        docs = await users_col.find(
            {
                "$or": [
                    {"email": {"$in": cleaned_emails}},
                    {"secondaryEmail": {"$in": cleaned_emails}},
                ]
            },
            {"_id": 1}
        ).to_list(length=None)
        return [str(doc["_id"]) for doc in docs]

    if target_audience == "specific_students":
        valid_ids = [uid for uid in target_user_ids if ObjectId.is_valid(uid)]
        if not valid_ids:
            return []
        docs = await users_col.find(
            {"_id": {"$in": [ObjectId(uid) for uid in valid_ids]}},
            {"_id": 1},
        ).to_list(length=None)
        return [str(doc["_id"]) for doc in docs]

    if target_audience == "exco_only":
        docs = await users_col.find({"role": "exco"}, {"_id": 1}).to_list(length=None)
        return [str(doc["_id"]) for doc in docs]

    if target_audience in {"team_leads_only", "class_rep_and_assistant"}:
        role_docs = await roles_col.find(
            {"sessionId": session_id, "isActive": True},
            {"userId": 1, "position": 1},
        ).to_list(length=None)
        matched = {
            str(role_doc.get("userId"))
            for role_doc in role_docs
            if _position_matches_audience(str(role_doc.get("position", "")), target_audience)
            and role_doc.get("userId")
        }
        return list(matched)

    if target_levels:
        enrolled = await enrollments_col.find(
            {"sessionId": session_id, "level": {"$in": target_levels}, "isActive": True}
        ).to_list(length=None)
    else:
        enrolled = await enrollments_col.find(
            {"sessionId": session_id, "isActive": True}
        ).to_list(length=None)

    user_ids = list({str(e.get("studentId") or e.get("userId") or e["_id"]) for e in enrolled})

    if not user_ids and not target_levels:
        logger.warning("[NOTIF] No enrollments for session %s — using all student users", session_id)
        all_students = await users_col.find({"role": "student"}, {"_id": 1}).to_list(length=None)
        user_ids = [str(u["_id"]) for u in all_students]

    if target_audience in {"all", "specific_levels"}:
        return user_ids

    if not user_ids:
        return []

    dept_query: dict = {"_id": {"$in": [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]}}
    if target_audience == "ipe":
        dept_query["department"] = "Industrial Engineering"
    elif target_audience == "external":
        dept_query["department"] = {"$ne": "Industrial Engineering"}
    matched = await users_col.find(dept_query, {"_id": 1}).to_list(length=None)
    return [str(u["_id"]) for u in matched]


async def _user_matches_target_audience(
    db,
    *,
    user_id: str,
    user_role: str,
    user_department: str,
    session_id: str,
    target_audience: str,
    target_user_ids: list[str],
    user_positions: list[str] | None = None,
    custom_emails: list[str] | None = None,
    user_email: str | None = None,
) -> bool:
    if target_audience in {"all", "specific_levels"}:
        return True
    if target_audience == "custom_emails":
        if not custom_emails:
            return False
        cleaned_custom = {e.lower().strip() for e in custom_emails if e and "@" in e}
        if user_email and user_email.lower().strip() in cleaned_custom:
            return True
        user_doc = await db["users"].find_one(
            {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
            {"email": 1, "secondaryEmail": 1}
        )
        if user_doc:
            u_email = (user_doc.get("email") or "").lower().strip()
            u_sec = (user_doc.get("secondaryEmail") or "").lower().strip()
            return (u_email in cleaned_custom) or (u_sec in cleaned_custom)
        return False
    if target_audience == "ipe":
        return user_department == "Industrial Engineering"
    if target_audience == "external":
        return user_department != "Industrial Engineering"
    if target_audience == "specific_students":
        return user_id in set(target_user_ids or [])
    if target_audience == "exco_only":
        return user_role == "exco"

    positions = user_positions or []
    if not positions and target_audience in {"team_leads_only", "class_rep_and_assistant"}:
        role_docs = await db["roles"].find(
            {"userId": user_id, "sessionId": session_id, "isActive": True},
            {"position": 1},
        ).to_list(length=None)
        positions = [str(doc.get("position", "")) for doc in role_docs]

    if target_audience == "team_leads_only":
        return any(_is_team_lead_position(pos) for pos in positions)
    if target_audience == "class_rep_and_assistant":
        return any(pos.startswith("class_rep_") or pos.startswith("asst_class_rep_") for pos in positions)

    return True


async def _fire_announcement_notifications(ann_doc: dict, db) -> None:
    """
    Shared helper: create in-app notifications for students + all admin/exco users
    for a published announcement.
    Idempotent — safe to call multiple times (callers should check if already sent).
    """
    try:
        from app.routers.notifications import create_bulk_notifications

        ann_id = str(ann_doc.get("_id", ""))
        target_levels = _normalize_levels(ann_doc.get("targetLevels") or [])
        target_user_ids = [str(uid) for uid in (ann_doc.get("targetUserIds") or [])]
        session_id = ann_doc.get("sessionId", "")
        notif_audience = ann_doc.get("targetAudience") or "all"

        logger.info(
            "[NOTIF] '%s': sessionId=%s levels=%s audience=%s",
            ann_doc.get("title"), session_id, target_levels or "ALL", notif_audience,
        )

        custom_emails = [str(e) for e in (ann_doc.get("customEmails") or [])]
        recipient_ids = await _resolve_target_user_ids(
            db,
            session_id=session_id,
            target_levels=target_levels,
            target_audience=notif_audience,
            target_user_ids=target_user_ids,
            custom_emails=custom_emails,
        )

        logger.info("[NOTIF] Recipients: %d", len(recipient_ids))
        if recipient_ids:
            raw_msg = ann_doc.get("content") or ""
            plain_msg = re.sub(r'<[^>]+>', ' ', raw_msg)
            plain_msg = re.sub(r'\s+([.,!?;:])', r'\1', plain_msg)
            plain_msg = re.sub(r'\s+', ' ', plain_msg).strip()
            await create_bulk_notifications(
                user_ids=recipient_ids,
                type="announcement",
                title=f"📢 {ann_doc['title']}",
                message=plain_msg[:200] or "New announcement published",
                link=f"/dashboard/announcements?highlight={ann_id}",
                related_id=ann_id,
                category="announcements",
            )
    except Exception as e:
        logger.error(f"Failed to create announcement notifications: {e}", exc_info=True)


async def _notify_students_of_announcement(
    session_id: str,
    target_levels: Optional[List[str]],
    title: str,
    content: str,
    priority: str,
    db,
    target_audience: str = "all",
    target_user_ids: Optional[List[str]] = None,
    custom_emails: Optional[List[str]] = None,
    attachments: Optional[List[dict]] = None,
):
    """Fire-and-forget: email all targeted users matching audience/level/specific rules with personalization tags."""
    try:
        users_col = db["users"]

        # Build target label string
        audience_labels = {
            "all": "All Students",
            "ipe": "IPE Students",
            "external": "External Students",
            "exco_only": "EXCO Members",
            "team_leads_only": "Team Leads",
            "class_rep_and_assistant": "Class Reps & Assistants",
            "specific_students": "Selected Students",
            "specific_levels": "Specific Levels",
            "custom_emails": "Custom Email List",
        }
        target_levels = _normalize_levels(target_levels or [])
        if target_levels:
            level_map = {
                "100L": "100 Level", "200L": "200 Level", "300L": "300 Level",
                "400L": "400 Level", "500L": "500 Level", "PG": "Postgraduate",
            }
            target_label = ", ".join(level_map.get(lv, lv) for lv in target_levels)
            if target_audience not in {"all", "specific_levels"}:
                target_label += f" ({audience_labels.get(target_audience, '')})"
        else:
            target_label = audience_labels.get(target_audience, "All Students")

        def _interpolate(template_str: str, student_dict: dict) -> str:
            if not template_str:
                return ""
            first_name = str(student_dict.get("firstName") or "").strip()
            last_name = str(student_dict.get("lastName") or "").strip()
            full_name = f"{first_name} {last_name}".strip() or "Student"
            matric_no = str(student_dict.get("matricNumber") or "").strip()
            level = str(student_dict.get("currentLevel") or "").strip()
            department = str(student_dict.get("department") or "Industrial Engineering").strip()
            email_val = str(student_dict.get("email") or "").strip()

            def _repl(m):
                k = m.group(1).lower().strip()
                if k in ("first_name", "firstname"):
                    return first_name or "Student"
                if k in ("last_name", "lastname"):
                    return last_name or ""
                if k in ("student_name", "studentname", "name", "full_name", "fullname"):
                    return full_name
                if k in ("matric_no", "matricno", "matric_number", "matricnumber"):
                    return matric_no or "N/A"
                if k in ("level", "current_level", "currentlevel"):
                    return level or "IPE"
                if k in ("department", "dept"):
                    return department
                if k == "email":
                    return email_val
                return m.group(0)

            return re.sub(r'\{\{\s*([\w]+)\s*\}\}', _repl, template_str)

        if target_audience == "custom_emails":
            clean_emails = list(dict.fromkeys(e.strip().lower() for e in (custom_emails or []) if e and "@" in e))
            if not clean_emails:
                logger.warning("[EMAIL] target_audience is custom_emails but no valid custom_emails provided")
                return

            matched_users = await users_col.find(
                {
                    "$or": [
                        {"email": {"$in": clean_emails}},
                        {"secondaryEmail": {"$in": clean_emails}},
                    ]
                },
                {
                    "email": 1, "firstName": 1, "lastName": 1,
                    "matricNumber": 1, "currentLevel": 1, "department": 1,
                    "secondaryEmail": 1, "secondaryEmailVerified": 1,
                    "notificationEmailPreference": 1, "notificationChannelPreference": 1
                }
            ).to_list(length=None)

            email_to_student = {}
            for st in matched_users:
                if st.get("email"):
                    email_to_student[st["email"].lower().strip()] = st
                if st.get("secondaryEmail"):
                    email_to_student[st["secondaryEmail"].lower().strip()] = st

            sent = 0
            for email_addr in clean_emails:
                student_doc = email_to_student.get(email_addr)
                if student_doc:
                    name = f"{student_doc.get('firstName', '')} {student_doc.get('lastName', '')}".strip() or "Student"
                    p_title = _interpolate(title, student_doc)
                    p_content = _interpolate(content, student_doc)
                else:
                    local_part = email_addr.split("@")[0]
                    parts = re.split(r'[._+\-]+', local_part)
                    synth_name = " ".join(p.capitalize() for p in parts if p).strip() or "Recipient"
                    synthetic_student = {
                        "firstName": synth_name.split()[0] if synth_name else "Recipient",
                        "lastName": " ".join(synth_name.split()[1:]) if len(synth_name.split()) > 1 else "",
                        "email": email_addr,
                        "matricNumber": "N/A",
                        "currentLevel": "N/A",
                        "department": "External",
                    }
                    name = synth_name
                    p_title = _interpolate(title, synthetic_student)
                    p_content = _interpolate(content, synthetic_student)

                try:
                    await send_announcement_email(
                        to=email_addr,
                        student_name=name,
                        title=p_title,
                        content=p_content,
                        priority=priority,
                        target_label="Custom Email List",
                        attachments=attachments or [],
                    )
                    sent += 1
                except Exception as e:
                    logger.warning(f"Failed to send announcement email to custom email {email_addr}: {e}")

            logger.info(f"Custom announcement email sent to {sent}/{len(clean_emails)} recipient(s) — '{title}'")
            return

        recipient_ids = await _resolve_target_user_ids(
            db,
            session_id=session_id,
            target_levels=target_levels,
            target_audience=target_audience,
            target_user_ids=[str(uid) for uid in (target_user_ids or [])],
        )

        if not recipient_ids:
            return

        students = await users_col.find(
            {"_id": {"$in": [ObjectId(uid) for uid in recipient_ids if ObjectId.is_valid(uid)]}},
            {
                "email": 1, "firstName": 1, "lastName": 1,
                "matricNumber": 1, "currentLevel": 1, "department": 1,
                "secondaryEmail": 1, "secondaryEmailVerified": 1,
                "notificationEmailPreference": 1, "notificationChannelPreference": 1
            }
        ).to_list(length=None)

        sent = 0
        for student in students:
            # Respect channel preference — skip email if user prefers in-app only
            if not should_send_email(student):
                continue
            # Resolve which email(s) to send to based on preference
            emails = get_notification_emails(student)
            if not emails:
                continue
            name = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip() or "Student"
            personalized_title = _interpolate(title, student)
            personalized_content = _interpolate(content, student)

            for email_addr in emails:
                try:
                    await send_announcement_email(
                        to=email_addr,
                        student_name=name,
                        title=personalized_title,
                        content=personalized_content,
                        priority=priority,
                        target_label=target_label,
                        attachments=attachments or [],
                    )
                    sent += 1
                except Exception as e:
                    logger.warning(f"Failed to send announcement email to {email_addr}: {e}")

        logger.info(f"Announcement email sent to {sent}/{len(students)} recipient(s) — '{title}'")

    except Exception as e:
        logger.error(f"Announcement email dispatch error: {e}")


class TestEmailRequest(BaseModel):
    title: str
    content: str
    priority: str = "normal"
    targetAudience: str = "all"
    targetLevels: Optional[List[str]] = None
    attachments: Optional[List[dict]] = None
    sampleStudent: Optional[dict] = None


@router.post("/upload-media")
async def upload_announcement_media_endpoint(
    file: UploadFile = File(...),
    user: dict = Depends(require_any_permission(["announcement:create", "announcement:edit"])),
):
    """
    Upload media or attachments for announcements (images, PDFs, documents up to 15MB).
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_bytes = await file.read()
    if len(file_bytes) > 15 * 1024 * 1024:  # 15MB
        raise HTTPException(status_code=413, detail="File size must be under 15MB")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    allowed_exts = {
        "jpg", "jpeg", "png", "webp", "gif", "svg",
        "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "zip"
    }
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"File extension .{ext} is not allowed")

    result = await upload_announcement_media(
        file_data=file_bytes,
        filename=file.filename,
        file_extension=ext,
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to upload file to Cloudinary")

    return result


@router.post("/send-test-email")
async def send_test_email(
    payload: TestEmailRequest,
    user: dict = Depends(require_any_permission(["announcement:create", "announcement:edit"])),
):
    """
    Send a test preview email of the draft announcement to the current admin's email address.
    """
    admin_email = user.get("email")
    if not admin_email:
        raise HTTPException(status_code=400, detail="Admin account has no email address configured")

    sample = payload.sampleStudent or {}
    first_name = str(sample.get("firstName") or user.get("firstName") or "Alex").strip()
    last_name = str(sample.get("lastName") or user.get("lastName") or "Student").strip()
    full_name = f"{first_name} {last_name}".strip() or "Student"
    matric_no = str(sample.get("matricNumber") or user.get("matricNumber") or "219800").strip()
    level = str(sample.get("currentLevel") or user.get("currentLevel") or "400L").strip()
    department = str(sample.get("department") or user.get("department") or "Industrial Engineering").strip()

    def _repl(m):
        k = m.group(1).lower().strip()
        if k in ("first_name", "firstname"):
            return first_name
        if k in ("last_name", "lastname"):
            return last_name
        if k in ("student_name", "studentname", "name", "full_name", "fullname"):
            return full_name
        if k in ("matric_no", "matricno", "matric_number", "matricnumber"):
            return matric_no
        if k in ("level", "current_level", "currentlevel"):
            return level
        if k in ("department", "dept"):
            return department
        if k == "email":
            return admin_email
        return m.group(0)

    test_title = f"[TEST PREVIEW] " + re.sub(r'\{\{\s*([\w]+)\s*\}\}', _repl, payload.title)
    test_content = re.sub(r'\{\{\s*([\w]+)\s*\}\}', _repl, payload.content)

    success = await send_announcement_email(
        to=admin_email,
        student_name=full_name,
        title=test_title,
        content=test_content,
        priority=payload.priority,
        target_label=payload.targetAudience.replace("_", " ").title(),
        attachments=payload.attachments or [],
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to dispatch test email.")

    return {"success": True, "message": f"Test preview email sent to {admin_email}"}

class ParseCustomEmailsRequest(BaseModel):
    rawText: Optional[str] = None
    emails: Optional[List[str]] = None


@router.post("/parse-custom-emails")
async def parse_custom_emails_endpoint(
    payload: ParseCustomEmailsRequest,
    user: dict = Depends(require_any_permission(["announcement:create", "announcement:edit"])),
    db=Depends(get_database),
):
    """
    Parse, sanitize, deduplicate, and analyze a raw messy text blob or list of emails.
    Identifies which emails correspond to registered students and breaks down domains.
    """
    raw = payload.rawText or ""
    if payload.emails:
        raw += "\n" + "\n".join(payload.emails)

    EMAIL_REGEX = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    found = re.findall(EMAIL_REGEX, raw)
    
    unique_ordered = []
    seen = set()
    total_found = len(found)
    for e in found:
        cleaned = e.strip().lower()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            unique_ordered.append(cleaned)
            
    duplicates_removed = total_found - len(unique_ordered)

    registered_students = []
    external_emails = []
    domains = {}

    if unique_ordered:
        users_col = db["users"]
        matched_users = await users_col.find(
            {
                "$or": [
                    {"email": {"$in": unique_ordered}},
                    {"secondaryEmail": {"$in": unique_ordered}},
                ]
            },
            {
                "email": 1, "firstName": 1, "lastName": 1,
                "matricNumber": 1, "currentLevel": 1, "department": 1,
                "secondaryEmail": 1
            }
        ).to_list(length=None)

        email_to_user = {}
        for u in matched_users:
            if u.get("email"):
                email_to_user[u["email"].lower().strip()] = u
            if u.get("secondaryEmail"):
                email_to_user[u["secondaryEmail"].lower().strip()] = u

        for em in unique_ordered:
            domain = em.split("@")[-1]
            domains[domain] = domains.get(domain, 0) + 1
            if em in email_to_user:
                u = email_to_user[em]
                name = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip() or "Student"
                registered_students.append({
                    "email": em,
                    "name": name,
                    "matricNumber": u.get("matricNumber", "N/A"),
                    "level": u.get("currentLevel", "N/A"),
                    "department": u.get("department", "Industrial Engineering"),
                })
            else:
                external_emails.append(em)

    return {
        "emails": unique_ordered,
        "totalValid": len(unique_ordered),
        "duplicatesRemoved": duplicates_removed,
        "registeredCount": len(registered_students),
        "externalCount": len(external_emails),
        "registeredStudents": registered_students,
        "externalEmails": external_emails,
        "domains": domains,
    }


@router.post("/", response_model=Announcement, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    announcement_data: AnnouncementCreate,
    user: dict = Depends(require_permission("announcement:create"))
):
    """
    Create a new announcement.
    Requires announcement:create permission.
    
    The announcement MUST include a session_id.
    """
    db = get_database()
    announcements = db["announcements"]
    users = db["users"]
    
    # Sanitize input to prevent XSS
    if not validate_no_scripts(announcement_data.title):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters detected in title"
        )
    if not validate_no_scripts(announcement_data.content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters detected in content"
        )
    
    # Verify session exists
    sessions = db["sessions"]
    session = await sessions.find_one({"_id": ObjectId(announcement_data.sessionId)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {announcement_data.sessionId} not found"
        )
    
    # Get author name
    author = await users.find_one({"_id": ObjectId(user["_id"])})
    author_name = f"{author.get('firstName', '')} {author.get('lastName', '')}".strip() or "Admin"
    
    # Create announcement document
    announcement_dict = announcement_data.model_dump()
    target_audience = announcement_dict.get("targetAudience") or "all"
    raw_target_user_ids = [str(uid) for uid in (announcement_dict.get("targetUserIds") or [])]
    valid_target_user_ids = [uid for uid in raw_target_user_ids if ObjectId.is_valid(uid)]
    if target_audience == "specific_students" and not valid_target_user_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one valid student for specific student targeting",
        )
    announcement_dict["targetUserIds"] = valid_target_user_ids if target_audience == "specific_students" else []

    raw_custom_emails = [str(e).strip().lower() for e in (announcement_dict.get("customEmails") or []) if str(e).strip()]
    if target_audience == "custom_emails" and not raw_custom_emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least one valid recipient email for custom email targeting",
        )
    announcement_dict["customEmails"] = raw_custom_emails if target_audience == "custom_emails" else []

    announcement_dict["authorName"] = author_name
    announcement_dict["readBy"] = []
    announcement_dict["createdAt"] = datetime.now(timezone.utc)
    announcement_dict["updatedAt"] = datetime.now(timezone.utc)

    # Scheduling support: if scheduledFor is in the future, mark as draft
    is_scheduled = False
    if announcement_dict.get("scheduledFor"):
        scheduled_dt = announcement_dict["scheduledFor"]
        if isinstance(scheduled_dt, str):
            scheduled_dt = datetime.fromisoformat(scheduled_dt.replace("Z", "+00:00"))
        if scheduled_dt > datetime.now(timezone.utc):
            announcement_dict["isPublished"] = False
            is_scheduled = True
        else:
            # Scheduled time already passed — publish immediately
            announcement_dict["isPublished"] = True
            announcement_dict["scheduledFor"] = None
    else:
        announcement_dict["isPublished"] = True
    
    result = await announcements.insert_one(announcement_dict)
    created_announcement = await announcements.find_one({"_id": result.inserted_id})
    created_announcement["_id"] = str(created_announcement["_id"])
    
    await AuditLogger.log(
        action=AuditLogger.ANNOUNCEMENT_CREATED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="announcement",
        resource_id=str(result.inserted_id),
        session_id=announcement_data.sessionId,
        details={"title": announcement_data.title, "priority": announcement_data.priority}
    )

    # Fire-and-forget: email enrolled students — only for immediately published announcements with sendEmail=True
    if not is_scheduled and announcement_data.sendEmail:
        raw_atts = [
            att.model_dump() if hasattr(att, "model_dump") else att
            for att in (announcement_data.attachments or [])
        ]
        fire_and_forget(_notify_students_of_announcement(
            session_id=announcement_data.sessionId,
            target_levels=announcement_data.targetLevels,
            title=announcement_data.title,
            content=announcement_data.content,
            priority=announcement_data.priority,
            db=db,
            target_audience=announcement_data.targetAudience or "all",
            target_user_ids=announcement_data.targetUserIds or [],
            custom_emails=announcement_data.customEmails or [],
            attachments=raw_atts,
        ))

    if not is_scheduled:
        from app.routers.sse import publish
        from app.core.cache import cache_delete, cache_delete_pattern
        publish("announcement_created", {
            "id": str(result.inserted_id),
            "title": announcement_data.title,
            "priority": announcement_data.priority,
        }, ipe_only=(announcement_data.targetAudience == "ipe"))
        await cache_delete("admin_stats")
        await cache_delete_pattern("student_dashboard:*")
    else:
        from app.core.cache import cache_delete
        await cache_delete("admin_stats")

    # Create in-app notifications for targeted students (only for immediately published)
    if not is_scheduled:
        fire_and_forget(_fire_announcement_notifications(created_announcement, db))

    return Announcement(**created_announcement)


@router.get("")
@router.get("/")
async def list_announcements(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    priority: Optional[str] = None,
    search: Optional[str] = Query(None, description="Search in title or content"),
    target_level: Optional[str] = Query(None, description="Filter by target level (e.g. 100L)"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of announcements to return"),
    skip: int = Query(0, ge=0, description="Number of announcements to skip"),
    user: dict = Depends(get_current_user)
):
    """
    List all announcements for a specific session with pagination.
    
    Filters announcements based on:
    - session_id (time travel)
    - targetLevels (if user is a student, only shows relevant announcements)
    - expiresAt (hides expired announcements)
    
    Returns announcements with user's read status.
    Supports pagination via limit and skip parameters.
    """
    db = get_database()
    announcements = db["announcements"]
    enrollments = db["enrollments"]
    sessions = db["sessions"]
    
    # Resolve session_id
    if not session_id:
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active session found"
            )
        session_id = str(active_session["_id"])
    
    # Verify session exists
    session = await sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    # Build query
    query = {"sessionId": session_id}

    # Students only see published announcements; admins see all (including scheduled drafts)
    is_admin_viewer = user.get("role") in ("admin", "super_admin")
    if not is_admin_viewer:
        query["$and"] = query.get("$and", []) + [
            {"$or": [{"isPublished": True}, {"isPublished": {"$exists": False}}]}
        ]
    
    # Filter by priority if specified
    if priority:
        query["priority"] = priority
    
    # Search in title/content
    if search:
        escaped = re.escape(search)
        query["$and"] = query.get("$and", []) + [{
            "$or": [
                {"title": {"$regex": escaped, "$options": "i"}},
                {"content": {"$regex": escaped, "$options": "i"}},
            ]
        }]
    
    # Filter by target level (for admin filtering)
    if target_level and target_level != "all":
        query["targetLevels"] = target_level
    
    # Hide expired announcements
    query["$or"] = [
        {"expiresAt": None},
        {"expiresAt": {"$gt": datetime.now(timezone.utc)}}
    ]
    
    # Get user's level for this session (if student)
    user_level = None
    if user.get("role") == "student":
        enrollment = await enrollments.find_one({
            "studentId": user["_id"],
            "sessionId": session_id,
            "isActive": True
        })
        if enrollment:
            user_level = enrollment.get("level")
    
    # Get total count for pagination
    total = await announcements.count_documents(query)
    
    # Get announcements
    cursor = announcements.find(query).sort([
        ("isPinned", -1),  # Pinned first
        ("priority", -1),   # High priority next
        ("createdAt", -1)   # Most recent
    ]).skip(skip).limit(limit)
    announcement_list = await cursor.to_list(length=limit)
    
    # Filter by target levels and audience, enrich with read status
    result = []
    user_role = user.get("role", "student")
    is_admin_user = user_role in ("admin", "super_admin")
    user_id = str(user.get("_id", ""))
    user_department = user.get("department", "Industrial Engineering")
    user_positions: list[str] = []
    if not is_admin_user:
        role_docs = await db["roles"].find(
            {"userId": user_id, "sessionId": session_id, "isActive": True},
            {"position": 1},
        ).to_list(length=None)
        user_positions = [str(doc.get("position", "")) for doc in role_docs]

    for announcement in announcement_list:
        # Check if announcement is targeted to specific levels
        target_levels = announcement.get("targetLevels")

        # If targeted, admins always see it; students must match their enrolled level
        if target_levels and not is_admin_user:
            if not user_level or user_level not in target_levels:
                continue  # Skip — student's level doesn't match

        # Check audience targeting (ipe-only vs external-only vs all vs custom_emails)
        target_audience = announcement.get("targetAudience", "all")
        target_user_ids = [str(uid) for uid in (announcement.get("targetUserIds") or [])]
        custom_emails = [str(e) for e in (announcement.get("customEmails") or [])]
        user_email = user.get("email", "")
        if not is_admin_user:
            allowed = await _user_matches_target_audience(
                db,
                user_id=user_id,
                user_role=user_role,
                user_department=user_department,
                session_id=session_id,
                target_audience=target_audience,
                target_user_ids=target_user_ids,
                user_positions=user_positions,
                custom_emails=custom_emails,
                user_email=user_email,
            )
            if not allowed:
                continue
        
        announcement["_id"] = str(announcement["_id"])
        
        # Check read status
        is_read = user["_id"] in announcement.get("readBy", [])
        
        announcement_with_status = AnnouncementWithStatus(
            **announcement,
            isRead=is_read
        )
        result.append(announcement_with_status)
    
    return {"items": result, "total": total}


@router.get("/recipient-search")
async def search_announcement_recipients(
    q: str = Query(..., min_length=2, description="Search by name, matric number, or email"),
    limit: int = Query(10, ge=1, le=20),
    _: dict = Depends(require_permission("announcement:create")),
):
    db = get_database()
    users = db["users"]

    escaped = re.escape(q.strip())
    query = {
        "$or": [
            {"firstName": {"$regex": escaped, "$options": "i"}},
            {"lastName": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
            {"matricNumber": {"$regex": escaped, "$options": "i"}},
        ]
    }
    docs = await users.find(
        query,
        {
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "matricNumber": 1,
            "role": 1,
            "currentLevel": 1,
            "gender": 1,
            "sex": 1,
        },
    ).sort("firstName", 1).limit(limit).to_list(length=limit)

    return {
        "items": [
            {
                "id": str(doc["_id"]),
                "firstName": doc.get("firstName", ""),
                "lastName": doc.get("lastName", ""),
                "email": doc.get("email", ""),
                "matricNumber": doc.get("matricNumber"),
                "role": doc.get("role", "student"),
                "currentLevel": doc.get("currentLevel"),
                "gender": doc.get("gender") or doc.get("sex"),
            }
            for doc in docs
        ]
    }


@router.get("/{announcement_id}", response_model=AnnouncementWithStatus)
async def get_announcement(
    announcement_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific announcement by ID with user's read status"""
    db = get_database()
    announcements = db["announcements"]
    
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID format"
        )
    
    announcement = await announcements.find_one({"_id": ObjectId(announcement_id)})
    
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement {announcement_id} not found"
        )
    
    announcement["_id"] = str(announcement["_id"])
    
    # Check read status
    is_read = user["_id"] in announcement.get("readBy", [])
    
    return AnnouncementWithStatus(
        **announcement,
        isRead=is_read
    )


@router.post("/{announcement_id}/read", response_model=AnnouncementWithStatus)
async def mark_announcement_as_read(
    announcement_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Mark an announcement as read by current user.
    """
    db = get_database()
    announcements = db["announcements"]
    
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID format"
        )
    
    # Mark as read (add user to readBy array if not already there)
    await announcements.update_one(
        {"_id": ObjectId(announcement_id)},
        {
            "$addToSet": {"readBy": user["_id"]},  # addToSet prevents duplicates
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    
    # Return updated announcement
    updated_announcement = await announcements.find_one({"_id": ObjectId(announcement_id)})
    
    if not updated_announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement {announcement_id} not found"
        )
    
    updated_announcement["_id"] = str(updated_announcement["_id"])
    
    return AnnouncementWithStatus(
        **updated_announcement,
        isRead=True
    )


@router.patch("/{announcement_id}", response_model=Announcement)
async def update_announcement(
    announcement_id: str,
    announcement_update: AnnouncementUpdate,
    user: dict = Depends(require_permission("announcement:edit"))
):
    """
    Update announcement details.
    Requires announcement:edit permission.
    """
    db = get_database()
    announcements = db["announcements"]
    
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID format"
        )
    
    update_data = announcement_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    if "targetAudience" in update_data or "targetUserIds" in update_data or "customEmails" in update_data:
        existing = await announcements.find_one({"_id": ObjectId(announcement_id)})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Announcement {announcement_id} not found"
            )
        effective_audience = update_data.get("targetAudience", existing.get("targetAudience", "all"))
        raw_target_user_ids = [str(uid) for uid in update_data.get("targetUserIds", existing.get("targetUserIds") or [])]
        valid_target_user_ids = [uid for uid in raw_target_user_ids if ObjectId.is_valid(uid)]
        if effective_audience == "specific_students" and not valid_target_user_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select at least one valid student for specific student targeting",
            )
        update_data["targetUserIds"] = valid_target_user_ids if effective_audience == "specific_students" else []

        raw_custom_emails = [str(e).strip().lower() for e in update_data.get("customEmails", existing.get("customEmails") or []) if str(e).strip()]
        if effective_audience == "custom_emails" and not raw_custom_emails:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please provide at least one valid recipient email for custom email targeting",
            )
        update_data["customEmails"] = raw_custom_emails if effective_audience == "custom_emails" else []

    update_data["updatedAt"] = datetime.now(timezone.utc)

    # Snapshot isPublished BEFORE updating so we can detect first-publish
    was_published: bool = False
    if update_data.get("isPublished") is True:
        original = await announcements.find_one(
            {"_id": ObjectId(announcement_id)}, {"isPublished": 1}
        )
        was_published = bool(original and original.get("isPublished") is True)

    result = await announcements.update_one(
        {"_id": ObjectId(announcement_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement {announcement_id} not found"
        )

    updated_announcement = await announcements.find_one({"_id": ObjectId(announcement_id)})
    updated_announcement["_id"] = str(updated_announcement["_id"])

    # Fire notifications when an announcement is published for the first time via PATCH
    if update_data.get("isPublished") is True and not was_published:
        fire_and_forget(_fire_announcement_notifications(updated_announcement, db))
        if updated_announcement.get("sendEmail") is not False:
            fire_and_forget(_notify_students_of_announcement(
                session_id=str(updated_announcement.get("sessionId")),
                target_levels=updated_announcement.get("targetLevels"),
                title=updated_announcement.get("title", ""),
                content=updated_announcement.get("content", ""),
                priority=updated_announcement.get("priority", "normal"),
                db=db,
                target_audience=updated_announcement.get("targetAudience") or "all",
                target_user_ids=updated_announcement.get("targetUserIds") or [],
                custom_emails=updated_announcement.get("customEmails") or [],
                attachments=updated_announcement.get("attachments") or [],
            ))

    await AuditLogger.log(
        action=AuditLogger.ANNOUNCEMENT_UPDATED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="announcement",
        resource_id=announcement_id,
        details={"updated_fields": list(update_data.keys())}
    )

    # For already-published announcements: emit SSE, invalidate cache, sync notification content
    if updated_announcement.get("isPublished"):
        from app.routers.sse import publish
        from app.core.cache import cache_delete, cache_delete_pattern
        publish("announcement_updated", {
            "id": announcement_id,
            "title": updated_announcement.get("title", ""),
        })
        await cache_delete("admin_stats")
        await cache_delete_pattern("student_dashboard:*")
        # Keep existing notification title/message in sync if text changed
        notif_patch: dict = {}
        if "title" in update_data:
            notif_patch["title"] = f"📢 {update_data['title']}"
        if "content" in update_data:
            plain_c = re.sub(r'<[^>]+>', '', update_data["content"] or "")
            plain_c = re.sub(r'\s+', ' ', plain_c).strip()
            notif_patch["message"] = plain_c[:200]
        if notif_patch:
            notif_patch["updatedAt"] = datetime.now(timezone.utc)
            await db.notifications.update_many(
                {"type": "announcement", "relatedId": announcement_id},
                {"$set": notif_patch}
            )

    return Announcement(**updated_announcement)


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: str,
    user: dict = Depends(require_permission("announcement:delete"))
):
    """
    Delete an announcement.
    Requires announcement:delete permission.
    """
    db = get_database()
    announcements = db["announcements"]
    
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID format"
        )
    
    result = await announcements.delete_one({"_id": ObjectId(announcement_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement {announcement_id} not found"
        )

    # Cascade: remove all in-app notifications for this announcement
    await db["notifications"].delete_many({"type": "announcement", "relatedId": announcement_id})

    await AuditLogger.log(
        action=AuditLogger.ANNOUNCEMENT_DELETED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="announcement",
        resource_id=announcement_id,
    )
    from app.routers.sse import publish
    from app.core.cache import cache_delete, cache_delete_pattern
    publish("announcement_deleted", {"id": announcement_id})
    await cache_delete("admin_stats")
    await cache_delete_pattern("student_dashboard:*")
    return None


@router.get("/reads/me", response_model=List[str])
async def get_my_read_announcements(
    user: dict = Depends(get_current_user)
):
    """
    Get list of announcement IDs the current user has read.
    Returns array of announcement ID strings.
    """
    db = get_database()
    announcements = db["announcements"]
    
    # Find all announcements where user is in readBy array
    cursor = announcements.find({"readBy": user["_id"]})
    read_announcements = await cursor.to_list(length=None)
    
    # Return array of announcement IDs as strings
    return [str(announcement["_id"]) for announcement in read_announcements]


# ═══════════════════════════════════════════════════════════════════
# SCHEDULED ANNOUNCEMENT PUBLISHER
# Call via cron or on admin dashboard load to publish due announcements
# ═══════════════════════════════════════════════════════════════════

@router.post("/publish-scheduled")
async def publish_scheduled_announcements(
    user: dict = Depends(require_permission("announcement:create")),
):
    """
    Publish all announcements whose scheduledFor has passed.
    Triggers email + in-app notifications for each published announcement.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    due = await db["announcements"].find({
        "isPublished": False,
        "scheduledFor": {"$lte": now},
    }).to_list(length=100)

    published_count = 0
    for ann in due:
        await db["announcements"].update_one(
            {"_id": ann["_id"]},
            {"$set": {"isPublished": True, "updatedAt": now}},
        )
        published_count += 1

        # Send email if sendEmail is true
        if ann.get("sendEmail", True):
            fire_and_forget(_notify_students_of_announcement(
                session_id=ann["sessionId"],
                target_levels=ann.get("targetLevels"),
                title=ann["title"],
                content=ann["content"],
                priority=ann.get("priority", "normal"),
                db=db,
                target_audience=ann.get("targetAudience", "all"),
                target_user_ids=ann.get("targetUserIds") or [],
                custom_emails=ann.get("customEmails") or [],
                attachments=ann.get("attachments") or [],
            ))

        # SSE + cache
        from app.routers.sse import publish as sse_publish
        from app.core.cache import cache_delete, cache_delete_pattern
        sse_publish("announcement_created", {
            "id": str(ann["_id"]),
            "title": ann["title"],
            "priority": ann.get("priority", "normal"),
        }, ipe_only=(ann.get("targetAudience") == "ipe"))
        await cache_delete_pattern("student_dashboard:*")

        # In-app notifications — delegate to shared helper
        asyncio.ensure_future(_fire_announcement_notifications(ann, db))

    await cache_delete("admin_stats")
    return {"published": published_count}


@router.post("/backfill-notifications")
async def backfill_announcement_notifications(
    user: dict = Depends(get_current_user),
):
    # Only admin / exco can run the backfill
    user_role = user.get("role", "")
    if user_role not in ("admin", "exco"):
        raise HTTPException(status_code=403, detail="Admin or exco role required")
    """
    Retroactively create in-app notifications for all published announcements
    that have not yet had notifications sent (checked via relatedId in notifications collection).

    Useful after deploying the notification feature for the first time, or
    after seeding the database with announcements.

    Requires announcement:create permission.
    """
    db = get_database()

    # Find all published announcements (isPublished=True or field missing)
    published_anns = await db["announcements"].find(
        {"$or": [{"isPublished": True}, {"isPublished": {"$exists": False}}]}
    ).to_list(length=None)

    # Find which announcement IDs already have notifications
    existing_ids: set[str] = set()
    async for n in db["notifications"].find(
        {"type": "announcement", "relatedId": {"$ne": None}}, {"relatedId": 1}
    ):
        if n.get("relatedId"):
            existing_ids.add(str(n["relatedId"]))

    created_for: list[str] = []
    skipped: list[str] = []

    for ann in published_anns:
        ann_id = str(ann["_id"])
        ann["_id"] = ann_id  # normalise for helper
        if ann_id in existing_ids:
            skipped.append(ann_id)
            continue
        await _fire_announcement_notifications(ann, db)
        created_for.append(ann_id)

    logger.info(
        "[BACKFILL] Notification backfill complete: created for %d announcements, skipped %d (already sent)",
        len(created_for), len(skipped),
    )
    return {
        "created_for": len(created_for),
        "skipped_already_sent": len(skipped),
    }
