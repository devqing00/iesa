"""
Conference Email Dispatcher Script

Dispatches the conference announcement to attendees from the Google Form response CSV:
  public/assets/IESA CONFERENCE 2026 (Responses) - Form Responses 1.csv

Features:
- Extracts dynamic variables ({{first_name}}, {{student_name}}, {{full_name}})
- Preserves exact HTML formatting, embedded Cloudinary image, and lavender links
- Deduplicates and normalizes attendee emails
- Supports review mode (--review), dry-run mode (--dry-run), and live dispatch (--live)
"""

import sys
import os

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
import csv
import re
import time
import json
import socket
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
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))
os.environ["EMAIL_PROVIDER"] = "console"  # Suppress SDK import warning (we use REST API directly)

import requests
from pymongo import MongoClient
from bson import ObjectId
from app.core.email import get_email_service, EmailTemplate

CSV_DEFAULT_PATH = os.path.join(
    PROJECT_ROOT, "public", "assets", "IESA CONFERENCE 2026 (Responses) - Form Responses 1.csv"
)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Name Parsing & Personalization
# ---------------------------------------------------------------------------
def parse_attendee_name(raw_name: str) -> tuple[str, str]:
    """
    Parse 'Name(Surname, First name)' field according to Nigerian form convention.
    Returns (first_name, full_name).
    """
    if not raw_name or not raw_name.strip():
        return ("Attendee", "Attendee")

    clean = raw_name.strip()

    # Comma format: "Surname, First name [Other names]"
    if "," in clean:
        parts = [p.strip() for p in clean.split(",", 1)]
        surname = parts[0].title()
        rest = parts[1].title()
        first_token = rest.split()[0] if rest else surname
        full_name = f"{first_token} {surname}" if surname else first_token
        return (first_token, full_name)

    # Space format: "Surname Firstname [Other names]"
    tokens = [t.strip().title() for t in clean.split() if t.strip()]
    if not tokens:
        return ("Attendee", "Attendee")
    if len(tokens) == 1:
        return (tokens[0], tokens[0])

    # Nigerian convention in forms labeled 'Name(Surname, First name)':
    # First token is Surname, Second token is First Name.
    first_name = tokens[1]
    full_name = " ".join(tokens)
    return (first_name, full_name)


