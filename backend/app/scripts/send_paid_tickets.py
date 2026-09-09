"""
Paid Ticket Dispatcher Script

Dispatches personalized visual tickets to all paid students of the Conference Dues payment.
Includes:
- Dynamic personalization ({{first_name}}, {{student_name}}, {{matric_number}})
- Visual ticket generation with custom QR code, name, and matric number overlay
- Base64 ticket attachment
- Support for test preview (--test), dry-run (--dry-run), and live dispatch (--live)
"""

import sys
import os

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import time
import json
import socket
import base64
import argparse
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# DNS & Network Patch for Windows Environment (resolves via 8.8.8.8)
# ---------------------------------------------------------------------------
import dns.resolver

_public_dns = dns.resolver.Resolver(configure=False)
_public_dns.nameservers = ['8.8.8.8', '1.1.1.1']

_mongo_shards = {
    'cluster0-shard-00-00.qrykl.mongodb.net': '65.62.31.34',
    'cluster0-shard-00-01.qrykl.mongodb.net': '65.62.31.41',
    'cluster0-shard-00-02.qrykl.mongodb.net': '65.62.31.50',
}

_orig_getaddrinfo = socket.getaddrinfo
_dns_cache = {}

def _resilient_getaddrinfo(host, port, *args, **kwargs):
    if host in _mongo_shards:
        return _orig_getaddrinfo(_mongo_shards[host], port, *args, **kwargs)
    if host in _dns_cache:
        return _orig_getaddrinfo(_dns_cache[host], port, *args, **kwargs)
    try:
        answers = _public_dns.resolve(host, 'A')
        ip = answers[0].to_text()
        _dns_cache[host] = ip
        return _orig_getaddrinfo(ip, port, *args, **kwargs)
    except Exception:
        return _orig_getaddrinfo(host, port, *args, **kwargs)

socket.getaddrinfo = _resilient_getaddrinfo


# ---------------------------------------------------------------------------
# Project Paths & Environment
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))
os.environ["EMAIL_PROVIDER"] = "console"  # Suppress SDK import warning

import requests
from pymongo import MongoClient
from bson import ObjectId

from app.core.email import get_email_service, EmailTemplate
from app.utils.visual_ticket_generator import generate_visual_ticket

CONFERENCE_PAYMENT_ID = "69b5c531f5e02c6de5ccb6b0"


# ---------------------------------------------------------------------------
# Ticket Email Template
# ---------------------------------------------------------------------------
DEFAULT_SUBJECT = "Your IESA Process Day 2026 Paid Ticket is here 🎟️"

DEFAULT_CONTENT_HTML = """<p>Dear <strong>{{first_name}}</strong>,</p>

<p>Thank you for choosing to be part of this year’s experience and for securing the <strong>Paid Attendee ticket</strong>.</p>

<p>Your <strong>Personalized Conference Ticket</strong> is attached to this email. 🎟️</p>

<p>Kindly take a moment to confirm the details on your ticket and if there is an error on it, send a WhatsApp message to Alex <a href="https://wa.link/1bdrt1" target="_blank" rel="noopener noreferrer" style="color:#9B72CF !important;font-weight:700;text-decoration:underline;"><strong><u>here</u></strong></a>.</p>

<p>This ticket contains your registered identity and serves as your confirmation for the Paid attendee package.</p>

<p><strong>Important:</strong> This ticket is assigned specifically to you. Please do not share or transfer it without contacting the conference organizers.</p>

<p>Remember, as a paid attendee, you get more. Your decision to register as a paid attendee comes with additional benefits beyond the regular conference experience.</p>

<h2>📍 <strong>Conference Details</strong></h2>
<p>Date: <strong><em>SEPTEMBER 10TH, 2026</em></strong></p>
<p>Venue: <strong><em>KAAF AUDITORIUM, HUMAN NUTRITION &amp; DIETETICS</em></strong></p>
<p>Time: <strong><em>9AM</em></strong></p>

<p>Want Your Own <strong><em>‘I will be attending’</em></strong> Personalized Conference Flyer to let everyone know you're coming?, We can design one for you!</p>
<p>If you're interested, send a message to <strong>Samuel</strong> here:<br>
👉 <a href="https://wa.link/gu2156" target="_blank" rel="noopener noreferrer" style="color:#9B72CF !important;font-weight:700;text-decoration:underline;"><strong><u>https://wa.link/gu2156</u></strong></a></p>

<p>Join the conference group for more updates <a href="https://chat.whatsapp.com/G2p8sAbGUxWIas4caTZWdY?s=cl&amp;p=a&amp;ilr=1" target="_blank" rel="noopener noreferrer" style="color:#9B72CF !important;font-weight:700;text-decoration:underline;"><strong><u>here</u></strong></a>.</p>

<p>Once again, thank you for registering as a paid attendee.</p>

<p><strong>See you at the conference!</strong> 🔥</p>

<p><em>Warm regards,</em><br>
<strong>Conference Team</strong><br>
Forge the Future Conference<br>
IESA Process Day 2026</p>
"""


