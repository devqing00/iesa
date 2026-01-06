import asyncio
import aiohttp
import sys
import os
import json

# Base URL for backend
BASE_URL = "http://localhost:8000"

async def test_endpoint(session, method, endpoint, params=None, data=None, token=None, description=""):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    url = f"{BASE_URL}{endpoint}"
    print(f"\n[{method}] {url}")
    if description:
        print(f"Goal: {description}")
    if params:
        print(f"Params: {params}")
    
    try:
        if method == "GET":
            async with session.get(url, params=params, headers=headers) as response:
                status = response.status
                text = await response.text()
                print(f"Status: {status}")
                if status == 200:
                    try:
                        data = json.loads(text)
                        preview = str(data)[:100] + "..." if len(str(data)) > 100 else str(data)
                        print(f"Success! Data preview: {preview}")
                    except:
                         print(f"Success! (Response not JSON)")
                else:
                    print(f"Error Response: {text}")
                return status
        elif method == "POST":
            async with session.post(url, json=data, headers=headers) as response:
                status = response.status
                text = await response.text()
                print(f"Status: {status}")
                print(f"Response: {text}")
                return status
    except Exception as e:
        print(f"Exception: {e}")
        return 500

async def main():
    print("IESA API Endpoint Tester")
    print("------------------------")
    
    # 1. Health Check (Public)
    async with aiohttp.ClientSession() as session:
        await test_endpoint(session, "GET", "/health", description="Check if backend is running")
        
        # 2. Token Input
        print("\nTo test protected endpoints, please provide a Firebase ID Token.")
        print("IMPORTANT: Do ensure this is the long JWT string, NOT just the User UID.")
        print("It usually starts with 'eyJ...' and is very long.")
        token = input("Enter ID Token (press Enter to skip): ").strip()
        
        if token and len(token) < 50:
            print(f"\n[WARNING] The token provided ('{token}') looks too short to be a valid JWT.")
            print("You might have pasted the User ID (UID) instead of the Access Token.")
            print("Continuing anyway, but expect 401 errors...\n")
        
        if not token:
            print("\nSkipping protected route tests (or expecting 401 Unauthorized)...")
        else:
            print("\nTesting with provided token...")

        # 3. Test Events
        print("\n--- Events ---")
        await test_endpoint(session, "GET", "/api/v1/events/", token=token, description="Fetch events (default to active session)")
        
        # 4. Test Announcements
        print("\n--- Announcements ---")
        await test_endpoint(session, "GET", "/api/v1/announcements/", token=token, description="Fetch announcements (default to active session)")

        # 5. Test Resources
        print("\n--- Resources (Library) ---")
        await test_endpoint(session, "GET", "/api/v1/resources", token=token, description="Fetch resources (default to active session)")

        # 6. Test Timetable
        print("\n--- Timetable ---")
        await test_endpoint(session, "GET", "/api/v1/timetable/classes", params={"level": 400}, token=token, description="Fetch timetable classes (Level 400)")

        # 7. Test Payments
        print("\n--- Payments ---")
        # First get current session
        print("  - Fetching active session first...")
        session_status = await test_endpoint(session, "GET", "/api/sessions/active", token=token, description="Get active session")
        if session_status == 200:
            # Now fetch payments with session
            await test_endpoint(session, "GET", "/api/v1/payments/", token=token, description="Fetch payments")
        
        # 8. Test ID Card Download
        print("\n--- ID Card ---")
        async with session.get(f"{BASE_URL}/api/v1/student-document", headers={"Authorization": f"Bearer {token}"}) as response:
            print(f"[GET] {BASE_URL}/api/v1/student-document")
            print(f"Goal: ID Card PDF Download")
            print(f"Status: {response.status}")
            if response.status == 200:
                content = await response.read() # Read as binary
                print(f"Success! Received {len(content)} bytes of PDF data.")
                # Verify PDF header
                if content.startswith(b"%PDF"):
                    print("Verified: Content is a valid PDF.")
                else:
                     print("Warning: Content does not start with %PDF")
            else:
                 text = await response.text()
                 print(f"Error Response: {text}")

        # === Testing Paystack Transactions ===
        print("\n=== Testing Paystack Transactions ===")
        async with session.get(f"{BASE_URL}/api/v1/paystack/transactions", headers={"Authorization": f"Bearer {token}"}) as response:
            print(f"[GET] {BASE_URL}/api/v1/paystack/transactions")
            print(f"Status: {response.status}")
            text = await response.text()
            if response.status == 200:
                print(f"Success! Response: {text[:100]}...")
            else:
                 print(f"Error Response: {text}")


if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