def load_recipients_from_csv(csv_path: str) -> list[dict]:
    """
    Read respondents from CSV, deduplicate emails, and return structured attendee list.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found at: {csv_path}")

    attendees = []
    seen_emails = set()

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_idx, row in enumerate(reader, start=2):
            raw_name = row.get("Name(Surname, First name)", "").strip()
            e1 = row.get("Email Address", "").strip()
            e2 = row.get("Email address", "").strip()

            # e2 is the manually typed address, e1 is Google Form login account
            chosen_email = e2 if (e2 and "@" in e2) else e1
            clean_email = chosen_email.strip().lower()

            if not clean_email or not EMAIL_REGEX.match(clean_email):
                print(f"⚠️  [Row {row_idx}] Skipping invalid email: '{chosen_email}' (Name: {raw_name})")
                continue

            if clean_email in seen_emails:
                print(f"ℹ️  [Row {row_idx}] Skipping duplicate email: '{clean_email}' (Name: {raw_name})")
                continue

            seen_emails.add(clean_email)
            first_name, full_name = parse_attendee_name(raw_name)

            attendees.append({
                "row": row_idx,
                "email": clean_email,
                "first_name": first_name,
                "full_name": full_name,
                "raw_name": raw_name,
                "institution": row.get("Institution/ School", "").strip(),
                "department": row.get("Faculty/Department ", "").strip(),
                "level": row.get("Current Academic Level", "").strip(),
                "has_paid": row.get("Have you paid for the conference?...", "").strip(),
            })

    return attendees


# ---------------------------------------------------------------------------
# Fetch Announcement Draft from Database
# ---------------------------------------------------------------------------
def fetch_conference_announcement(announcement_id: str | None = None) -> dict:
    """
    Fetch the conference announcement draft from MongoDB.
    """
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

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[db_name]

    if announcement_id:
        doc = db.announcements.find_one({"_id": ObjectId(announcement_id)})
        if doc:
            return doc
        raise ValueError(f"Announcement with ID {announcement_id} not found.")

    # Search for latest conference announcement
    doc = db.announcements.find_one({
        "$or": [
            {"title": {"$regex": "Confirmed", "$options": "i"}},
            {"title": {"$regex": "Forge the Future", "$options": "i"}},
            {"content": {"$regex": "Forge the Future", "$options": "i"}},
        ]
    }, sort=[("updatedAt", -1)])

    if not doc:
        # Fallback to most recently updated announcement
        doc = db.announcements.find_one(sort=[("updatedAt", -1)])

    if not doc:
        raise ValueError("No announcements found in database.")

    return doc


# ---------------------------------------------------------------------------
# Email Delivery via Resend API
# ---------------------------------------------------------------------------
def send_via_resend(to: str, subject: str, html_content: str) -> tuple[bool, str]:
    """
    Send an email directly through the Resend REST API using RESEND_API_KEY.
    """
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        raise ValueError("RESEND_API_KEY is not configured in .env")

    from_email = os.getenv("EMAIL_FROM", "noreply@iesaui.org")
    from_header = f"IESA <{from_email}>"

    payload = {
        "from": from_header,
        "to": [to],
        "subject": subject,
        "html": html_content,
    }

    try:
        res = requests.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        if res.status_code in (200, 201, 202):
            msg_id = res.json().get("id", "sent")
            return (True, msg_id)
        else:
            return (False, f"HTTP {res.status_code}: {res.text}")
    except Exception as exc:
        return (False, str(exc))


def render_personalized_email(announcement: dict, attendee: dict) -> tuple[str, str]:
    """
    Personalize title and content with attendee data and render with email service shell.
    """
    email_service = get_email_service()

    first_name = attendee.get("first_name", "Attendee")
    full_name = attendee.get("full_name", first_name)

    raw_title = str(announcement.get("title", "You’re Confirmed! 🔥"))
    raw_content = str(announcement.get("content", ""))

    # Substitute dynamic placeholders
    for placeholder in ["{{first_name}}", "{first_name}"]:
        raw_title = raw_title.replace(placeholder, first_name)
        raw_content = raw_content.replace(placeholder, first_name)

    for placeholder in ["{{student_name}}", "{{full_name}}", "{{name}}", "{student_name}", "{full_name}"]:
        raw_title = raw_title.replace(placeholder, full_name)
        raw_content = raw_content.replace(placeholder, full_name)

    context = {
        "title": raw_title,
        "content": raw_content,
        "student_name": full_name,
        "priority": announcement.get("priority", "normal"),
        "target_label": "Conference Attendees",
        "dashboard_url": "https://iesaui.org/dashboard/payments",
        "attachments": announcement.get("attachments", []),
    }

    subject, html = email_service._render_template(EmailTemplate.ANNOUNCEMENT, context)
    return (subject, html)


# ---------------------------------------------------------------------------
# CLI Command Handlers
# ---------------------------------------------------------------------------
def run_review(announcement: dict, recipients: list[str]) -> None:
    """
    Send a sample test email to reviewer(s) to verify layout, links, and styling.
    """
    print(f"\n=======================================================")
    print(f"🚀 SENDING REVIEW / TEST EMAIL")
    print(f"=======================================================")
    print(f"Announcement ID: {announcement.get('_id')}")
    print(f"Raw Title:       {announcement.get('title')}")
    print(f"Reviewers:       {', '.join(recipients)}")

    sample_attendee = {
        "first_name": "Alexander",
        "full_name": "Alexander Adetayo",
        "email": recipients[0],
    }

    subject, html = render_personalized_email(announcement, sample_attendee)

    print(f"\nRendered Subject: {subject}")
    print(f"HTML Size:        {len(html)} bytes")
    print(f"Embedded Image:   {'res.cloudinary.com' in html}")
    print(f"Lavender Links:   {'#9B72CF' in html}")

    for r_email in recipients:
        print(f"\nSending preview to {r_email}...")
        success, info = send_via_resend(r_email, subject, html)
        if success:
            print(f"✅ Preview sent successfully! Message ID: {info}")
        else:
            print(f"❌ Failed to send preview: {info}")

    print(f"\n✨ Review email dispatched! Please check your inbox and confirm before running --live.")


def run_dry_run(announcement: dict, attendees: list[dict]) -> None:
    """
    Validate all attendees and output summary preview.
    """
    print(f"\n=======================================================")
    print(f"🔍 DRY RUN VALIDATION SUMMARY")
    print(f"=======================================================")
    print(f"Announcement Title: {announcement.get('title')}")
    print(f"Total CSV Attendees: {len(attendees)} (deduplicated & validated)")

    print(f"\nSample Recipients Preview (First 5):")
    print(f"{'#':<4} | {'First Name':<15} | {'Full Name':<28} | {'Email':<35}")
    print("-" * 88)
    for i, att in enumerate(attendees[:5], start=1):
        print(f"{i:<4} | {att['first_name']:<15} | {att['full_name']:<28} | {att['email']:<35}")

    # Check sample personalized subjects
    print(f"\nPersonalized Subject Line Samples:")
    for att in attendees[:3]:
        sub, _ = render_personalized_email(announcement, att)
        print(f"  • To: {att['email']} ({att['full_name']}) => Subject: {sub}")

    print(f"\nSummary:")
    print(f"  • Ready to send: {len(attendees)} emails")
    print(f"  • Safe mode: NO real emails were sent during dry-run.")
    print(f"  • Next step: Review the test email sent to your inbox, then run with --live to dispatch.")


def run_live_dispatch(announcement: dict, attendees: list[dict], delay_sec: float = 0.6) -> None:
    """
    Execute the live email dispatch to all attendees.
    """
    print(f"\n=======================================================")
    print(f"🔥 STARTING LIVE EMAIL DISPATCH")
    print(f"=======================================================")
    print(f"Total Recipients: {len(attendees)}")
    print(f"Rate Limiting:    {delay_sec}s delay between requests")
    print(f"Announcement:     {announcement.get('title')}")
    print(f"Started At:       {datetime.now(timezone.utc).isoformat()}")

    results = []
    success_count = 0
    fail_count = 0

    results_file = os.path.join(BACKEND_DIR, "app", "data", "conference_email_results.json")
    os.makedirs(os.path.dirname(results_file), exist_ok=True)

    for idx, att in enumerate(attendees, start=1):
        subject, html = render_personalized_email(announcement, att)
        to_email = att["email"]

        success, detail = send_via_resend(to_email, subject, html)
        if success:
            success_count += 1
            status_tag = f"✅ [{idx}/{len(attendees)}] SENT"
            print(f"{status_tag}: {to_email} ({att['first_name']}) - ID: {detail}")
        else:
            fail_count += 1
            status_tag = f"❌ [{idx}/{len(attendees)}] FAILED"
            print(f"{status_tag}: {to_email} ({att['first_name']}) - Error: {detail}")

        results.append({
            "index": idx,
            "email": to_email,
            "first_name": att["first_name"],
            "full_name": att["full_name"],
            "subject": subject,
            "success": success,
            "detail": detail,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        if delay_sec > 0:
            time.sleep(delay_sec)

    # Save final results
    with open(results_file, "w", encoding="utf-8") as rf:
        json.dump({
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "total": len(attendees),
            "success": success_count,
            "failed": fail_count,
            "records": results,
        }, rf, indent=2)

    print(f"\n=======================================================")
    print(f"🏁 DISPATCH COMPLETED")
    print(f"=======================================================")
    print(f"Total:      {len(attendees)}")
    print(f"Successful: {success_count}")
    print(f"Failed:     {fail_count}")
    print(f"Report:     {results_file}")


def run_retry_failed(announcement: dict, attendees: list[dict], delay_sec: float = 0.6) -> None:
    """
    Retry sending only to the attendees that failed in previous runs.
    """
    results_file = os.path.join(BACKEND_DIR, "app", "data", "conference_email_results.json")
    if not os.path.exists(results_file):
        print(f"❌ Results file not found at {results_file}")
        return

    with open(results_file, "r", encoding="utf-8") as rf:
        data = json.load(rf)

    failed_records = [r for r in data.get("records", []) if not r.get("success")]
    if not failed_records:
        print("✅ No failed records found in conference_email_results.json! All attendees already succeeded.")
        return

    failed_emails = {r["email"].lower(): r for r in failed_records}
    print(f"\n=======================================================")
    print(f"🔁 RETRYING DISPATCH FOR {len(failed_records)} PREVIOUSLY FAILED ATTENDEES")
    print(f"=======================================================")
    for r in failed_records:
        print(f"  • #{r['index']} {r['email']} ({r['first_name']}) — Previous: {r['detail'][:65]}")

    retry_attendees = [a for a in attendees if a["email"].lower() in failed_emails]
    matched_emails = {a["email"].lower() for a in retry_attendees}
    for r in failed_records:
        if r["email"].lower() not in matched_emails:
            retry_attendees.append({
                "email": r["email"],
                "first_name": r["first_name"],
                "full_name": r["full_name"],
            })

    print(f"\nDispatching copies to {len(retry_attendees)} attendees now...")
    res_lookup = {r["email"].lower(): r for r in data.get("records", [])}

    new_successes = 0
    new_fails = 0

    for idx, att in enumerate(retry_attendees, start=1):
        subject, html = render_personalized_email(announcement, att)
        to_email = att["email"]

        success, detail = send_via_resend(to_email, subject, html)
        if success:
            new_successes += 1
            print(f"✅ [{idx}/{len(retry_attendees)}] SENT: {to_email} ({att['first_name']}) - ID: {detail}")
            if to_email.lower() in res_lookup:
                res_lookup[to_email.lower()]["success"] = True
                res_lookup[to_email.lower()]["detail"] = detail
                res_lookup[to_email.lower()]["retried_at"] = datetime.now(timezone.utc).isoformat()
        else:
            new_fails += 1
            print(f"❌ [{idx}/{len(retry_attendees)}] FAILED: {to_email} ({att['first_name']}) - Error: {detail}")
            if to_email.lower() in res_lookup:
                res_lookup[to_email.lower()]["detail"] = detail

        if delay_sec > 0:
            time.sleep(delay_sec)

    all_records = data.get("records", [])
    total_success = sum(1 for r in all_records if r.get("success"))
    total_failed = len(all_records) - total_success
    data["success"] = total_success
    data["failed"] = total_failed
    data["last_retry_at"] = datetime.now(timezone.utc).isoformat()

    with open(results_file, "w", encoding="utf-8") as rf:
        json.dump(data, rf, indent=2)

    print(f"\n=======================================================")
    print(f"🏁 RETRY COMPLETE")
    print(f"  Attempted:      {len(retry_attendees)}")
    print(f"  Newly Sent:     {new_successes}")
    print(f"  Still Failed:   {new_fails}")
    print(f"  Overall Status: {total_success}/{len(all_records)} Delivered Successfully")
    print(f"=======================================================\n")


def main():
    parser = argparse.ArgumentParser(description="IESA Conference Email Dispatcher")
    parser.add_argument("--csv", default=CSV_DEFAULT_PATH, help="Path to attendee CSV file")
    parser.add_argument("--announcement-id", default=None, help="Specific MongoDB announcement ID")
    parser.add_argument("--review", nargs="*", help="Send preview email to specified address(es)")
    parser.add_argument("--dry-run", action="store_true", help="Inspect and validate without sending")
    parser.add_argument("--live", action="store_true", help="Perform live dispatch to all attendees")
    parser.add_argument("--retry-failed", action="store_true", help="Retry sending to previously failed recipients")
    parser.add_argument("--delay", type=float, default=0.6, help="Delay between emails in seconds")

    args = parser.parse_args()

    print("Loading announcement draft...")
    announcement = fetch_conference_announcement(args.announcement_id)

    attendees = load_recipients_from_csv(args.csv)

    if args.review is not None:
        review_emails = args.review if len(args.review) > 0 else [
            "aadetayo856@stu.ui.edu.ng",
            "adetayoalexander12@gmail.com",
        ]
        run_review(announcement, review_emails)
        return

    if args.retry_failed:
        run_retry_failed(announcement, attendees, delay_sec=args.delay)
    elif args.live:
        run_live_dispatch(announcement, attendees, delay_sec=args.delay)
    else:
        run_dry_run(announcement, attendees)



if __name__ == "__main__":
    main()
