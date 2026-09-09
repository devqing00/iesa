import asyncio
import os
import sys
import dns.resolver

# Configure Google Public DNS for reliable SRV resolution on Windows
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '1.1.1.1']

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    mongo_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "iesa_db")
    print(f"Connecting to {db_name}...")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    announcements = await db.announcements.find().sort("createdAt", -1).to_list(length=10)
    print(f"Found {len(announcements)} announcements:")
    for a in announcements:
        print("---")
        print(f"ID: {a.get('_id')}")
        print(f"Title: {a.get('title')}")
        print(f"Published: {a.get('isPublished')}")
        print(f"Audience: {a.get('targetAudience')}")
        print(f"Created: {a.get('createdAt')}")
        print(f"Updated: {a.get('updatedAt')}")
        content_preview = str(a.get('content', ''))[:150]
        print(f"Content preview: {content_preview}...")

if __name__ == "__main__":
    asyncio.run(check())
