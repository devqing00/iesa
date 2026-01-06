"""
Clear all documents from database collections while keeping the collections intact.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")

# Collections to clear
COLLECTIONS_TO_CLEAR = [
    "users",
    "sessions",
    "enrollments",
    "payments",
    "events",
    "announcements",
    "grades",
    "roles",
    "transactions",
    "resources",
    "classSessions",
    "classCancellations",
    "paystackTransactions",
    "auditLogs"
]

async def clear_database():
    """Clear all documents from collections"""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print(f"🗑️  Clearing database: {DATABASE_NAME}")
    print("=" * 60)
    
    total_deleted = 0
    
    for collection_name in COLLECTIONS_TO_CLEAR:
        collection = db[collection_name]
        
        # Count documents before deletion
        count_before = await collection.count_documents({})
        
        if count_before > 0:
            # Delete all documents
            result = await collection.delete_many({})
            deleted = result.deleted_count
            total_deleted += deleted
            print(f"✅ {collection_name}: Deleted {deleted} documents")
        else:
            print(f"⏭️  {collection_name}: Already empty")
    
    print("=" * 60)
    print(f"✅ Total documents deleted: {total_deleted}")
    print("🎉 Database cleared successfully!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(clear_database())
