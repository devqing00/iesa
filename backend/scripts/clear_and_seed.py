#!/usr/bin/env python3
"""
Clear and Seed Script — Reset database and create initial data

Usage:
    python scripts/clear_and_seed.py --all
    python scripts/clear_and_seed.py --all --session "2025/2026"
    python scripts/clear_and_seed.py --clear-only
    python scripts/clear_and_seed.py --session "2025/2026"
    python scripts/clear_and_seed.py --admin user@example.com

This script:
1. Clears ALL collections (users, sessions, enrollments, resources, etc.)
2. Seeds a realistic development dataset (session, users, announcements, events, etc.)
3. Optionally promotes a user to admin

⚠️  WARNING: This DELETES ALL DATA. Use only for development/testing.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

from argon2 import PasswordHasher

# Argon2id hasher — must match settings in app/core/auth.py
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def _hash(password: str) -> str:
    """Hash a password for seeding (synchronous — fine outside the event loop)."""
    return _ph.hash(password)

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ──────────────────────────────────────────────────────────────────
# All MongoDB collections used by the IESA platform
# ──────────────────────────────────────────────────────────────────
ALL_COLLECTIONS = [
    # Core
    "users",
    "sessions",
    "enrollments",
    "roles",
    "refresh_tokens",
    "audit_logs",
    # Content
    "announcements",
    "events",
    "payments",
    "transactions",
    "press_articles",
    "resources",
    "notifications",
    "contact_messages",
    # Timetable
    "classSessions",
    "classCancellations",
    "academicEvents",
    # Payments
    "bankAccounts",
    "bankTransfers",
    "paystackTransactions",
    "platformSettings",
    # Study Groups
    "study_groups",
    # Growth Hub
    "growth_data",
    # Applications
    "unit_applications",
    # TIMP
    "timpApplications",
    "timpPairs",
    "timpFeedback",
    "timpSettings",
    # IEPOD
    "iepod_societies",
    "iepod_registrations",
    "iepod_niche_audits",
    "iepod_teams",
    "iepod_submissions",
    "iepod_quizzes",
    "iepod_quiz_responses",
    "iepod_points",
    # AI
    "ai_feedback",
    "ai_rate_limits",
]


async def clear_all_data(db, keep_users: bool = False) -> None:
    """Delete all data from all collections."""
    skip = {"users", "refresh_tokens"} if keep_users else set()
    label = "Clearing session data (keeping users)..." if keep_users else "Clearing all data..."
    print(f"\n🗑️  {label}")

    for col_name in ALL_COLLECTIONS:
        if col_name in skip:
            continue
        result = await db[col_name].delete_many({})
        if result.deleted_count > 0:
            print(f"   ✓ Deleted {result.deleted_count} documents from '{col_name}'")
        else:
            print(f"   - '{col_name}' was already empty")


async def create_session(db, session_name: str, is_active: bool = True) -> str:
    """Create an academic session."""
    from bson import ObjectId

    sessions = db["sessions"]

    existing = await sessions.find_one({"name": session_name})
    if existing:
        print(f"   ✓ Session '{session_name}' already exists")
        return str(existing["_id"])

    try:
        start_year = int(session_name.split("/")[0])
    except (IndexError, ValueError):
        start_year = datetime.now().year

    now = datetime.now(timezone.utc)
    session_data = {
        "name": session_name,
        "startDate": datetime(start_year, 9, 1, tzinfo=timezone.utc),
        "endDate": datetime(start_year + 1, 8, 31, tzinfo=timezone.utc),
        "semester1StartDate": datetime(start_year, 9, 1, tzinfo=timezone.utc),
        "semester1EndDate": datetime(start_year + 1, 2, 28, tzinfo=timezone.utc),
        "semester2StartDate": datetime(start_year + 1, 3, 1, tzinfo=timezone.utc),
        "semester2EndDate": datetime(start_year + 1, 8, 31, tzinfo=timezone.utc),
        "currentSemester": 1,
        "isActive": is_active,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await sessions.insert_one(session_data)
    session_id = str(result.inserted_id)
    status = "active" if is_active else "inactive"
    print(f"   ✓ Created {status} session: '{session_name}' (ID: {session_id[:8]}...)")
    return session_id


# ─────────────────────────────────────────────────────────────────────────────
# Default seed credentials (printed at the end for convenience)
# ─────────────────────────────────────────────────────────────────────────────
ADMIN_EMAIL    = "admin@iesa.ui.edu.ng"
ADMIN_PASSWORD = "Admin@1234!"
STUDENT_PASSWORD = "Student@1234!"


async def seed_users(db, session_id: str) -> dict:
    """
    Seed dummy users — admin, exco, and students at each level.
    Returns a {email: uid_string} map so other seeders can use real UIDs.
    """
    now = datetime.now(timezone.utc)
    users_col = db["users"]
    enrollments_col = db["enrollments"]

    # ── Define users ─────────────────────────────────────────────────
    # Each entry: (email, password, firstName, lastName, role, level, admissionYear, matric, bio)
    # admissionYear = second year of admitted session (e.g. admitted 2023/2024 → 2024)
    _users = [
        # Admin account
        (
            ADMIN_EMAIL, ADMIN_PASSWORD,
            "IESA", "Admin", "admin",
            None, None, None,
            "Platform administrator for IESA.",
        ),
        # Exco — President, 400L
        (
            "chike.okafor@stu.ui.edu.ng", STUDENT_PASSWORD,
            "Chike", "Okafor", "exco",
            "400L", 2023, "20/22IPE001",
            "IESA President, 400L Industrial Engineering student.",
        ),
        # Students — one per level + extras to populate transactions / transfers
        (
            "adewale.okonkwo@stu.ui.edu.ng", STUDENT_PASSWORD,
            "Adewale", "Okonkwo", "student",
            "300L", 2024, "21/23IPE001",
            "300L student interested in operations research.",
        ),
        (
            "ngozi.obi@stu.ui.edu.ng", STUDENT_PASSWORD,
            "Ngozi", "Obi", "student",
            "200L", 2025, "22/24IPE001",
            "200L student passionate about data and process engineering.",
        ),
        (
            "tunde.fashola@stu.ui.edu.ng", STUDENT_PASSWORD,
            "Tunde", "Fashola", "student",
            "400L", 2023, "20/22IPE002",
            "400L student and aspiring supply chain engineer.",
        ),
        (
            "amaka.eze@stu.ui.edu.ng", STUDENT_PASSWORD,
            "Amaka", "Eze", "student",
            "100L", 2026, "24/25IPE001",
            "Fresh 100L student eager to learn.",
        ),
        (
            "ibrahim.musa@stu.ui.edu.ng", STUDENT_PASSWORD,
            "Ibrahim", "Musa", "student",
            "500L", 2022, "18/21IPE001",
            "500L student working on his final year project.",
        ),
        (
            "emeka.anozie@stu.ui.edu.ng", STUDENT_PASSWORD,
            "Chukwuemeka", "Anozie", "student",
            "300L", 2024, "21/23IPE002",
            "300L student and tech enthusiast.",
        ),
        (
            "funmi.adeyemi@stu.ui.edu.ng", STUDENT_PASSWORD,
            "Funmilayo", "Adeyemi", "student",
            "200L", 2025, "22/24IPE002",
            "200L student interested in quality engineering.",
        ),
        (
            "yusuf.abdullahi@stu.ui.edu.ng", STUDENT_PASSWORD,
            "Yusuf", "Abdullahi", "student",
            "400L", 2023, "20/22IPE003",
            "400L student and robotics club member.",
        ),
    ]

    user_map: dict = {}  # email → uid_string
    inserted = 0

    for (email, password, first, last, role, level, admission_yr, matric, bio) in _users:
        existing = await users_col.find_one({"email": email})
        if existing:
            user_map[email] = str(existing["_id"])
            continue

        email_type = "institutional" if email.endswith("@stu.ui.edu.ng") else "personal"
        doc = {
            "email": email,
            "passwordHash": _hash(password),
            "firstName": first,
            "lastName": last,
            "matricNumber": matric,
            "phone": None,
            "currentLevel": level,
            "admissionYear": admission_yr,
            "department": "Industrial Engineering",
            "role": role,
            "bio": bio,
            "profilePictureUrl": None,
            "skills": [],
            "emailType": email_type,
            "secondaryEmail": None,
            "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
            "notificationCategories": None,
            "emailVerified": True,          # skip email verification for seed users
            "hasCompletedOnboarding": True,
            "isActive": True,
            "isExternalStudent": False,       # all seed users are IPE students
            "lastLogin": None,
            "firebaseUid": None,
            "createdAt": now,
            "updatedAt": now,
        }
        result = await users_col.insert_one(doc)
        uid = str(result.inserted_id)
        user_map[email] = uid
        inserted += 1

        # Create enrollment for student/exco users
        if level:
            await enrollments_col.insert_one({
                "studentId": uid,
                "sessionId": session_id,
                "level": level,
                "enrollmentDate": now,
                "createdAt": now,
                "isActive": True,
            })

    print(f"   ✓ Seeded {inserted} users ({len(user_map)} total incl. existing)")
    return user_map


async def seed_announcements(db, session_id: str) -> None:
    """Seed sample announcements."""
    announcements = [
        {
            "title": "Welcome to the New Academic Session",
            "content": "We are pleased to welcome all Industrial and Production Engineering students to the new session. Please complete your enrollment as soon as possible.",
            "sessionId": session_id,
            "priority": "high",
            "targetLevels": [100, 200, 300, 400, 500],
            "isPinned": True,
            "expiresAt": None,
            "authorId": "system",
            "authorName": "IESA Admin",
            "readBy": [],
            "createdAt": datetime.now(timezone.utc) - timedelta(days=5),
            "updatedAt": datetime.now(timezone.utc) - timedelta(days=5),
        },
        {
            "title": "Department Dues Payment Deadline",
            "content": "All students are reminded that department dues for the current session must be paid before the end of November. Visit the payments page to make your payment.",
            "sessionId": session_id,
            "priority": "normal",
            "targetLevels": [100, 200, 300, 400, 500],
            "isPinned": False,
            "expiresAt": None,
            "authorId": "system",
            "authorName": "IESA Admin",
            "readBy": [],
            "createdAt": datetime.now(timezone.utc) - timedelta(days=2),
            "updatedAt": datetime.now(timezone.utc) - timedelta(days=2),
        },
        {
            "title": "Industrial Visit to Dangote Refinery",
            "content": "An industrial visit to the Dangote Refinery has been scheduled for 300L and 400L students. Registration is open on the events page.",
            "sessionId": session_id,
            "priority": "normal",
            "targetLevels": [300, 400],
            "isPinned": False,
            "expiresAt": None,
            "authorId": "system",
            "authorName": "IESA Admin",
            "readBy": [],
            "createdAt": datetime.now(timezone.utc) - timedelta(days=1),
            "updatedAt": datetime.now(timezone.utc) - timedelta(days=1),
        },
    ]
    await db["announcements"].insert_many(announcements)
    print(f"   ✓ Seeded {len(announcements)} announcements")


async def seed_events(db, session_id: str) -> None:
    """Seed sample events — a mix of near-future and later dates."""
    now = datetime.now(timezone.utc)
    events = [
        {
            "title": "MATLAB & Python for Engineers Workshop",
            "sessionId": session_id,
            "date": now + timedelta(days=5),
            "endDate": now + timedelta(days=5),
            "location": "Computer Lab 2, Faculty of Technology",
            "category": "Workshop",
            "description": "Hands-on session covering MATLAB and Python tools used in industrial and production engineering. Open to all levels.",
            "maxAttendees": 60,
            "registrationDeadline": now + timedelta(days=3),
            "imageUrl": None,
            "requiresPayment": False,
            "paymentAmount": 0,
            "paymentId": None,
            "createdBy": "system",
            "registrations": [],
            "attendees": [],
            "createdAt": now - timedelta(days=2),
            "updatedAt": now - timedelta(days=2),
        },
        {
            "title": "IESA Freshers Night",
            "sessionId": session_id,
            "date": now + timedelta(days=10),
            "endDate": now + timedelta(days=10),
            "location": "Trenchard Hall, University of Ibadan",
            "category": "Social",
            "description": "Welcome party for new 100-level students. Food, music, and networking with senior colleagues.",
            "maxAttendees": 300,
            "registrationDeadline": now + timedelta(days=8),
            "imageUrl": None,
            "requiresPayment": True,
            "paymentAmount": 1500,
            "paymentId": None,
            "createdBy": "system",
            "registrations": [],
            "attendees": [],
            "createdAt": now - timedelta(days=4),
            "updatedAt": now - timedelta(days=4),
        },
        {
            "title": "Career Workshop: Engineering in Industry 4.0",
            "sessionId": session_id,
            "date": now + timedelta(days=20),
            "endDate": now + timedelta(days=20),
            "location": "TET Building, Room 301",
            "category": "Career",
            "description": "Learn about the role of Industrial Engineers in the era of AI and automation. Guest speaker from Procter & Gamble.",
            "maxAttendees": 100,
            "registrationDeadline": now + timedelta(days=18),
            "imageUrl": None,
            "requiresPayment": False,
            "paymentAmount": 0,
            "paymentId": None,
            "createdBy": "system",
            "registrations": [],
            "attendees": [],
            "createdAt": now - timedelta(days=3),
            "updatedAt": now - timedelta(days=3),
        },
        {
            "title": "Industrial Visit — Dangote Refinery",
            "sessionId": session_id,
            "date": now + timedelta(days=35),
            "endDate": now + timedelta(days=36),
            "location": "Lekki Free Trade Zone, Lagos",
            "category": "Academic",
            "description": "Mandatory industrial visit for 300L and 400L students to the Dangote Petroleum Refinery. Transport and logistics covered by the department.",
            "maxAttendees": 80,
            "registrationDeadline": now + timedelta(days=25),
            "imageUrl": None,
            "requiresPayment": True,
            "paymentAmount": 8000,
            "paymentId": None,
            "createdBy": "system",
            "registrations": [],
            "attendees": [],
            "createdAt": now - timedelta(days=7),
            "updatedAt": now - timedelta(days=7),
        },
        {
            "title": "IESA Inter-Level Quiz Competition",
            "sessionId": session_id,
            "date": now + timedelta(days=45),
            "endDate": now + timedelta(days=45),
            "location": "Engineering Lecture Theatre",
            "category": "Competition",
            "description": "Annual quiz covering core engineering topics. Teams of 3 students from each level compete. Prizes for top 3 teams.",
            "maxAttendees": 150,
            "registrationDeadline": now + timedelta(days=40),
            "imageUrl": None,
            "requiresPayment": False,
            "paymentAmount": 0,
            "paymentId": None,
            "createdBy": "system",
            "registrations": [],
            "attendees": [],
            "createdAt": now - timedelta(days=5),
            "updatedAt": now - timedelta(days=5),
        },
        {
            "title": "IESA Week 2026",
            "sessionId": session_id,
            "date": now + timedelta(days=55),
            "endDate": now + timedelta(days=60),
            "location": "Faculty of Technology Auditorium",
            "category": "Social",
            "description": "The annual IESA Week — seminars, competitions, cultural night, gala dinner. The biggest event of the academic year.",
            "maxAttendees": 400,
            "registrationDeadline": now + timedelta(days=50),
            "imageUrl": None,
            "requiresPayment": True,
            "paymentAmount": 3000,
            "paymentId": None,
            "createdBy": "system",
            "registrations": [],
            "attendees": [],
            "createdAt": now - timedelta(days=10),
            "updatedAt": now - timedelta(days=10),
        },
    ]
    await db["events"].insert_many(events)
    print(f"   ✓ Seeded {len(events)} events")


async def seed_payments(db, session_id: str, user_map: dict) -> None:
    """
    Seed sample payment dues + linked Paystack transactions and bank transfers.
    user_map: {email: uid_string} from seed_users() — used to populate real IDs.
    """
    now = datetime.now(timezone.utc)

    # Resolve UIDs for students who appear in transactions / transfers
    uid_adewale  = user_map.get("adewale.okonkwo@stu.ui.edu.ng", "")
    uid_ngozi    = user_map.get("ngozi.obi@stu.ui.edu.ng", "")
    uid_tunde    = user_map.get("tunde.fashola@stu.ui.edu.ng", "")
    uid_amaka    = user_map.get("amaka.eze@stu.ui.edu.ng", "")
    uid_ibrahim  = user_map.get("ibrahim.musa@stu.ui.edu.ng", "")
    uid_emeka    = user_map.get("emeka.anozie@stu.ui.edu.ng", "")
    uid_funmi    = user_map.get("funmi.adeyemi@stu.ui.edu.ng", "")
    uid_yusuf    = user_map.get("yusuf.abdullahi@stu.ui.edu.ng", "")

    # ── Payment Dues ─────────────────────────────────────────────────
    # paidBy is pre-populated with UIDs of students whose transactions succeeded.
    # Dues paid: adewale + ngozi (Paystack), emeka (bank transfer approved)
    # Lab Coat paid: tunde (Paystack), funmi (bank transfer approved)
    payments = [
        {
            "title": "Department Dues",
            "amount": 3000,
            "sessionId": session_id,
            "mandatory": True,
            "deadline": now + timedelta(days=60),
            "description": "Mandatory department association dues for the current session.",
            "category": "dues",
            "paidBy": [uid for uid in [uid_adewale, uid_ngozi, uid_emeka] if uid],
            "createdAt": now - timedelta(days=10),
            "updatedAt": now - timedelta(days=1),
        },
        {
            "title": "Lab Coat",
            "amount": 5000,
            "sessionId": session_id,
            "mandatory": False,
            "deadline": now + timedelta(days=45),
            "description": "Official IESA lab coat for practicals and industrial visits.",
            "category": "other",
            "paidBy": [uid for uid in [uid_tunde, uid_funmi] if uid],
            "createdAt": now - timedelta(days=8),
            "updatedAt": now - timedelta(days=1),
        },
        {
            "title": "IESA Week Dinner",
            "amount": 7500,
            "sessionId": session_id,
            "mandatory": False,
            "deadline": now + timedelta(days=20),
            "description": "Gala dinner ticket for the annual IESA week celebration.",
            "category": "event",
            "paidBy": [],
            "createdAt": now - timedelta(days=5),
            "updatedAt": now - timedelta(days=5),
        },
        {
            "title": "Excursion Fee",
            "amount": 15000,
            "sessionId": session_id,
            "mandatory": False,
            "deadline": now - timedelta(days=7),
            "description": "Industrial excursion to Dangote Refinery — now overdue.",
            "category": "other",
            "paidBy": [],
            "createdAt": now - timedelta(days=30),
            "updatedAt": now - timedelta(days=30),
        },
    ]
    result = await db["payments"].insert_many(payments)
    payment_ids = [str(pid) for pid in result.inserted_ids]
    print(f"   ✓ Seeded {len(payments)} payment dues")

    # ── Paystack Transactions ─────────────────────────────────────────
    # Matches exact document shape produced by paystack.py's initialize + verify flow.
    # Fields: reference, paymentId, studentId (real UID), studentName, studentLevel,
    #         studentEmail, amount, amountKobo, status, paystackData, channel,
    #         paidAt, amountPaid, createdAt, updatedAt
    txns = [
        {
            "reference": "IESA-TXN-2026-001",
            "paymentId": payment_ids[0],          # Department Dues
            "studentId": uid_adewale,
            "studentName": "Adewale Okonkwo",
            "studentLevel": "300L",
            "studentEmail": "adewale.okonkwo@stu.ui.edu.ng",
            "amount": 3000,
            "amountKobo": 300000,
            "status": "success",
            "channel": "card",
            "paidAt": now - timedelta(days=6),
            "amountPaid": 3000,
            "paystackData": {"accessCode": "seed_access_001", "authorizationUrl": "https://checkout.paystack.com/seed001"},
            "createdAt": now - timedelta(days=6),
            "updatedAt": now - timedelta(days=6),
        },
        {
            "reference": "IESA-TXN-2026-002",
            "paymentId": payment_ids[0],          # Department Dues
            "studentId": uid_ngozi,
            "studentName": "Ngozi Obi",
            "studentLevel": "200L",
            "studentEmail": "ngozi.obi@stu.ui.edu.ng",
            "amount": 3000,
            "amountKobo": 300000,
            "status": "success",
            "channel": "bank",
            "paidAt": now - timedelta(days=4),
            "amountPaid": 3000,
            "paystackData": {"accessCode": "seed_access_002", "authorizationUrl": "https://checkout.paystack.com/seed002"},
            "createdAt": now - timedelta(days=4),
            "updatedAt": now - timedelta(days=4),
        },
        {
            "reference": "IESA-TXN-2026-003",
            "paymentId": payment_ids[1],          # Lab Coat
            "studentId": uid_tunde,
            "studentName": "Tunde Fashola",
            "studentLevel": "400L",
            "studentEmail": "tunde.fashola@stu.ui.edu.ng",
            "amount": 5000,
            "amountKobo": 500000,
            "status": "success",
            "channel": "ussd",
            "paidAt": now - timedelta(days=3),
            "amountPaid": 5000,
            "paystackData": {"accessCode": "seed_access_003", "authorizationUrl": "https://checkout.paystack.com/seed003"},
            "createdAt": now - timedelta(days=3),
            "updatedAt": now - timedelta(days=3),
        },
        {
            "reference": "IESA-TXN-2026-004",
            "paymentId": payment_ids[0],          # Department Dues — failed
            "studentId": uid_amaka,
            "studentName": "Amaka Eze",
            "studentLevel": "100L",
            "studentEmail": "amaka.eze@stu.ui.edu.ng",
            "amount": 3000,
            "amountKobo": 300000,
            "status": "failed",
            "channel": "card",
            "paidAt": None,
            "amountPaid": None,
            "paystackData": {"accessCode": "seed_access_004", "authorizationUrl": "https://checkout.paystack.com/seed004"},
            "createdAt": now - timedelta(days=2),
            "updatedAt": now - timedelta(days=2),
        },
        {
            "reference": "IESA-TXN-2026-005",
            "paymentId": payment_ids[2],          # IESA Week Dinner — pending
            "studentId": uid_ibrahim,
            "studentName": "Ibrahim Musa",
            "studentLevel": "500L",
            "studentEmail": "ibrahim.musa@stu.ui.edu.ng",
            "amount": 7500,
            "amountKobo": 750000,
            "status": "pending",
            "channel": None,
            "paidAt": None,
            "amountPaid": None,
            "paystackData": {"accessCode": "seed_access_005", "authorizationUrl": "https://checkout.paystack.com/seed005"},
            "createdAt": now - timedelta(hours=5),
            "updatedAt": now - timedelta(hours=5),
        },
    ]
    await db["paystackTransactions"].insert_many(txns)
    print(f"   ✓ Seeded {len(txns)} Paystack transactions")

    # ── Bank Transfers ────────────────────────────────────────────────
    # Matches document shape from bank_transfers.py: studentId (real UID), etc.
    transfers = [
        {
            "studentId": uid_emeka,
            "studentName": "Chukwuemeka Anozie",
            "studentEmail": "emeka.anozie@stu.ui.edu.ng",
            "paymentId": payment_ids[0],          # Department Dues — approved
            "paymentTitle": "Department Dues",
            "sessionId": session_id,
            "bankAccountId": "dummy-acct",
            "bankAccountName": "IESA University of Ibadan",
            "bankAccountBank": "GTBank",
            "bankAccountNumber": "0123456789",
            "amount": 3000,
            "senderName": "Chukwuemeka Anozie",
            "senderBank": "Access Bank",
            "transactionReference": "GT-20260221-00312",
            "transferDate": (now - timedelta(days=5)).isoformat(),
            "narration": "Department dues 2025/2026",
            "receiptImageUrl": None,
            "status": "approved",
            "adminNote": "Confirmed — teller slip verified.",
            "reviewedBy": user_map.get(ADMIN_EMAIL, "admin"),
            "reviewedAt": now - timedelta(days=4),
            "createdAt": now - timedelta(days=5),
            "updatedAt": now - timedelta(days=4),
        },
        {
            "studentId": uid_funmi,
            "studentName": "Funmilayo Adeyemi",
            "studentEmail": "funmi.adeyemi@stu.ui.edu.ng",
            "paymentId": payment_ids[1],          # Lab Coat — approved
            "paymentTitle": "Lab Coat",
            "sessionId": session_id,
            "bankAccountId": "dummy-acct",
            "bankAccountName": "IESA University of Ibadan",
            "bankAccountBank": "GTBank",
            "bankAccountNumber": "0123456789",
            "amount": 5000,
            "senderName": "Funmilayo Adeyemi",
            "senderBank": "Zenith Bank",
            "transactionReference": "ZEN-20260219-00871",
            "transferDate": (now - timedelta(days=8)).isoformat(),
            "narration": "Lab coat payment",
            "receiptImageUrl": None,
            "status": "approved",
            "adminNote": "Bank statement verified.",
            "reviewedBy": user_map.get(ADMIN_EMAIL, "admin"),
            "reviewedAt": now - timedelta(days=7),
            "createdAt": now - timedelta(days=8),
            "updatedAt": now - timedelta(days=7),
        },
        {
            "studentId": uid_yusuf,
            "studentName": "Yusuf Abdullahi",
            "studentEmail": "yusuf.abdullahi@stu.ui.edu.ng",
            "paymentId": payment_ids[0],          # Department Dues — rejected
            "paymentTitle": "Department Dues",
            "sessionId": session_id,
            "bankAccountId": "dummy-acct",
            "bankAccountName": "IESA University of Ibadan",
            "bankAccountBank": "GTBank",
            "bankAccountNumber": "0123456789",
            "amount": 3000,
            "senderName": "Yusuf Abdullahi",
            "senderBank": "First Bank",
            "transactionReference": "FBN-20260215-00554",
            "transferDate": (now - timedelta(days=12)).isoformat(),
            "narration": "IESA dues — Yusuf",
            "receiptImageUrl": None,
            "status": "rejected",
            "adminNote": "Amount transferred (₦2,500) does not match the required ₦3,000.",
            "reviewedBy": user_map.get(ADMIN_EMAIL, "admin"),
            "reviewedAt": now - timedelta(days=11),
            "createdAt": now - timedelta(days=12),
            "updatedAt": now - timedelta(days=11),
        },
        {
            "studentId": uid_yusuf,
            "studentName": "Yusuf Abdullahi",
            "studentEmail": "yusuf.abdullahi@stu.ui.edu.ng",
            "paymentId": payment_ids[0],          # Department Dues — pending retry
            "paymentTitle": "Department Dues",
            "sessionId": session_id,
            "bankAccountId": "dummy-acct",
            "bankAccountName": "IESA University of Ibadan",
            "bankAccountBank": "GTBank",
            "bankAccountNumber": "0123456789",
            "amount": 3000,
            "senderName": "Yusuf Abdullahi",
            "senderBank": "First Bank",
            "transactionReference": "FBN-20260226-01102",
            "transferDate": (now - timedelta(days=1)).isoformat(),
            "narration": "IESA dues retry — full amount",
            "receiptImageUrl": None,
            "status": "pending",
            "adminNote": None,
            "reviewedBy": None,
            "reviewedAt": None,
            "createdAt": now - timedelta(days=1),
            "updatedAt": now - timedelta(days=1),
        },
    ]
    await db["bankTransfers"].insert_many(transfers)
    print(f"   ✓ Seeded {len(transfers)} bank transfers")


async def seed_timetable(db, session_id: str) -> None:
    """Seed timetable for all 5 levels. Field names match the timetable router schema."""
    now = datetime.now(timezone.utc)

    def cls(code, title, level, day, start, end, venue, lecturer, ctype="lecture"):
        return {
            "courseCode": code,
            "courseTitle": title,      # ← correct field name (not courseName)
            "level": level,
            "day": day,                # ← correct field name (not dayOfWeek)
            "startTime": start,
            "endTime": end,
            "venue": venue,
            "lecturer": lecturer,
            "type": ctype,
            "recurring": True,
            "sessionId": session_id,
            "createdBy": "system",
            "createdAt": now,
            "updatedAt": now,
        }

    classes = [
        # ── 100 Level ──
        cls("GST 111", "Use of English I", 100, "Monday", "08:00", "10:00", "Faculty LT1", "Dr. Afolabi"),
        cls("MAT 101", "Elementary Mathematics I", 100, "Monday", "12:00", "14:00", "TET LT1", "Prof. Salami"),
        cls("PHY 101", "General Physics I", 100, "Tuesday", "08:00", "10:00", "Faculty LT2", "Dr. Okonkwo"),
        cls("CHE 101", "General Chemistry I", 100, "Tuesday", "12:00", "14:00", "Chemistry LT", "Dr. Bello"),
        cls("ENG 101", "Engineering Drawing I", 100, "Wednesday", "08:00", "11:00", "Drawing Studio", "Engr. Adeyemi"),
        cls("MAT 102", "Elementary Mathematics II", 100, "Wednesday", "14:00", "16:00", "TET LT1", "Prof. Salami"),
        cls("PHY 191", "Physics Practical", 100, "Thursday", "10:00", "13:00", "Physics Lab", "Lab Instructor", "practical"),
        cls("GST 112", "Nigerian Peoples & Culture", 100, "Friday", "10:00", "12:00", "Faculty LT1", "Dr. Fashola"),

        # ── 200 Level ──
        cls("MEE 201", "Engineering Mechanics", 200, "Monday", "08:00", "10:00", "TET LT2", "Prof. Adeola"),
        cls("IPE 201", "Introduction to Industrial Engineering", 200, "Monday", "12:00", "14:00", "TET LT1", "Dr. Oluwaseun"),
        cls("MAT 201", "Mathematical Methods I", 200, "Tuesday", "08:00", "10:00", "TET LT1", "Dr. Nwosu"),
        cls("EEE 281", "Basic Electrical Engineering", 200, "Tuesday", "14:00", "16:00", "Electrical LT", "Dr. Lawal"),
        cls("MEE 203", "Engineering Thermodynamics", 200, "Wednesday", "10:00", "12:00", "TET LT2", "Prof. Adeola"),
        cls("CSC 201", "Introduction to Computing", 200, "Wednesday", "14:00", "16:00", "Computer Lab 1", "Dr. Akinola"),
        cls("MEE 201", "Engineering Mechanics (Tutorial)", 200, "Thursday", "08:00", "09:00", "TET Room 201", "Engr. Raji", "tutorial"),
        cls("IPE 291", "Workshop Practice", 200, "Friday", "08:00", "11:00", "Engineering Workshop", "Engr. Adeyinka", "practical"),

        # ── 300 Level ──
        cls("MEE 301", "Thermodynamics I", 300, "Monday", "08:00", "10:00", "TET LT1", "Prof. Oladipo"),
        cls("IPE 301", "Operations Research I", 300, "Tuesday", "10:00", "12:00", "TET LT2", "Dr. Adebiyi"),
        cls("IPE 303", "Engineering Statistics", 300, "Wednesday", "14:00", "16:00", "TET Room 204", "Dr. Akinola"),
        cls("MEE 303", "Fluid Mechanics", 300, "Thursday", "10:00", "12:00", "TET LT1", "Prof. Ogunleye"),
        cls("IPE 305", "Work Study & Ergonomics", 300, "Thursday", "14:00", "16:00", "TET Room 101", "Dr. Fashola"),
        cls("MEE 301", "Thermodynamics I (Tutorial)", 300, "Friday", "08:00", "09:00", "TET Room 104", "Engr. Balogun", "tutorial"),
        cls("IPE 391", "Industrial Engineering Lab", 300, "Friday", "10:00", "13:00", "IPE Lab", "Lab Instructor", "practical"),

        # ── 400 Level ──
        cls("IPE 401", "Operations Research II", 400, "Monday", "10:00", "12:00", "TET LT2", "Dr. Adebiyi"),
        cls("IPE 403", "Production Planning & Control", 400, "Monday", "14:00", "16:00", "TET Room 301", "Prof. Okunade"),
        cls("IPE 405", "Quality Assurance & Control", 400, "Tuesday", "08:00", "10:00", "TET LT1", "Dr. Alabi"),
        cls("MEE 401", "Heat & Mass Transfer", 400, "Wednesday", "08:00", "10:00", "TET LT2", "Prof. Oladipo"),
        cls("IPE 407", "Supply Chain Management", 400, "Wednesday", "12:00", "14:00", "TET Room 204", "Dr. Nwachukwu"),
        cls("IPE 409", "Human Factors Engineering", 400, "Thursday", "08:00", "10:00", "TET Room 301", "Dr. Abiodun"),
        cls("IPE 491", "Industrial Project (Seminar)", 400, "Friday", "10:00", "12:00", "TET Conference Room", "Supervisors", "tutorial"),

        # ── 500 Level ──
        cls("IPE 501", "Engineering Management", 500, "Monday", "08:00", "10:00", "TET Room 401", "Prof. Okunade"),
        cls("IPE 503", "Simulation & Modelling", 500, "Tuesday", "10:00", "12:00", "Computer Lab 2", "Dr. Akinola"),
        cls("IPE 505", "Systems Engineering", 500, "Wednesday", "10:00", "12:00", "TET LT1", "Prof. Adeyemi"),
        cls("IPE 507", "Project Management", 500, "Thursday", "12:00", "14:00", "TET Room 301", "Dr. Nwachukwu"),
        cls("IPE 591", "Final Year Project (Supervision)", 500, "Friday", "08:00", "12:00", "Respective Offices", "Individual Supervisors", "practical"),
    ]

    await db["classSessions"].insert_many(classes)
    print(f"   ✓ Seeded {len(classes)} timetable classes across 5 levels")


async def seed_resources(db, session_id: str) -> None:
    """Seed sample approved resources."""
    now = datetime.now(timezone.utc)
    resources = [
        {
            "title": "MEE 301 Past Questions (2018-2023)",
            "description": "Compiled past exam questions for Thermodynamics I from 2018 to 2023 with solutions.",
            "type": "pastQuestion",
            "url": "https://drive.google.com/example1",
            "courseCode": "MEE 301",
            "level": 300,
            "semester": "first",
            "sessionId": session_id,
            "uploadedBy": "system",
            "uploaderName": "IESA Library",
            "tags": ["thermodynamics", "past questions", "exam prep"],
            "viewCount": 42,
            "isApproved": True,
            "feedback": None,
            "createdAt": now - timedelta(days=15),
            "updatedAt": now - timedelta(days=15),
        },
        {
            "title": "Operations Research I Lecture Slides",
            "description": "Complete lecture slides for IPE 301 covering linear programming, simplex method, and duality.",
            "type": "slide",
            "url": "https://drive.google.com/example2",
            "courseCode": "IPE 301",
            "level": 300,
            "semester": "first",
            "sessionId": session_id,
            "uploadedBy": "system",
            "uploaderName": "IESA Library",
            "tags": ["operations research", "linear programming", "slides"],
            "viewCount": 28,
            "isApproved": True,
            "feedback": None,
            "createdAt": now - timedelta(days=10),
            "updatedAt": now - timedelta(days=10),
        },
        {
            "title": "Engineering Statistics Study Notes",
            "description": "Comprehensive study notes for IPE 303 covering probability, distributions, and hypothesis testing.",
            "type": "note",
            "url": "https://drive.google.com/example3",
            "courseCode": "IPE 303",
            "level": 300,
            "semester": "first",
            "sessionId": session_id,
            "uploadedBy": "system",
            "uploaderName": "IESA Library",
            "tags": ["statistics", "probability", "notes"],
            "viewCount": 15,
            "isApproved": True,
            "feedback": None,
            "createdAt": now - timedelta(days=7),
            "updatedAt": now - timedelta(days=7),
        },
    ]
    await db["resources"].insert_many(resources)
    print(f"   ✓ Seeded {len(resources)} resources")


async def seed_academic_calendar(db, session_id: str) -> None:
    """Seed academic calendar events for both semesters."""
    now = datetime.now(timezone.utc)
    year = now.year  # base year for the session

    def dt(y, m, d):
        return datetime(y, m, d, tzinfo=timezone.utc)

    events = [
        # ── Semester 1 ──
        {"title": "Semester 1 Lectures Begin",       "eventType": "lecture_start",  "startDate": dt(year, 9, 22),     "endDate": None,               "semester": 1, "description": "First day of lectures for the first semester."},
        {"title": "Course Registration Period",       "eventType": "registration",   "startDate": dt(year, 9, 15),     "endDate": dt(year, 10, 15),   "semester": 1, "description": "Students must register for courses on the university portal."},
        {"title": "Add / Drop Period",                "eventType": "add_drop",       "startDate": dt(year, 10, 16),    "endDate": dt(year, 10, 31),   "semester": 1, "description": "Last chance to add or drop courses without penalty."},
        {"title": "Independence Day Holiday",         "eventType": "holiday",        "startDate": dt(year, 10, 1),     "endDate": None,               "semester": 1, "description": "National holiday — no lectures."},
        {"title": "Mid-Semester Break",               "eventType": "break_period",   "startDate": dt(year, 11, 10),    "endDate": dt(year, 11, 14),   "semester": 1, "description": "One-week mid-semester break."},
        {"title": "Semester 1 Lectures End",          "eventType": "lecture_end",    "startDate": dt(year, 12, 20),    "endDate": None,               "semester": 1, "description": "Last day of first-semester lectures."},
        {"title": "Christmas & New Year Break",       "eventType": "break_period",   "startDate": dt(year, 12, 21),    "endDate": dt(year + 1, 1, 5), "semester": 1, "description": "University-wide holiday break."},
        {"title": "Semester 1 Examination Period",    "eventType": "exam_period",    "startDate": dt(year + 1, 1, 6),  "endDate": dt(year + 1, 1, 25),"semester": 1, "description": "First semester examinations for all levels."},
        # ── Semester 2 ──
        {"title": "Semester 2 Lectures Begin",        "eventType": "lecture_start",  "startDate": dt(year + 1, 2, 10), "endDate": None,               "semester": 2, "description": "First day of lectures for the second semester."},
        {"title": "Semester 2 Course Registration",   "eventType": "registration",   "startDate": dt(year + 1, 2, 3),  "endDate": dt(year + 1, 3, 7), "semester": 2, "description": "Second-semester course registration window."},
        {"title": "Easter Break",                     "eventType": "holiday",        "startDate": dt(year + 1, 4, 18), "endDate": dt(year + 1, 4, 21),"semester": 2, "description": "Easter holiday break."},
        {"title": "Project Proposal Submission",      "eventType": "deadline",       "startDate": dt(year + 1, 3, 15), "endDate": None,               "semester": 2, "description": "Final-year project proposals must be submitted to the department."},
        {"title": "Semester 2 Lectures End",          "eventType": "lecture_end",    "startDate": dt(year + 1, 6, 20), "endDate": None,               "semester": 2, "description": "Last day of second-semester lectures."},
        {"title": "Semester 2 Examination Period",    "eventType": "exam_period",    "startDate": dt(year + 1, 7, 1),  "endDate": dt(year + 1, 7, 21),"semester": 2, "description": "Second semester examinations for all levels."},
        {"title": "Convocation Ceremony",             "eventType": "other",          "startDate": dt(year + 1, 7, 28), "endDate": None,               "semester": 2, "description": "University convocation for graduating students."},
    ]

    docs = [{**ev, "sessionId": session_id, "createdAt": now, "updatedAt": now} for ev in events]
    await db["academicEvents"].insert_many(docs)
    print(f"   ✓ Seeded {len(docs)} academic calendar events")


async def seed_iepod_societies(db) -> None:
    """Seed IEPOD societies so AI context can resolve society names."""
    now = datetime.now(timezone.utc)
    societies = [
        {"name": "IESA Robotics Club",          "description": "Hands-on robotics and automation for engineers.",   "focus": "technology",  "memberCount": 0, "createdAt": now},
        {"name": "IESA Entrepreneurship Circle", "description": "Developing business and startup skills.",           "focus": "business",    "memberCount": 0, "createdAt": now},
        {"name": "IESA Data Science Guild",      "description": "Exploring data analytics, ML and AI applications.", "focus": "data",        "memberCount": 0, "createdAt": now},
        {"name": "IESA Green Engineering Forum", "description": "Sustainable engineering and environmental impact.",  "focus": "environment", "memberCount": 0, "createdAt": now},
        {"name": "IESA Leadership Academy",      "description": "Building leadership and communication skills.",      "focus": "soft_skills", "memberCount": 0, "createdAt": now},
    ]
    await db["iepod_societies"].insert_many(societies)
    print(f"   ✓ Seeded {len(societies)} IEPOD societies")


async def seed_study_groups(db, session_id: str) -> None:
    """Seed sample open study groups students can join."""
    now = datetime.now(timezone.utc)
    groups = [
        {
            "name": "Operations Research Study Circle",
            "courseCode": "IPE 301",
            "description": "Weekly problem-solving sessions for OR I — LP, simplex, transportation models.",
            "tags": ["300L", "operations research", "LP"],
            "isOpen": True,
            "maxMembers": 15,
            "members": [],
            "sessionId": session_id,
            "createdAt": now,
            "updatedAt": now,
        },
        {
            "name": "Thermodynamics Question Bank",
            "courseCode": "MEE 301",
            "description": "Collaborative past-questions review for Thermodynamics I.",
            "tags": ["300L", "thermodynamics", "past questions"],
            "isOpen": True,
            "maxMembers": 20,
            "members": [],
            "sessionId": session_id,
            "createdAt": now,
            "updatedAt": now,
        },
        {
            "name": "Final Year Project Support",
            "courseCode": "IPE 591",
            "description": "Peer support group for 500L FYP — methodology reviews, writing, presentations.",
            "tags": ["500L", "FYP", "project"],
            "isOpen": True,
            "maxMembers": 12,
            "members": [],
            "sessionId": session_id,
            "createdAt": now,
            "updatedAt": now,
        },
        {
            "name": "Engineering Management Discussion",
            "courseCode": "IPE 501",
            "description": "Case study discussions and exam prep for Engineering Management.",
            "tags": ["500L", "management"],
            "isOpen": True,
            "maxMembers": 15,
            "members": [],
            "sessionId": session_id,
            "createdAt": now,
            "updatedAt": now,
        },
    ]
    await db["study_groups"].insert_many(groups)
    print(f"   ✓ Seeded {len(groups)} study groups")


async def seed_platform_settings(db) -> None:
    """Seed default platform settings."""
    await db["platformSettings"].update_one(
        {"_id": "global"},
        {"$setOnInsert": {"onlinePaymentEnabled": False}},
        upsert=True,
    )
    print("   ✓ Seeded platform settings")


async def seed_bank_accounts(db) -> None:
    """Seed bank account details for manual transfers."""
    now = datetime.now(timezone.utc)
    accounts = [
        {
            "bankName": "GTBank",
            "accountNumber": "0123456789",
            "accountName": "IESA University of Ibadan",
            "isActive": True,
            "createdAt": now,
        },
    ]
    await db["bankAccounts"].insert_many(accounts)
    print(f"   ✓ Seeded {len(accounts)} bank accounts")


async def promote_user_to_admin(db, email: str) -> bool:
    """Promote a user to admin role."""
    users = db["users"]

    user = await users.find_one({"email": email.lower()})
    if not user:
        print(f"   ✗ User with email '{email}' not found")
        return False

    if user.get("role") == "admin":
        print(f"   ✓ User '{email}' is already an admin")
        return True

    result = await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"role": "admin", "updatedAt": datetime.now(timezone.utc)}},
    )

    if result.modified_count == 1:
        print(f"   ✓ Promoted '{email}' to admin")
        return True

    return False


async def main():
    import argparse
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv

    parser = argparse.ArgumentParser(description="Clear database and seed initial data")
    parser.add_argument("--all", action="store_true", help="Clear all data and seed defaults")
    parser.add_argument("--clear-only", action="store_true", help="Only clear data, don't seed")
    parser.add_argument("--session", type=str, help="Session name to create (e.g., '2025/2026')")
    parser.add_argument("--admin", type=str, help="Email of user to promote to admin")
    parser.add_argument(
        "--keep-users",
        action="store_true",
        help="Keep user accounts (only clear session data)",
    )

    args = parser.parse_args()

    # Load environment — resolve .env relative to this script's location (backend/.env)
    _env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    load_dotenv(_env_path)
    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"

    print(f"\n{'='*60}")
    print(f"IESA Database Clear & Seed Script")
    print(f"{'='*60}")
    print(f"Database: {db_name}")
    print(f"MongoDB:  {mongo_url}")
    print(f"Collections tracked: {len(ALL_COLLECTIONS)}")

    if not args.clear_only and not args.all and not args.session and not args.admin:
        print("\n⚠️  No action specified. Use --help to see options.")
        sys.exit(0)

    print(f"\n⚠️  WARNING: This will DELETE data from the database.")
    confirm = input("Type 'yes' to continue: ")
    if confirm.lower() != "yes":
        print("Aborted.")
        sys.exit(0)

    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        # Step 1: Clear data
        await clear_all_data(db, keep_users=args.keep_users)

        if args.clear_only:
            print("\n✅ Data cleared successfully.")
            client.close()
            return

        # Step 2: Create session
        session_name = args.session or "2025/2026"
        print(f"\n📅 Creating academic session...")
        session_id = await create_session(db, session_name, is_active=True)

        # Step 3: Seed data
        if args.all:
            print(f"\n📦 Seeding development data...")
            # seed_users MUST run first — other seeders use the returned UID map
            user_map = await seed_users(db, session_id)
            await seed_announcements(db, session_id)
            await seed_events(db, session_id)
            await seed_payments(db, session_id, user_map)
            await seed_timetable(db, session_id)
            await seed_academic_calendar(db, session_id)
            await seed_iepod_societies(db)
            await seed_study_groups(db, session_id)
            await seed_resources(db, session_id)
            await seed_bank_accounts(db)
            await seed_platform_settings(db)

        # Step 4: Promote admin
        if args.admin:
            print(f"\n👤 Promoting user to admin...")
            await promote_user_to_admin(db, args.admin)

        print(f"\n✅ Database setup complete!")
        if args.all:
            print(f"\n{'─'*55}")
            print(f"  Seed credentials")
            print(f"{'─'*55}")
            print(f"  Admin    → {ADMIN_EMAIL}")
            print(f"             password: {ADMIN_PASSWORD}")
            print(f"  Students → <name>@stu.ui.edu.ng")
            print(f"             password: {STUDENT_PASSWORD}")
            print(f"  Examples: adewale.okonkwo, ngozi.obi, tunde.fashola,")
            print(f"            amaka.eze, ibrahim.musa, emeka.anozie,")
            print(f"            funmi.adeyemi, yusuf.abdullahi, chike.okafor")
            print(f"{'─'*55}")

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
