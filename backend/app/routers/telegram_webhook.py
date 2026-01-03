"""
Telegram Bot Webhook Router

Handles incoming Telegram updates via webhooks instead of polling.
This is more efficient for production deployment on Render.

Setup:
1. Set TELEGRAM_BOT_TOKEN in environment variables
2. Deploy to Render (webhook URL will be set automatically)
3. Bot will be active immediately after deployment
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
import logging

from ..db import get_database
from ..routers.iesa_ai import IESA_KNOWLEDGE

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/telegram", tags=["Telegram Bot"])

# Telegram configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize Groq client
GROQ_AVAILABLE = False
groq_client = None

if GROQ_API_KEY:
    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
        GROQ_AVAILABLE = True
    except ImportError:
        logger.warning("Groq package not installed. Telegram bot will have limited functionality.")

# Store conversation history (in production, use Redis or MongoDB)
conversation_store: Dict[str, List[dict]] = {}


class TelegramUser(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None


class TelegramChat(BaseModel):
    id: int
    type: str
    first_name: Optional[str] = None
    username: Optional[str] = None


class TelegramMessage(BaseModel):
    message_id: int
    from_: Optional[TelegramUser] = None
    chat: TelegramChat
    text: Optional[str] = None
    
    class Config:
        populate_by_name = True
        fields = {'from_': 'from'}


class TelegramUpdate(BaseModel):
    update_id: int
    message: Optional[TelegramMessage] = None


async def send_telegram_message(chat_id: int, text: str, parse_mode: str = None):
    """Send a message via Telegram Bot API"""
    import httpx
    
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set")
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    data = {
        "chat_id": chat_id,
        "text": text
    }
    
    if parse_mode:
        data["parse_mode"] = parse_mode
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=data)
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to send Telegram message: {e}")


async def send_chat_action(chat_id: int, action: str = "typing"):
    """Send chat action (typing indicator)"""
    import httpx
    
    if not TELEGRAM_BOT_TOKEN:
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendChatAction"
    
    async with httpx.AsyncClient() as client:
        try:
            await client.post(url, json={"chat_id": chat_id, "action": action})
        except Exception as e:
            logger.error(f"Failed to send chat action: {e}")


async def chat_with_groq(user_message: str, conversation_history: list, user_context: dict = None) -> str:
    """
    Send message to Groq API with IESA context
    """
    if not GROQ_AVAILABLE or not groq_client:
        return "Sorry, AI service is temporarily unavailable. Please try again later."
    
    # Build system prompt with IESA knowledge
    system_prompt = f"""You are IESA AI, a helpful and friendly assistant for the Industrial Engineering Students' Association (IESA) at the University of Ibadan.

{IESA_KNOWLEDGE}
"""
    
    if user_context:
        system_prompt += f"\n\nCurrent User Information:\n"
        system_prompt += f"- Name: {user_context.get('name', 'Unknown')}\n"
        system_prompt += f"- Level: {user_context.get('level', 'Unknown')}\n"
    
    system_prompt += """

Respond in a friendly, helpful manner. Keep answers concise but informative (max 300 words). 
Use emojis occasionally to make responses more engaging.
If you don't know something, admit it honestly and suggest where they can find the information.
"""
    
    # Prepare messages for Groq
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history (last 10 messages)
    for msg in conversation_history[-10:]:
        messages.append(msg)
    
    # Add current user message
    messages.append({"role": "user", "content": user_message})
    
    try:
        # Call Groq API
        chat_completion = groq_client.chat.completions.create(
            messages=messages,
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            temperature=0.7,
            max_tokens=800,
        )
        
        response = chat_completion.choices[0].message.content
        return response
    
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return "Sorry, I'm having trouble processing your request right now. Please try again in a moment."


async def handle_start_command(chat_id: int, user_first_name: str):
    """Handle /start command"""
    welcome_message = f"""👋 Hello {user_first_name}!

I'm the **IESA AI Assistant** - your personal guide to the Industrial Engineering Students' Association at UI.

I can help you with:
📚 Timetables and schedules
💰 Payment information
📅 Upcoming events
📖 Library resources
🎓 Academic guidance
❓ General questions about IESA

Just send me a message and I'll do my best to help!

*Commands:*
/start - Show this welcome message
/clear - Clear conversation history
/help - Get help

*Powered by Groq AI* 🚀
"""
    await send_telegram_message(chat_id, welcome_message, parse_mode="Markdown")


async def handle_help_command(chat_id: int):
    """Handle /help command"""
    help_text = """*IESA AI Assistant Help*

*Available Commands:*
/start - Welcome message
/clear - Clear your conversation history
/help - Show this help message

