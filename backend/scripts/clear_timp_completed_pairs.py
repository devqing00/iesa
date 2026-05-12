#!/usr/bin/env python3
"""
Clear TIMP completed pairs and unpair affected users.

Usage:
  python scripts/clear_timp_completed_pairs.py
  python scripts/clear_timp_completed_pairs.py --execute
  python scripts/clear_timp_completed_pairs.py --execute --all-sessions
  python scripts/clear_timp_completed_pairs.py --execute --session-id <sessionId>
  python scripts/clear_timp_completed_pairs.py --execute --delete-feedback --delete-messages

By default this is a dry-run and only reports what would be removed.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Add backend root to path
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


async def _sync_pair_role_tags(db, session_id: str, mentor_id: str, mentee_id: str) -> None:
    now = datetime.now(timezone.utc)

    mentor_active = 0
    if mentor_id:
        mentor_active = await db["timpPairs"].count_documents({
            "mentorId": mentor_id,
            "sessionId": session_id,
            "status": "active",
        })

    mentee_active = 0
    if mentee_id:
        mentee_active = await db["timpPairs"].count_documents({
            "menteeId": mentee_id,
            "sessionId": session_id,
            "status": "active",
        })

    async def _upsert_active_role(user_id: str, position: str, permissions: list[str]) -> None:
        existing = await db["roles"].find_one({
            "userId": user_id,
            "sessionId": session_id,
            "position": position,
            "isActive": True,
        })
        if existing:
            return

        dormant = await db["roles"].find_one({
            "userId": user_id,
            "sessionId": session_id,
            "position": position,
        })
        if dormant:
            await db["roles"].update_one(
                {"_id": dormant["_id"]},
                {"$set": {"isActive": True, "permissions": permissions, "updatedAt": now}},
            )
        else:
            await db["roles"].insert_one({
                "userId": user_id,
                "sessionId": session_id,
                "position": position,
                "permissions": permissions,
                "assignedBy": "system:timp_pair_activation",
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            })

    async def _deactivate_role(user_id: str, position: str) -> None:
        await db["roles"].update_many(
            {
                "userId": user_id,
                "sessionId": session_id,
                "position": position,
                "isActive": True,
            },
            {"$set": {"isActive": False, "updatedAt": now}},
        )

    if mentor_id:
        if mentor_active > 0:
            await _upsert_active_role(mentor_id, "timp_mentor", ["timp:view", "announcement:view"])
        else:
            await _deactivate_role(mentor_id, "timp_mentor")

    if mentee_id:
        if mentee_active > 0:
            await _upsert_active_role(mentee_id, "timp_mentee", ["timp:view", "announcement:view"])
        else:
            await _deactivate_role(mentee_id, "timp_mentee")


async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Clear TIMP completed pairs")
    parser.add_argument("--execute", action="store_true", help="Apply destructive changes. Default is dry-run.")
    parser.add_argument("--all-sessions", action="store_true", help="Target all sessions (default: active session only)")
    parser.add_argument("--session-id", help="Target a specific session ID (overrides active session)")
    parser.add_argument("--delete-feedback", action="store_true", help="Also delete feedback for removed pairs")
    parser.add_argument("--delete-messages", action="store_true", help="Also delete messages for removed pairs")
    args = parser.parse_args()

    if args.all_sessions and args.session_id:
        print("Choose either --all-sessions or --session-id, not both.")
        return

    mongo_url, db_name = _env()
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        session_id = args.session_id
        if not args.all_sessions and not session_id:
            session_id = await _active_session_id(db)
            if not session_id:
                print("No active session found. Use --all-sessions or --session-id.")
                return

        query: dict = {"status": "completed"}
        if session_id:
            query["sessionId"] = session_id

        cursor = db["timpPairs"].find(
            query,
            {
                "mentorId": 1,
                "mentorName": 1,
                "menteeId": 1,
                "menteeName": 1,
                "sessionId": 1,
                "createdAt": 1,
                "status": 1,
            },
        )
        pairs = [p async for p in cursor]

        pair_object_ids = [p["_id"] for p in pairs]
        pair_ids = [str(p["_id"]) for p in pairs]

        unique_mentors = {p.get("mentorId") for p in pairs if p.get("mentorId")}
        unique_mentees = {p.get("menteeId") for p in pairs if p.get("menteeId")}

        feedback_count = 0
        messages_count = 0
        if pair_ids:
            feedback_count = await db["timpFeedback"].count_documents({"pairId": {"$in": pair_ids}})
            messages_count = await db["timpMessages"].count_documents({"pairId": {"$in": pair_ids}})

        print("\n" + "=" * 72)
        print(" TIMP Completed Pair Cleanup")
        print("=" * 72)
        print(f"Database : {db_name}")
        print(f"Scope    : {'all sessions' if args.all_sessions else f'session {session_id}'}")
        print(f"Pairs    : {len(pairs)} completed")
        print(f"Mentors  : {len(unique_mentors)}")
        print(f"Mentees  : {len(unique_mentees)}")
        print(f"Feedback : {feedback_count} (pair-linked)")
        print(f"Messages : {messages_count} (pair-linked)")

        if pairs:
            print("\nSample pairs (up to 10):")
            for p in pairs[:10]:
                mentor = p.get("mentorName") or p.get("mentorId") or "Unknown mentor"
                mentee = p.get("menteeName") or p.get("menteeId") or "Unknown mentee"
                print(f" - {mentor} -> {mentee} | pairId={p.get('_id')} | session={p.get('sessionId')}")

        if not args.execute:
            print("\nDry-run complete. Re-run with --execute to apply changes.")
            return

        print("\nWARNING: You are about to delete completed TIMP pairs.")
        confirm = input("Type 'yes' to continue: ").strip().lower()
        if confirm != "yes":
            print("Aborted.")
            return

        deleted_pairs = 0
        if pair_object_ids:
            result = await db["timpPairs"].delete_many({"_id": {"$in": pair_object_ids}})
            deleted_pairs = result.deleted_count

        deleted_feedback = 0
        if args.delete_feedback and pair_ids:
            result = await db["timpFeedback"].delete_many({"pairId": {"$in": pair_ids}})
            deleted_feedback = result.deleted_count

        deleted_messages = 0
        if args.delete_messages and pair_ids:
            result = await db["timpMessages"].delete_many({"pairId": {"$in": pair_ids}})
            deleted_messages = result.deleted_count

        sync_targets = {(p.get("sessionId"), p.get("mentorId"), p.get("menteeId")) for p in pairs}
        sync_targets = {t for t in sync_targets if t[0] and (t[1] or t[2])}
        for sid, mentor_id, mentee_id in sync_targets:
            await _sync_pair_role_tags(db, sid, mentor_id or "", mentee_id or "")

        print("\nCleanup complete:")
        print(f" - pairs deleted     : {deleted_pairs}")
        if args.delete_feedback:
            print(f" - feedback deleted  : {deleted_feedback}")
        if args.delete_messages:
            print(f" - messages deleted  : {deleted_messages}")
        print(f" - roles synced      : {len(sync_targets)}")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
