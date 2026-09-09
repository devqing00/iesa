import socket
import dns.resolver
from bson import ObjectId
from pymongo import MongoClient

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

uri = 'mongodb://adetayoalexander12:8oj4NiUp7FK0jyty@cluster0-shard-00-00.qrykl.mongodb.net:27017,cluster0-shard-00-01.qrykl.mongodb.net:27017,cluster0-shard-00-02.qrykl.mongodb.net:27017/iesa_db?ssl=true&authSource=admin&retryWrites=true&w=majority'
client = MongoClient(uri, serverSelectionTimeoutMS=5000)
db = client['iesa_db']

fadeelat_ids = ['6a0b6ed04439b436e3b53f43', '6aa1ad405b5c87b138814e5a']
dennis_ids = ['69b93e9efcc560f66403c265', '6a6787fa4e9323b07374b1e5']

print("--- Bank Transfers for Fadeelat ---")
for bt in db.bankTransfers.find({'studentId': {'$in': fadeelat_ids}}):
    print(bt)

print("\n--- Bank Transfers for Dennis / Afolabi ---")
for bt in db.bankTransfers.find({'studentId': {'$in': dennis_ids}}):
    print(bt)
