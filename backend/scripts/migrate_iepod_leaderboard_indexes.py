#!/usr/bin/env python3
"""
Ensure IEPOD leaderboard-supporting indexes exist.

Creates the following indexes if missing:
- iepod_registrations(sessionId, userId)
- iepod_points(sessionId, userId)

Usage:
  python scripts/migrate_iepod_leaderboard_indexes.py
"""

import asyncio
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING


def _env() -> tuple[str, str]:
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    load_dotenv(env_path)
    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"
    return mongo_url, db_name


async def main() -> None:
    mongo_url, db_name = _env()
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        reg_index = await db["iepod_registrations"].create_index(
            [("sessionId", ASCENDING), ("userId", ASCENDING)],
            name="idx_iepod_registration_session_user",
        )
        points_index = await db["iepod_points"].create_index(
            [("sessionId", ASCENDING), ("userId", ASCENDING)],
            name="idx_iepod_points_session_user",
        )

        print("IEPOD leaderboard index migration complete")
        print(f" - iepod_registrations: {reg_index}")
        print(f" - iepod_points: {points_index}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
