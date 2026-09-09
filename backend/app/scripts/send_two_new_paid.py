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

import io
from PIL import Image
from bson import ObjectId
from app.scripts.send_paid_tickets import (
    CONFERENCE_PAYMENT_ID,
    DEFAULT_SUBJECT,
    get_db,
    render_ticket_email,
)
from app.scripts.dispatch_paid_tickets_batch import send_email_with_ticket
from app.utils.visual_ticket_generator import generate_visual_ticket, format_ticket_name

ARTIFACT_DIR = r"C:\Users\QING\.gemini\antigravity-ide\brain\3821aa0a-4cff-4990-9a59-f45147cebdb0"
SCRATCH_DIR = os.path.join(ARTIFACT_DIR, "scratch")
os.makedirs(SCRATCH_DIR, exist_ok=True)

STUDENTS = [
    {
        "_id": "6a0b6ed04439b436e3b53f43",
        "first_name": "Fadeelat",
        "raw_name": "Fadeelat Abdul-Azeez",
        "display_name": "Fadeelat Abdul-Azeez",
        "salutation": "Fadeelat",
        "email": "delahazeez23@gmail.com",
        "matric_display": "251106",
        "department": "Industrial Engineering",
        "source": "paid_direct_db",
        "in_db": True,
        "filename_key": "Fadeelat_AbdulAzeez"
    },
    {
        "_id": "69b93e9efcc560f66403c265",
        "first_name": "Olaniyi",
        "raw_name": "Afolabi Olaniyi Daniel",
        "display_name": "Olaniyi Afolabi",
        "salutation": "Olaniyi",
        "email": "oafolabi244024@stu.ui.edu.ng",
        "matric_display": "244024",
        "department": "Industrial Engineering",
        "source": "paid_direct_db",
        "in_db": True,
        "filename_key": "Olaniyi_Afolabi"
    }
]