# ---------------------------------------------------------------------------
# MongoDB Helpers
# ---------------------------------------------------------------------------
def get_db():
    mongo_url = os.getenv("MONGODB_URL", "")
    db_name = os.getenv("DATABASE_NAME", "iesa_db")
    if "cluster0.qrykl.mongodb.net" in mongo_url:
        mongo_url = (
            "mongodb://adetayoalexander12:8oj4NiUp7FK0jyty@"
            "cluster0-shard-00-00.qrykl.mongodb.net:27017,"
            "cluster0-shard-00-01.qrykl.mongodb.net:27017,"
            "cluster0-shard-00-02.qrykl.mongodb.net:27017/"
            "iesa_db?ssl=true&authSource=admin&retryWrites=true&w=majority"
        )
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=15000, readPreference='secondaryPreferred')
    return client[db_name]


def get_paid_attendees(payment_id: str = CONFERENCE_PAYMENT_ID) -> tuple[dict, list[dict]]:
    db = get_db()
    payment = db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise ValueError(f"Payment {payment_id} not found.")

    paid_uids = payment.get("paidBy", [])
    oid_list = [ObjectId(uid) for uid in paid_uids if ObjectId.is_valid(uid)]

    users = list(db.users.find(
        {"_id": {"$in": oid_list}},
        {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1}
    ))

    attendees = []
    for u in users:
        first_name = u.get("firstName", "Attendee").strip()
        last_name = u.get("lastName", "").strip()
        full_name = f"{first_name} {last_name}".strip()
        # In case firstName has multiple tokens (e.g. 'Samuel oluwafemi'), take first token as salutation
        first_token = first_name.split()[0].title() if first_name else "Attendee"

        attendees.append({
            "_id": str(u["_id"]),
            "first_name": first_token,
            "full_name": full_name,
            "email": u.get("email"),
            "matric_number": u.get("matricNumber") or "—",
        })

    return payment, attendees


# ---------------------------------------------------------------------------
# Email Delivery
# ---------------------------------------------------------------------------
def send_via_smtp(
    to: str,
    subject: str,
    html_content: str,
    ticket_bytes: bytes,
    student_name: str,
) -> tuple[bool, str]:
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        return (False, "SMTP_USER and SMTP_PASSWORD not set in .env")

    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"IESA <{smtp_user}>"
    msg["To"] = to

    msg_alt = MIMEMultipart("alternative")
    msg_alt.attach(MIMEText(html_content, "html", "utf-8"))
    msg.attach(msg_alt)

    safe_name = "".join(c for c in student_name if c.isalnum() or c in " _-").strip().replace(" ", "_")
    part = MIMEApplication(ticket_bytes, _subtype="png")
    part.add_header("Content-Disposition", "attachment", filename=f"IESA_Conference_Ticket_{safe_name}.png")
    msg.attach(part)

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return (True, "sent_via_smtp")
    except Exception as exc:
        return (False, str(exc))


