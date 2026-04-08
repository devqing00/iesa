#!/usr/bin/env python3
"""
Reset one user's IEPOD data for the active session.

This is a maintenance script for QA cleanup and support operations.
It mirrors the admin reset endpoint behavior and supports dry-run mode.

Usage:
  # Dry run
  python scripts/reset_iepod_user_data.py --user-id <userId>

  # Execute reset
  python scripts/reset_iepod_user_data.py --user-id <userId> --execute --reason "Cleanup after mock run"

  # Execute reset and block rejoin for the session
  python scripts/reset_iepod_user_data.py --user-id <userId> --execute --block-rejoin --reason "Policy breach"
"""

import asyncio
import os
import sys
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


def _user_id_variants(user_id: str):
    variants = [user_id]
    if ObjectId.is_valid(user_id):
        variants.append(ObjectId(user_id))
    return variants


async def _active_session_id(db) -> str | None:
    doc = await db["sessions"].find_one({"isActive": True}, {"_id": 1})
    return str(doc["_id"]) if doc and doc.get("_id") else None


async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Reset one user's IEPOD data for the active session")
    parser.add_argument("--user-id", required=True, help="User ID (ObjectId string)")
    parser.add_argument("--execute", action="store_true", help="Apply destructive changes. Default is dry-run")
    parser.add_argument("--block-rejoin", action="store_true", help="Block user from re-registering this session")
    parser.add_argument("--reason", default="Admin script reset", help="Reason for reset/block log")
    args = parser.parse_args()

    mongo_url, db_name = _env()
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        session_id = await _active_session_id(db)
        if not session_id:
            print("No active session found.")
            return

        user_id = args.user_id.strip()
        variants = _user_id_variants(user_id)

        reg = await db["iepod_registrations"].find_one(
            {
                "sessionId": session_id,
                "$or": [
                    {"userId": {"$in": variants}},
                    {"studentId": {"$in": variants}},
                ],
            },
            {"userId": 1, "userName": 1, "userEmail": 1},
        )

        canonical_user_id = str(reg.get("userId")) if reg and reg.get("userId") else user_id

        teams = await db["iepod_teams"].find(
            {"sessionId": session_id, "members.userId": canonical_user_id},
            {"_id": 1, "name": 1, "members": 1, "leaderId": 1},
        ).to_list(length=200)
        team_ids = [str(t.get("_id")) for t in teams]

        print("\n" + "=" * 72)
        print(" IEPOD User Reset")
        print("=" * 72)
        print(f"Database : {db_name}")
        print(f"Session  : {session_id}")
        print(f"User     : {canonical_user_id}")
        print(f"Name     : {(reg or {}).get('userName', 'Unknown')}")
        print(f"Teams    : {len(team_ids)}")
        print(f"Block    : {args.block_rejoin}")

        if not args.execute:
            print("\nDry-run complete. Re-run with --execute to apply changes.")
            return

        confirm = input("\nType 'yes' to continue: ").strip().lower()
        if confirm != "yes":
            print("Aborted.")
            return

        deleted_teams = 0
        updated_teams = 0
        for team in teams:
            members = team.get("members") or []
            remaining = [m for m in members if str(m.get("userId") or "") != canonical_user_id]
            team_id = str(team.get("_id"))
            if not remaining:
                await db["iepod_submissions"].delete_many({"sessionId": session_id, "teamId": team_id})
                await db["iepod_teams"].delete_one({"_id": team.get("_id")})
                deleted_teams += 1
                continue

            updates = {
                "members": remaining,
                "updatedAt": datetime.now(timezone.utc),
            }
            if str(team.get("leaderId") or "") == canonical_user_id:
                updates["leaderId"] = str(remaining[0].get("userId") or "")
                updates["leaderName"] = remaining[0].get("userName") or "Team Lead"
            await db["iepod_teams"].update_one({"_id": team.get("_id")}, {"$set": updates})
            updated_teams += 1

        await db["iepod_niche_audits"].delete_many({"sessionId": session_id, "userId": canonical_user_id})
        await db["iepod_quiz_responses"].delete_many({"sessionId": session_id, "userId": canonical_user_id})
        await db["iepod_live_quiz_participants"].delete_many({"sessionId": session_id, "userId": canonical_user_id})
        await db["iepod_live_quiz_answers"].delete_many({"sessionId": session_id, "userId": canonical_user_id})
        await db["iepod_points"].delete_many({"sessionId": session_id, "userId": canonical_user_id})
        await db["iepod_quiz_points"].delete_many({"sessionId": session_id, "userId": canonical_user_id})
        await db["iepod_registrations"].delete_many(
            {
                "sessionId": session_id,
                "$or": [
                    {"userId": {"$in": _user_id_variants(canonical_user_id)}},
                    {"studentId": {"$in": _user_id_variants(canonical_user_id)}},
                ],
            }
        )

        if team_ids:
            await db["iepod_registrations"].update_many(
                {"sessionId": session_id, "teamId": {"$in": team_ids}},
                {"$set": {"teamId": None, "updatedAt": datetime.now(timezone.utc)}},
            )

        if args.block_rejoin:
            await db["iepod_registration_blocks"].update_one(
                {"sessionId": session_id, "userId": canonical_user_id},
                {
                    "$set": {
                        "sessionId": session_id,
                        "userId": canonical_user_id,
                        "userEmail": (reg or {}).get("userEmail"),
                        "reason": args.reason,
                        "blockedByUserId": "script",
                        "blockedByEmail": "script",
                        "updatedAt": datetime.now(timezone.utc),
                    },
                    "$setOnInsert": {"createdAt": datetime.now(timezone.utc)},
                },
                upsert=True,
            )
        else:
            await db["iepod_registration_blocks"].delete_many({"sessionId": session_id, "userId": canonical_user_id})

        print("\nReset complete:")
        print(f" - Teams deleted: {deleted_teams}")
        print(f" - Teams updated: {updated_teams}")
        print(f" - Rejoin blocked: {args.block_rejoin}")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
