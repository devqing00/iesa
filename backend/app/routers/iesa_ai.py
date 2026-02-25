"""
IESA AI Router - Comprehensive AI Assistant

A smart AI assistant powered by Groq that can:
- Answer questions about timetables/schedules with REAL data
- Provide personalized payment, grade, and enrollment info
- Help with IESA processes and procedures
- Offer contextual study tips and academic guidance
- Answer general questions about the department

Uses RAG (Retrieval Augmented Generation) with live database context.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
from datetime import datetime, timezone, timedelta, date
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import os
import json
import logging
import asyncio

from ..core.security import get_current_user
from ..core.rate_limiting import limiter
from ..db import get_database

logger = logging.getLogger("iesa_backend")

router = APIRouter(prefix="/api/v1/iesa-ai", tags=["IESA AI"])

# Groq API setup
try:
    from groq import Groq
    GROQ_AVAILABLE = True
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    if GROQ_API_KEY:
        groq_client = Groq(api_key=GROQ_API_KEY)
    else:
        GROQ_AVAILABLE = False
        print("Warning: GROQ_API_KEY not found in environment variables")
except ImportError:
    GROQ_AVAILABLE = False
    print("Warning: groq package not installed. Install with: pip install groq")


class ChatMessage(BaseModel):
    message: str
    conversationHistory: Optional[List[dict]] = []
    language: Optional[str] = "en"  # "en", "pcm" (Pidgin), "yo" (Yoruba)


class ChatResponse(BaseModel):
    reply: str
    suggestions: Optional[List[str]] = None
    data: Optional[dict] = None


# IESA Knowledge Base - Comprehensive reference for RAG
IESA_KNOWLEDGE = """
## About IESA
IESA (Industrial Engineering Students' Association) is the official departmental student body for Industrial & Production Engineering (IPE) at the University of Ibadan (UI), Nigeria — Faculty of Technology. It serves as the bridge between students and the department, organises academic and social programs, and manages departmental resources, dues, and welfare.

## Academic Program
- 5-year B.Sc. in Industrial & Production Engineering (100–500 Level)
- Session cycle: ~February to February, 2 semesters/session, ~15 weeks each + exams
- Level is based on admission year: 100L (Year 1), 200L (Year 2), ... 500L (Year 5)
- Core disciplines: Operations Research, Production Planning, Quality Control, Systems Engineering, Ergonomics, Facilities Planning, Engineering Economy, Automation & Robotics, Work Study
- Final Year Project: IOP 502 (500 Level) — individual research project submitted to the department
- Students take both IPE-specific (IOP-coded) and general engineering courses (MEE, EEE, MAT, GNS)

## Core Courses by Level
100L: ENG 101, MTH 101, PHY 101, CHM 101, GNS 101, GNS 102
200L: TVE 201, TVE 202, MEE 201, MEE 202, MAT 201, GNS 201
300L: IOP 301 (Work Study & Ergonomics), IOP 302 (Production Planning & Control), IOP 303 (Statistical Quality Control), MEE 301, EEE 301, MAT 301
400L: IOP 401 (Operations Research), IOP 402 (Systems Engineering), IOP 403 (Facilities Planning & Design), IOP 404 (Engineering Economy), IOP 405 (Human Factors Engineering)
500L: IOP 501 (Project Management), IOP 502 (Final Year Project), IOP 503 (Automation & Robotics), IOP 504 (Supply Chain Management)

## IESA Structure & Leadership
EXCO positions: President, Vice President, General Secretary, Assistant General Secretary, Financial Secretary, Treasurer, Public Relations Officer (PRO), Welfare Director, Academic Director, Sports Director, Social Director
Class Representatives: Each level has class reps who manage timetables, liaise with lecturers, and represent students
Committees: Academic (library, past questions, study sessions), Welfare (student support, medical, hostel), Sports (athletics, games), Protocol (events, decorum)
To see the current EXCO and their contacts: go to the Team page on the platform (Dashboard → Team → Central EXCO).
To see class reps: Dashboard → Team → Class Reps

## Payments & Dues
- Departmental dues vary by session (typically ₦2,500–₦5,000 total across one or more payment items)
- Multiple payment items may exist per session (e.g., association dues, level dues, welfare levy)
- Pay easily via Paystack: card, bank transfer, USSD — go to the Payments page
- Auto-generated PDF receipt available immediately after payment — go to Receipts page to download
- ID card: green border = dues paid, red border = dues owed
- Payment deadline reminders are sent via announcements

## Platform Features (Full Dashboard)
Core Pages:
- Dashboard Home: Overview of dues status, upcoming events, announcements, and AI assistant
- Payments: Pay all dues via Paystack. View all payment items and status.
- Receipts: Download PDF receipts for any payment you've made.
- Timetable: View your class schedule for the week (managed by class reps/admin)
- Library: Browse and download past questions, lecture slides, and study notes filtered by level and course
- Events: View upcoming and past IESA events; RSVP to events
- Calendar: Full academic calendar — exam dates, events, key dates
- Announcements: Important notices from IESA EXCO and the department
- Applications: Apply for unit/elective courses; track your application status

Growth Tools (Dashboard → Growth):
- CGPA Calculator: Calculate and track your semester GPA and cumulative CGPA using UI's grading system
- Habits Tracker: Build and track daily academic habits (reading, exercise, revision, etc.)
- Weekly Journal: Reflect on your week — what went well, what to improve, next week's focus, gratitude
- Flashcards: Create and study flashcard decks for any course, with flip-card interaction
- Study Groups: Create or join peer study groups for specific courses; coordinate meetings and resources
- Goals: Set and track academic goals by deadline and priority
- Study Timer (Pomodoro): Timed focus sessions with break reminders to improve study efficiency
- Weekly Planner: Plan your weekly schedule with time blocks
- Courses: Manage your enrolled courses and track progress

IEPOD Hub (Dashboard → IEPOD):
- IEPOD stands for Intellectual Exchange, Professional & Occupational Development
- Hub home: Overview of mentoring programs, research projects, and niche development resources
- TIMP (The I.E. Mentoring Program): Formal peer mentoring. Senior students (400L/500L) can apply to be mentors; junior students (100L–300L) can apply to be mentees. Mentors guide mentees through academics, career planning, and professional development.
- Research Projects: Students can submit and showcase research project ideas or completed works to the department community
- Niche Audit: A self-assessment tool to help students identify their area of focus within industrial engineering (operations, quality, manufacturing, logistics, consulting, etc.)
- IEPOD Team: See the IEPOD coordinators and team members

Team Pages:
- Central EXCO: Current executive officers with names, roles, and contacts
- Committees: Committee members and their roles
- Class Reps: Class representatives for each level

Press:
- Write for IESA: Submit articles for the IESA press/newsletter
- Review submissions (for editors)
- Read published IESA press articles

Profile: Update personal info, profile picture, change password

## Study & Academic Tips
- For past questions: Dashboard → Library → Filter by level and course
- For CGPA calculation: Dashboard → Growth → CGPA Calculator — supports 4.0 and 5.0 scales, and UI's specific grading system
- For study groups: Dashboard → Growth → Study Groups — search by course or create a new group
- For exam prep: Use Flashcards for memorisation, Study Timer for focused sessions, Journal for weekly reflection
- Departmental library (physical) is in the Technology Faculty Complex

## Contact & Support
Office: Technology Faculty Complex, Mon–Fri 10am–4pm
For urgent issues: Contact EXCO directly (see Team page for contacts)
Social: @IESAUI (Instagram, Twitter, Facebook)
Academic issues: Contact Academic Director or your class rep
Welfare issues: Contact Welfare Director
Payment issues: Contact Financial Secretary or Treasurer
"""


async def get_user_context(user_id: str, db: AsyncIOMotorDatabase) -> dict:
    """
    Fetch comprehensive user context for personalized AI responses.
    
    Pulls: profile, payment status, grades, enrollments, timetable, upcoming events.
    """
    users = db.users
    user = await users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    
    if not user:
        return {}
    
    level = user.get("currentLevel", "Unknown")
    context = {
        "level": level,
        "name": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "matric": user.get("matricNumber", "Unknown"),
    }
    
    # Get active session
    sessions = db.sessions
    active_session = await sessions.find_one({"isActive": True})
    
    if active_session:
        session_id = str(active_session["_id"])
        context["session"] = active_session.get("name", "Current session")
        
        # ── Payment status ──
        payments = db.payments
        # Payments track payers via 'paidBy' array, not 'userId'
        session_payments = await payments.find({
            "sessionId": session_id
        }).to_list(length=50)
        
        paid_payments = [p for p in session_payments if user_id in (p.get("paidBy") or [])]
        unpaid_payments = [p for p in session_payments if user_id not in (p.get("paidBy") or [])]
        
        if session_payments:
            context["payment_status"] = f"Paid {len(paid_payments)}/{len(session_payments)} dues"
            context["paid_payments"] = [{"title": p.get("title", ""), "amount": p.get("amount", 0)} for p in paid_payments]
            context["unpaid_payments"] = [{"title": p.get("title", ""), "amount": p.get("amount", 0)} for p in unpaid_payments]
        else:
            context["payment_status"] = "No payment dues found for this session"
        
        # ── Upcoming events (next 14 days) ──
        events = db.events
        try:
            upcoming_events = await events.find({
                "date": {"$gte": datetime.now(timezone.utc), "$lte": datetime.now(timezone.utc) + timedelta(days=14)}
            }).sort("date", 1).limit(5).to_list(length=5)
            
            if upcoming_events:
                context["upcoming_events"] = [
                    {
                        "title": e.get("title", "Untitled Event"),
                        "date": e.get("date").strftime("%A, %B %d, %Y") if e.get("date") else "TBD",
                        "location": e.get("location", "TBD"),
                        "type": e.get("type", "general"),
                    }
                    for e in upcoming_events
                ]
        except Exception:
            pass
        
        # ── Grades (most recent) ──
        grades = db.grades
        try:
            user_grades = await grades.find({
                "studentId": user_id
            }).sort("createdAt", -1).limit(20).to_list(length=20)
            
            if user_grades:
                grade_summary = []
                for g in user_grades:
                    grade_summary.append({
                        "course": g.get("courseCode", "Unknown"),
                        "grade": g.get("grade", "N/A"),
                        "score": g.get("score"),
                        "semester": g.get("semester", ""),
                        "session": g.get("session", ""),
                    })
                context["grades"] = grade_summary
                
                # Calculate simple GPA if scores available
                graded = [g for g in user_grades if g.get("score") is not None]
                if graded:
                    avg_score = sum(g["score"] for g in graded) / len(graded)
                    context["average_score"] = round(avg_score, 1)
        except Exception:
            pass
        
        # ── Timetable (today's and full week) ──
        class_sessions = db.classSessions
        try:
            # Try to get numeric level
            numeric_level = int(str(level).replace("L", "").replace("l", "").strip()) if level != "Unknown" else None
            
            if numeric_level:
                today_name = date.today().strftime("%A")
                
                # Today's classes
                today_classes = await class_sessions.find({
                    "sessionId": active_session["_id"],
                    "level": numeric_level,
                    "day": today_name
                }).sort("startTime", 1).to_list(length=20)
                
                if today_classes:
                    context["today_classes"] = [
                        {
                            "course": c.get("courseCode", ""),
                            "title": c.get("courseTitle", ""),
                            "time": f"{c.get('startTime', '')} - {c.get('endTime', '')}",
                            "venue": c.get("venue", "TBD"),
                            "type": c.get("type", "lecture"),
                            "lecturer": c.get("lecturer", ""),
                        }
                        for c in today_classes
                    ]
                else:
                    context["today_classes"] = []
                    context["today_note"] = f"No classes scheduled for {today_name}"
                
                # Full week timetable
                all_classes = await class_sessions.find({
                    "sessionId": active_session["_id"],
                    "level": numeric_level,
                }).sort([("day", 1), ("startTime", 1)]).to_list(length=50)
                
                if all_classes:
                    week_schedule = {}
                    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
                    for c in all_classes:
                        day = c.get("day", "Unknown")
                        if day not in week_schedule:
                            week_schedule[day] = []
                        week_schedule[day].append({
                            "course": c.get("courseCode", ""),
                            "title": c.get("courseTitle", ""),
                            "time": f"{c.get('startTime', '')} - {c.get('endTime', '')}",
                            "venue": c.get("venue", "TBD"),
                            "type": c.get("type", "lecture"),
                            "lecturer": c.get("lecturer", ""),
                        })
                    # Order by day
                    context["weekly_timetable"] = {
                        d: week_schedule[d] for d in day_order if d in week_schedule
                    }
        except Exception as e:
            logger.debug(f"Timetable fetch error: {e}")
    
    # ── Enrollments ──
    enrollments = db.enrollments
    try:
        user_enrollments = await enrollments.find({
            "userId": user_id
        }).sort("createdAt", -1).limit(10).to_list(length=10)
        
        if user_enrollments:
            context["enrollments"] = [
                {
                    "course": e.get("courseCode", ""),
                    "title": e.get("courseTitle", ""),
                    "status": e.get("status", "active"),
                    "semester": e.get("semester", ""),
                }
                for e in user_enrollments
            ]
    except Exception:
        pass
    
    # ── Announcements (recent) ──
    announcements = db.announcements
    try:
        recent_announcements = await announcements.find({}).sort("createdAt", -1).limit(3).to_list(length=3)
        if recent_announcements:
            context["recent_announcements"] = [
                {
                    "title": a.get("title", ""),
                    "content": a.get("content", "")[:150],  # Truncate to save tokens
                    "date": a.get("createdAt").strftime("%B %d, %Y") if a.get("createdAt") and hasattr(a["createdAt"], "strftime") else "Recent",
                }
                for a in recent_announcements
            ]
    except Exception:
        pass
    
    return context


def build_system_prompt(user_context: dict, language: str = "en") -> str:
    """
    Build an intelligent, data-aware system prompt for IESA AI.
    """
    
    # Language-specific instructions
    language_instructions = {
        "en": "Respond in clear, friendly Nigerian English. Be conversational and warm.",
        
        "pcm": """Respond ENTIRELY in Nigerian Pidgin English throughout this conversation. 
Use authentic expressions: "How far?", "E go sweet you", "No wahala", "Wetin dey happen?", "Na so", "Sharp sharp", "Bros/Sisi", "Chai!", "Ehen!", "Omo!", "E be like say".
Keep it friendly like you dey gist with your paddy. Mix English only for technical terms.
Example: "Bros, your payment don enter! You fit download receipt for the Payment page. Na so we see am!"
IMPORTANT: You MUST maintain Pidgin throughout ALL responses in this conversation, never switch to standard English.""",
        
        "yo": """Respond in Yoruba language mixed naturally with English (code-switching). 
Use authentic expressions: "E kaaro", "E kaasan", "E pele", "Bawo ni?", "O dara", "Mo ti gbọ".
Use English for technical terms as Yoruba speakers naturally would.
Example: "E kaaro! Mo ti ri payment rẹ. O le download receipt rẹ lati Payment page. A ti ri i!"
IMPORTANT: You MUST maintain Yoruba style throughout ALL responses in this conversation."""
    }
    
    lang_instruction = language_instructions.get(language, language_instructions["en"])
    
    # Build rich user data section
    user_data_section = ""
    if user_context:
        user_data_section = f"""
## STUDENT PROFILE (REAL DATA — use this to answer questions directly)
- Name: {user_context.get('name', 'Unknown')}
- Level: {user_context.get('level', 'Unknown')}
- Matric Number: {user_context.get('matric', 'Unknown')}
- Session: {user_context.get('session', 'Unknown')}
- Payment Status: {user_context.get('payment_status', 'Unknown')}"""
        
        if user_context.get('payment_amount'):
            user_data_section += f"\n- Payment Amount: ₦{user_context['payment_amount']:,.0f}"
        if user_context.get('payment_date'):
            user_data_section += f"\n- Paid On: {user_context['payment_date']}"
        if user_context.get('average_score'):
            user_data_section += f"\n- Average Score: {user_context['average_score']}%"
        
        # Today's classes
        if user_context.get('today_classes'):
            user_data_section += "\n\n## TODAY'S CLASSES"
            for c in user_context['today_classes']:
                user_data_section += f"\n- {c['course']} ({c['title']}): {c['time']} at {c['venue']}"
                if c.get('lecturer'):
                    user_data_section += f" — {c['lecturer']}"
                if c.get('type') != 'lecture':
                    user_data_section += f" [{c['type']}]"
        elif user_context.get('today_note'):
            user_data_section += f"\n\n## TODAY'S CLASSES\n{user_context['today_note']}"
        
        # Weekly timetable
        if user_context.get('weekly_timetable'):
            user_data_section += "\n\n## WEEKLY TIMETABLE"
            for day, classes in user_context['weekly_timetable'].items():
                user_data_section += f"\n### {day}"
                for c in classes:
                    user_data_section += f"\n- {c['course']}: {c['time']} at {c['venue']}"
                    if c.get('lecturer'):
                        user_data_section += f" ({c['lecturer']})"
        
        # Grades
        if user_context.get('grades'):
            user_data_section += "\n\n## GRADES"
            for g in user_context['grades']:
                line = f"\n- {g['course']}: {g['grade']}"
                if g.get('score') is not None:
                    line += f" ({g['score']}%)"
                if g.get('semester'):
                    line += f" — {g['semester']}"
                user_data_section += line
        
        # Enrollments
        if user_context.get('enrollments'):
            user_data_section += "\n\n## ENROLLED COURSES"
            for e in user_context['enrollments']:
                user_data_section += f"\n- {e['course']} ({e['title']}): {e['status']}"
        
        # Events
        if user_context.get('upcoming_events'):
            user_data_section += "\n\n## UPCOMING EVENTS"
            for event in user_context['upcoming_events']:
                user_data_section += f"\n- {event['title']} — {event['date']}"
                if event.get('location') and event['location'] != 'TBD':
                    user_data_section += f" at {event['location']}"
        
        # Announcements
        if user_context.get('recent_announcements'):
            user_data_section += "\n\n## RECENT ANNOUNCEMENTS"
            for a in user_context['recent_announcements']:
                user_data_section += f"\n- [{a['date']}] {a['title']}: {a['content']}"
    
    # Build unpaid / paid payment details for the prompt
    payment_detail_section = ""
    if user_context.get('paid_payments'):
        payment_detail_section += "\nPaid items:"
        for p in user_context['paid_payments']:
            payment_detail_section += f"\n  ✓ {p['title']} — ₦{p['amount']:,.0f}"
    if user_context.get('unpaid_payments'):
        payment_detail_section += "\nOwing items:"
        for p in user_context['unpaid_payments']:
            payment_detail_section += f"\n  ✗ {p['title']} — ₦{p['amount']:,.0f}"
    if payment_detail_section:
        user_data_section = user_data_section.replace(
            f"- Payment Status: {user_context.get('payment_status', 'Unknown')}",
            f"- Payment Status: {user_context.get('payment_status', 'Unknown')}{payment_detail_section}"
        )

    prompt = f"""You are IESA AI — the smart, friendly academic assistant built for students of the Industrial Engineering Students' Association (IESA) at the University of Ibadan, Nigeria.

You are knowledgeable, encouraging, and grounded in real data. You speak like a helpful senior student who knows the platform inside out.

## LANGUAGE INSTRUCTION
{lang_instruction}

## DIRECT DATA ACCESS
You have LIVE access to this student's real data: profile, payment status (including exactly which dues are paid and which are owed), class timetable, grades, enrolled courses, upcoming events, and recent announcements. This data is provided in the STUDENT PROFILE section below. USE IT to give specific, direct answers — never say "I can't access your records" or "check your dashboard" when you already have the answer right here.

## RESPONSE GUIDELINES
1. **Be specific & direct:** Quote actual data when answering — course names, amounts, times, venues. Don't be vague.
2. **Be concise:** 2–5 sentences for simple questions. Use brief bullet lists for multi-item answers. Avoid long walls of text.
3. **Be honest about gaps:** If a field is empty (no timetable, no grades), say so clearly with a practical next step. Example: "No timetable entries yet — your class rep likely hasn't added them. Remind them to update it."
4. **Be context-aware:** "Do I have class tomorrow?" → check the weekly timetable for tomorrow's day. "What's my GPA?" → calculate from grade data. Parse the question's intent before answering.
5. **Be a community ally:** This is a student platform. Be warm, encouraging, motivating. Students are navigating academics and early career — meet them there.
6. **Use emojis sparingly:** 1–2 per message max. Only where they genuinely add warmth, not as filler.
7. **Stay in scope:** You're an IESA/academic assistant. For completely unrelated topics, briefly acknowledge and redirect back to what you can help with.
8. **Reference specific pages:** When guiding a student, name the exact page — "Go to Dashboard → Payments", "Check Dashboard → Growth → CGPA Calculator", "Visit Dashboard → IEPOD → TIMP".

## PLATFORM KNOWLEDGE
{IESA_KNOWLEDGE}
{user_data_section}

## CURRENT DATE & TIME
- Today: {datetime.now().strftime("%A, %B %d, %Y")}
- Time: {datetime.now().strftime("%I:%M %p")} (WAT, West Africa Time)

## NON-NEGOTIABLE RULES
- You have the student's data above — NEVER claim otherwise
- NEVER fabricate data not present in the student profile section; if something is missing, say it hasn't been entered yet
- Always suggest the relevant EXCO contact for issues beyond the platform (see Knowledge Base → Contact section)
- For payment questions, be precise: list exactly what is paid and what is owed using the data above
- For timetable questions with no data, guide the student to their class rep
"""

    return prompt


async def summarize_conversation_history(history: List[dict]) -> str:
    """
    Summarize older conversation messages to maintain context without token overflow.
    
    Uses Groq to create a compact summary of the conversation so far.
    """
    if not GROQ_AVAILABLE or not GROQ_API_KEY or len(history) < 8:
        return ""
    
    try:
        # Take the first N-6 messages to summarize (keep last 6 full)
        messages_to_summarize = history[:-6]
        
        summary_prompt = "Summarize this conversation between a student and IESA AI assistant in 2-3 sentences, focusing on key questions asked and answers given:\n\n"
        for msg in messages_to_summarize:
            role = "Student" if msg.get("role") == "user" else "AI"
            summary_prompt += f"{role}: {msg.get('content', '')[:150]}\n"
        
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": summary_prompt}],
            temperature=0.4,
            max_tokens=200,
        )
        
        summary = completion.choices[0].message.content or ""
        return summary
    except Exception as e:
        logger.debug(f"Summary generation error: {e}")
        return ""


@router.post("/chat/stream")
@limiter.limit("20/hour")
async def chat_with_iesa_ai_stream(
    request: Request,
    chat_data: ChatMessage,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Streaming version of IESA AI chat - returns tokens as they're generated.
    
    Returns Server-Sent Events (SSE) stream with:
    - data: {token: "..."} for each token
    - data: {done: true, suggestions: [...]} when complete
    """
    
    if not GROQ_AVAILABLE or not GROQ_API_KEY:
        async def error_stream():
            yield f"data: {json.dumps({'error': 'AI is currently offline'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")
    
    async def generate():
        try:
            # Get user context
            user_context = await get_user_context(str(user["_id"]), db)
            
            # Debug: Log what data is available
            logger.info(f"User context keys: {list(user_context.keys())}")
            logger.info(f"Has grades: {bool(user_context.get('grades'))}")
            logger.info(f"Has timetable: {bool(user_context.get('today_classes') or user_context.get('weekly_timetable'))}")
            
            # Build system prompt
            system_prompt = build_system_prompt(user_context, chat_data.language or "en")
            
            # Build messages with smart context window
            messages = [{"role": "system", "content": system_prompt}]
            
            if chat_data.conversationHistory:
                history_len = len(chat_data.conversationHistory)
                
                if history_len > 12:
                    # Summarize older messages
                    summary = await summarize_conversation_history(chat_data.conversationHistory)
                    if summary:
                        messages.append({"role": "system", "content": f"Previous conversation summary: {summary}"})
                    
                    # Add recent messages
                    for msg in chat_data.conversationHistory[-6:]:
                        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
                else:
                    # Add all messages if short conversation
                    for msg in chat_data.conversationHistory[-10:]:
                        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            
            # Add current message
            messages.append({"role": "user", "content": chat_data.message})
            
            # Stream from Groq
            stream = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,  # type: ignore
                temperature=0.6,
                max_tokens=800,
                top_p=0.85,
                stream=True
            )
            
            full_response = ""
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield f"data: {json.dumps({'token': token})}\n\n"
                    await asyncio.sleep(0)  # Allow other tasks to run
            
            # Generate suggestions
            suggestions = generate_suggestions(chat_data.message, full_response)
            
            # Send completion event
            yield f"data: {json.dumps({'done': True, 'suggestions': suggestions, 'user_context': user_context})}\n\n"
            
        except Exception as e:
            error_msg = str(e).lower()
            logger.error(f"IESA AI stream error: {e}")
            
            if "rate_limit" in error_msg or "429" in error_msg:
                yield f"data: {json.dumps({'error': 'Rate limit reached. Please wait a minute and try again.'})}\n\n"
            else:
                yield f"data: {json.dumps({'error': 'An error occurred. Please try again.'})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/usage")
