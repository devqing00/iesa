#!/usr/bin/env python3
"""
Clear IEPOD niche-audit submissions for selected registrations.

Default behavior targets approved registrations in the active session.
This script clears ONLY niche-audit artifacts (audit docs, registration links,
and associated niche-audit points), not user accounts.

Usage:
  # Dry run (safe preview)
  python scripts/clear_iepod_niche_audits.py

  # Execute for approved registrations in active session
  python scripts/clear_iepod_niche_audits.py --execute

  # Execute for specific users (repeat --user-id)
  python scripts/clear_iepod_niche_audits.py --execute --user-id <uid1> --user-id <uid2>

  # Execute across all sessions
  python scripts/clear_iepod_niche_audits.py --execute --all-sessions

  # Keep points untouched (not recommended)
  python scripts/clear_iepod_niche_audits.py --execute --keep-points
"""

import asyncio
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _env() -> tuple[str, str]:
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    load_dotenv(env_path)
    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"
    return mongo_url, db_name


async def _active_session_id(db) -> str | None:
    sess = await db["sessions"].find_one({"isActive": True}, {"_id": 1})
    return str(sess["_id"]) if sess and sess.get("_id") else None


async def _collect_targets(db, *, session_id: str | None, statuses: list[str], user_ids: list[str]):
    query: dict = {
        "nicheAuditId": {"$nin": [None, ""]},
    }
    if session_id:
        query["sessionId"] = session_id
    if statuses:
        query["status"] = {"$in": statuses}
    if user_ids:
        query["userId"] = {"$in": user_ids}

    docs = await db["iepod_registrations"].find(
        query,
        {
            "_id": 1,
            "userId": 1,
            "userName": 1,
            "sessionId": 1,
            "status": 1,
            "points": 1,
            "nicheAuditId": 1,
        },
    ).to_list(length=5000)
    return docs


async def _summarize_points_to_remove(db, registrations):
    if not registrations:
        return {}, []

    by_user_session: dict[tuple[str, str], int] = defaultdict(int)
    audit_ids = [str(r.get("nicheAuditId")) for r in registrations if r.get("nicheAuditId")]
    cursor = db["iepod_points"].find(
        {
            "$or": [
                {"action": "niche_audit", "referenceId": {"$in": audit_ids}},
                {"action": "niche_audit", "referenceId": {"$exists": False}},
            ]
        },
        {"_id": 1, "userId": 1, "sessionId": 1, "points": 1, "action": 1, "referenceId": 1},
    )

    point_docs = []
    async for p in cursor:
        point_docs.append(p)

    reg_keys = {(r.get("userId"), r.get("sessionId")) for r in registrations}
    matched_point_ids = []
    for p in point_docs:
        key = (p.get("userId"), p.get("sessionId"))
        if key in reg_keys:
            by_user_session[key] += int(p.get("points") or 0)
            matched_point_ids.append(p["_id"])

    return by_user_session, matched_point_ids


async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Clear IEPOD niche-audits from selected registrations")
    parser.add_argument("--execute", action="store_true", help="Apply destructive changes. Default is dry-run.")
    parser.add_argument("--all-sessions", action="store_true", help="Target all sessions instead of active session only")
    parser.add_argument("--status", action="append", default=["approved"], help="Registration status filter (repeatable)")
    parser.add_argument("--user-id", action="append", default=[], help="Restrict to specific user IDs (repeatable)")
    parser.add_argument("--keep-points", action="store_true", help="Do not remove niche-audit point entries or rebalance registration points")
    args = parser.parse_args()

    mongo_url, db_name = _env()
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        session_id = None
        if not args.all_sessions:
            session_id = await _active_session_id(db)
            if not session_id:
                print("No active session found. Use --all-sessions or set an active session first.")
                return

        statuses = [s.strip().lower() for s in args.status if s.strip()]
        regs = await _collect_targets(
            db,
            session_id=session_id,
            statuses=statuses,
            user_ids=[u.strip() for u in args.user_id if u.strip()],
        )

        by_user_session, point_ids = await _summarize_points_to_remove(db, regs)

        print("\n" + "=" * 72)
        print(" IEPOD Niche Audit Cleanup")
        print("=" * 72)
        print(f"Database: {db_name}")
        print(f"Scope   : {'all sessions' if args.all_sessions else f'active session ({session_id})'}")
        print(f"Statuses: {', '.join(statuses) if statuses else 'any'}")
        print(f"Targets : {len(regs)} registration(s)")

        if regs:
            print("\nSample targets (up to 10):")
            for r in regs[:10]:
                print(
                    f" - {r.get('userName', 'Unknown')} | userId={r.get('userId')} | "
                    f"status={r.get('status')} | session={r.get('sessionId')} | audit={r.get('nicheAuditId')}"
                )

        audit_ids = [str(r.get("nicheAuditId")) for r in regs if r.get("nicheAuditId")]
        print(f"\nNiche audit docs to delete: {len(audit_ids)}")
        if args.keep_points:
            print("Niche-audit points cleanup: skipped (--keep-points)")
        else:
            print(f"Niche-audit point rows to delete: {len(point_ids)}")

        if not args.execute:
            print("\nDry-run complete. Re-run with --execute to apply changes.")
            return

        confirm = input("\nType 'yes' to confirm destructive cleanup: ").strip().lower()
        if confirm != "yes":
            print("Aborted.")
            return

        now = datetime.now(timezone.utc)

        reg_ids = [r["_id"] for r in regs]
        if reg_ids:
            reg_update = await db["iepod_registrations"].update_many(
                {"_id": {"$in": reg_ids}},
                {"$set": {"nicheAuditId": None, "updatedAt": now}},
            )
        else:
            reg_update = None

        audit_object_ids = [ObjectId(aid) for aid in audit_ids if ObjectId.is_valid(aid)]
        audit_delete = await db["iepod_niche_audits"].delete_many({"_id": {"$in": audit_object_ids}})

        points_deleted = 0
        points_rebalanced_regs = 0
        if not args.keep_points and point_ids:
            pd = await db["iepod_points"].delete_many({"_id": {"$in": point_ids}})
            points_deleted = pd.deleted_count
            for (uid, sid), deducted in by_user_session.items():
                if deducted <= 0:
                    continue
                await db["iepod_registrations"].update_one(
                    {"userId": uid, "sessionId": sid},
                    {"$inc": {"points": -deducted}, "$set": {"updatedAt": now}},
                )
                points_rebalanced_regs += 1

        print("\nCleanup complete:")
        print(f" - Registrations updated (nicheAuditId cleared): {reg_update.modified_count if reg_update else 0}")
        print(f" - Niche audit docs deleted: {audit_delete.deleted_count}")
        if args.keep_points:
            print(" - Points untouched")
        else:
            print(f" - Niche-audit point rows deleted: {points_deleted}")
            print(f" - Registrations rebalanced for points: {points_rebalanced_regs}")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
