import sys
import os
import csv
import json

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Setup paths
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROOT_DIR = os.path.dirname(BACKEND_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

# DNS Patch
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

from app.scripts.send_paid_tickets import get_paid_attendees, get_db
from app.utils.visual_ticket_generator import format_ticket_name

def clean_department(raw_dept: str) -> str:
    """Format raw department string into a clean, concise label for the matric space."""
    if not raw_dept:
        return "IESA Delegate"
    d = raw_dept.strip()
    d_low = d.lower()
    if "industrial" in d_low or "ipe" in d_low:
        return "IPE"
    elif "petroleum" in d_low:
        return "Petroleum Eng"
    elif "agric" in d_low:
        return "Agric. Eng"
    elif "systems" in d_low:
        return "Systems Eng"
    elif "mechanical" in d_low:
        return "Mechanical Eng"
    elif "electrical" in d_low:
        return "Electrical Eng"
    elif "civil" in d_low:
        return "Civil Eng"
    elif "technology" in d_low or "tech" in d_low:
        return "Tech Faculty"
    parts = [p.strip() for p in d.replace("//", "/").split("/") if p.strip()]
    if parts:
        return parts[-1][:18]
    return d[:18]

def main():
    print("===============================================================")
    print("🔍 RECONCILING IESA PAID ATTENDEES (WEBSITE + FORM RESPONSES)")
    print("===============================================================\n")

    db = get_db()
    payment, website_attendees = get_paid_attendees()
    print(f"1. Website Confirmed Attendees: {len(website_attendees)}")

    # Index all DB users
    all_users = list(db.users.find({}, {
        "firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1, "department": 1
    }))
    email_to_user = {}
    name_to_user = {}
    for u in all_users:
        em = (u.get("email") or "").strip().lower()
        if em:
            email_to_user[em] = u
        fn = (u.get("firstName") or "").strip().lower()
        ln = (u.get("lastName") or "").strip().lower()
        if fn and ln:
            name_to_user[f"{fn} {ln}"] = u
            name_to_user[f"{ln} {fn}"] = u

    # Read CSV
    csv_path = os.path.join(ROOT_DIR, "public", "assets", "IESA CONFERENCE 2026 (Responses) - Form Responses 1.csv")
    if not os.path.exists(csv_path):
        print(f"Error: CSV not found at {csv_path}")
        return

    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        header = next(reader)
        form_rows = list(reader)

    print(f"2. Form Responses Total: {len(form_rows)}")

    # Master list keyed by email
    unified_attendees = {}
    
    # Track website attendees by multiple identifiers for comprehensive deduplication
    website_by_email = {}
    website_by_uid = {}
    website_by_matric = {}
    website_by_name = {}

    for a in website_attendees:
        em = (a.get("email") or "").strip().lower()
        if em:
            website_by_email[em] = a
        uid = str(a.get("_id", ""))
        if uid:
            website_by_uid[uid] = a
        mat = str(a.get("matric_number") or "").strip()
        if mat and mat != "—":
            website_by_matric[mat] = a
        # Name tokens
        raw_n = a.get("full_name", "").lower()
        tokens = tuple(sorted([t for t in raw_n.replace(",", "").split() if len(t) > 1]))
        if tokens:
            website_by_name[tokens] = a

        unified_attendees[em] = {
            "source": "website",
            "_id": a["_id"],
            "raw_name": a["full_name"],
            "display_name": format_ticket_name(a["full_name"]),
            "salutation": a["first_name"],
            "email": a["email"],
            "matric_display": a["matric_number"] if a["matric_number"] and a["matric_number"] != "—" else "IPE",
            "department": "IPE",
            "has_receipt": True,
            "receipt_url": "Website Payment (Verified)",
            "in_db": True,
        }

    print(f"   -> Added {len(unified_attendees)} attendees from Website.")

    # 2. Process Form Responses
    form_yes_with_receipt = []
    form_yes_without_receipt = []

    for idx, r in enumerate(form_rows, start=1):
        val14 = r[14].strip() if len(r) > 14 else ""
        if "yes" in val14.lower():
            receipt = r[15].strip() if len(r) > 15 else ""
            item = {
                "row_idx": idx,
                "name": r[2].strip(),
                "email1": r[1].strip().lower(),
                "email2": r[3].strip().lower(),
                "phone": r[4].strip() if len(r) > 4 else "",
                "dept": r[7].strip() if len(r) > 7 else "",
                "receipt": receipt,
                "has_receipt": bool(receipt),
            }
            if receipt:
                form_yes_with_receipt.append(item)
            else:
                form_yes_without_receipt.append(item)

    print(f"3. Form YES with uploaded receipt: {len(form_yes_with_receipt)}")
    print(f"   Form YES without uploaded receipt: {len(form_yes_without_receipt)}")

    # Process those with receipt
    added_from_form_with_receipt = 0
    duplicates_from_form_with_receipt = 0
    duplicate_details = []

    for item in form_yes_with_receipt:
        em1 = item["email1"]
        em2 = item["email2"]

        # Look up in DB first to get identity
        db_user = email_to_user.get(em1) or email_to_user.get(em2)
        if not db_user:
            raw_n = item["name"].lower().replace(",", "")
            tokens = raw_n.split()
            if len(tokens) >= 2:
                db_user = name_to_user.get(f"{tokens[0]} {tokens[-1]}") or name_to_user.get(f"{tokens[-1]} {tokens[0]}")

        # Multi-level match against website attendees
        matched_website_attendee = None
        match_reason = None

        if em1 in website_by_email:
            matched_website_attendee = website_by_email[em1]
            match_reason = f"Primary Email ({em1})"
        elif em2 in website_by_email:
            matched_website_attendee = website_by_email[em2]
            match_reason = f"Secondary Email ({em2})"
        elif db_user and str(db_user["_id"]) in website_by_uid:
            matched_website_attendee = website_by_uid[str(db_user["_id"])]
            match_reason = f"Database User ID ({db_user['_id']})"
        elif db_user and db_user.get("matricNumber") and str(db_user["matricNumber"]).strip() in website_by_matric:
            matched_website_attendee = website_by_matric[str(db_user["matricNumber"]).strip()]
            match_reason = f"Matric Number ({db_user['matricNumber']})"
        else:
            # Check name token match
            form_tokens = set(item["name"].lower().replace(",", "").split())
            form_tokens = {t for t in form_tokens if len(t) > 1}
            for w_tokens, w_att in website_by_name.items():
                intersection = form_tokens.intersection(set(w_tokens))
                # If 2 significant name parts match (e.g. ['ojo', 'peace'] or ['alli', 'oluwateniara'])
                if len(intersection) >= 2:
                    matched_website_attendee = w_att
                    match_reason = f"Name overlap ({', '.join(intersection)})"
                    break

        if matched_website_attendee:
            target_em = matched_website_attendee["email"].lower()
            if target_em in unified_attendees:
                unified_attendees[target_em]["receipt_url"] = item["receipt"]
                unified_attendees[target_em]["form_phone"] = item["phone"]
            duplicates_from_form_with_receipt += 1
            duplicate_details.append(f"Row {item['row_idx']}: {item['name']} -> Matched website attendee {matched_website_attendee['full_name']} via {match_reason}")
            continue

        # Truly NEW paid attendee from Form + Receipt!
        primary_email = em1 or em2
        clean_dept = clean_department(item["dept"])

        if db_user:
            fn = db_user.get("firstName", "").strip()
            ln = db_user.get("lastName", "").strip()
            full_n = f"{fn} {ln}".strip() or item["name"]
            first_tok = fn.split()[0].title() if fn else item["name"].split()[0].title()
            mat = db_user.get("matricNumber") or clean_dept
            uid = str(db_user["_id"])
            in_db = True
        else:
            full_n = item["name"]
            if "," in full_n:
                parts = [p.strip() for p in full_n.split(",")]
                full_n = f"{parts[1]} {parts[0]}" if len(parts) > 1 else parts[0]
            first_tok = full_n.split()[0].title() if full_n else "Attendee"
            mat = clean_dept
            uid = f"FORM_{item['row_idx']}"
            in_db = False

        unified_attendees[primary_email] = {
            "source": "form_receipt",
            "_id": uid,
            "raw_name": full_n,
            "display_name": format_ticket_name(full_n),
            "salutation": first_tok,
            "email": primary_email,
            "matric_display": str(mat),
            "department": clean_dept,
            "has_receipt": True,
            "receipt_url": item["receipt"],
            "in_db": in_db,
            "phone": item["phone"],
        }
        added_from_form_with_receipt += 1

    print(f"\n--- Deduplication Analysis ---")
    for d in duplicate_details:
        print(f" 🔗 {d}")

    print(f"\nReconciliation Results:")
    print(f" - Form With Receipt: {duplicates_from_form_with_receipt} already in website list (deduplicated)")
    print(f" - Form With Receipt: {added_from_form_with_receipt} NEW confirmed attendees added")
    print(f" - Total Confirmed Attendees so far: {len(unified_attendees)}")

    # Check those without receipt
    print(f"\n--- Checking Form YES WITHOUT Receipt ({len(form_yes_without_receipt)}) ---")
    without_receipt_in_website = 0
    without_receipt_not_in_website = []
    for item in form_yes_without_receipt:
        em1 = item["email1"]
        em2 = item["email2"]
        if em1 in unified_attendees or em2 in unified_attendees:
            without_receipt_in_website += 1
        else:
            without_receipt_not_in_website.append(item)

    print(f" - Already paid on website: {without_receipt_in_website}")
    print(f" - Not in website and NO receipt uploaded: {len(without_receipt_not_in_website)}")
    for missing in without_receipt_not_in_website:
        print(f"    * Row {missing['row_idx']}: {missing['name']} ({missing['email1']}) - {missing['dept']}")

    # Output full table
    print("\n=========================================================================================================")
    print(f"📋 FINAL RECONCILED CONFIRMED ATTENDEE LIST ({len(unified_attendees)} ATTENDEES)")
    print("=========================================================================================================")
    print(f"{'#':<3} | {'Ticket Name (Max 2)':<22} | {'Matric / Dept':<15} | {'Email':<34} | {'Source':<12} | {'In DB'}")
    print("-" * 105)

    sorted_list = sorted(unified_attendees.values(), key=lambda x: (x['source'], x['display_name']))
    for i, a in enumerate(sorted_list, start=1):
        in_db_str = "✅ Yes" if a["in_db"] else "⚠️ No (Ext)"
        src_str = "Website" if a["source"] == "website" else "Form+Receipt"
        print(f"{i:<3} | {a['display_name']:<22} | {a['matric_display']:<15} | {a['email']:<34} | {src_str:<12} | {in_db_str}")

    # Save to json file for review and execution
    out_json = os.path.join(ROOT_DIR, "backend", "app", "data", "final_reconciled_paid_attendees.json")
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(sorted_list, f, indent=2, ensure_ascii=False)
    print(f"\nSaved reconciled list to: {out_json}")

if __name__ == "__main__":
    main()