def main():
    print("=======================================================")
    print("🎟️ DISPATCHING TICKETS FOR 2 NEWLY PAID ATTENDEES")
    print("=======================================================")

    db = get_db()
    payment = db.payments.find_one({"_id": ObjectId(CONFERENCE_PAYMENT_ID)})
    if not payment:
        raise ValueError(f"Payment document {CONFERENCE_PAYMENT_ID} not found!")

    config = payment.get("ticketConfig", {})
    results_path = os.path.join(BACKEND_DIR, "app", "data", "paid_tickets_dispatch_results.json")
    with open(results_path, "r", encoding="utf-8") as f:
        dispatch_results = json.load(f)

    reconciled_path = os.path.join(BACKEND_DIR, "app", "data", "final_reconciled_paid_attendees.json")
    with open(reconciled_path, "r", encoding="utf-8") as f:
        reconciled = json.load(f)

    public_dir_1 = os.path.join(ROOT_DIR, "public", "tickets")
    os.makedirs(public_dir_1, exist_ok=True)
    public_dir_2 = os.path.join(ROOT_DIR, "..", "iepod-conference", "public", "tickets")
    if os.path.exists(os.path.join(ROOT_DIR, "..", "iepod-conference")):
        os.makedirs(public_dir_2, exist_ok=True)

    sent_count = 0
    for student in STUDENTS:
        print(f"\n-------------------------------------------------------")
        print(f"Processing: {student['display_name']} ({student['matric_display']}) - {student['email']}")
        print(f"-------------------------------------------------------")

        qr_data = f"IESA_EVENT:{CONFERENCE_PAYMENT_ID}|STUDENT:{student['_id']}"
        print(f"QR Payload: {qr_data}")

        # 1. Generate visual ticket
        print("Generating visual ticket...")
        ticket_bytes = generate_visual_ticket(
            template_url=config.get("templateUrl"),
            qr_config=config.get("qrCode", {}),
            name_config=config.get("studentName", {}),
            matric_config=config.get("matricNumber", {}),
            font_family=config.get("fontFamily", "Helvetica"),
            student_name=student["display_name"],
            matric_number=student["matric_display"],
            qr_data=qr_data,
        )
        print(f"✅ Generated ticket ({len(ticket_bytes):,} bytes)")

        # Save ticket crop for visual inspection
        img = Image.open(io.BytesIO(ticket_bytes))
        w, h = img.size
        # Crop name + matric + QR region
        crop_box = (int(w * 0.48), int(h * 0.18), int(w * 0.82), int(h * 0.65))
        crop_img = img.crop(crop_box)
        crop_path = os.path.join(SCRATCH_DIR, f"{student['filename_key'].lower()}_crop.png")
        crop_img.save(crop_path)
        print(f"Saved crop for inspection: {crop_path}")

        # 2. Save full ticket in artifacts and public directories
        art_path = os.path.join(ARTIFACT_DIR, f"IESA_Ticket_{student['matric_display']}_{student['filename_key']}.png")
        with open(art_path, "wb") as f:
            f.write(ticket_bytes)
        print(f"Saved artifact: {art_path}")

        p1 = os.path.join(public_dir_1, f"IESA_Conference_Ticket_{student['filename_key']}.png")
        with open(p1, "wb") as f:
            f.write(ticket_bytes)
        print(f"Saved iesa public: {p1}")

        if os.path.exists(os.path.join(ROOT_DIR, "..", "iepod-conference")):
            p2 = os.path.join(public_dir_2, f"IESA_Conference_Ticket_{student['filename_key']}.png")
            with open(p2, "wb") as f:
                f.write(ticket_bytes)
            print(f"Saved iepod-conference public: {p2}")

        # 3. Render email
        subject, html = render_ticket_email(student)

        # 4. Send email via Resend
        print(f"Dispatching email to {student['email']}...")
        success, detail = send_email_with_ticket(
            to=student["email"],
            subject=subject,
            html_content=html,
            ticket_bytes=ticket_bytes,
            student_name=student["display_name"],
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        if success:
            print(f"✅ EMAIL SENT SUCCESSFULLY! Message ID: {detail}")
            sent_count += 1
        else:
            print(f"❌ FAILED TO SEND EMAIL: {detail}")
            continue

        # 5. Add student ID to MongoDB paidBy in payments collection
        db.payments.update_one(
            {"_id": ObjectId(CONFERENCE_PAYMENT_ID)},
            {
                "$addToSet": {"paidBy": student["_id"]},
                "$set": {"updatedAt": datetime.now(timezone.utc)}
            }
        )
        print(f"✅ Added {student['_id']} to payments.paidBy")

        # 6. Record transaction if not exists
        existing_tx = db.transactions.find_one({
            "studentId": student["_id"],
            "paymentId": CONFERENCE_PAYMENT_ID
        })
        if not existing_tx:
            db.transactions.insert_one({
                "studentId": student["_id"],
                "paymentId": CONFERENCE_PAYMENT_ID,
                "amount": 2500.0,
                "status": "success",
                "channel": "manual",
                "reference": f"CONF_PAID_{str(ObjectId())[:12].upper()}",
                "paidAt": datetime.now(timezone.utc),
                "notes": "Paid Attendee Confirmed",
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            })
            print(f"✅ Recorded transaction in transactions collection")
        else:
            print(f"ℹ️ Transaction already recorded")

        # 7. Update paid_tickets_dispatch_results.json
        dispatch_results.setdefault("delivered", {})[student["email"]] = {
            "name": student["display_name"],
            "matric": student["matric_display"],
            "student_id": student["_id"],
            "message_id": detail,
            "sent_at": now_iso,
            "source": student["source"],
        }

        # 8. Update final_reconciled_paid_attendees.json
        clean_entry = {
            "source": student["source"],
            "_id": student["_id"],
            "raw_name": student["raw_name"],
            "display_name": student["display_name"],
            "salutation": student["salutation"],
            "email": student["email"],
            "matric_display": student["matric_display"],
            "department": student["department"],
            "has_receipt": True,
            "receipt_url": "Direct Payment Verified",
            "in_db": student["in_db"]
        }
        if not any(a.get("email", "").lower() == student["email"].lower() for a in reconciled):
            reconciled.append(clean_entry)

        # Rate limiting delay between dispatches (Resend rate limit is 2 req/sec)
        time.sleep(1.0)

    # Finalize stats
    dispatch_results["stats"]["total_delivered"] = len(dispatch_results["delivered"])
    dispatch_results["stats"]["last_run"] = datetime.now(timezone.utc).isoformat()

    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(dispatch_results, f, indent=2, ensure_ascii=False)
    print(f"\nUpdated {results_path} (Total delivered: {len(dispatch_results['delivered'])})")

    reconciled.sort(key=lambda x: x["display_name"])
    with open(reconciled_path, "w", encoding="utf-8") as f:
        json.dump(reconciled, f, indent=2, ensure_ascii=False)
    print(f"Updated {reconciled_path} (Total reconciled: {len(reconciled)})")

    print(f"\n=======================================================")
    print(f"🎉 COMPLETED: Successfully dispatched {sent_count}/{len(STUDENTS)} tickets!")
    print(f"=======================================================")

if __name__ == "__main__":
    main()
