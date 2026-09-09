import sys
import os
import json

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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

from app.scripts.send_paid_tickets import get_db

def main():
    db = get_db()
    print("--- SEARCHING USERS IN DATABASE ---")
    queries = [
        {"matricNumber": "251106"},
        {"email": {"$regex": "delahazeez23@gmail.com", "$options": "i"}},
        {"lastName": {"$regex": "Abdul-Azeez|Azeez", "$options": "i"}},
        {"matricNumber": "244024"},
        {"email": {"$regex": "oafolabi244024@stu.ui.edu.ng", "$options": "i"}},
        {"lastName": {"$regex": "Afolabi", "$options": "i"}}
    ]
    found_ids = set()
    for q in queries:
        for u in db.users.find(q):
            uid = str(u["_id"])
            if uid not in found_ids:
                found_ids.add(uid)
                print(f"Match for {q}:")
                print(f"  ID: {uid}")
                print(f"  Name: {u.get('firstName')} {u.get('lastName')}")
                print(f"  Matric: {u.get('matricNumber')}")
                print(f"  Email: {u.get('email')}")
                print(f"  Dept: {u.get('department')}")
                print(f"  Level: {u.get('level')}")

    # Also search CSV files
    csv_path = os.path.join(BACKEND_DIR, "app", "data", "conference_form_responses.csv")
    if os.path.exists(csv_path):
        import csv
        print("\n--- SEARCHING CSV RESPONSES ---")
        with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, 1):
                txt = " ".join(row.values()).lower()
                if "251106" in txt or "delahazeez" in txt or "fadeelat" in txt or "244024" in txt or "afolabi" in txt or "olaniyi" in txt:
                    print(f"Row {i}: Name={row.get('Full Name') or row.get('Name')}, Email={row.get('Email Address') or row.get('Email')}, Dept={row.get('Department')}, Paid={row.get('Have you paid your conference dues?')}")

if __name__ == "__main__":
    main()
