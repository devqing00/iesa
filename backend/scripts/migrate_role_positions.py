#!/usr/bin/env python3
"""
Role Position Migration Script

Renames legacy executive position names to new canonical names in MongoDB.

Mappings:
  - director_of_socials → social_director
  - director_of_sports → sports_secretary

This script is designed to run ONCE after deploying the executive role restructuring.
It's safe to run multiple times (idempotent) — already-renamed positions are skipped.

Usage:
    cd backend
    python scripts/migrate_role_positions.py

    # Dry run (preview changes without applying):
    python scripts/migrate_role_positions.py --dry-run
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

# Legacy → Canonical position mappings
POSITION_RENAMES = {
    "director_of_socials": "social_director",
    "director_of_sports": "sports_secretary",
}


async def migrate_roles(db, dry_run: bool = False):
    """Rename legacy role positions to canonical names."""
    roles_coll = db["roles"]

    print()
    print("=" * 65)
    print("   Role Position Migration — Legacy → Canonical Names")
    print("=" * 65)
    print(f"  Database: {DATABASE_NAME}")
    print(f"  Dry Run : {'YES (no changes applied)' if dry_run else 'NO (changes will be applied)'}")
    print("=" * 65)
    print()

    total_renamed = 0

    for legacy_position, canonical_position in POSITION_RENAMES.items():
        # Count existing legacy roles
        legacy_count = await roles_coll.count_documents({"position": legacy_position})

        if legacy_count == 0:
            print(f"  • {legacy_position:30} → {canonical_position:30} [SKIPPED: 0 roles found]")
            continue

        # Check if canonical position already exists for these users (conflict check)
        legacy_docs = await roles_coll.find({"position": legacy_position}).to_list(None)
        conflicts = 0

        for doc in legacy_docs:
            existing_canonical = await roles_coll.find_one({
                "userId": doc["userId"],
                "sessionId": doc["sessionId"],
                "position": canonical_position,
            })
            if existing_canonical:
                conflicts += 1

        if not dry_run:
            # Apply rename
            result = await roles_coll.update_many(
                {"position": legacy_position},
                {"$set": {"position": canonical_position}},
            )
            total_renamed += result.modified_count
            print(
                f"  ✓ {legacy_position:30} → {canonical_position:30} [RENAMED: {result.modified_count} roles]"
            )
            if conflicts > 0:
                print(f"    ⚠ WARNING: {conflicts} users already had canonical position (skipped)")
        else:
            print(
                f"  ~ {legacy_position:30} → {canonical_position:30} [DRY RUN: {legacy_count} roles would be renamed]"
            )
            if conflicts > 0:
                print(f"    ⚠ WARNING: {conflicts} users already have canonical position")

    print()
    print("=" * 65)
    if dry_run:
        print(f"  Dry Run Complete — {total_renamed} roles would be affected")
        print(f"  Run without --dry-run flag to apply changes")
    else:
        print(f"  Migration Complete — {total_renamed} roles renamed")
    print("=" * 65)
    print()


async def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Migrate legacy role positions to canonical names",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without applying them",
    )
    args = parser.parse_args()

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    try:
        await migrate_roles(db, dry_run=args.dry_run)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