@limiter.limit("30/minute")
async def get_usage(
    request: Request,
    user: dict = Depends(get_current_user)
):
    """
    Get current rate limit usage for the authenticated user.
    
    Returns remaining requests out of the hourly limit.
    """
    try:
        # The rate limiter tracks usage automatically
        # For the chat endpoint, we have 20/hour limit
        # We can't directly query slowapi's internal state, so we return the limit
        # The frontend will track actual usage client-side
        
        return {
            "limit": 20,
            "window": "hour",
            "message": "Track usage client-side by counting requests"
        }
    except Exception as e:
        logger.error(f"Usage endpoint error: {e}")
        return {"limit": 20, "window": "hour", "remaining": None}


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/hour")
async def chat_with_iesa_ai(
    request: Request,
    chat_data: ChatMessage,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Chat with IESA AI - Comprehensive student assistant.
    
    Handles:
    - Schedule/timetable queries
    - Payment information
    - Event information
    - Study guidance
    - General IESA questions
    """
    
    if not GROQ_AVAILABLE or not GROQ_API_KEY:
        return ChatResponse(
            reply="I'm currently offline. Please check back later or contact the IESA admin.",
            suggestions=["Check the Events page", "Visit the Library", "View your Timetable"]
        )
    
    try:
        # Get user context for personalization
        user_context = await get_user_context(str(user["_id"]), db)
        
        # Build system prompt with context and language preference
        system_prompt = build_system_prompt(user_context, chat_data.language or "en")
        
        # Build conversation history
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add previous messages (keep last 10 for context)
        if chat_data.conversationHistory:
            for msg in chat_data.conversationHistory[-10:]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
        
        # Add current user message
        messages.append({"role": "user", "content": chat_data.message})
        
        # Call Groq API
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,  # type: ignore
            temperature=0.6,
            max_tokens=800,
            top_p=0.85,
        )
        
        ai_response = completion.choices[0].message.content or "I couldn't generate a response. Please try again."
        
        # Generate smart suggestions based on query intent
        suggestions = generate_suggestions(chat_data.message, ai_response)
        
        return ChatResponse(
            reply=ai_response,
            suggestions=suggestions,
            data={"user_context": user_context}
        )
        
    except Exception as e:
        error_msg = str(e).lower()
        logger.error(f"IESA AI chat error: {e}")
        
        # Handle Groq rate limit errors specifically
        if "rate_limit" in error_msg or "429" in error_msg or "rate limit" in error_msg:
            return ChatResponse(
                reply="I've hit my thinking limit for now! 🧠 Groq's free tier has request limits. Please wait a minute and try again, or keep your questions concise to use fewer tokens.",
                suggestions=["Try again in 1 minute", "Check the Events page", "View your Timetable"]
            )
        
        return ChatResponse(
            reply="Sorry, I encountered an error. Please try again or rephrase your question.",
            suggestions=["Check the Events page", "Visit the Library", "View your Timetable"]
        )


def generate_suggestions(user_message: str, ai_response: str) -> List[str]:
    """
    Generate smart follow-up suggestions based on conversation context.
    """

    message_lower = user_message.lower()

    # Payment-related suggestions
    if any(word in message_lower for word in ["pay", "dues", "payment", "receipt", "owing", "fee"]):
        return [
            "Download my receipt",
            "How do I pay my dues?",
            "Check payment deadline"
        ]

    # Event-related suggestions
    if any(word in message_lower for word in ["event", "meeting", "program", "activity", "general meeting"]):
        return [
            "Show all upcoming events",
            "How do I RSVP to an event?",
            "What events happened recently?"
        ]

    # Schedule/timetable suggestions
    if any(word in message_lower for word in ["class", "schedule", "timetable", "lecture", "practical", "tutorial"]):
        return [
            "What classes do I have tomorrow?",
            "View my full weekly timetable",
            "Who is my class rep?"
        ]

    # CGPA / grade suggestions
    if any(word in message_lower for word in ["cgpa", "gpa", "grade", "score", "result", "point"]):
        return [
            "Calculate my CGPA",
            "What grade do I need to pass?",
            "Find past questions for my courses"
        ]

    # Study / exam suggestions
    if any(word in message_lower for word in ["study", "exam", "test", "revision", "prepare"]):
        return [
            "Show me study resources",
            "Start a Pomodoro study timer",
            "Find a study group for my course"
        ]

    # Library / resources suggestions
    if any(word in message_lower for word in ["library", "resource", "material", "book", "slide", "note", "past question"]):
        return [
            "Browse library resources",
            "Download past questions",
            "Search for course slides"
        ]

    # IEPOD / mentoring suggestions
    if any(word in message_lower for word in ["iepod", "timp", "mentor", "mentee", "niche", "career", "research", "project"]):
        return [
            "What is TIMP mentoring?",
            "How do I apply to be a mentee?",
            "Tell me about the Niche Audit tool"
        ]

    # Growth tools suggestions
    if any(word in message_lower for word in ["habit", "journal", "flashcard", "goal", "timer", "planner", "pomodoro", "growth"]):
        return [
            "Track my daily habits",
            "Create flashcards for a course",
            "Start a study timer session"
        ]

    # Team / EXCO suggestions
    if any(word in message_lower for word in ["exco", "president", "secretary", "team", "class rep", "welfare", "contact"]):
        return [
            "Show current EXCO members",
            "Who is my class rep?",
            "How do I contact the Welfare Director?"
        ]

    # Default suggestions
    return [
        "Check my payment status",
        "What classes do I have today?",
        "Tell me about IEPOD Hub"
    ]


@router.get("/suggestions")
async def get_quick_suggestions():
    """
    Get quick suggestion chips for the chat interface.
    """
    return {
        "suggestions": [
            "What events are coming up?",
            "How do I pay my dues?",
            "What classes do I have today?",
            "Show me resources for my level",
            "How do I calculate my CGPA?",
            "What is TIMP mentoring?",
            "How do I join or create a study group?",
            "Who are the current EXCO members?",
            "What is the Niche Audit tool?",
            "Tips for exam preparation",
            "How do I apply for a unit course?",
            "When is the next general meeting?"
        ]
    }


@router.post("/feedback")
async def submit_feedback(
    feedback: dict,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Submit feedback on AI responses (for improvement).
    """
    
    feedbacks = db.ai_feedback
    
    feedback_doc = {
        "userId": str(user["_id"]),
        "message": feedback.get("message"),
        "response": feedback.get("response"),
        "rating": feedback.get("rating"),  # thumbs up/down
        "comment": feedback.get("comment"),
        "createdAt": datetime.now(timezone.utc)
    }
    
    await feedbacks.insert_one(feedback_doc)
    
    return {"message": "Thank you for your feedback!"}