def send_email_with_ticket(
    to: str,
    subject: str,
    html_content: str,
    ticket_bytes: bytes,
    student_name: str,
) -> tuple[bool, str]:
    api_key = os.getenv("RESEND_API_KEY")
    if api_key:
        from_email = os.getenv("EMAIL_FROM", "noreply@iesaui.org")
        from_header = f"IESA <{from_email}>"

        safe_name = "".join(c for c in student_name if c.isalnum() or c in " _-").strip().replace(" ", "_")
        ticket_b64 = base64.b64encode(ticket_bytes).decode("utf-8")

        payload = {
            "from": from_header,
            "to": [to],
            "subject": subject,
            "html": html_content,
            "attachments": [
                {
                    "filename": f"IESA_Conference_Ticket_{safe_name}.png",
                    "content": ticket_b64,
                }
            ],
        }

        try:
            res = requests.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                timeout=20,
            )
            if res.status_code in (200, 201, 202):
                msg_id = res.json().get("id", "sent")
                return (True, msg_id)
            elif res.status_code == 429:
                # Quota reached — try SMTP fallback if configured
                smtp_user = os.getenv("SMTP_USER")
                if smtp_user:
                    print("⚠️  Resend quota exceeded, attempting SMTP fallback...")
                    return send_via_smtp(to, subject, html_content, ticket_bytes, student_name)
                return (False, f"Resend Daily Quota Exceeded (HTTP 429). Resets at 00:00 UTC.")
            else:
                return (False, f"HTTP {res.status_code}: {res.text}")
        except Exception as exc:
            return (False, str(exc))

    # Fall back directly to SMTP if no Resend key
    return send_via_smtp(to, subject, html_content, ticket_bytes, student_name)


def render_ticket_email(attendee: dict) -> tuple[str, str]:
    email_service = get_email_service()

    first_name = attendee.get("first_name", "Attendee")
    full_name = attendee.get("full_name", first_name)
    matric = attendee.get("matric_number", "")

    content = DEFAULT_CONTENT_HTML
    content = content.replace("{{first_name}}", first_name)
    content = content.replace("{{student_name}}", full_name)
    content = content.replace("{{full_name}}", full_name)
    content = content.replace("{{matric_number}}", matric)

    context = {
        "title": DEFAULT_SUBJECT,
        "content": content,
        "student_name": full_name,
        "priority": "normal",
        "target_label": "Paid Attendees",
        "dashboard_url": "https://iesaui.org/dashboard/payments",
    }

    subject, html = email_service._render_template(EmailTemplate.ANNOUNCEMENT, context)
    return (subject, html)


# ---------------------------------------------------------------------------
# CLI Actions
# ---------------------------------------------------------------------------
def run_test_email(payment: dict, attendees: list[dict], test_recipients: list[str]) -> None:
    print(f"\n=======================================================")
    print(f"🎫 GENERATING SAMPLE TICKET & DISPATCHING TEST EMAIL")
    print(f"=======================================================")

    # Use Toriola Samuel Oluwafemi or first attendee as the ticket sample
    sample_attendee = next((a for a in attendees if "toriola" in a["full_name"].lower()), attendees[0])

    config = payment.get("ticketConfig", {})
    payment_id = str(payment["_id"])
    qr_data = f"IESA_EVENT:{payment_id}|STUDENT:{sample_attendee['_id']}"

    print(f"Generating visual ticket for: {sample_attendee['full_name']} ({sample_attendee['matric_number']})...")
    ticket_bytes = generate_visual_ticket(
        template_url=config.get("templateUrl"),
        qr_config=config.get("qrCode", {}),
        name_config=config.get("studentName", {}),
        matric_config=config.get("matricNumber", {}),
        font_family=config.get("fontFamily", "Helvetica"),
        student_name=sample_attendee["full_name"],
        matric_number=sample_attendee["matric_number"],
        qr_data=qr_data,
    )
    print(f"✅ Ticket generated successfully ({len(ticket_bytes):,} bytes)")

    subject, html = render_ticket_email(sample_attendee)

    for email in test_recipients:
        print(f"\nSending test email with ticket attachment to: {email}...")
        success, detail = send_email_with_ticket(
            to=email,
            subject=subject,
            html_content=html,
            ticket_bytes=ticket_bytes,
            student_name=sample_attendee["full_name"],
        )
        if success:
            print(f"✅ Test email sent! Message ID: {detail}")
        else:
            print(f"⚠️  Result: {detail}")


