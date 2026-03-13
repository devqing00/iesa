#!/usr/bin/env python3
"""
Role Permission Normalization Script

One-time migration utility to normalize existing role documents against the
current permission model and remove historical over-grants.

What it does:
- Canonicalizes legacy permission aliases to current keys.
- Removes invalid/unknown permission keys.
- For built-in positions, removes explicit permissions (defaults are now authoritative).
- For custom positions, keeps only valid normalized explicit permissions.

Usage:
    # Preview changes only
    python scripts/normalize_role_permissions.py --dry-run

    # Apply changes
    python scripts/normalize_role_permissions.py --apply
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.permissions import DEFAULT_PERMISSIONS, PERMISSIONS, normalize_permissions

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")


def get_position_defaults(position: str) -> list[str]:
    """Resolve default permissions for a role position using backend runtime rules."""
    if not position:
        return []

    if position in DEFAULT_PERMISSIONS:
        return normalize_permissions(DEFAULT_PERMISSIONS[position])

    if position.startswith("class_rep") or position.startswith("asst_class_rep"):
        base = "asst_class_rep" if position.startswith("asst_class_rep") else "class_rep"
        return normalize_permissions(DEFAULT_PERMISSIONS.get(base, []))

    if position.startswith("team_head_custom_") or position.startswith("unit_head_custom_"):
        return normalize_permissions(DEFAULT_PERMISSIONS.get("team_head_custom", []))

    return []


async def run_migration(db, apply: bool) -> None:
    roles = db["roles"]

    total = 0
    would_change = 0
    changed = 0

    print("\n" + "=" * 72)
    print(" Role Permission Normalization")
    print("=" * 72)
    print(f" Database : {DATABASE_NAME}")
    print(f" Mode     : {'APPLY' if apply else 'DRY-RUN'}")
    print("=" * 72 + "\n")

    cursor = roles.find({}, {"position": 1, "permissions": 1})
    async for role in cursor:
        total += 1

        role_id = str(role["_id"])
        position = role.get("position", "")

        existing_permissions = role.get("permissions") or []
        normalized_permissions = normalize_permissions(existing_permissions)
        normalized_permissions = [p for p in normalized_permissions if p in PERMISSIONS]

        defaults = get_position_defaults(position)
        is_builtin_position = len(defaults) > 0

        if is_builtin_position:
            target_permissions = []
            reason = "built-in position (explicit permissions cleared; defaults apply)"
        else:
            target_permissions = normalized_permissions
            reason = "custom/unknown position (normalized explicit permissions kept)"

        if existing_permissions != target_permissions:
            would_change += 1
            before_count = len(existing_permissions)
            after_count = len(target_permissions)
            print(
                f" - role {role_id} [{position or 'unknown'}]: {before_count} -> {after_count} perms ({reason})"
            )

            if apply:
                await roles.update_one(
                    {"_id": role["_id"]},
                    {
                        "$set": {
                            "permissions": target_permissions,
                            "updatedAt": datetime.now(timezone.utc),
                        }
                    },
                )
                changed += 1

    print("\n" + "=" * 72)
    print(f" Scanned roles : {total}")
    print(f" To change     : {would_change}")
    print(f" Changed       : {changed if apply else 0}")
    if not apply:
        print("\n Run with --apply to persist these changes.")
    print("=" * 72 + "\n")


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Normalize stored role permissions")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    parser.add_argument("--apply", action="store_true", help="Apply changes")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        args.dry_run = True

    if args.dry_run and args.apply:
        print("Choose only one mode: --dry-run or --apply")
        sys.exit(1)

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    try:
        await run_migration(db, apply=args.apply)
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
