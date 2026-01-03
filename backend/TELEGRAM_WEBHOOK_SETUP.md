# Telegram Bot Webhook - Production Setup Guide

## ✅ Automatic Activation

The Telegram bot now uses **webhooks** and will automatically activate when you deploy to Render!

## Setup Steps

### 1. Add Environment Variable on Render

In your Render dashboard:

1. Go to your backend service
2. Navigate to **Environment** tab
3. Add this variable:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```
4. Click **Save Changes**

### 2. Create Your Bot (If You Haven't Already)

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow prompts to create your bot
4. Copy the token BotFather gives you
5. Add it to Render environment variables (step 1)

### 3. Deploy to Render

```bash
git add .
git commit -m "Add Telegram webhook integration"
git push
```

Render will automatically deploy your changes.

### 4. Register the Webhook (One-Time Setup)

After deployment is complete, visit this URL in your browser:

```
https://your-app.onrender.com/api/telegram/setup
```

Replace `your-app` with your actual Render app name.

You should see:
```json
{
  "success": true,
  "webhook_url": "https://your-app.onrender.com/api/telegram/webhook",
  "message": "Webhook successfully registered with Telegram!"
}
```

### 5. Test Your Bot

Open Telegram, find your bot, and send `/start`

You should get a welcome message immediately!

## How It Works

### Production (Render)
- Telegram sends updates to your FastAPI endpoint: `/api/telegram/webhook`
- No polling, no background process needed
- Works on free tier ✅
- Always active when backend is running

### Local Development
The webhook won't work locally (Telegram needs a public HTTPS URL).

For local testing, use the polling script:
```bash
cd backend
python telegram_bot.py
```

## Available Endpoints

### `/api/telegram/webhook` (POST)
- Receives updates from Telegram
- Automatically processes messages and commands
- No need to call this manually (Telegram calls it)

### `/api/telegram/setup` (GET)
- Registers webhook URL with Telegram
- Call once after deployment
- Safe to call multiple times

### `/api/telegram/info` (GET)
- Check bot status and configuration
- View webhook details
- Useful for debugging

## Monitoring

Check if webhook is active:
```
https://your-app.onrender.com/api/telegram/info
```

Response will show:
- Bot username and ID
- Webhook URL
- Pending update count
- Last error (if any)

## Troubleshooting

### Bot doesn't respond
1. Check environment variable is set: `TELEGRAM_BOT_TOKEN`
2. Visit `/api/telegram/info` to verify webhook is registered
3. Re-run `/api/telegram/setup` if needed
4. Check Render logs for errors

### "Webhook already set" error
This is normal! It means webhook is already configured. Your bot should work.

### Messages delayed
Render free tier may have cold starts. First message might take 10-30 seconds.

## Security Notes

- ✅ Webhook URL is public (this is normal for Telegram)
- ✅ Telegram verifies requests are from their servers
- ✅ Bot token is kept secret in environment variables
- ❌ Never commit bot token to git
- ❌ Never share bot token publicly

## Cost

**100% FREE** on Render free tier!
- No background worker needed
- No polling overhead
- Only active when users message the bot

---

**Your bot will be live in production as soon as you:**
1. Add `TELEGRAM_BOT_TOKEN` to Render
2. Push to main branch
3. Visit `/api/telegram/setup` once

That's it! 🎉