def run_live_dispatch(payment: dict, attendees: list[dict]) -> None:
    print(f"\n=======================================================")
    print(f"🚀 DISPATCHING PERSONALIZED TICKETS TO ALL {len(attendees)} PAID ATTENDEES")
    print(f"=======================================================")

    config = payment.get("ticketConfig", {})
    payment_id = str(payment["_id"])
    template_url = config.get("templateUrl")
    qr_cfg = config.get("qrCode", {})
    name_cfg = config.get("studentName", {})
    matric_cfg = config.get("matricNumber", {})
    font_fam = config.get("fontFamily", "Helvetica")

    success_count = 0
    fail_count = 0

    for idx, att in enumerate(attendees, start=1):
        full_name = att["full_name"]
        matric = att["matric_number"]
        email = att["email"]

        if not email:
            print(f"[{idx}/{len(attendees)}] ⚠️  Skipping {full_name} — no email address.")
            fail_count += 1
            continue

        print(f"\n[{idx}/{len(attendees)}] Processing: {full_name} ({matric}) -> {email}")

        try:
            qr_data = f"IESA_EVENT:{payment_id}|STUDENT:{att['_id']}"
            ticket_bytes = generate_visual_ticket(
                template_url=template_url,
                qr_config=qr_cfg,
                name_config=name_cfg,
                matric_config=matric_cfg,
                font_family=font_fam,
                student_name=full_name,
                matric_number=matric,
                qr_data=qr_data,
            )

            subject, html = render_ticket_email(att)

            success, detail = send_email_with_ticket(
                to=email,
                subject=subject,
                html_content=html,
                ticket_bytes=ticket_bytes,
                student_name=full_name,
            )

            if success:
                print(f"  ✅ Sent! (ID: {detail})")
                success_count += 1
            else:
                print(f"  ❌ Failed to send: {detail}")
                fail_count += 1

            time.sleep(0.5)

        except Exception as exc:
            print(f"  ❌ Error: {exc}")
            fail_count += 1

    print(f"\n=======================================================")
    print(f"📊 DISPATCH COMPLETE")
    print(f"  Total:   {len(attendees)}")
    print(f"  Success: {success_count}")
    print(f"  Failed:  {fail_count}")
    print(f"=======================================================\n")


def run_dry_run(payment: dict, attendees: list[dict]) -> None:
    print(f"\n=======================================================")
    print(f"🔍 PAID ATTENDEES TICKET DISPATCH SUMMARY")
    print(f"=======================================================")
    print(f"Payment Title:    {payment.get('title')} (ID: {payment.get('_id')})")
    print(f"Total Paid Count: {len(attendees)} students")
    print(f"Template URL:     {payment.get('ticketConfig', {}).get('templateUrl')}")

    print(f"\nPaid Attendees List ({len(attendees)}):")
    print(f"{'#':<4} | {'Name':<32} | {'Matric':<10} | {'Email':<35}")
    print("-" * 88)
    for i, a in enumerate(attendees, start=1):
        matric_str = str(a.get("matric_number") or "—")
        email_str = str(a.get("email") or "—")
        print(f"{i:<4} | {a['full_name']:<32} | {matric_str:<10} | {email_str:<35}")


def main():
    parser = argparse.ArgumentParser(description="IESA Paid Ticket Dispatcher")
    parser.add_argument("--test", nargs="*", help="Send test email with ticket attachment")
    parser.add_argument("--dry-run", action="store_true", help="List all paid attendees and ticket info")
    parser.add_argument("--live", action="store_true", help="Dispatch tickets to all paid attendees")

    args = parser.parse_args()

    payment, attendees = get_paid_attendees()

    if args.test is not None:
        recipients = args.test if len(args.test) > 0 else [
            "aadetayo856@stu.ui.edu.ng",
            "adetayoalexander12@gmail.com",
        ]
        run_test_email(payment, attendees, recipients)
    elif args.live:
        run_live_dispatch(payment, attendees)
    else:
        run_dry_run(payment, attendees)



if __name__ == "__main__":
    main()
