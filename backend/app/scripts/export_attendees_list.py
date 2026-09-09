import json
import os
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
dispatch_path = os.path.join(BACKEND_DIR, "app", "data", "paid_tickets_dispatch_results.json")
reconciled_path = os.path.join(BACKEND_DIR, "app", "data", "final_reconciled_paid_attendees.json")

with open(dispatch_path, "r", encoding="utf-8") as f:
    dispatch = json.load(f)

with open(reconciled_path, "r", encoding="utf-8") as f:
    reconciled = json.load(f)

reconciled_map = {a["email"].strip().lower(): a for a in reconciled}

delivered = dispatch.get("delivered", {})

items = []
for em, rec in delivered.items():
    extra = reconciled_map.get(em, {})
    phone = extra.get("phone", "—")
    dept = extra.get("department", "IPE")
    raw_name = extra.get("raw_name") or rec.get("name")
    items.append({
        "name": rec.get("name"),
        "raw_name": raw_name,
        "matric": rec.get("matric"),
        "email": em,
        "phone": phone,
        "dept": dept,
        "source": rec.get("source", extra.get("source", "website")),
        "message_id": rec.get("message_id"),
    })

items.sort(key=lambda x: x["name"].lower())

print(f"Total: {len(items)}\n")
for i, x in enumerate(items, start=1):
    print(f"{i:2d} | {x['name']:<22} | {x['raw_name']:<30} | {x['matric']:<12} | {x['email']:<32} | {x['phone']:<15} | {x['dept']}")
