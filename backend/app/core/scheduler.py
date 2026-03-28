"""
IESA Scheduled Jobs — APScheduler (AsyncIOScheduler)

Daily background jobs that run at server time (UTC):
  07:00 UTC — planner_deadline_alerts  (planner tasks due tomorrow)
  08:00 UTC — birthday_wishes          (users with birthday today)
  08:00 UTC — event_reminders          (events happening tomorrow)
  08:05 UTC — payment_deadline_reminders (payments due tomorrow for unpaid students)
    every minute — timetable_class_reminders (30m/15m/ongoing class reminders)

All jobs are fire-and-forget — failures are logged but never crash the server.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from bson import ObjectId

logger = logging.getLogger("iesa_backend.scheduler")

# ─── Lazy import so the scheduler module can be imported without
#     APScheduler being installed (fails gracefully at startup instead). ─────
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.triggers.interval import IntervalTrigger
    _HAS_APSCHEDULER = True
except ImportError:
    _HAS_APSCHEDULER = False
    logger.warning(
        "APScheduler not installed — scheduled jobs disabled. "
        "Install with: pip install apscheduler==3.10.4"
    )

_scheduler: "AsyncIOScheduler | None" = None


_ROLE_LABELS = {
    "president": "President",
    "vice_president": "Vice President",
    "general_secretary": "General Secretary",
    "assistant_general_secretary": "Asst. General Secretary",
    "treasurer": "Treasurer",
    "social_director": "Social Director",
    "sports_secretary": "Sports Secretary",
    "assistant_sports_secretary": "Asst. Sports Secretary",
    "pro": "Public Relations Officer",
    "financial_secretary": "Financial Secretary",
    "director_of_socials": "Director of Socials",
    "director_of_sports": "Director of Sports",
    "press_editor_in_chief": "Press Editor-in-Chief",
    "press_member": "Press Member",
    "press_niche_editor": "Press Niche Editor",
    "press_pro": "Press PRO",
    "timp_lead": "TIMP Lead",
    "timp_mentor": "TIMP Mentor",
    "timp_mentee": "TIMP Mentee",
    "iepod_hub_director": "IEPOD Hub Director",
    "iepod_hub_lead": "IEPOD Hub Lead",
    "iepod_conference_lead": "IEPOD Conference Lead",
    "iepod_program_coordinator": "IEPOD Program Coordinator",
    "iepod_communications_officer": "IEPOD Communications Officer",
}


def _format_position_label(position: str, society_name: str | None = None) -> str:
    if not position:
        return "Role"
    if position.startswith("class_rep_"):
        level = position.replace("class_rep_", "").upper()
        return f"{level} Class Rep"
    base_label = _ROLE_LABELS.get(position, position.replace("_", " ").title())
    if position == "iepod_hub_lead" and society_name:
        return f"{base_label} ({society_name})"
    return base_label


def _build_role_appreciation(role_labels: list[str]) -> str | None:
    labels = [label for label in role_labels if label]
    if not labels:
        return None
    if len(labels) == 1:
        return f"Thank you for serving as {labels[0]}."
    if len(labels) == 2:
        return f"Thank you for serving as {labels[0]} and {labels[1]}."
    return (
        f"Thank you for serving as {labels[0]}, {labels[1]}, "
        f"and {len(labels) - 2} other role{'s' if len(labels) - 2 > 1 else ''}."
    )


# ─────────────────────────────────────────────────────────────────────────────
# JOB 1 — Birthday Wishes
# ─────────────────────────────────────────────────────────────────────────────

async def birthday_wishes() -> None:
    """
    Send a birthday notification to every user whose birthday is today.
    Runs once daily at 08:00 UTC.
    """
    try:
        from app.db import get_database
        from app.routers.notifications import create_bulk_notifications, create_notification
        from app.core.email import send_birthday_email
        from app.core.notification_utils import (
            get_notification_emails,
            should_notify_category,
            should_send_email,
        )

        db = get_database()
        now = datetime.now(timezone.utc)
        month, day = now.month, now.day

        # Find all users born on this month+day (any year)
        pipeline = [
            {
                "$match": {
                    "dateOfBirth": {"$exists": True, "$ne": None},
                    "isActive": {"$ne": False},
                    "role": "student",
                }
            },
            {
                "$addFields": {
                    "_birthMonth": {"$month": "$dateOfBirth"},
                    "_birthDay": {"$dayOfMonth": "$dateOfBirth"},
                }
            },
            {
                "$match": {"_birthMonth": month, "_birthDay": day}
            },
            {
                "$project": {
                    "_id": 1,
                    "firstName": 1,
                    "lastName": 1,
                    "email": 1,
                    "secondaryEmail": 1,
                    "secondaryEmailVerified": 1,
                    "notificationEmailPreference": 1,
                    "notificationChannelPreference": 1,
                    "notificationCategories": 1,
                }
            },
        ]

        celebrants = await db["users"].aggregate(pipeline).to_list(length=200)
        if not celebrants:
            logger.info("[Scheduler] birthday_wishes: no birthdays today (%02d-%02d)", month, day)
            return

        active_sessions = await db["sessions"].find(
            {"isActive": True}, {"_id": 1}
        ).to_list(length=10)
        active_session_ids = [str(s["_id"]) for s in active_sessions if s.get("_id")]

        celebrant_ids = [str(u["_id"]) for u in celebrants if u.get("_id")]
        role_map: dict[str, list[str]] = {uid: [] for uid in celebrant_ids}
        if celebrant_ids and active_session_ids:
            role_docs = await db["roles"].find(
                {
                    "userId": {"$in": celebrant_ids},
                    "sessionId": {"$in": active_session_ids},
                    "isActive": True,
                },
                {"userId": 1, "position": 1, "societyName": 1},
            ).to_list(length=1500)
            for role_doc in role_docs:
                role_uid = str(role_doc.get("userId") or "")
                position = str(role_doc.get("position") or "").strip()
                if not role_uid or not position:
                    continue
                role_map.setdefault(role_uid, []).append(
                    _format_position_label(position, role_doc.get("societyName"))
                )
            for uid, labels in role_map.items():
                role_map[uid] = sorted(set(labels))

        logger.info(
            "[Scheduler] birthday_wishes: %d birthday(s) on %02d-%02d",
            len(celebrants), month, day,
        )

        celebrant_names = [
            f"{u.get('firstName', '').strip()} {u.get('lastName', '').strip()}".strip()
            for u in celebrants
        ]
        celebrant_names = [name for name in celebrant_names if name]

        if celebrant_names:
            if len(celebrant_names) == 1:
                names_text = celebrant_names[0]
            elif len(celebrant_names) == 2:
                names_text = f"{celebrant_names[0]} and {celebrant_names[1]}"
            elif len(celebrant_names) == 3:
                names_text = f"{celebrant_names[0]}, {celebrant_names[1]} and {celebrant_names[2]}"
            else:
                names_text = f"{celebrant_names[0]}, {celebrant_names[1]} and {len(celebrant_names) - 2} others"

            ipe_students = await db["users"].find(
                {
                    "isActive": {"$ne": False},
                    "role": "student",
                    "department": "Industrial Engineering",
                    "$or": [
                        {"isExternalStudent": False},
                        {"isExternalStudent": {"$exists": False}},
                    ],
                },
                {"_id": 1},
            ).to_list(length=5000)
            ipe_user_ids = [str(u["_id"]) for u in ipe_students if u.get("_id")]

            if ipe_user_ids:
                try:
                    await create_bulk_notifications(
                        user_ids=ipe_user_ids,
                        type="birthday_celebration",
                        title="Birthday Celebration 🎉",
                        message=f"Join us in celebrating {names_text} today. Send your birthday wishes!",
                        link="/dashboard",
                        category="academic",
                    )
                except Exception as e:
                    logger.warning(
                        "[Scheduler] birthday_wishes: celebration broadcast failed — %s", e
                    )

        for user in celebrants:
            user_id = str(user["_id"])
            first_name = user.get("firstName", "")
            full_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Student"
            greeting = f"Happy Birthday, {first_name}! 🎂" if first_name else "Happy Birthday!"
            role_appreciation = _build_role_appreciation(role_map.get(user_id, []))

            due_reminder = None
            if active_session_ids:
                user_id_variants = [user_id]
                if ObjectId.is_valid(user_id):
                    user_id_variants.append(ObjectId(user_id))

                unpaid_mandatory = await db["payments"].find(
                    {
                        "sessionId": {"$in": active_session_ids},
                        "mandatory": {"$ne": False},
                        "paidBy": {"$nin": user_id_variants},
                    },
                    {"title": 1},
                ).to_list(length=10)

                if unpaid_mandatory:
                    titles = [p.get("title", "a mandatory due") for p in unpaid_mandatory if p.get("title")]
                    if len(titles) == 1:
                        due_reminder = f"After your cake, please clear {titles[0]} when you can 💚"
                    elif len(titles) == 2:
                        due_reminder = f"Birthday mode first, then remember to clear {titles[0]} and {titles[1]} 💚"
                    else:
                        due_reminder = f"Birthday mode first, then remember you still have {len(unpaid_mandatory)} mandatory dues pending 💚"

            try:
                await create_notification(
                    user_id=user_id,
                    type="birthday",
                    title=greeting,
                    message=(
                        "Wishing you a wonderful birthday from the entire IESA community! "
                        "Hope your day is as amazing as you are. 🎉"
                        + (f" {role_appreciation}" if role_appreciation else "")
                        + (f" {due_reminder}" if due_reminder else "")
                    ),
                    link="/dashboard",
                    category="academic",
                )
            except Exception as e:
                logger.warning(
                    "[Scheduler] birthday_wishes: failed for userId=%s — %s", user_id, e
                )

            try:
                if should_send_email(user) and should_notify_category(user, "academic"):
                    email_addresses = list(dict.fromkeys(get_notification_emails(user)))
                    for email in email_addresses:
                        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
                        await send_birthday_email(
                            to=email,
                            name=full_name,
                            role_appreciation=role_appreciation,
                            due_reminder=due_reminder,
                            dashboard_url=f"{frontend_url}/dashboard",
                        )
            except Exception as e:
                logger.warning(
                    "[Scheduler] birthday_wishes: birthday email failed for userId=%s — %s",
                    user_id,
                    e,
                )

    except Exception as exc:
        logger.error("[Scheduler] birthday_wishes job crashed: %s", exc, exc_info=True)


# ─────────────────────────────────────────────────────────────────────────────
# JOB 2 — Event Reminders (events happening tomorrow)
# ─────────────────────────────────────────────────────────────────────────────

async def event_reminders() -> None:
    """
    Notify registered students about events happening tomorrow.
    Runs once daily at 08:00 UTC.
    """
    try:
        from app.db import get_database
        from app.routers.notifications import create_bulk_notifications

        db = get_database()
        now = datetime.now(timezone.utc)
        # Tomorrow: midnight→midnight UTC
        tomorrow_start = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        tomorrow_end = tomorrow_start + timedelta(days=1)

        events_tomorrow = await db["events"].find(
            {
                "date": {"$gte": tomorrow_start, "$lt": tomorrow_end},
                "isPublished": {"$ne": False},
            },
            {"_id": 1, "title": 1, "date": 1, "location": 1, "registrations": 1},
        ).to_list(length=100)

        if not events_tomorrow:
            logger.info("[Scheduler] event_reminders: no events tomorrow")
            return

        logger.info(
            "[Scheduler] event_reminders: %d event(s) tomorrow", len(events_tomorrow)
        )

        for event in events_tomorrow:
            event_id = str(event["_id"])
            registrations: list = event.get("registrations") or []
            if not registrations:
                continue

            # Normalize IDs to strings
            user_ids = [str(uid) for uid in registrations if uid]
            if not user_ids:
                continue

            event_title = event.get("title", "Event")
            location = event.get("location", "")
            time_str = ""
            if isinstance(event.get("date"), datetime):
                time_str = event["date"].strftime("%I:%M %p")

            loc_part = f" at {location}" if location else ""
            time_part = f" at {time_str}" if time_str else ""

            try:
                await create_bulk_notifications(
                    user_ids=user_ids,
                    type="event",
                    title=f"Reminder: {event_title} is tomorrow",
                    message=(
                        f"{event_title} is happening tomorrow{loc_part}{time_part}. "
                        "Don't forget to attend!"
                    ),
                    link=f"/dashboard/events",
                    related_id=event_id,
                    category="events",
                )
                logger.info(
                    "[Scheduler] event_reminders: sent to %d user(s) for event '%s'",
                    len(user_ids), event_title,
                )
            except Exception as e:
                logger.warning(
                    "[Scheduler] event_reminders: bulk notify failed for event %s — %s",
                    event_id, e,
                )

    except Exception as exc:
        logger.error("[Scheduler] event_reminders job crashed: %s", exc, exc_info=True)


# ─────────────────────────────────────────────────────────────────────────────
# JOB 3 — Payment Deadline Reminders
# ─────────────────────────────────────────────────────────────────────────────

async def payment_deadline_reminders() -> None:
    """
    Notify unpaid students about payment deadlines falling tomorrow.
    Runs once daily at 08:05 UTC.
    """
    try:
        from app.db import get_database
        from app.routers.notifications import create_bulk_notifications

        db = get_database()
        now = datetime.now(timezone.utc)
        tomorrow_start = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        tomorrow_end = tomorrow_start + timedelta(days=1)

        # Fetch the active session(s) to scope the query
        active_sessions = await db["sessions"].find(
            {"isActive": True}, {"_id": 1}
        ).to_list(length=5)
        session_ids = [str(s["_id"]) for s in active_sessions]

        if not session_ids:
            logger.info("[Scheduler] payment_deadline_reminders: no active sessions")
            return

        payments_due = await db["payments"].find(
            {
                "sessionId": {"$in": session_ids},
                "deadline": {"$gte": tomorrow_start, "$lt": tomorrow_end},
            },
            {"_id": 1, "title": 1, "amount": 1, "sessionId": 1, "paidBy": 1},
        ).to_list(length=50)

        if not payments_due:
            logger.info("[Scheduler] payment_deadline_reminders: no payments due tomorrow")
            return

        logger.info(
            "[Scheduler] payment_deadline_reminders: %d payment(s) due tomorrow",
            len(payments_due),
        )

        for payment in payments_due:
            payment_id = str(payment["_id"])
            session_id = payment.get("sessionId", "")
            paid_by: list = [str(uid) for uid in (payment.get("paidBy") or [])]
            amount = payment.get("amount", 0)
            title = payment.get("title", "Payment")

            # Find enrolled students for this session who haven't paid
            enrollments = await db["enrollments"].find(
                {"sessionId": session_id, "isActive": True},
                {"studentId": 1, "userId": 1},
            ).to_list(length=2000)

            unpaid_ids = []
            for enr in enrollments:
                sid = str(enr.get("studentId") or enr.get("userId") or "")
                if sid and sid not in paid_by:
                    unpaid_ids.append(sid)

            if not unpaid_ids:
                logger.info(
                    "[Scheduler] payment_deadline_reminders: all paid for '%s'", title
                )
                continue

            amount_str = f" (₦{amount:,.0f})" if amount else ""

            try:
                await create_bulk_notifications(
                    user_ids=unpaid_ids,
                    type="payment",
                    title=f"Payment Due Tomorrow: {title}",
                    message=(
                        f"Your payment for '{title}'{amount_str} is due tomorrow. "
                        "Head to the payments page to complete it now."
                    ),
                    link="/dashboard/payments",
                    related_id=payment_id,
                    category="payments",
                )
                logger.info(
                    "[Scheduler] payment_deadline_reminders: notified %d unpaid for '%s'",
                    len(unpaid_ids), title,
                )
            except Exception as e:
                logger.warning(
                    "[Scheduler] payment_deadline_reminders: bulk notify failed for payment %s — %s",
                    payment_id, e,
                )

    except Exception as exc:
        logger.error(
            "[Scheduler] payment_deadline_reminders job crashed: %s", exc, exc_info=True
        )


# ─────────────────────────────────────────────────────────────────────────────
# JOB 4 — Planner Deadline Alerts
# ─────────────────────────────────────────────────────────────────────────────

async def planner_deadline_alerts() -> None:
    """
    Notify students about planner tasks due tomorrow that are not yet completed.
    Runs once daily at 07:00 UTC.
    """
    try:
        from app.db import get_database
        from app.routers.notifications import create_notification

        db = get_database()
        now = datetime.now(timezone.utc)
        tomorrow_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")

        # Fetch all planner data documents
        planner_docs = await db["growth_data"].find(
            {"tool": "planner"},
            {"_id": 0, "userId": 1, "data": 1},
        ).to_list(length=5000)

        if not planner_docs:
            logger.info("[Scheduler] planner_deadline_alerts: no planner data found")
            return

        notified = 0
        for doc in planner_docs:
            user_id = doc.get("userId")
            tasks = doc.get("data") or []
            if not user_id or not isinstance(tasks, list):
                continue

            # Tasks due tomorrow that are not completed
            due_tomorrow = [
                t for t in tasks
                if isinstance(t, dict)
                and not t.get("completed", False)
                and isinstance(t.get("dueDate"), str)
                and t["dueDate"].startswith(tomorrow_str)
            ]

            if not due_tomorrow:
                continue

            count = len(due_tomorrow)
            if count == 1:
                task_title = due_tomorrow[0].get("title", "a task")
                notif_title = f"Planner Reminder: '{task_title}' due tomorrow"
                notif_message = (
                    f"You have a planner task due tomorrow: {task_title}. "
                    "Open your planner to stay on track."
                )
            else:
                notif_title = f"Planner Reminder: {count} tasks due tomorrow"
                notif_message = (
                    f"You have {count} planner tasks due tomorrow. "
                    "Open your planner to review and complete them."
                )

            try:
                await create_notification(
                    user_id=user_id,
                    type="planner_reminder",
                    title=notif_title,
                    message=notif_message,
                    link="/dashboard/growth/planner",
                    category="academic",
                )
                notified += 1
            except Exception as e:
                logger.warning(
                    "[Scheduler] planner_deadline_alerts: failed for userId=%s — %s",
                    user_id, e,
                )

        logger.info(
            "[Scheduler] planner_deadline_alerts: sent reminders to %d user(s) (tasks due %s)",
            notified, tomorrow_str,
        )

    except Exception as exc:
        logger.error(
            "[Scheduler] planner_deadline_alerts job crashed: %s", exc, exc_info=True
        )


# ─────────────────────────────────────────────────────────────────────────────
# JOB 5 — Timetable Class Reminders (30m/15m/ongoing)
# ─────────────────────────────────────────────────────────────────────────────

async def timetable_class_reminders() -> None:
    """Dispatch timetable reminders for students automatically every minute."""
    try:
        from zoneinfo import ZoneInfo
        from app.db import get_database
        from app.routers.timetable import _dispatch_class_reminders_for_users

        lagos_tz = ZoneInfo("Africa/Lagos")
        now_lagos = datetime.now(lagos_tz)
        weekday = now_lagos.strftime("%A")
        db = get_database()

        session = await db["sessions"].find_one({"isActive": True}, {"_id": 1})
        if not session:
            return

        session_id = str(session["_id"])
        classes = await db["classSessions"].find(
            {"sessionId": session_id, "day": weekday},
            {"level": 1},
        ).to_list(length=500)
        if not classes:
            return

        levels = sorted({int(cls.get("level", 0)) for cls in classes if cls.get("level")})
        if not levels:
            return

        total_created = 0
        for level in levels:
            users_cursor = db["users"].find(
                {
                    "role": "student",
                    "isActive": {"$ne": False},
                    "isExternalStudent": {"$ne": True},
                    "currentLevel": {"$regex": f"^{level}"},
                },
                {"_id": 1},
            )
            user_ids = [str(user["_id"]) async for user in users_cursor if user.get("_id")]
            if not user_ids:
                continue

            outcome = await _dispatch_class_reminders_for_users(
                db=db,
                session_id=session_id,
                level=level,
                user_ids=user_ids,
                now=now_lagos,
            )
            total_created += int(outcome.get("created", 0))

        if total_created:
            logger.info("[Scheduler] timetable_class_reminders: created %d reminder notification(s)", total_created)
    except Exception as exc:
        logger.error("[Scheduler] timetable_class_reminders job crashed: %s", exc, exc_info=True)


# ─────────────────────────────────────────────────────────────────────────────
# Scheduler lifecycle
# ─────────────────────────────────────────────────────────────────────────────

def start_scheduler() -> None:
    """
    Start the AsyncIOScheduler with all registered jobs.
    Call once from the FastAPI lifespan startup.
    """
    global _scheduler

    if not _HAS_APSCHEDULER:
        logger.warning("[Scheduler] APScheduler unavailable — skipping scheduler start.")
        return

    if _scheduler and _scheduler.running:
        logger.warning("[Scheduler] Scheduler already running — skipping duplicate start.")
        return

    _scheduler = AsyncIOScheduler(timezone="UTC")

    # Job 1: Birthday wishes — 08:00 UTC daily
    _scheduler.add_job(
        birthday_wishes,
        CronTrigger(hour=8, minute=0, timezone="UTC"),
        id="birthday_wishes",
        name="Daily Birthday Wishes",
        replace_existing=True,
        misfire_grace_time=3600,  # 1 hour grace — runs even if missed by up to 1h
    )

    # Job 2: Event reminders — 08:00 UTC daily
    _scheduler.add_job(
        event_reminders,
        CronTrigger(hour=8, minute=0, timezone="UTC"),
        id="event_reminders",
        name="Daily Event Reminders",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Job 3: Payment deadline reminders — 08:05 UTC daily
    _scheduler.add_job(
        payment_deadline_reminders,
        CronTrigger(hour=8, minute=5, timezone="UTC"),
        id="payment_deadline_reminders",
        name="Daily Payment Deadline Reminders",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Job 4: Planner deadline alerts — 07:00 UTC daily
    _scheduler.add_job(
        planner_deadline_alerts,
        CronTrigger(hour=7, minute=0, timezone="UTC"),
        id="planner_deadline_alerts",
        name="Daily Planner Deadline Alerts",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Job 5: Timetable reminders — every minute
    _scheduler.add_job(
        timetable_class_reminders,
        IntervalTrigger(minutes=1, timezone="UTC"),
        id="timetable_class_reminders",
        name="Timetable Class Reminders",
        replace_existing=True,
        misfire_grace_time=50,
        coalesce=True,
        max_instances=1,
    )

    _scheduler.start()
    logger.info(
        "[Scheduler] Started — 5 jobs registered: "
        "birthday_wishes@08:00, event_reminders@08:00, "
        "payment_deadline_reminders@08:05, planner_deadline_alerts@07:00, "
        "timetable_class_reminders@every-1m (all UTC)"
    )


def stop_scheduler() -> None:
    """
    Gracefully shut down the scheduler.
    Call from the FastAPI lifespan shutdown.
    """
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Stopped.")
    _scheduler = None
