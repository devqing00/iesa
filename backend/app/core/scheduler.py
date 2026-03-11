"""
IESA Scheduled Jobs — APScheduler (AsyncIOScheduler)

Daily background jobs that run at server time (UTC):
  07:00 UTC — planner_deadline_alerts  (planner tasks due tomorrow)
  08:00 UTC — birthday_wishes          (users with birthday today)
  08:00 UTC — event_reminders          (events happening tomorrow)
  08:05 UTC — payment_deadline_reminders (payments due tomorrow for unpaid students)

All jobs are fire-and-forget — failures are logged but never crash the server.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("iesa_backend.scheduler")

# ─── Lazy import so the scheduler module can be imported without
#     APScheduler being installed (fails gracefully at startup instead). ─────
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    _HAS_APSCHEDULER = True
except ImportError:
    _HAS_APSCHEDULER = False
    logger.warning(
        "APScheduler not installed — scheduled jobs disabled. "
        "Install with: pip install apscheduler==3.10.4"
    )

_scheduler: "AsyncIOScheduler | None" = None


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
        from app.routers.notifications import create_notification

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
            {"$project": {"_id": 1, "firstName": 1}},
        ]

        celebrants = await db["users"].aggregate(pipeline).to_list(length=200)
        if not celebrants:
            logger.info("[Scheduler] birthday_wishes: no birthdays today (%02d-%02d)", month, day)
            return

        logger.info(
            "[Scheduler] birthday_wishes: %d birthday(s) on %02d-%02d",
            len(celebrants), month, day,
        )

        for user in celebrants:
            user_id = str(user["_id"])
            first_name = user.get("firstName", "")
            greeting = f"Happy Birthday, {first_name}! 🎂" if first_name else "Happy Birthday!"
            try:
                await create_notification(
                    user_id=user_id,
                    type="birthday",
                    title=greeting,
                    message=(
                        "Wishing you a wonderful birthday from the entire IESA community! "
                        "Hope your day is as amazing as you are. 🎉"
                    ),
                    link="/dashboard",
                    category="academic",
                )
            except Exception as e:
                logger.warning(
                    "[Scheduler] birthday_wishes: failed for userId=%s — %s", user_id, e
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

    _scheduler.start()
    logger.info(
        "[Scheduler] Started — 4 jobs registered: "
        "birthday_wishes@08:00, event_reminders@08:00, "
        "payment_deadline_reminders@08:05, planner_deadline_alerts@07:00 (all UTC)"
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
