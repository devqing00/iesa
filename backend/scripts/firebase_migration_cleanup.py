#!/usr/bin/env python3
"""
Firebase Migration Cleanup Script

Run ONCE after deploying the Firebase Auth migration.
This script:
  1. Drops the 'refresh_tokens' collection (JWT refresh tokens — no longer used)
  2. Removes old auth fields from all user documents:
     - passwordHash, twoFactorEnabled, twoFactorSecret,
       twoFactorPendingSecret, twoFactorBackupCodes, googleId
  3. Drops the 'ai_rate_limits' TTL index that references old fields (if any)
  4. Prints summary of changes

Usage:
    cd backend
    python scripts/firebase_migration_cleanup.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")

OLD_USER_FIELDS = [
    "passwordHash",
    "twoFactorEnabled",
    "twoFactorSecret",
    "twoFactorPendingSecret",
    "twoFactorBackupCodes",
    "googleId",          # replaced by firebaseUid
]


async def cleanup():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    print()
    print("=" * 60)
    print("   Firebase Auth Migration — Data Cleanup")
    print("=" * 60)
    print()

    # 1. Drop refresh_tokens collection
    collections = await db.list_collection_names()
    if "refresh_tokens" in collections:
        await db.drop_collection("refresh_tokens")
        print("✅ Dropped 'refresh_tokens' collection")
    else:
        print("ℹ️  'refresh_tokens' collection does not exist — skipping")

    # 2. Remove old auth fields from all users
    unset_fields = {field: "" for field in OLD_USER_FIELDS}
    result = await db.users.update_many({}, {"$unset": unset_fields})
    print(f"✅ Cleaned {result.modified_count} user document(s) — removed old auth fields")

    # 3. Ensure firebaseUid index exists (sparse + unique)
    existing_indexes = await db.users.index_information()
    fb_index_ok = False
    for name, info in existing_indexes.items():
        keys = info.get("key", [])
        if any(k[0] == "firebaseUid" for k in keys):
            fb_index_ok = True
            print(f"ℹ️  'firebaseUid' index already exists: {name}")
            break
    if not fb_index_ok:
        await db.users.create_index("firebaseUid", unique=True, sparse=True)
        print("✅ Created unique sparse index on users.firebaseUid")

    # 4. Summary
    total_users = await db.users.count_documents({})
    users_with_firebase = await db.users.count_documents({"firebaseUid": {"$exists": True, "$ne": None}})
    users_without = total_users - users_with_firebase

    print()
    print("-" * 60)
    print(f"   Total users:             {total_users}")
    print(f"   With firebaseUid:        {users_with_firebase}")
    print(f"   Without firebaseUid:     {users_without}")
    if users_without > 0:
        print(f"\n   ⚠️  {users_without} user(s) have no firebaseUid.")
        print("   They cannot log in until they re-register via Firebase.")
    print("-" * 60)
    print()
    print("🎉 Cleanup complete!")
    print()

    client.close()


if __name__ == "__main__":
    asyncio.run(cleanup())
