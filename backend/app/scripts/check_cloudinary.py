import socket
import dns.resolver
import os
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

res = dns.resolver.Resolver(configure=False)
res.nameservers = ['8.8.8.8', '1.1.1.1']
orig_gai = socket.getaddrinfo

def patched_gai(host, port, *args, **kwargs):
    try:
        return orig_gai(host, port, *args, **kwargs)
    except Exception:
        ans = res.resolve(host, 'A')
        return orig_gai(ans[0].to_text(), port, *args, **kwargs)

socket.getaddrinfo = patched_gai

load_dotenv(r'c:\Users\QING\Desktop\Qing\iesa\backend\.env')
cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME', 'dtndwunfd').strip('"\'')
api_key = os.getenv('CLOUDINARY_API_KEY', '').strip('"\'')
api_secret = os.getenv('CLOUDINARY_API_SECRET', '').strip('"\'')

auth = HTTPBasicAuth(api_key, api_secret)
base_url = f'https://api.cloudinary.com/v1_1/{cloud_name}'

endpoints = [
    '/ping',
    '/usage',
    '/folders',
    '/sub_accounts',
    '/users',
]

print(f"Cloud Name: {cloud_name}")
print(f"API Key: {api_key}")

for ep in endpoints:
    try:
        r = requests.get(base_url + ep, auth=auth, timeout=10)
        print(f"{ep} -> {r.status_code}: {r.text[:300]}")
    except Exception as e:
        print(f"{ep} -> Error: {e}")

# Check resources
r = requests.get(f"{base_url}/resources/image?context=true&tags=true&max_results=5", auth=auth, timeout=10)
print(f"/resources/image -> {r.status_code}")
if r.status_code == 200:
    for item in r.json().get("resources", []):
        print("  Item:", item.get("public_id"), item.get("created_at"), item.get("context"))

# Check upload presets
r = requests.get(f"{base_url}/upload_presets", auth=auth, timeout=10)
print(f"/upload_presets -> {r.status_code}")
if r.status_code == 200:
    for p in r.json().get("presets", []):
        print("  Preset:", p.get("name"), p.get("settings"))

