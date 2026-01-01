"""
IESA AI Telegram Bot

A Telegram bot that connects to the IESA AI system.
Students can chat with IESA AI directly through Telegram.

Setup:
1. Create a bot with @BotFather on Telegram
2. Get your bot token
3. Set TELEGRAM_BOT_TOKEN in .env file
4. Run: python telegram_bot.py

Requirements:
pip install python-telegram-bot groq motor pymongo
"""

import os
import asyncio
import logging
from datetime import datetime
from typing import Optional

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Import IESA AI functions
from app.db import get_database
from app.routers.iesa_ai import get_user_context, IESA_KNOWLEDGE

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Load environment variables
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN not found in environment variables")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables")

# Initialize Groq client
try:
    from groq import Groq
    groq_client = Groq(api_key=GROQ_API_KEY)
    GROQ_AVAILABLE = True
except ImportError:
    logger.error("Groq package not installed. Install with: pip install groq")
    GROQ_AVAILABLE = False
    groq_client = None


# Store conversation history per user (in-memory, can be moved to Redis/MongoDB for persistence)
conversation_store = {}


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user = update.effective_user
    welcome_message = f"""
👋 Hello {user.first_name}!

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
/schedule - View your timetable
/events - See upcoming events
/payments - Check payment status

*Powered by Groq AI* 🚀
"""
    await update.message.reply_text(welcome_message)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    help_text = """
*IESA AI Assistant Help*

*Available Commands:*
/start - Welcome message
/clear - Clear your conversation history
/help - Show this help message
/schedule - View your class timetable
/events - See upcoming IESA events
/payments - Check payment status

*How to Use:*
Simply send me any question about:
- Your timetable or schedule
- IESA events and programs
- Payment information
- Academic resources
- Study tips
- General IESA information

*Examples:*
- "What's my schedule for today?"
- "When is the next IESA event?"
- "How do I pay my dues?"
- "What courses are in 300 level?"
- "Tips for passing IOP 301?"

I'll do my best to provide helpful answers!
"""
    await update.message.reply_text(help_text, parse_mode='Markdown')


async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /clear command - clears conversation history"""
    user_id = str(update.effective_user.id)
    
    if user_id in conversation_store:
        del conversation_store[user_id]
    
    await update.message.reply_text("✅ Conversation history cleared! Starting fresh.")


async def schedule_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /schedule command"""
    message = "📅 What would you like to know about your schedule? Ask me questions like:\n\n"
    message += "- What's my schedule for today?\n"
    message += "- When is my next class?\n"
    message += "- Show me my Monday timetable\n"
    message += "- When do I have IOP 301?"
    
    await update.message.reply_text(message)


async def events_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /events command"""
    # This would fetch from database in production
    message = "📅 Let me check upcoming IESA events for you!\n\n"
    message += "Ask me questions like:\n"
    message += "- What events are coming up?\n"
    message += "- When is the next general meeting?\n"
    message += "- Are there any workshops this week?"
    
    await update.message.reply_text(message)


async def payments_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /payments command"""
    message = "💰 I can help with payment information!\n\n"
    message += "Ask me:\n"
    message += "- Have I paid my dues?\n"
    message += "- How much are departmental dues?\n"
    message += "- How do I make a payment?\n"
    message += "- Can I get my receipt?"
    
    await update.message.reply_text(message)


async def chat_with_groq(user_message: str, conversation_history: list, user_context: dict = None) -> str:
    """
    Send message to Groq API with IESA context
    
    Args:
        user_message: The user's message
        conversation_history: Previous messages in the conversation
        user_context: User-specific context (level, payment status, etc.)
    
    Returns:
        AI response
    """
    if not GROQ_AVAILABLE or not groq_client:
        return "Sorry, AI service is temporarily unavailable. Please try again later."
    
    # Build system prompt with IESA knowledge and user context
    system_prompt = f"""You are IESA AI, a helpful and friendly assistant for the Industrial Engineering Students' Association (IESA) at the University of Ibadan.

{IESA_KNOWLEDGE}
"""
    
    if user_context:
        system_prompt += f"\n\nCurrent User Information:\n"
        system_prompt += f"- Name: {user_context.get('name', 'Unknown')}\n"
        system_prompt += f"- Level: {user_context.get('level', 'Unknown')}\n"
        system_prompt += f"- Matric Number: {user_context.get('matric', 'Unknown')}\n"
        system_prompt += f"- Session: {user_context.get('session', 'Current session')}\n"
        system_prompt += f"- Payment Status: {user_context.get('payment_status', 'Unknown')}\n"
    
    system_prompt += """

Respond in a friendly, helpful manner. Keep answers concise but informative. 
Use emojis occasionally to make responses more engaging.
If you don't know something, admit it honestly and suggest where they can find the information.
"""
    
    # Prepare messages for Groq
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history (last 10 messages to avoid token limits)
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
            max_tokens=1024,
        )
        
        response = chat_completion.choices[0].message.content
        return response
    
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return "Sorry, I'm having trouble processing your request right now. Please try again in a moment."


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle incoming messages"""
    user = update.effective_user
    user_id = str(user.id)
    message_text = update.message.text
    
    logger.info(f"Message from {user.first_name} ({user_id}): {message_text}")
    
    # Show typing indicator
    await update.message.chat.send_action("typing")
    
    # Get or create conversation history for this user
    if user_id not in conversation_store:
        conversation_store[user_id] = []
    
    conversation_history = conversation_store[user_id]
    
    # Get user context from database (if linked)
    # For now, use Telegram user info as context
    user_context = {
        "name": user.first_name,
        "level": "Unknown (Link your IESA account)",
        "session": "2025/2026",
    }
    
    # Chat with Groq
    response = await chat_with_groq(message_text, conversation_history, user_context)
    
    # Update conversation history
    conversation_history.append({"role": "user", "content": message_text})
    conversation_history.append({"role": "assistant", "content": response})
    
    # Keep only last 20 messages (10 exchanges) to manage memory
    conversation_store[user_id] = conversation_history[-20:]
    
    # Send response
    await update.message.reply_text(response)


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle errors"""
    logger.error(f"Update {update} caused error {context.error}")
    
    if update and update.message:
        await update.message.reply_text(
            "Sorry, something went wrong. Please try again or use /help for assistance."
        )


def main():
    """Start the Telegram bot"""
    logger.info("Starting IESA AI Telegram Bot...")
    
    # Create application
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    # Add command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("clear", clear_command))
    application.add_handler(CommandHandler("schedule", schedule_command))
    application.add_handler(CommandHandler("events", events_command))
    application.add_handler(CommandHandler("payments", payments_command))
    
    # Add message handler for all text messages
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    # Add error handler
    application.add_error_handler(error_handler)
    
    # Start the bot
    logger.info("IESA AI Telegram Bot is running! Press Ctrl+C to stop.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
