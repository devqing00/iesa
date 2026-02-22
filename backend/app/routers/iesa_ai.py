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


# IESA Knowledge Base - Compact reference for RAG
IESA_KNOWLEDGE = """
## About IESA
IESA (Industrial Engineering Students' Association) — departmental student body for Industrial & Production Engineering (IPE) at the University of Ibadan (UI), Nigeria. Faculty of Technology.

## Academic Program
- 5-year B.Sc. in Industrial & Production Engineering (100–500 Level)
- Session cycle: ~February to February, 2 semesters/session, ~15 weeks each + exams
- Core areas: Operations Research, Production Planning, Quality Control, Systems Engineering, Ergonomics, Facilities Planning, Engineering Economy, Automation & Robotics
- Final Year Project: IOP 502 (500 Level)

## Core Courses by Level
100L: ENG 101, MTH 101, PHY 101, CHM 101, GNS 101
200L: TVE 201/202, MEE 201, MEE 202, MAT 201
300L: IOP 301 (Work Study), IOP 302 (Production Planning), IOP 303 (Quality Control), MEE 301, EEE 301
400L: IOP 401 (Operations Research), IOP 402 (Systems Eng), IOP 403 (Facilities Planning), IOP 404 (Engineering Economy)
500L: IOP 501 (Project Mgmt), IOP 502 (FYP), IOP 503 (Automation & Robotics)

## IESA Structure
EXCO: President, Vice President, General Secretary, Asst. Gen Sec, Financial Secretary, Treasurer, PRO, Welfare Director, Academic Director, Sports Director, Class Representatives
Committees: Academic (library, past questions), Welfare (student support), Sports (athletics), Protocol (events)

## Payments & Dues
- Departmental dues vary by session (typically ₦2,500–₦5,000)
- Pay via Paystack (card, bank transfer, USSD)
- Auto-generated PDF receipt after payment
- ID card: green border = paid, red = owing

## Platform Features
1. Payment portal with Paystack integration
2. Resource library (past questions, slides, notes by course/level)
3. Event calendar with RSVP
4. CGPA calculator
5. Class timetable (managed by class reps/admin)
6. IESA AI assistant

## Contact
Office: Technology Faculty Complex, Mon–Fri 10am–4pm
Social: @IESAUI (Instagram, Twitter, Facebook)
"""


async def get_user_context(user_id: str, db: AsyncIOMotorDatabase) -> dict:
    """
    Fetch comprehensive user context for personalized AI responses.
    
    Pulls: profile, payment status, grades, enrollments, timetable, upcoming events.
    """
    users = db.users
    user = await users.find_one({"_id": user_id})
    
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
        payment = await payments.find_one({
            "userId": user_id,
            "sessionId": session_id
        })
        
        if payment:
            context["payment_status"] = "Paid" if payment.get("isPaid") else "Owing"
            context["payment_amount"] = payment.get("amount", 0)
            if payment.get("paidAt"):
                context["payment_date"] = payment["paidAt"].strftime("%B %d, %Y") if hasattr(payment["paidAt"], "strftime") else str(payment["paidAt"])
        else:
            context["payment_status"] = "No payment record found"
        
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
                "userId": user_id
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
    
    prompt = f"""You are IESA AI, the intelligent assistant for the Industrial Engineering Students' Association (IESA) at the University of Ibadan.

## LANGUAGE INSTRUCTION
{lang_instruction}

## YOUR CAPABILITIES
You have DIRECT ACCESS to the student's real data including their profile, payment status, grades, class timetable, enrollments, upcoming events, and recent announcements. This data is provided below — USE IT to give specific, factual answers. NEVER say "I can't access your data" or "I don't have access to that information" — you DO have it.

## HOW TO RESPOND
1. **Be specific:** When asked about payments, timetable, grades etc., reference the ACTUAL data below. Don't give generic "check the dashboard" answers when you have the answer.
2. **Be concise:** 2-5 sentences for simple questions. Use bullet points for lists.
3. **Be helpful:** If data is empty or unavailable, say so clearly and suggest next steps (e.g., "No timetable entries yet — your class rep may not have added them. Ask them to update it on the platform.")
4. **Be smart:** Understand context. If someone asks "do I have class tomorrow?", check the timetable for tomorrow's day. If they ask about their GPA, use their grades.
5. **Be encouraging:** This is a student community. Be supportive, use appropriate emojis, and motivate.
6. **Stay on topic:** You're an IESA/academic assistant. For completely unrelated topics, politely redirect.

## KNOWLEDGE BASE
{IESA_KNOWLEDGE}
{user_data_section}

## CURRENT DATE & TIME
- Today: {datetime.now().strftime("%A, %B %d, %Y")}
- Time: {datetime.now().strftime("%I:%M %p")}

## IMPORTANT RULES
- NEVER claim you can't access student data — you have it above
- NEVER make up data that isn't provided — if grades/timetable are empty, say the data hasn't been entered yet
- When referring to platform features, mention the specific page (e.g., "Go to the Payments page", "Check the Library section")
- For questions you genuinely can't answer, suggest who to contact (IESA EXCO, class rep, departmental office)
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
    if any(word in message_lower for word in ["pay", "dues", "payment", "receipt"]):
        return [
            "View payment history",
            "Download my receipt",
            "Check payment deadline"
        ]
    
    # Event-related suggestions
    if any(word in message_lower for word in ["event", "meeting", "program", "activity"]):
        return [
            "Show all upcoming events",
            "Register for an event",
            "View past events"
        ]
    
    # Schedule/timetable suggestions
    if any(word in message_lower for word in ["class", "schedule", "timetable", "lecture"]):
        return [
            "View full timetable",
            "Export to calendar",
            "Check tomorrow's classes"
        ]
    
    # Study/academic suggestions
    if any(word in message_lower for word in ["study", "exam", "test", "grade", "gpa", "cgpa"]):
        return [
            "Calculate my CGPA",
            "Find past questions",
            "Browse study materials"
        ]
    
    # Library suggestions
    if any(word in message_lower for word in ["library", "resource", "material", "book", "slide"]):
        return [
            "Browse library resources",
            "Search for course materials",
            "Download past questions"
        ]
    
    # Default suggestions
    return [
        "Tell me about upcoming events",
        "Check my payment status",
        "Show my timetable"
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
            "Show me resources for my level",
            "What's my class schedule?",
            "Tips for exam preparation",
            "How can I calculate my CGPA?",
            "Who are the current EXCO members?",
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
