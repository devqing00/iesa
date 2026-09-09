import socket
import dns.resolver
import os
import sys
from datetime import datetime, timezone
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
uri = 'mongodb://adetayoalexander12:8oj4NiUp7FK0jyty@cluster0-shard-00-00.qrykl.mongodb.net:27017,cluster0-shard-00-01.qrykl.mongodb.net:27017,cluster0-shard-00-02.qrykl.mongodb.net:27017/iesa_db?ssl=true&authSource=admin&retryWrites=true&w=majority'
client = MongoClient(uri, serverSelectionTimeoutMS=5000)
db = client['iesa_db']

student_id = "69b82bfc376298834e19f397"
payment_id = "69b5c531f5e02c6de5ccb6b0"

payment = db.payments.find_one({"_id": ObjectId(payment_id)})
paid_by = payment.get("paidBy", [])
print(f"Current paid count for '{payment.get('title')}': {len(paid_by)}")

if student_id in paid_by:
    print("Student already in paidBy list!")
else:
    db.payments.update_one(
        {"_id": ObjectId(payment_id)},
        {
            "$addToSet": {"paidBy": student_id},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    # Also create a transaction record
    db.transactions.insert_one({
        "studentId": student_id,
        "paymentId": payment_id,
        "amount": 2500.0,
        "status": "success",
        "channel": "manual",
        "reference": f"SEC_APPROVAL_{str(ObjectId())[:12].upper()}",
        "paidAt": datetime.now(timezone.utc),
        "notes": "Approved by Secretary",
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    })
    print("✅ Successfully added Toriola Samuel Oluwafemi to paidBy and created transaction record!")

# Verify updated count
updated_payment = db.payments.find_one({"_id": ObjectId(payment_id)})
print(f"New paid count: {len(updated_payment.get('paidBy', []))}")
