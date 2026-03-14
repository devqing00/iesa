#!/usr/bin/env python3
"""
Clear malformed push subscriptions + user payment records.

Usage:
    # Dry-run preview (no data changes)
    python scripts/clear_user_payment_and_bad_push_records.py

    # Execute destructive cleanup
    python scripts/clear_user_payment_and_bad_push_records.py --execute

    # Execute cleanup and additionally wipe all push subscriptions
    python scripts/clear_user_payment_and_bad_push_records.py --execute --clear-all-push

This script does:
  1) Removes malformed push subscriptions (invalid/missing p256dh/auth).
  2) Clears user payment records:
     - payments.paidBy arrays reset to []
     - deletes all docs in transactions
     - deletes all docs in paystackTransactions
     - deletes all docs in bankTransfers

WARNING: --execute is destructive and cannot be undone.
"""

import asyncio
import base64
import os
import sys
from dataclasses import dataclass

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _b64_decode_loose(value: str) -> bytes:
    compact = "".join(value.split())
    padded = compact + ("=" * ((4 - (len(compact) % 4)) % 4))
    try:
        return base64.b64decode(padded)
    except Exception:
        return base64.urlsafe_b64decode(padded)


def _is_valid_subscription(sub_doc: dict) -> bool:
    keys = sub_doc.get("keys") or {}
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    if not p256dh or not auth:
        return False
    try:
        _b64_decode_loose(str(p256dh))
        _b64_decode_loose(str(auth))
        return True
    except Exception:
        return False


@dataclass
class CleanupPreview:
    total_push_subscriptions: int
    malformed_push_subscriptions: int
    transactions_count: int
    paystack_transactions_count: int
    bank_transfers_count: int
    payments_with_paidby: int
    payments_paidby_entries: int


async def compute_preview(db) -> CleanupPreview:
    push_collection = db["push_subscriptions"]
    payments_collection = db["payments"]

    total_push_subscriptions = await push_collection.count_documents({})
    malformed_push_subscriptions = 0

    async for sub in push_collection.find({}, {"keys": 1}):
        if not _is_valid_subscription(sub):
            malformed_push_subscriptions += 1

    transactions_count = await db["transactions"].count_documents({})
    paystack_transactions_count = await db["paystackTransactions"].count_documents({})
    bank_transfers_count = await db["bankTransfers"].count_documents({})

    payments_with_paidby = await payments_collection.count_documents({
        "paidBy": {"$exists": True, "$ne": []}
    })
    payments_paidby_entries = 0
    async for payment in payments_collection.find(
        {"paidBy": {"$exists": True, "$ne": []}},
        {"paidBy": 1},
    ):
        entries = payment.get("paidBy") or []
        if isinstance(entries, list):
            payments_paidby_entries += len(entries)

    return CleanupPreview(
        total_push_subscriptions=total_push_subscriptions,
        malformed_push_subscriptions=malformed_push_subscriptions,
        transactions_count=transactions_count,
        paystack_transactions_count=paystack_transactions_count,
        bank_transfers_count=bank_transfers_count,
        payments_with_paidby=payments_with_paidby,
        payments_paidby_entries=payments_paidby_entries,
    )


async def execute_cleanup(db, clear_all_push: bool) -> dict:
    push_collection = db["push_subscriptions"]
    payments_collection = db["payments"]

    malformed_ids = []
    if clear_all_push:
        deleted_push = await push_collection.delete_many({})
        malformed_deleted = 0
        push_deleted = deleted_push.deleted_count
    else:
        async for sub in push_collection.find({}, {"keys": 1}):
            if not _is_valid_subscription(sub):
                malformed_ids.append(sub["_id"])

        malformed_deleted = 0
        if malformed_ids:
            result = await push_collection.delete_many({"_id": {"$in": malformed_ids}})
            malformed_deleted = result.deleted_count
        push_deleted = malformed_deleted

    payments_update = await payments_collection.update_many(
        {"paidBy": {"$exists": True, "$ne": []}},
        {"$set": {"paidBy": []}},
    )

    transactions_deleted = await db["transactions"].delete_many({})
    paystack_deleted = await db["paystackTransactions"].delete_many({})
    bank_transfers_deleted = await db["bankTransfers"].delete_many({})

    return {
        "push_deleted": push_deleted,
        "malformed_push_deleted": malformed_deleted,
        "payments_modified": payments_update.modified_count,
        "transactions_deleted": transactions_deleted.deleted_count,
        "paystack_transactions_deleted": paystack_deleted.deleted_count,
        "bank_transfers_deleted": bank_transfers_deleted.deleted_count,
    }


async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Clear malformed push subscriptions and all user payment records",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Apply destructive cleanup. Without this flag, script runs in dry-run mode.",
    )
    parser.add_argument(
        "--clear-all-push",
        action="store_true",
        help="Also delete valid push subscriptions (default only deletes malformed ones).",
    )
    args = parser.parse_args()

    _env_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
    )
    load_dotenv(_env_path)

    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        preview = await compute_preview(db)

        print("\n" + "=" * 68)
        print("  IESA Cleanup — Push + User Payment Records")
        print("=" * 68)
        print(f"  Database: {db_name}")
        print(f"  MongoDB : {mongo_url[:54]}{'...' if len(mongo_url) > 54 else ''}")
        print("\n  Preview:")
        print(f"    - push_subscriptions total         : {preview.total_push_subscriptions}")
        print(f"    - malformed push_subscriptions     : {preview.malformed_push_subscriptions}")
        print(f"    - transactions docs               : {preview.transactions_count}")
        print(f"    - paystackTransactions docs       : {preview.paystack_transactions_count}")
        print(f"    - bankTransfers docs              : {preview.bank_transfers_count}")
        print(f"    - payments with non-empty paidBy  : {preview.payments_with_paidby}")
        print(f"    - total paidBy entries            : {preview.payments_paidby_entries}")

        if not args.execute:
            print("\nDry-run only. No changes made.")
            print("Re-run with --execute to apply cleanup.")
            return

        print("\nWARNING: You are about to perform a destructive cleanup.")
        confirm = input("Type 'yes' to continue: ").strip().lower()
        if confirm != "yes":
            print("Aborted.")
            return

        result = await execute_cleanup(db, clear_all_push=args.clear_all_push)

        print("\nCleanup completed:")
        print(f"    - push_subscriptions deleted       : {result['push_deleted']}")
        print(f"      (malformed deleted)              : {result['malformed_push_deleted']}")
        print(f"    - payments modified (paidBy reset) : {result['payments_modified']}")
        print(f"    - transactions deleted             : {result['transactions_deleted']}")
        print(f"    - paystackTransactions deleted     : {result['paystack_transactions_deleted']}")
        print(f"    - bankTransfers deleted            : {result['bank_transfers_deleted']}")

        post = await compute_preview(db)
        print("\nPost-check:")
        print(f"    - malformed push_subscriptions     : {post.malformed_push_subscriptions}")
        print(f"    - transactions docs               : {post.transactions_count}")
        print(f"    - paystackTransactions docs       : {post.paystack_transactions_count}")
        print(f"    - bankTransfers docs              : {post.bank_transfers_count}")
        print(f"    - total paidBy entries            : {post.payments_paidby_entries}")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
