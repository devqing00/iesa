"""
Generate Realistic Dummy Data for IESA Platform

This script populates the database with comprehensive, realistic test data:
- Multiple students across all levels (100L-500L)
- Announcements (general, academic, events)
- Events (workshops, socials, career fairs)
- Timetable/schedule (weekly classes)
- Payment records
- Resources (slides, past questions, notes)
- Grades (realistic GPAs and course scores)

Usage:
    python -m app.scripts.generate_dummy_data
    
Options:
    --clear: Clear existing data before generating (USE WITH CAUTION!)
"""

import asyncio
import random
import argparse
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
from dotenv import load_dotenv
from app.core.auth import hash_password

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")


# Realistic Nigerian names
FIRST_NAMES = [
    "Adebayo", "Chioma", "Ifeanyi", "Aminat", "Tunde", "Ngozi", "Emeka", 
    "Fatima", "Oluwaseun", "Zainab", "Chidi", "Aisha", "Babatunde", "Chiamaka",
    "Musa", "Oluwatobi", "Yusuf", "Blessing", "Ibrahim", "Peace", "Hassan",
    "Gift", "Abdullahi", "Joy", "Usman", "Precious", "Adekunle", "Grace"
]

LAST_NAMES = [
    "Adeyemi", "Okafor", "Ibrahim", "Adeleke", "Okonkwo", "Mohammed",
    "Adebayo", "Eze", "Bello", "Oladipo", "Yusuf", "Nwankwo", "Abubakar",
    "Adeola", "Okoli", "Suleiman", "Ogbonna", "Aliyu", "Adewale", "Onyeka",
    "Musa", "Olayemi", "Hassan", "Chukwu", "Usman", "Okeke", "Abdullahi"
]

# Course codes for Industrial Engineering (UI)
COURSES_BY_LEVEL = {
    100: [
        ("IEM 101", "Introduction to Industrial Engineering", 3),
        ("MTH 101", "General Mathematics I", 3),
        ("PHY 101", "General Physics I", 3),
        ("CHM 101", "General Chemistry I", 3),
        ("GST 101", "Use of English I", 2),
        ("GST 107", "The Good Study Guide", 2),
    ],
    200: [
        ("IEM 201", "Engineering Drawing I", 3),
        ("IEM 203", "Workshop Practice", 2),
        ("MTH 201", "Mathematical Methods I", 3),
        ("MEE 205", "Strength of Materials I", 3),
        ("EEE 209", "Electrical Engineering I", 3),
        ("GST 201", "Nigerian Peoples and Culture", 2),
    ],
    300: [
        ("IEM 301", "Operations Research I", 3),
        ("IEM 303", "Work Study and Ergonomics", 3),
        ("IEM 305", "Engineering Economy", 3),
        ("IEM 307", "Production Planning and Control", 3),
        ("IEM 309", "Quality Control", 3),
        ("IEM 311", "Manufacturing Processes I", 3),
    ],
    400: [
        ("IEM 401", "Operations Research II", 3),
        ("IEM 403", "Facilities Planning and Design", 3),
        ("IEM 405", "Project Management", 3),
        ("IEM 407", "Systems Engineering", 3),
        ("IEM 409", "Industrial Management", 3),
        ("IEM 499", "Industrial Training", 6),
    ],
    500: [
        ("IEM 501", "Reliability Engineering", 3),
        ("IEM 503", "Supply Chain Management", 3),
        ("IEM 505", "Advanced Quality Management", 3),
        ("IEM 507", "Simulation and Modeling", 3),
        ("IEM 599", "Final Year Project", 6),
    ]
}

