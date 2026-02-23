#!/usr/bin/env python3
"""
Email Test Script

Tests the email sending functionality with Gmail SMTP.
Run this after configuring your Gmail App Password in .env
"""

import asyncio
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from app.core.email import (
    send_verification_email,
    send_welcome_email,
    send_payment_receipt,
    send_announcement_email,
    get_email_service
)

# Load environment variables
load_dotenv()


async def test_email_configuration():
    """Test if email service is properly configured"""
    print("\n" + "="*70)
    print("IESA Email Configuration Test")
    print("="*70)
    
    service = get_email_service()
    print(f"\n📧 Email Provider: {service.provider.value}")
    print(f"   Host: {getattr(service, 'smtp_host', 'N/A')}")
    print(f"   Port: {getattr(service, 'smtp_port', 'N/A')}")
    print(f"   User: {getattr(service, 'smtp_user', 'N/A')}")
    print(f"   From: {service.from_email} ({service.from_name})")
    
    if service.provider.value == "console":
        print("\n⚠️  WARNING: Using console mode (emails will be printed, not sent)")
        print("   Set SMTP_USER and SMTP_PASSWORD in .env to use Gmail SMTP")
        return False
    
    return True


async def test_verification_email(recipient: str):
    """Test email verification email"""
    print(f"\n📤 Sending verification email to {recipient}...")
    
    try:
        result = await send_verification_email(
            to=recipient,
            name="Test User",
            verification_url="https://iesa-ui.vercel.app/verify-email?token=test123456"
        )
        
        if result:
            print("   ✅ Verification email sent successfully!")
            return True
        else:
            print("   ❌ Failed to send verification email")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False


async def test_welcome_email(recipient: str):
    """Test welcome email"""
    print(f"\n📤 Sending welcome email to {recipient}...")
    
    try:
        result = await send_welcome_email(
            to=recipient,
            name="Test User",
            dashboard_url="https://iesa-ui.vercel.app/dashboard"
        )
        
        if result:
            print("   ✅ Welcome email sent successfully!")
            return True
        else:
            print("   ❌ Failed to send welcome email")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False


async def test_payment_receipt(recipient: str):
    """Test payment receipt email"""
    print(f"\n📤 Sending payment receipt to {recipient}...")
    
    try:
        result = await send_payment_receipt(
            to=recipient,
            student_name="Test User",
            payment_title="IESA Membership Dues",
            amount=5000.00,
            reference="PAY-TEST-" + datetime.now().strftime("%Y%m%d%H%M%S"),
            date=datetime.now().strftime("%B %d, %Y at %I:%M %p")
        )
        
        if result:
            print("   ✅ Payment receipt sent successfully!")
            return True
        else:
            print("   ❌ Failed to send payment receipt")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False


async def test_announcement_email(recipient: str):
    """Test announcement email"""
    print(f"\n📤 Sending announcement email to {recipient}...")
    
    try:
        result = await send_announcement_email(
            to=recipient,
            student_name="Test User",
            title="Test Announcement: Email System Working!",
            content="This is a test announcement to verify that the IESA email system is working correctly. If you receive this email, your Gmail SMTP integration was successful!",
            priority="normal",
            target_label="All Students",
            dashboard_url="https://iesa-ui.vercel.app/dashboard/announcements"
        )
        
        if result:
            print("   ✅ Announcement email sent successfully!")
            return True
        else:
            print("   ❌ Failed to send announcement email")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False


async def run_all_tests(recipient: str):
    """Run all email tests"""
    print(f"\n🎯 Running email tests for: {recipient}")
    print("   (Check your inbox and spam folder)")
    
    # Test configuration
    configured = await test_email_configuration()
    if not configured:
        print("\n❌ Email service not properly configured. Please check .env file.")
        return
    
    print("\n" + "-"*70)
    
    # Run tests
    results = []
    results.append(("Verification Email", await test_verification_email(recipient)))
    results.append(("Welcome Email", await test_welcome_email(recipient)))
    results.append(("Payment Receipt", await test_payment_receipt(recipient)))
    results.append(("Announcement Email", await test_announcement_email(recipient)))
    
    # Summary
    print("\n" + "="*70)
    print("📊 Test Summary")
    print("="*70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status} - {test_name}")
    
    print(f"\n   Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Gmail SMTP is working correctly.")
        print("   Check your inbox for the test emails.")
    else:
        print("\n⚠️  Some tests failed. Check the error messages above.")
        print("   Common issues:")
        print("   - Incorrect SMTP_USER or SMTP_PASSWORD in .env")
        print("   - 2-Step Verification not enabled on Gmail")
        print("   - App Password expired or revoked")
        print("   - Port 587 blocked by firewall")
        print("\n   See GMAIL_SMTP_SETUP.md for troubleshooting guide.")
    
    print("="*70 + "\n")


async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Test IESA email functionality")
    parser.add_argument("recipient", nargs="?", help="Recipient email address")
    parser.add_argument("--verification", action="store_true", help="Test verification email only")
    parser.add_argument("--welcome", action="store_true", help="Test welcome email only")
    parser.add_argument("--receipt", action="store_true", help="Test payment receipt only")
    parser.add_argument("--announcement", action="store_true", help="Test announcement email only")
    
    args = parser.parse_args()
    
    # Get recipient email
    recipient = args.recipient
    if not recipient:
        recipient = input("Enter recipient email address: ").strip()
    
    if not recipient or "@" not in recipient:
        print("❌ Invalid email address provided.")
        sys.exit(1)
    
    # Run specific test or all tests
    if args.verification:
        await test_email_configuration()
        await test_verification_email(recipient)
    elif args.welcome:
        await test_email_configuration()
        await test_welcome_email(recipient)
    elif args.receipt:
        await test_email_configuration()
        await test_payment_receipt(recipient)
    elif args.announcement:
        await test_email_configuration()
        await test_announcement_email(recipient)
    else:
        # Run all tests
        await run_all_tests(recipient)


if __name__ == "__main__":
    asyncio.run(main())