*How to Use:*
Simply send me any question about:
- Your timetable or schedule
- IESA events and programs
- Payment information
- Academic resources
- Study tips
- General IESA information

*Examples:*
- "What courses are in 300 level?"
- "How do I pay my dues?"
- "When is the next IESA event?"
- "Tips for passing IOP 301?"

I'll do my best to provide helpful answers!
"""
    await send_telegram_message(chat_id, help_text, parse_mode="Markdown")


async def handle_clear_command(chat_id: int, user_id: str):
    """Handle /clear command"""
    if user_id in conversation_store:
        del conversation_store[user_id]
    
    await send_telegram_message(chat_id, "✅ Conversation history cleared! Starting fresh.")


async def handle_message(chat_id: int, user_id: str, user_first_name: str, message_text: str):
    """Handle regular text messages"""
    # Send typing indicator
    await send_chat_action(chat_id, "typing")
    
    # Get or create conversation history
    if user_id not in conversation_store:
        conversation_store[user_id] = []
    
    conversation_history = conversation_store[user_id]
    
    # User context
    user_context = {
        "name": user_first_name,
        "level": "Unknown (Link your IESA account)",
    }
    
    # Chat with Groq
    response = await chat_with_groq(message_text, conversation_history, user_context)
    
    # Update conversation history
    conversation_history.append({"role": "user", "content": message_text})
    conversation_history.append({"role": "assistant", "content": response})
    
    # Keep only last 20 messages (10 exchanges)
    conversation_store[user_id] = conversation_history[-20:]
    
    # Send response
    await send_telegram_message(chat_id, response)


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """
    Receive updates from Telegram via webhook
    
    Telegram will POST updates to this endpoint when users interact with the bot.
    """
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="Telegram bot not configured")
    
    try:
        # Parse the update
        body = await request.json()
        update = TelegramUpdate(**body)
        
        # Only process messages (ignore other update types)
        if not update.message or not update.message.text:
            return {"ok": True}
        
        message = update.message
        chat_id = message.chat.id
        user_id = str(message.from_.id) if message.from_ else str(chat_id)
        user_first_name = message.from_.first_name if message.from_ else "User"
        text = message.text.strip()
        
        logger.info(f"Telegram message from {user_first_name} ({user_id}): {text}")
        
        # Handle commands
        if text.startswith("/"):
            command = text.split()[0].lower()
            
            if command == "/start":
                await handle_start_command(chat_id, user_first_name)
            elif command == "/help":
                await handle_help_command(chat_id)
            elif command == "/clear":
                await handle_clear_command(chat_id, user_id)
            else:
                await send_telegram_message(
                    chat_id, 
                    "Unknown command. Use /help to see available commands."
                )
        else:
            # Handle regular message
            await handle_message(chat_id, user_id, user_first_name, text)
        
        return {"ok": True}
    
    except Exception as e:
        logger.error(f"Error processing Telegram webhook: {e}")
        return {"ok": False, "error": str(e)}


@router.get("/setup")
async def setup_webhook(request: Request):
    """
    Setup webhook URL with Telegram
    
    Call this endpoint once after deployment to register your webhook.
    Example: GET https://your-app.onrender.com/api/telegram/setup
    """
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="TELEGRAM_BOT_TOKEN not configured")
    
    # Get the base URL from the request
    base_url = str(request.base_url).rstrip('/')
    webhook_url = f"{base_url}/api/telegram/webhook"
    
    # Set webhook with Telegram
    import httpx
    telegram_api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                telegram_api_url,
                json={"url": webhook_url}
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get("ok"):
                return {
                    "success": True,
                    "webhook_url": webhook_url,
                    "message": "Webhook successfully registered with Telegram!",
                    "details": result
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to set webhook: {result}"
                )
        
        except Exception as e:
            logger.error(f"Failed to setup webhook: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to setup webhook: {str(e)}"
            )


@router.get("/info")
async def bot_info():
    """Get bot information and webhook status"""
    if not TELEGRAM_BOT_TOKEN:
        return {"configured": False, "message": "TELEGRAM_BOT_TOKEN not set"}
    
    import httpx
    
    async with httpx.AsyncClient() as client:
        try:
            # Get bot info
            bot_response = await client.get(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe"
            )
            bot_data = bot_response.json()
            
            # Get webhook info
            webhook_response = await client.get(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getWebhookInfo"
            )
            webhook_data = webhook_response.json()
            
            return {
                "configured": True,
                "bot": bot_data.get("result", {}),
                "webhook": webhook_data.get("result", {}),
                "groq_available": GROQ_AVAILABLE
            }
        
        except Exception as e:
            logger.error(f"Failed to get bot info: {e}")
            return {
                "configured": True,
                "error": str(e)
            }