# Announcement templates
ANNOUNCEMENT_TEMPLATES = [
    {
        "title": "Welcome to {session} Academic Session",
        "content": "We are pleased to announce the commencement of the {session} academic session. All students are expected to complete their registration and payment of departmental dues within the next two weeks. Classes commence on {start_date}.",
        "category": "general",
        "priority": "normal"
    },
    {
        "title": "Departmental Dues Payment Reminder",
        "content": "This is a friendly reminder that all students are required to pay their departmental dues before {deadline}. Failure to do so may result in exclusion from departmental activities and examinations.",
        "category": "finance",
        "priority": "high"
    },
    {
        "title": "Upcoming Mid-Semester Tests - {level}",
        "content": "Mid-semester tests for {level} students will hold from {start_date} to {end_date}. Please check your course outlines for specific dates and times. Attendance is mandatory.",
        "category": "academic",
        "priority": "urgent"
    },
    {
        "title": "IESA Week {year} - Call for Participation",
        "content": "IESA Week {year} is around the corner! We invite all students to participate in various competitions including Project Exhibition, Quiz Competition, and Sports. Registration closes on {deadline}.",
        "category": "event",
        "priority": "normal"
    },
    {
        "title": "Industrial Training Guidelines for {level} Students",
        "content": "All {level} students proceeding for Industrial Training (IT) are required to attend the mandatory orientation on {date}. Please come with your acceptance letters and insurance forms.",
        "category": "academic",
        "priority": "high"
    },
    {
        "title": "Scholarship Opportunities - {session}",
        "content": "Several scholarship opportunities are now available for outstanding students. Eligibility criteria include minimum CGPA of 3.5 and active participation in departmental activities. Application deadline: {deadline}.",
        "category": "opportunity",
        "priority": "normal"
    },
]

# Event templates
EVENT_TEMPLATES = [
    {
        "title": "IESA Tech Workshop: Introduction to Python for Engineers",
        "description": "Learn the fundamentals of Python programming and its applications in industrial engineering. Topics include data analysis, automation, and optimization. All levels welcome!",
        "category": "Workshop",
        "maxAttendees": 50,
        "requiresPayment": False
    },
    {
        "title": "Career Fair {year} - Meet Top Employers",
        "description": "Network with representatives from leading companies in manufacturing, consulting, and tech. Bring your CVs and dress professionally. Companies confirmed: Nestle, Dangote, PwC, Shell.",
        "category": "Career",
        "maxAttendees": 200,
        "requiresPayment": False
    },
    {
        "title": "IESA Annual Dinner & Awards Night",
        "description": "Join us for an evening of networking, entertainment, and recognition of outstanding students. Dress code: Formal. Early bird registration ends {deadline}.",
        "category": "Social",
        "maxAttendees": 150,
        "requiresPayment": True,
        "paymentAmount": 3000
    },
    {
        "title": "Guest Lecture: Future of Manufacturing in Africa",
        "description": "Distinguished Professor will discuss emerging trends in African manufacturing, Industry 4.0, and career opportunities. Q&A session follows. CPD points available.",
        "category": "Academic",
        "maxAttendees": 100,
        "requiresPayment": False
    },
    {
        "title": "IESA Sports Day {year}",
        "description": "Annual inter-level sports competition. Events include football, volleyball, chess, and athletics. Show your level pride! Register your team by {deadline}.",
        "category": "Social",
        "maxAttendees": 200,
        "requiresPayment": False
    },
]

# Resource templates
RESOURCE_TEMPLATES = [
    {"type": "slide", "title": "{course}: Lecture Slides Week {week}", "courseCode": "{course_code}"},
    {"type": "pastQuestion", "title": "{course}: Past Questions ({year})", "courseCode": "{course_code}"},
    {"type": "note", "title": "{course}: Comprehensive Notes", "courseCode": "{course_code}"},
    {"type": "textbook", "title": "{course}: Recommended Textbook (PDF)", "courseCode": "{course_code}"},
]

# Weekly timetable structure (Monday-Friday, 8am-5pm)
TIMETABLE_SLOTS = {
    "Monday": [("08:00", "10:00"), ("10:00", "12:00"), ("13:00", "15:00"), ("15:00", "17:00")],
    "Tuesday": [("08:00", "10:00"), ("10:00", "12:00"), ("13:00", "15:00"), ("15:00", "17:00")],
    "Wednesday": [("08:00", "10:00"), ("10:00", "12:00"), ("13:00", "15:00"), ("15:00", "17:00")],
    "Thursday": [("08:00", "10:00"), ("10:00", "12:00"), ("13:00", "15:00"), ("15:00", "17:00")],
    "Friday": [("08:00", "10:00"), ("10:00", "12:00"), ("13:00", "15:00")],
}

