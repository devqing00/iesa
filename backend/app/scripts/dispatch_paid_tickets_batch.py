import sys
import os
import time
import json
import socket
import base64
import argparse
from datetime import datetime, timezone

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROOT_DIR = os.path.dirname(BACKEND_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

# DNS Patch for Windows MongoDB Atlas
import dns.resolver
_public_dns = dns.resolver.Resolver(configure=False)
_public_dns.nameservers = ['8.8.8.8', '1.1.1.1']
_orig_getaddrinfo = socket.getaddrinfo
_dns_cache = {
    'cluster0-shard-00-00.qrykl.mongodb.net': '65.62.31.34',
    'cluster0-shard-00-01.qrykl.mongodb.net': '65.62.31.41',
    'cluster0-shard-00-02.qrykl.mongodb.net': '65.62.31.50',
}
def _resilient_getaddrinfo(host, port, *args, **kwargs):
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

import requests
from pymongo import MongoClient
from bson import ObjectId
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

from app.core.email import get_email_service, EmailTemplate
from app.utils.visual_ticket_generator import generate_visual_ticket, format_ticket_name
from app.scripts.send_paid_tickets import (
    DEFAULT_SUBJECT,
    DEFAULT_CONTENT_HTML,
    CONFERENCE_PAYMENT_ID,
    get_db,
    send_via_smtp,
    render_ticket_email,
)

RESULTS_FILE = os.path.join(BACKEND_DIR, "app", "data", "paid_tickets_dispatch_results.json")
RECONCILED_FILE = os.path.join(BACKEND_DIR, "app", "data", "final_reconciled_paid_attendees.json")


def load_results() -> dict:
    if os.path.exists(RESULTS_FILE):
        try:
            with open(RESULTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"delivered": {}, "failed": {}, "stats": {}}


def save_results(results: dict) -> None:
    os.makedirs(os.path.dirname(RESULTS_FILE), exist_ok=True)
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)


def send_email_with_ticket(
    to: str,
    subject: str,
    html_content: str,
    ticket_bytes: bytes,
    student_name: str,
) -> tuple[bool, str]:
    api_key = os.getenv("RESEND_API_KEY")
    safe_name = "".join(c for c in student_name if c.isalnum() or c in " _-").strip().replace(" ", "_")

    if api_key:
        from_email = os.getenv("EMAIL_FROM", "noreply@iesaui.org")
        from_header = f"IESA <{from_email}>"
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
                timeout=25,
            )
            if res.status_code in (200, 201, 202):
                msg_id = res.json().get("id", "sent")
                return (True, msg_id)
            elif res.status_code == 429:
                print("⚠️  Resend quota exceeded (HTTP 429), attempting SMTP fallback...")
                return send_via_smtp(to, subject, html_content, ticket_bytes, student_name)
            else:
                return (False, f"HTTP {res.status_code}: {res.text}")
        except Exception as exc:
            return (False, str(exc))

    return send_via_smtp(to, subject, html_content, ticket_bytes, student_name)


def assemble_final_batch() -> tuple[dict, list[dict]]:
    """
    Combines:
    1. The 44 reconciled attendees from final_reconciled_paid_attendees.json
    2. The 4 newly instructed additions:
       - Okhaioisevai ADEOYE (okhaioisevai44@gmail.com, 231526)
       - Precious Ajao (ajaoprecious11@gmail.com, 231531)
       - Precious Adetipe (padetipe527@stu.ui.edu.ng, 231527)
       - Rhema Victor-Menekpo (menekporhema@gmail.com, 244080)
    """
    db = get_db()
    payment = db.payments.find_one({"_id": ObjectId(CONFERENCE_PAYMENT_ID)})
    if not payment:
        raise ValueError(f"Conference Payment {CONFERENCE_PAYMENT_ID} not found.")

    # Load 44 reconciled
    attendees_by_email = {}
    if os.path.exists(RECONCILED_FILE):
        with open(RECONCILED_FILE, "r", encoding="utf-8") as f:
            reconciled = json.load(f)
            for a in reconciled:
                em = a["email"].strip().lower()
                attendees_by_email[em] = a

    # Define the 4 explicit additions
    explicit_additions = [
        {
            "_id": "69b3cba8800ee1a6182f91cd",
            "first_name": "Okhaioisevai",
            "full_name": "Okhaioisevai ADEOYE",
            "display_name": "Okhaioisevai Adeoye",
            "salutation": "Okhaioisevai",
            "email": "okhaioisevai44@gmail.com",
            "matric_display": "231526",
            "department": "IPE",
            "source": "admin_requested (Form Row 106)",
            "in_db": True,
        },
        {
            "_id": "69b3cb3a800ee1a6182f91cb",
            "first_name": "Precious",
            "full_name": "Precious Ajao",
            "display_name": "Precious Ajao",
            "salutation": "Precious",
            "email": "ajaoprecious11@gmail.com",
            "matric_display": "231531",
            "department": "IPE",
            "source": "admin_requested (500L DB)",
            "in_db": True,
        },
        {
            "_id": "69b3d4fb3c072ea0b383c243",
            "first_name": "Precious",
            "full_name": "Precious Adetipe",
            "display_name": "Precious Adetipe",
            "salutation": "Precious",
            "email": "padetipe527@stu.ui.edu.ng",
            "matric_display": "231527",
            "department": "IPE",
            "source": "admin_requested (500L DB)",
            "in_db": True,
        },
        {
            "_id": "69d67bbc4d0695fc14cbf392",
            "first_name": "Rhema",
            "full_name": "Rhema Victor-Menekpo",
            "display_name": "Rhema Victor-Menekpo",
            "salutation": "Rhema",
            "email": "menekporhema@gmail.com",
            "matric_display": "244080",
            "department": "IPE",
            "source": "admin_requested (300L DB)",
            "in_db": True,
        },
    ]

    for item in explicit_additions:
        em = item["email"].strip().lower()
        if em not in attendees_by_email:
            attendees_by_email[em] = item

    final_list = list(attendees_by_email.values())
    final_list.sort(key=lambda x: x["display_name"])

    # Synchronize paidBy in MongoDB
    paid_by_current = set(payment.get("paidBy", []))
    oids_to_add = []
    for a in final_list:
        uid = str(a.get("_id", ""))
        if ObjectId.is_valid(uid) and uid not in paid_by_current:
            oids_to_add.append(uid)

    if oids_to_add:
        db.payments.update_one(
            {"_id": ObjectId(CONFERENCE_PAYMENT_ID)},
            {"$addToSet": {"paidBy": {"$each": oids_to_add}}}
        )
        print(f"✅ Synchronized MongoDB: Added {len(oids_to_add)} new verified attendee ObjectIds to paidBy.")
        payment["paidBy"] = list(paid_by_current.union(set(oids_to_add)))

    return payment, final_list


