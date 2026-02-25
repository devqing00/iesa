"""
Email Testing Script

Verifies that the configured email provider is working correctly by sending
test emails for the most common template types.

Usage:
    # Test with the console provider (no config needed):
    python -m app.scripts.test_email

    # Send a real test email to a specific address:
    python -m app.scripts.test_email --to your@email.com

    # Test a specific template only:
    python -m app.scripts.test_email --to your@email.com --template welcome

    # List available templates:
    python -m app.scripts.test_email --list-templates

Environment variables read from .env (same ones the app uses):
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD  → SMTP / Gmail
    SENDGRID_API_KEY                                 → SendGrid
    RESEND_API_KEY                                   → Resend
    (none of the above)                              → Console (stdout)
"""

import asyncio
import argparse
import sys
import os
from typing import Optional
from datetime import datetime

# ---------------------------------------------------------------------------
# Make sure the app package is importable when running as a module from the
# backend/ directory:  python -m app.scripts.test_email
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Load .env so SMTP_* / SENDGRID_API_KEY / RESEND_API_KEY are available
try:
    from dotenv import load_dotenv
    env_path = os.path.join(BACKEND_DIR, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"✅ Loaded environment from {env_path}")
    else:
        print("⚠️  No .env file found — using system environment variables")
except ImportError:
    print("⚠️  python-dotenv not installed, using system environment variables")

from app.core.email import EmailService, EmailTemplate, get_email_service


# ---------------------------------------------------------------------------
# Template test payloads
# ---------------------------------------------------------------------------

TEMPLATE_TESTS = {
    "welcome": {
        "template": EmailTemplate.WELCOME,
        "context": {
            "name": "Test Student",
            "dashboard_url": "http://localhost:3000/dashboard",
        },
        "description": "Welcome email sent after registration",
    },
    "verification": {
        "template": EmailTemplate.EMAIL_VERIFICATION,
        "context": {
            "name": "Test Student",
            "verification_url": "http://localhost:3000/verify?token=test-token-12345",
        },
        "description": "Email address verification",
    },
    "password_reset": {
        "template": EmailTemplate.PASSWORD_RESET,
        "context": {
            "name": "Test Student",
            "reset_url": "http://localhost:3000/reset-password?token=test-reset-token-abc",
        },
        "description": "Password reset request",
    },
    "payment_receipt": {
        "template": EmailTemplate.PAYMENT_RECEIPT,
        "context": {
            "student_name": "Test Student",
            "payment_title": "Departmental Dues 2025/2026",
            "amount": 15000.00,
            "reference": "IESA-TEST-REF-001",
            "date": datetime.now().strftime("%B %d, %Y %I:%M %p"),
        },
        "description": "Payment confirmation receipt",
    },
    "role_assigned": {
        "template": EmailTemplate.ROLE_ASSIGNED,
        "context": {
            "name": "Test Student",
            "position": "Financial Secretary",
            "session": "2025/2026",
            "permissions": [
                "payment:view",
                "payment:manage",
                "announcement:create",
            ],
        },
        "description": "Role assignment notification",
    },
}


# ---------------------------------------------------------------------------
# Plain-text / custom HTML test (no template enum)
# ---------------------------------------------------------------------------

PLAIN_HTML = """\
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0F0F2D;">IESA Email Test ✅</h2>
  <p>This is a plain test email from the IESA platform email testing script.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
    <tr style="background: #f5f5f5;">
      <th style="text-align:left; padding: 8px; border: 1px solid #ddd;">Field</th>
      <th style="text-align:left; padding: 8px; border: 1px solid #ddd;">Value</th>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">Sent at</td>
      <td style="padding: 8px; border: 1px solid #ddd;">{sent_at}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">Platform</td>
      <td style="padding: 8px; border: 1px solid #ddd;">IESA ERP — University of Ibadan</td>
    </tr>
  </table>
  <p style="color: #666; font-size: 12px;">
    If you received this, your email provider is configured correctly. 🎉
  </p>
</body>
</html>
""".format(sent_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

async def test_plain(service: EmailService, to: str) -> bool:
    """Send a basic plain HTML email (no template system)."""
    print("\n─── Plain HTML test ──────────────────────────────────")
    success = await service.send_email(
        to=to,
        subject=f"[IESA Test] Plain email — {datetime.now().strftime('%H:%M:%S')}",
        html_content=PLAIN_HTML,
        text_content="IESA plain email test. If you see this, your email config is working!",
    )
    status = "✅ SENT" if success else "❌ FAILED"
    print(f"  {status}")
    return success


async def test_template(
    service: EmailService,
    to: str,
    key: str,
    spec: dict,
) -> bool:
    """Send one template test email."""
    print(f"\n─── Template: {key} ─────────────────────────────────")
    print(f"  Description : {spec['description']}")
    success = await service.send_template_email(
        to=to,
        template=spec["template"],
        context=spec["context"],
    )
    status = "✅ SENT" if success else "❌ FAILED"
    print(f"  Result      : {status}")
    return success


async def run_tests(to: str, template_key: Optional[str] = None) -> int:
    """
    Run email tests. Returns exit code (0 = all passed, 1 = some failed).
    """
    print()
    print("=" * 60)
    print("  IESA Email Testing Script")
    print("=" * 60)

    service = get_email_service()

    print(f"\n  Provider : {service.provider.value.upper()}")
    print(f"  From     : {service.from_name} <{service.from_email}>")
    print(f"  To       : {to}")

    if service.provider.value == "console":
        print()
        print("  ℹ️  Console provider — emails are printed to stdout.")
        print("  ℹ️  Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD to use a real provider.")

    results: dict[str, bool] = {}

    # 1. Always run the plain send test
    results["plain"] = await test_plain(service, to)

    # 2. Template tests
    if template_key:
        spec = TEMPLATE_TESTS.get(template_key)
        if not spec:
            print(f"\n❌ Unknown template '{template_key}'. Use --list-templates to see options.")
            return 1
        results[template_key] = await test_template(service, to, template_key, spec)
    else:
        for key, spec in TEMPLATE_TESTS.items():
            results[key] = await test_template(service, to, key, spec)

    # Summary
    print()
    print("=" * 60)
    print("  Summary")
    print("=" * 60)
    passed = sum(1 for v in results.values() if v)
    failed = len(results) - passed
    for name, ok in results.items():
        icon = "✅" if ok else "❌"
        print(f"  {icon}  {name}")
    print()
    print(f"  Passed: {passed}/{len(results)}  |  Failed: {failed}/{len(results)}")
    print()

    return 0 if failed == 0 else 1


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="IESA Email Testing Script — verify email provider configuration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--to",
        default="test@example.com",
        help="Recipient email address (default: test@example.com)",
    )
    parser.add_argument(
        "--template",
        choices=list(TEMPLATE_TESTS.keys()),
        help="Test only a specific template (default: all templates)",
    )
    parser.add_argument(
        "--list-templates",
        action="store_true",
        help="List available template names and exit",
    )

    args = parser.parse_args()

    if args.list_templates:
        print("\nAvailable templates:")
        for key, spec in TEMPLATE_TESTS.items():
            print(f"  {key:<20} — {spec['description']}")
        print()
        sys.exit(0)

    exit_code = asyncio.run(run_tests(to=args.to, template_key=args.template))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
