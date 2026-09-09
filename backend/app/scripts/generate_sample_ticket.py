import socket
import dns.resolver
import os
import sys
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

_mongo_shards = {
    'cluster0-shard-00-00.qrykl.mongodb.net': '65.62.31.34',
    'cluster0-shard-00-01.qrykl.mongodb.net': '65.62.31.41',
    'cluster0-shard-00-02.qrykl.mongodb.net': '65.62.31.50',
}
orig_gai = socket.getaddrinfo
def patched_gai(host, port, *args, **kwargs):
    if host in _mongo_shards:
        return orig_gai(_mongo_shards[host], port, *args, **kwargs)
    return orig_gai(host, port, *args, **kwargs)
socket.getaddrinfo = patched_gai

load_dotenv(r'c:\Users\QING\Desktop\Qing\iesa\backend\.env')
sys.path.insert(0, r'c:\Users\QING\Desktop\Qing\iesa\backend')

from app.utils.visual_ticket_generator import generate_visual_ticket

uri = 'mongodb://adetayoalexander12:8oj4NiUp7FK0jyty@cluster0-shard-00-00.qrykl.mongodb.net:27017,cluster0-shard-00-01.qrykl.mongodb.net:27017,cluster0-shard-00-02.qrykl.mongodb.net:27017/iesa_db?ssl=true&authSource=admin&retryWrites=true&w=majority'
client = MongoClient(uri, serverSelectionTimeoutMS=5000)
db = client['iesa_db']

payment_id = "69b5c531f5e02c6de5ccb6b0"
payment = db.payments.find_one({"_id": ObjectId(payment_id)})
config = payment["ticketConfig"]

student_name = "Toriola Samuel Oluwafemi"
matric = "258451"
student_id = "69b82bfc376298834e19f397"
qr_data = f"IESA_EVENT:{payment_id}|STUDENT:{student_id}"

ticket_bytes = generate_visual_ticket(
    template_url=config.get("templateUrl"),
    qr_config=config.get("qrCode", {}),
    name_config=config.get("studentName", {}),
    matric_config=config.get("matricNumber", {}),
    font_family=config.get("fontFamily", "Helvetica"),
    student_name=student_name,
    matric_number=matric,
    qr_data=qr_data
)

out_path = r'C:\Users\QING\.gemini\antigravity-ide\brain\3821aa0a-4cff-4990-9a59-f45147cebdb0\scratch\test_ticket_toriola.png'
with open(out_path, 'wb') as f:
    f.write(ticket_bytes)

print(f"Generated ticket saved to {out_path} ({len(ticket_bytes)} bytes)")
