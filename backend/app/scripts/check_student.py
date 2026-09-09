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
uri = 'mongodb://adetayoalexander12:8oj4NiUp7FK0jyty@cluster0-shard-00-00.qrykl.mongodb.net:27017,cluster0-shard-00-01.qrykl.mongodb.net:27017,cluster0-shard-00-02.qrykl.mongodb.net:27017/iesa_db?ssl=true&authSource=admin&retryWrites=true&w=majority'
client = MongoClient(uri, serverSelectionTimeoutMS=5000)
db = client['iesa_db']

print("Searching for student: 258451 / Toriola...")
by_matric = db.users.find_one({"matricNumber": {"$regex": "258451", "$options": "i"}})
if by_matric:
    print("Found by matricNumber:", by_matric.get("_id"), by_matric.get("firstName"), by_matric.get("lastName"), by_matric.get("email"), by_matric.get("matricNumber"))
else:
    print("Not found by matricNumber. Searching by name 'toriola'...")
    by_name = db.users.find_one({"$or": [{"firstName": {"$regex": "toriola", "$options": "i"}}, {"lastName": {"$regex": "toriola", "$options": "i"}}]})
    if by_name:
        print("Found by name:", by_name.get("_id"), by_name.get("firstName"), by_name.get("lastName"), by_name.get("email"), by_name.get("matricNumber"))
    else:
        print("No student found with 'toriola' in name.")