VENUES = [
    "Engineering Auditorium", "LT1", "LT2", "LT3", "E-Lab 1", "E-Lab 2",
    "Workshop A", "Workshop B", "CAD Lab", "Industrial Lab"
]

LECTURERS = [
    "Prof. Adeyemi A.O.", "Dr. Okafor C.N.", "Engr. Ibrahim M.S.",
    "Dr. (Mrs) Adeleke F.T.", "Prof. Nwankwo P.I.", "Dr. Bello K.A.",
    "Engr. Oladipo R.O.", "Dr. Eze N.C.", "Prof. Mohammed Y.A."
]


async def generate_dummy_data(clear_existing=False):
    """Main function to generate all dummy data"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🎲 IESA Dummy Data Generator")
    print("=" * 50)
    print(f"📊 Database: {DATABASE_NAME}")
    print(f"🔗 MongoDB: {MONGODB_URL}")
    print()
    
    if clear_existing:
        print("⚠️  CLEARING EXISTING DATA...")
        await clear_data(db)
        print("✅ Data cleared!")
        print()
    
    # 1. Ensure active session exists
    print("📅 Step 1: Ensuring active session...")
    session = await ensure_active_session(db)
    session_id = str(session["_id"])
    print(f"✅ Active session: {session['name']}")
    print()
    
    # 2. Generate students
    print("👥 Step 2: Generating students...")
    students = await generate_students(db, session_id)
    print(f"✅ Created {len(students)} students across all levels")
    print()
    
    # 3. Generate admin user
    print("👤 Step 3: Creating admin user...")
    admin = await create_admin_user(db)
    print(f"✅ Admin user created: {admin['email']}")
    print()
    
    # 4. Generate announcements
    print("📢 Step 4: Generating announcements...")
    announcements = await generate_announcements(db, session_id, admin["_id"])
    print(f"✅ Created {len(announcements)} announcements")
    print()
    
    # 5. Generate events
    print("🎉 Step 5: Generating events...")
    events = await generate_events(db, session_id, admin["_id"])
    print(f"✅ Created {len(events)} events")
    print()
    
    # 6. Generate timetable
    print("📚 Step 6: Generating weekly timetable...")
    classes = await generate_timetable(db, session_id, admin["_id"])
    print(f"✅ Created {len(classes)} class sessions")
    print()
    
    # 7. Generate resources
    print("📖 Step 7: Generating learning resources...")
    resources = await generate_resources(db, students[0]["_id"])
    print(f"✅ Created {len(resources)} resources")
    print()
    
    # 8. Generate payments
    print("💰 Step 8: Generating payment records...")
    payments_count = await generate_payments(db, session_id, students)
    print(f"✅ Created {payments_count} payment records")
    print()
    
    # 9. Generate grades
    print("📊 Step 9: Generating student grades...")
    grades_count = await generate_grades(db, session_id, students)
    print(f"✅ Created {grades_count} grade records")
    print()
    
    print("🎉 Dummy data generation complete!")
    print()
    print("📝 Summary:")
    print(f"   👥 Students: {len(students)}")
    print(f"   📢 Announcements: {len(announcements)}")
    print(f"   🎉 Events: {len(events)}")
    print(f"   📚 Class Sessions: {len(classes)}")
    print(f"   📖 Resources: {len(resources)}")
    print(f"   💰 Payments: {payments_count}")
    print(f"   📊 Grade Records: {grades_count}")
    print()
    print("=" * 70)
    print("⚠️  DUMMY DATA LOGIN INFO")
    print("=" * 70)
    print()
    print("All dummy users have the password: DummyPass1!")
    print()
    print("🔑 Login directly with email + password:")
    print()
    print(f"    • {admin['email']} (admin)")
    if students:
        print(f"    • {students[0]['email']} (100L student)")
        if len(students) > 4:
            print(f"    • {students[4]['email']} (200L student)")
    print()
    print("✅ No separate registration step needed for dummy users!")
    print()
    print("📚 Full list: Run `python -m app.scripts.list_dummy_emails`")
    print()
    
    client.close()


async def clear_data(db):
    """Clear existing dummy data (CAUTION!)"""
    collections = [
        "announcements", "events", "resources", "payments",
        "grades", "enrollments", "roles"
    ]
    
    for collection in collections:
        await db[collection].delete_many({})


async def ensure_active_session(db):
    """Ensure an active session exists"""
    session = await db.sessions.find_one({"isActive": True})
    
    if not session:
        # Create 2024/2025 session
        session_data = {
            "name": "2024/2025",
            "startDate": datetime(2024, 9, 1),
            "endDate": datetime(2025, 7, 31),
            "currentSemester": 1,
            "isActive": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        result = await db.sessions.insert_one(session_data)
        session = await db.sessions.find_one({"_id": result.inserted_id})
    
    return session


async def generate_students(db, session_id):
    """Generate realistic student profiles"""
    students = []
    matric_base = 230000  # Starting matric number
    
    levels = [100, 200, 300, 400, 500]
    students_per_level = 4
    
    for level in levels:
        for i in range(students_per_level):
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)
            matric_num = str(matric_base + len(students))
            
            # Calculate admission year based on level
            current_year = 2024
            years_in_school = level // 100
            admission_year = current_year - years_in_school + 1
            
            student_data = {
                "passwordHash": hash_password("DummyPass1!"),
                "email": f"{first_name.lower()}.{last_name.lower()}{matric_num[-3:]}@stu.ui.edu.ng",
                "firstName": first_name,
                "lastName": last_name,
                "matricNumber": matric_num,
                "institutionalEmail": f"{first_name.lower()[0]}{last_name.lower()}{matric_num[-3:]}@stu.ui.edu.ng",
                "phone": f"+234{random.randint(8000000000, 9099999999)}",
                "currentLevel": f"{level}L",
                "admissionYear": admission_year,
                "department": "Industrial Engineering",
                "role": "student",
                "hasCompletedOnboarding": True,
                "bio": f"{level}L Industrial Engineering student passionate about optimization and process improvement.",
                "skills": random.sample(["Python", "Excel", "AutoCAD", "MATLAB", "Project Management", "Data Analysis"], 3),
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            
            # Check if student exists
            existing = await db.users.find_one({"matricNumber": matric_num})
            if not existing:
                result = await db.users.insert_one(student_data)
                student_data["_id"] = result.inserted_id
                
                # Create enrollment
                await db.enrollments.insert_one({
                    "studentId": student_data["_id"],
                    "sessionId": session_id,
                    "level": level,
                    "isActive": True,
                    "semester": 1,
                    "createdAt": datetime.now(timezone.utc),
                    "updatedAt": datetime.now(timezone.utc)
                })
                
                students.append(student_data)
            else:
                # Add existing student to list for dependent data generation
                students.append(existing)
    
    # If no students were generated (all existed), fetch all students for dependent data
    if not students:
        cursor = db.users.find({"role": "student"}).limit(20)
        students = await cursor.to_list(length=20)
    
    return students


async def create_admin_user(db):
    """Create admin user for testing"""
    admin_data = {
        "passwordHash": hash_password("DummyPass1!"),
        "email": "admin@iesa.ui.edu.ng",
        "firstName": "IESA",
        "lastName": "Administrator",
        "department": "Industrial Engineering",
        "role": "admin",
        "hasCompletedOnboarding": True,
        "bio": "IESA Platform Administrator",
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    existing = await db.users.find_one({"email": admin_data["email"]})
    if existing:
        return existing
    
    result = await db.users.insert_one(admin_data)
    admin_data["_id"] = result.inserted_id
    return admin_data


async def generate_announcements(db, session_id, admin_id):
    """Generate realistic announcements"""
    announcements = []
    
    for template in ANNOUNCEMENT_TEMPLATES:
        # Create 2 announcements per template
        for i in range(2):
            days_ago = random.randint(1, 30)
            date_offset = datetime.now(timezone.utc) - timedelta(days=days_ago)
            
            announcement = {
                "title": template["title"].format(
                    session="2024/2025",
                    level=f"{random.choice([100, 200, 300, 400, 500])}L",
                    year=2024
                ),
                "content": template["content"].format(
                    session="2024/2025",
                    start_date=(datetime.now(timezone.utc) + timedelta(days=7)).strftime("%B %d, %Y"),
                    end_date=(datetime.now(timezone.utc) + timedelta(days=14)).strftime("%B %d, %Y"),
                    deadline=(datetime.now(timezone.utc) + timedelta(days=21)).strftime("%B %d, %Y"),
                    date=(datetime.now(timezone.utc) + timedelta(days=10)).strftime("%B %d, %Y"),
                    level=f"{random.choice([300, 400, 500])}L",
                    year=2024
                ),
                "category": template["category"],
                "priority": template["priority"],
                "sessionId": session_id,
                "authorId": str(admin_id),
                "targetLevels": random.sample([100, 200, 300, 400, 500], k=random.randint(2, 5)),
                "readBy": [],
                "viewCount": random.randint(5, 50),
                "createdAt": date_offset,
                "updatedAt": date_offset
            }
            
            result = await db.announcements.insert_one(announcement)
            announcement["_id"] = result.inserted_id
            announcements.append(announcement)
    
    return announcements


async def generate_events(db, session_id, admin_id):
    """Generate upcoming events"""
    events = []
    
    for i, template in enumerate(EVENT_TEMPLATES):
        days_ahead = (i + 1) * 7  # Space events weekly
        event_date = datetime.now(timezone.utc) + timedelta(days=days_ahead)
        
        event = {
            "title": template["title"].format(year=2024, deadline=(event_date - timedelta(days=3)).strftime("%B %d")),
            "description": template["description"].format(
                deadline=(event_date - timedelta(days=5)).strftime("%B %d, %Y"),
                year=2024
            ),
            "date": event_date,
            "endDate": event_date + timedelta(hours=3),
            "location": random.choice(["Engineering Auditorium", "LT1", "IESA Hall", "UI Sports Complex"]),
            "category": template["category"],
            "sessionId": session_id,
            "organizerId": str(admin_id),
            "maxAttendees": template.get("maxAttendees", 100),
            "requiresPayment": template.get("requiresPayment", False),
            "paymentAmount": template.get("paymentAmount", 0),
            "registrations": [],
            "attendees": [],
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        
        result = await db.events.insert_one(event)
        event["_id"] = result.inserted_id
        events.append(event)
    
    return events


async def generate_timetable(db, session_id, admin_id):
    """Generate weekly class timetable for all levels"""
    classes = []
    
    for level, courses in COURSES_BY_LEVEL.items():
        course_schedule = []
        
        # Assign courses to time slots
        for day, slots in TIMETABLE_SLOTS.items():
            for slot_idx, (start_time, end_time) in enumerate(slots):
                if len(course_schedule) < len(courses):
                    course = courses[len(course_schedule)]
                    
                    class_type = "lecture" if slot_idx < 2 else random.choice(["lecture", "practical", "tutorial"])
                    
                    class_session = {
                        "sessionId": session_id,
                        "courseCode": course[0],
                        "courseTitle": course[1],
                        "level": level,
                        "day": day,
                        "startTime": start_time,
                        "endTime": end_time,
                        "venue": random.choice(VENUES),
                        "lecturer": random.choice(LECTURERS),
                        "type": class_type,
                        "recurring": True,
                        "createdBy": str(admin_id),
                        "createdAt": datetime.now(timezone.utc),
                        "updatedAt": datetime.now(timezone.utc)
                    }
                    
                    result = await db.timetable.insert_one(class_session)
                    class_session["_id"] = result.inserted_id
                    classes.append(class_session)
                    course_schedule.append(course)
    
    return classes


async def generate_resources(db, uploader_id):
    """Generate learning resources"""
    resources = []
    
    for level, courses in COURSES_BY_LEVEL.items():
        for course in courses[:3]:  # First 3 courses per level
            course_code, course_title, _ = course
            
            # Generate 2-3 resources per course
            for resource_template in random.sample(RESOURCE_TEMPLATES, k=random.randint(2, 3)):
                resource = {
                    "title": resource_template["title"].format(
                        course=course_title,
                        course_code=course_code,
                        week=random.randint(1, 12),
                        year=random.choice([2023, 2024])
                    ),
                    "description": f"Shared by students for {course_title}",
                    "type": resource_template["type"],
                    "courseCode": course_code,
                    "level": level,
                    "url": f"https://drive.google.com/file/d/dummy_{ObjectId()}",
                    "driveFileId": f"dummy_{ObjectId()}",
                    "fileType": "pdf",
                    "fileSize": random.randint(500000, 5000000),
                    "uploadedBy": str(uploader_id),
                    "uploaderName": "IESA Community",
                    "tags": [course_code, f"{level}L", resource_template["type"]],
                    "downloadCount": random.randint(10, 200),
                    "viewCount": random.randint(20, 500),
                    "isApproved": True,
                    "createdAt": datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60)),
                    "updatedAt": datetime.now(timezone.utc)
                }
                
                result = await db.resources.insert_one(resource)
                resource["_id"] = result.inserted_id
                resources.append(resource)
    
    return resources


async def generate_payments(db, session_id, students):
    """Generate payment records for students"""
    count = 0
    
    payment_types = [
        {"title": "Departmental Dues", "amount": 5000, "category": "dues"},
        {"title": "Handbook & Materials", "amount": 2000, "category": "materials"},
        {"title": "IESA Week Registration", "amount": 1500, "category": "event"},
    ]
    
    for student in students:
        for payment_type in payment_types:
            # 60% of students have paid
            is_paid = random.random() < 0.6
            
            payment_data = {
                "userId": student["_id"],
                "sessionId": session_id,
                "title": payment_type["title"],
                "description": f"{payment_type['title']} for {session_id}",
                "amount": payment_type["amount"],
                "category": payment_type["category"],
                "deadline": datetime.now(timezone.utc) + timedelta(days=30),
                "isPaid": is_paid,
                "hasPaid": is_paid,
                "paymentDate": datetime.now(timezone.utc) - timedelta(days=random.randint(1, 20)) if is_paid else None,
                "transactionId": f"TXN{random.randint(100000, 999999)}" if is_paid else None,
                "createdAt": datetime.now(timezone.utc) - timedelta(days=45),
                "updatedAt": datetime.now(timezone.utc)
            }
            
            await db.payments.insert_one(payment_data)
            count += 1
    
    return count


async def generate_grades(db, session_id, students):
    """Generate realistic grade records"""
    count = 0
    
    for student in students:
        level = int(student["currentLevel"].replace("L", ""))
        courses = COURSES_BY_LEVEL.get(level, [])
        
        if not courses:
            continue
        
        # Generate grades for each course
        course_grades = []
        total_units = 0
        total_weighted = 0
        
        for course_code, course_title, units in courses:
            # Generate realistic scores (40-100)
            score = random.randint(40, 100)
            
            # Determine grade
            if score >= 70:
                grade, grade_point = "A", 5.0
            elif score >= 60:
                grade, grade_point = "B", 4.0
            elif score >= 50:
                grade, grade_point = "C", 3.0
            elif score >= 45:
                grade, grade_point = "D", 2.0
            else:
                grade, grade_point = "F", 0.0
            
            course_grades.append({
                "courseCode": course_code,
                "courseTitle": course_title,
                "units": units,
                "score": score,
                "grade": grade,
                "gradePoint": grade_point
            })
            
            total_units += units
            total_weighted += grade_point * units
        
        gpa = round(total_weighted / total_units, 2) if total_units > 0 else 0.0
        
        grade_record = {
            "studentId": student["_id"],
            "sessionId": session_id,
            "semester": 1,
            "courses": course_grades,
            "gpa": gpa,
            "cgpa": round(gpa - random.uniform(0, 0.3), 2),  # CGPA slightly lower
            "totalUnits": total_units,
            "remarks": "Excellent performance" if gpa >= 4.5 else "Good standing" if gpa >= 3.5 else "Fair performance",
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        
        await db.grades.insert_one(grade_record)
        count += 1
    
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate dummy data for IESA platform")
    parser.add_argument("--clear", action="store_true", help="Clear existing data before generating")
    args = parser.parse_args()
    
    asyncio.run(generate_dummy_data(clear_existing=args.clear))
