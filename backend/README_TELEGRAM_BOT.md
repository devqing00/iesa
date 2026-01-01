# IESA AI Telegram Bot Setup Guide

## Overview

The IESA AI Telegram Bot allows students to interact with the IESA AI assistant directly through Telegram. It uses the same Groq AI backend as the web platform and provides access to:

- 📚 Timetable information
- 💰 Payment status and dues
- 📅 Upcoming events
- 📖 Library resources
- 🎓 Academic guidance
- ❓ General IESA information

## Prerequisites

1. Python 3.8 or higher
2. IESA backend dependencies installed
3. Telegram account
4. Groq API key (already configured in your IESA backend)

## Setup Instructions

### Step 1: Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Start a chat and send `/newbot`
3. Follow the prompts:
   - Choose a name for your bot (e.g., "IESA AI Assistant")
   - Choose a username (must end in 'bot', e.g., "IESAUIBot")
4. BotFather will give you a **bot token** - save this securely!

Example token: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### Step 2: Configure Environment Variables

Add your bot token to the `.env` file in the backend directory:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Make sure these are also set (should already be configured)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
```

### Step 3: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This will install `python-telegram-bot` along with other dependencies.

### Step 4: Run the Bot

#### Option 1: Run Standalone (Recommended for testing)

```bash
cd backend
python telegram_bot.py
```

You should see:
```
INFO - Starting IESA AI Telegram Bot...
INFO - IESA AI Telegram Bot is running! Press Ctrl+C to stop.
```

#### Option 2: Run as Background Service (Production)

Using `screen` or `tmux`:
```bash
screen -S iesa-telegram
cd backend
python telegram_bot.py
# Press Ctrl+A then D to detach
```

Using systemd (Linux):
```bash
sudo nano /etc/systemd/system/iesa-telegram-bot.service
```

Add:
```ini
[Unit]
Description=IESA AI Telegram Bot
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/iesa/backend
Environment="PYTHONPATH=/path/to/iesa/backend"
ExecStart=/usr/bin/python3 telegram_bot.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable iesa-telegram-bot
sudo systemctl start iesa-telegram-bot
sudo systemctl status iesa-telegram-bot
```

## Using the Bot

### Available Commands

- `/start` - Welcome message and introduction
- `/help` - Show available commands and usage examples
- `/clear` - Clear conversation history and start fresh
- `/schedule` - Get help with timetable questions
- `/events` - Check upcoming IESA events
- `/payments` - Get payment information

### Example Conversations

**Timetable Queries:**
```
User: What's my schedule for today?
Bot: Let me help you with your schedule! ...

User: When is IOP 301?
Bot: IOP 301 (Work Study and Ergonomics) is scheduled for...
```

**Payment Questions:**
```
User: How much are departmental dues?
Bot: Departmental dues typically range from ₦2,500 to ₦5,000 per session...

User: How do I pay my dues?
Bot: You can pay your departmental dues through Paystack...
```

**General Questions:**
```
User: What events are coming up?
Bot: Here are the upcoming IESA events: ...

User: Tips for passing IOP 303?
Bot: Quality Control (IOP 303) is an important course! Here are some tips...
```

## Features

### 1. Conversation Memory
- The bot remembers your conversation context
- Up to 10 message exchanges are kept in memory
- Use `/clear` to start a fresh conversation

### 2. Personalized Responses
- Responses are tailored to your level and session
- Integration with IESA database for user-specific information

### 3. AI-Powered Intelligence
- Uses Groq's LLaMA 3.1 model for natural language understanding
- Can handle complex, multi-part questions
- Provides contextual and relevant answers

### 4. Rich Knowledge Base
- Complete IESA information (courses, events, payments)
- Academic structure and program details
- Study tips and guidance

## Troubleshooting

### Bot doesn't respond
1. Check if the bot is running: `ps aux | grep telegram_bot.py`
2. Check logs for errors
3. Verify `TELEGRAM_BOT_TOKEN` is correctly set in `.env`
4. Make sure Groq API key is valid

### "AI service temporarily unavailable"
1. Check `GROQ_API_KEY` in `.env`
2. Verify internet connection
3. Check Groq API status and rate limits

### Bot stops after some time
1. Use systemd service (see Option 2 above)
2. Or run in a persistent session (screen/tmux)
3. Check system logs: `journalctl -u iesa-telegram-bot -f`

## Security Notes

1. **Never share your bot token publicly**
2. Keep `.env` file secure (already in `.gitignore`)
3. Bot token gives full control of the bot
4. If token is compromised, revoke it with @BotFather and create a new one

## Future Enhancements

Potential improvements:
- [ ] User authentication (link Telegram account to IESA account)
- [ ] Inline keyboards for quick actions
- [ ] File uploads (e.g., upload past questions)
- [ ] Notifications for events and announcements
- [ ] Payment integration directly through Telegram
- [ ] Group chat support for IESA discussions
- [ ] Admin commands for EXCO members

## Support

For issues or questions:
1. Check the logs: `tail -f telegram_bot.log` (if logging to file)
2. Review this documentation
3. Contact the IESA tech team

---

**Built with ❤️ for IESA - University of Ibadan**
