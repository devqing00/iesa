import sys
import os
import json

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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

from app.scripts.send_paid_tickets import get_db

db = get_db()
users = list(db.users.find({}))
print(f"Total users in DB: {len(users)}")

keywords = ["precious", "ajao", "adetipe", "rhema", "victor", "menkpo", "adeoye", "okhai"]

found = []
for u in users:
    doc_str = json.dumps({k: str(v) for k, v in u.items()}).lower()
    for kw in keywords:
        if kw in doc_str:
            found.append((kw, u))

print(f"Total keyword hits: {len(found)}")
for kw, u in found:
    print(f"[{kw.upper()}] _id: {u.get('_id')} | Name: '{u.get('firstName')}' '{u.get('lastName')}' | Email: {u.get('email')} | Matric: {u.get('matricNumber')} | Level: {u.get('level')}")

# Also check enrollments collection in case student names are there!
enrollments = list(db.enrollments.find({}))
print(f"\nTotal enrollments: {len(enrollments)}")
for e in enrollments:
    e_str = json.dumps({k: str(v) for k, v in e.items()}).lower()
    for kw in keywords:
        if kw in e_str:
            print(f"[ENROLLMENT {kw.upper()}] {e}")
