import sys
import os
import json
import base64
import time
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

import socket
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
from bson import ObjectId
from app.scripts.send_paid_tickets import (
    CONFERENCE_PAYMENT_ID,
    DEFAULT_SUBJECT,
    get_db,
    render_ticket_email,
)
from app.scripts.dispatch_paid_tickets_batch import send_email_with_ticket
from app.utils.visual_ticket_generator import generate_visual_ticket, format_ticket_name

def main():
    print("=======================================================")
    print("🎟️ GENERATING & SENDING TICKET FOR TAJUDEEN OLORUNNISOLA")
    print("=======================================================")

    student_data = {
        "_id": "FORM_180",
        "first_name": "Tajudeen",
        "raw_name": "Tajudeen Abdulrahman Olorunnisola",
        "display_name": "Tajudeen Olorunnisola",
        "salutation": "Tajudeen",
        "email": "solapeace086@gmail.com",
        "matric_display": "251295",
        "department": "Petroleum Engineering",
        "source": "form_unconfirmed_approved",
        "in_db": False,
    }

    db = get_db()
    payment = db.payments.find_one({"_id": ObjectId(CONFERENCE_PAYMENT_ID)})
    config = payment.get("ticketConfig", {})

    qr_data = f"IESA_EVENT:{CONFERENCE_PAYMENT_ID}|STUDENT:{student_data['_id']}"

    print("Generating visual ticket...")
    ticket_bytes = generate_visual_ticket(
        template_url=config.get("templateUrl"),
        qr_config=config.get("qrCode", {}),
        name_config=config.get("studentName", {}),
        matric_config=config.get("matricNumber", {}),
        font_family=config.get("fontFamily", "Helvetica"),
        student_name=student_data["display_name"],
        matric_number=student_data["matric_display"],
        qr_data=qr_data,
    )
    print(f"✅ Ticket generated successfully ({len(ticket_bytes):,} bytes)")

    # Save copies
    # 1. Artifact directory
    artifact_path = r"C:\Users\QING\.gemini\antigravity-ide\brain\3821aa0a-4cff-4990-9a59-f45147cebdb0\IESA_Ticket_251295_Tajudeen_Olorunnisola.png"
    with open(artifact_path, "wb") as f:
        f.write(ticket_bytes)
    print(f"Saved artifact to: {artifact_path}")

    # 2. iesa public/tickets
    public_dir_1 = os.path.join(ROOT_DIR, "public", "tickets")
    os.makedirs(public_dir_1, exist_ok=True)
    p1 = os.path.join(public_dir_1, "IESA_Conference_Ticket_Tajudeen_Olorunnisola.png")
    with open(p1, "wb") as f:
        f.write(ticket_bytes)
    print(f"Saved to iesa public: {p1}")

    # 3. iepod-conference public/tickets
    public_dir_2 = os.path.join(ROOT_DIR, "..", "iepod-conference", "public", "tickets")
    if os.path.exists(os.path.join(ROOT_DIR, "..", "iepod-conference")):
        os.makedirs(public_dir_2, exist_ok=True)
        p2 = os.path.join(public_dir_2, "IESA_Conference_Ticket_Tajudeen_Olorunnisola.png")
        with open(p2, "wb") as f:
            f.write(ticket_bytes)
        print(f"Saved to iepod-conference public: {p2}")

    # Render email
    subject, html = render_ticket_email(student_data)

    print(f"\nDispatching email with ticket to: {student_data['email']}...")
    success, detail = send_email_with_ticket(
        to=student_data["email"],
        subject=subject,
        html_content=html,
        ticket_bytes=ticket_bytes,
        student_name=student_data["display_name"],
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    if success:
        print(f"✅ EMAIL SENT SUCCESSFULLY! Message ID: {detail}")
    else:
        print(f"❌ FAILED TO SEND EMAIL: {detail}")
        return

    # Update paid_tickets_dispatch_results.json
    results_path = os.path.join(BACKEND_DIR, "app", "data", "paid_tickets_dispatch_results.json")
    with open(results_path, "r", encoding="utf-8") as f:
        results = json.load(f)

    results.setdefault("delivered", {})[student_data["email"]] = {
        "name": student_data["display_name"],
        "matric": student_data["matric_display"],
        "student_id": student_data["_id"],
        "message_id": detail,
        "sent_at": now_iso,
        "source": student_data["source"],
    }
    results["stats"]["total_delivered"] = len(results["delivered"])
    results["stats"]["last_run"] = now_iso

    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Updated {results_path} (Total delivered now: {len(results['delivered'])})")

    # Update final_reconciled_paid_attendees.json
    reconciled_path = os.path.join(BACKEND_DIR, "app", "data", "final_reconciled_paid_attendees.json")
    if os.path.exists(reconciled_path):
        with open(reconciled_path, "r", encoding="utf-8") as f:
            reconciled = json.load(f)
        if not any(a.get("email", "").lower() == student_data["email"] for a in reconciled):
            reconciled.append(student_data)
            reconciled.sort(key=lambda x: x["display_name"])
            with open(reconciled_path, "w", encoding="utf-8") as f:
                json.dump(reconciled, f, indent=2, ensure_ascii=False)
            print(f"Updated {reconciled_path} (Total reconciled now: {len(reconciled)})")

    print("\n=======================================================")
    print("🎉 COMPLETED: Ticket generated, dispatched & recorded!")
    print("=======================================================")

if __name__ == "__main__":
    main()
