"""
Backfill isExternalStudent field on existing user documents.

Users who registered before the isExternalStudent field was added will not
have it in their MongoDB document. This script sets:
  - isExternalStudent = True  for department != "Industrial Engineering"
  - isExternalStudent = False for department == "Industrial Engineering" or missing

Also ensures every user has a department field (defaults to "Industrial Engineering").

Usage:
    python -m scripts.backfill_external_student

Run from the backend/ directory with MONGODB_URI in the environment.
"""

import asyncio
import os
import sys

from motor.motor_asyncio import AsyncIOMotorClient


IPE_DEPARTMENT = "Industrial Engineering"

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB", "iesa")


async def backfill():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    users = db["users"]

    total = await users.count_documents({})
    print(f"Total users: {total}")

    # 1. Set department to IPE for users missing the field entirely
    missing_dept = await users.update_many(
        {"department": {"$exists": False}},
        {"$set": {"department": IPE_DEPARTMENT, "isExternalStudent": False}},
    )
    print(f"Set department to IPE (was missing): {missing_dept.modified_count}")

    # 2. Set isExternalStudent = False for IPE students missing the field
    ipe_result = await users.update_many(
        {
            "department": IPE_DEPARTMENT,
            "isExternalStudent": {"$exists": False},
        },
        {"$set": {"isExternalStudent": False}},
    )
    print(f"Set isExternalStudent=False (IPE): {ipe_result.modified_count}")

    # 3. Set isExternalStudent = True for external students missing the field
    ext_result = await users.update_many(
        {
            "department": {"$ne": IPE_DEPARTMENT},
            "isExternalStudent": {"$exists": False},
        },
        {"$set": {"isExternalStudent": True}},
    )
    print(f"Set isExternalStudent=True (external): {ext_result.modified_count}")

    # 4. Fix any inconsistencies: department != IPE but isExternalStudent = False
    fix_false = await users.update_many(
        {
            "department": {"$ne": IPE_DEPARTMENT},
            "isExternalStudent": False,
        },
        {"$set": {"isExternalStudent": True}},
    )
    print(f"Fixed inconsistent isExternalStudent=False (should be True): {fix_false.modified_count}")

    # 5. Fix the reverse: department == IPE but isExternalStudent = True
    fix_true = await users.update_many(
        {
            "department": IPE_DEPARTMENT,
            "isExternalStudent": True,
        },
        {"$set": {"isExternalStudent": False}},
    )
    print(f"Fixed inconsistent isExternalStudent=True (should be False): {fix_true.modified_count}")

    total_modified = (
        missing_dept.modified_count
        + ipe_result.modified_count
        + ext_result.modified_count
        + fix_false.modified_count
        + fix_true.modified_count
    )
    print(f"\nDone. Total documents modified: {total_modified}")

    client.close()


if __name__ == "__main__":
    asyncio.run(backfill())