def dispatch_batch(live: bool = False) -> None:
    payment, attendees = assemble_final_batch()
    results = load_results()
    delivered_map = results.get("delivered", {})

    print("\n=======================================================")
    print(f"🎫 IESA PROCESS DAY 2026: PAID TICKET BATCH DISPATCH")
    print(f"=======================================================")
    print(f"Mode:             {'🚀 LIVE DISPATCH' if live else '🔍 DRY RUN (Preview)'}")
    print(f"Total Attendees:  {len(attendees)}")
    print(f"Already Sent:     {len(delivered_map)}")
    print(f"Pending Dispatch: {sum(1 for a in attendees if a['email'].strip().lower() not in delivered_map)}")
    print("=======================================================\n")

    config = payment.get("ticketConfig", {})
    payment_id = str(payment["_id"])
    template_url = config.get("templateUrl")
    qr_cfg = config.get("qrCode", {})
    name_cfg = config.get("studentName", {})
    matric_cfg = config.get("matricNumber", {})
    font_fam = config.get("fontFamily", "Helvetica")

    success_count = 0
    skipped_count = 0
    failed_count = 0

    for idx, att in enumerate(attendees, start=1):
        email = att["email"].strip().lower()
        full_name = att.get("raw_name") or att.get("display_name")
        display_name = att.get("display_name") or format_ticket_name(full_name)
        matric = att.get("matric_display") or att.get("matric_number") or "IPE"
        uid = att.get("_id", f"ATT_{idx}")

        # Check idempotency
        if email in delivered_map:
            prev = delivered_map[email]
            print(f"[{idx}/{len(attendees)}] ⏭️  SKIP: {display_name} ({email}) - already sent on {prev.get('sent_at')} (ID: {prev.get('message_id')})")
            skipped_count += 1
            continue

        if not live:
            print(f"[{idx}/{len(attendees)}] 🔍 PREVIEW: {display_name:<22} | Matric: {matric:<12} | Email: {email}")
            continue

        print(f"\n[{idx}/{len(attendees)}] 🚀 Generating ticket & dispatching to: {display_name} ({matric}) -> {email}...")

        try:
            qr_data = f"IESA_EVENT:{payment_id}|STUDENT:{uid}"
            ticket_bytes = generate_visual_ticket(
                template_url=template_url,
                qr_config=qr_cfg,
                name_config=name_cfg,
                matric_config=matric_cfg,
                font_family=font_fam,
                student_name=display_name,
                matric_number=matric,
                qr_data=qr_data,
            )

            subject, html = render_ticket_email(att)

            success, detail = send_email_with_ticket(
                to=email,
                subject=subject,
                html_content=html,
                ticket_bytes=ticket_bytes,
                student_name=display_name,
            )

            now_iso = datetime.now(timezone.utc).isoformat()
            if success:
                print(f"  ✅ Sent successfully! (Message ID: {detail})")
                delivered_map[email] = {
                    "name": display_name,
                    "matric": matric,
                    "student_id": uid,
                    "message_id": detail,
                    "sent_at": now_iso,
                    "source": att.get("source", "batch"),
                }
                success_count += 1
            else:
                print(f"  ❌ Failed to send: {detail}")
                results.setdefault("failed", {})[email] = {
                    "name": display_name,
                    "error": detail,
                    "attempted_at": now_iso,
                }
                failed_count += 1

            # Save state after each send
            results["delivered"] = delivered_map
            results["stats"] = {
                "total_attendees": len(attendees),
                "total_delivered": len(delivered_map),
                "last_run": now_iso,
            }
            save_results(results)

            time.sleep(0.8)

        except Exception as exc:
            print(f"  ❌ Generation Error: {exc}")
            failed_count += 1

    print("\n=======================================================")
    print("📊 BATCH DISPATCH SUMMARY")
    print(f"  Total Attendees in Batch: {len(attendees)}")
    print(f"  Sent in this run:         {success_count}")
    print(f"  Skipped (already sent):   {skipped_count}")
    print(f"  Failed:                   {failed_count}")
    print(f"  Total Delivered to date:  {len(delivered_map)}")
    print(f"  Results saved to:         {RESULTS_FILE}")
    print("=======================================================\n")


def main():
    parser = argparse.ArgumentParser(description="IESA Batch Ticket Dispatcher")
    parser.add_argument("--live", action="store_true", help="Execute live email sending")
    args = parser.parse_args()

    dispatch_batch(live=args.live)


if __name__ == "__main__":
    main()
