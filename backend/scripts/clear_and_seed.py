#!/usr/bin/env python3
"""
IESA Database Reset Script

Usage:
    # Full reset: clear everything and create session
    python scripts/clear_and_seed.py --all

    # Full reset with a custom session name
    python scripts/clear_and_seed.py --all --session "2025/2026"

    # Clear data only (no session or admin created)
    python scripts/clear_and_seed.py --clear-only

    # Clear everything except user accounts
    python scripts/clear_and_seed.py --clear-only --keep-users

    # Promote an existing user to admin
    python scripts/clear_and_seed.py --admin user@example.com

This script:
 1. Clears ALL collections.
 2. Creates an academic session and marks it active.
 3. Optionally promotes an existing user to super_admin.

WARNING: --all and --clear-only DELETE data permanently. Use with care.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Add backend root to path so dotenv resolution works properly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─── All MongoDB collections managed by the IESA platform ────────────────────
ALL_COLLECTIONS = [
    # Core
    "users",
    "sessions",
    "enrollments",
    "roles",
    "refresh_tokens",
    "audit_logs",
    # Content
    "announcements",
    "events",
    "payments",
    "transactions",
    "press_articles",
    "resources",
    "notifications",
    "contact_messages",
    # Timetable
    "classSessions",
    "classCancellations",
    "academicEvents",
    # Payments
    "bankAccounts",
    "bankTransfers",
    "paystackTransactions",
    "platformSettings",
    # Study Groups
    "study_groups",
    # Growth Hub
    "growth_data",
    # Applications
    "unit_applications",
    "unit_settings",
    # TIMP
    "timpApplications",
    "timpPairs",
    "timpFeedback",
    "timpSettings",
    # IEPOD
    "iepod_societies",
    "iepod_registrations",
    "iepod_niche_audits",
    "iepod_teams",
    "iepod_submissions",
    "iepod_quizzes",
    "iepod_quiz_responses",
    "iepod_points",
    # AI
    "ai_feedback",
    "ai_rate_limits",
    # Class Rep Portal
    "class_rep_deadlines",
    "class_rep_polls",
    "class_rep_relay",
    # Unit Head Portal
    "unit_noticeboard",
    "unit_tasks",
]

# ─── Helpers ─────────────────────────────────────────────────────────────────

async def clear_all_data(db, keep_users: bool = False) -> None:
    """Delete all documents from every tracked collection."""
    skip = {"users", "refresh_tokens"} if keep_users else set()
    label = (
        "Clearing session/content data (keeping users)..."
        if keep_users
        else "Clearing all data..."
    )
    print(f"\n   {label}")

    for col_name in ALL_COLLECTIONS:
        if col_name in skip:
            continue
        result = await db[col_name].delete_many({})
        if result.deleted_count > 0:
            print(f"   + Deleted {result.deleted_count:>6} docs from '{col_name}'")
        else:
            print(f"   - (empty) '{col_name}'")


async def create_session(db, session_name: str) -> str:
    """Create (or reuse) the active academic session."""
    sessions = db["sessions"]

    existing = await sessions.find_one({"name": session_name})
    if existing:
        await sessions.update_one(
            {"_id": existing["_id"]}, {"$set": {"isActive": True}}
        )
        print(f"   + Session '{session_name}' already exists — marked active")
        return str(existing["_id"])

    try:
        start_year = int(session_name.split("/")[0])
    except (IndexError, ValueError):
        start_year = datetime.now().year

    now = datetime.now(timezone.utc)
    doc = {
        "name": session_name,
        "startDate":          datetime(start_year,     9,  1, tzinfo=timezone.utc),
        "endDate":            datetime(start_year + 1, 8, 31, tzinfo=timezone.utc),
        "semester1StartDate": datetime(start_year,     9,  1, tzinfo=timezone.utc),
        "semester1EndDate":   datetime(start_year + 1, 2, 28, tzinfo=timezone.utc),
        "semester2StartDate": datetime(start_year + 1, 3,  1, tzinfo=timezone.utc),
        "semester2EndDate":   datetime(start_year + 1, 8, 31, tzinfo=timezone.utc),
        "currentSemester": 1,
        "isActive": True,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await sessions.insert_one(doc)
    sid = str(result.inserted_id)
    print(f"   + Created active session: '{session_name}'")
    return sid


async def promote_user_to_admin(db, email: str) -> None:
    """Promote an existing user to super_admin role."""
    result = await db["users"].update_one(
        {"email": email},
        {"$set": {"role": "super_admin", "updatedAt": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        print(f"   x No user found with email: {email}")
    else:
        print(f"   + Promoted '{email}' to admin")


# ─── Entry point ──────────────────────────────────────────────────────────────

async def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="IESA Database Reset Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Clear all data and create session",
    )
    parser.add_argument(
        "--clear-only",
        action="store_true",
        help="Clear all data and exit (no session or admin created)",
    )
    parser.add_argument(
        "--session",
        type=str,
        default="2025/2026",
        metavar="NAME",
        help='Academic session name, e.g. "2025/2026" (default: 2025/2026)',
    )
    parser.add_argument(
        "--admin",
        type=str,
        metavar="EMAIL",
        help="Promote an existing user to admin role",
    )
    parser.add_argument(
        "--keep-users",
        action="store_true",
        help="Preserve user accounts when clearing",
    )

    args = parser.parse_args()

    if not args.clear_only and not args.all and not args.admin:
        parser.print_help()
        sys.exit(0)

    # Resolve .env from backend/
    _env_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
    )
    load_dotenv(_env_path)
    mongo_url = (
        os.getenv("MONGODB_URL")
        or os.getenv("MONGO_URL")
        or "mongodb://localhost:27017"
    )
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"

    print(f"\n{'='*55}")
    print(f"  IESA Database Reset")
    print(f"{'='*55}")
    print(f"  Database  : {db_name}")
    print(f"  MongoDB   : {mongo_url[:45]}{'...' if len(mongo_url) > 45 else ''}")
    if args.all or args.clear_only:
        print(f"  Action    : {'clear + init' if args.all else 'clear only'}")
        print(f"  Keep users: {args.keep_users}")
    if args.admin:
        print(f"  Promote   : {args.admin}")
    print(f"{'='*55}")
    print()

    confirm = input("WARNING: This will permanently DELETE data. Type 'yes' to continue: ").strip()
    if confirm.lower() != "yes":
        print("Aborted.")
        sys.exit(0)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        # ── 1. Clear ──────────────────────────────────────────────────────
        if args.all or args.clear_only:
            await clear_all_data(db, keep_users=args.keep_users)

        if args.clear_only:
            print("\nDone — all data cleared.")
            return

        # ── 2. Session ────────────────────────────────────────────────────
        if args.all:
            print(f"\n   Setting up academic session '{args.session}'...")
            await create_session(db, args.session)

        # ── 3. Promote ────────────────────────────────────────────────────
        if args.admin:
            print(f"\n   Promoting user to admin...")
            await promote_user_to_admin(db, args.admin)

        print(f"\n{'='*55}")
        print(f"  Done!")
        if args.all:
            print(f"  Session  : {args.session}  (active)")
            print(f"  Promote users with: --admin <email>")
        print(f"{'='*55}\n")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
