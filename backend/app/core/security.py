import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os, json, base64
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase Admin
cred_path = "serviceAccountKey.json"

sa_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64")
if sa_b64:
    sa_json = json.loads(base64.b64decode(sa_b64).decode("utf-8"))
    cred = credentials.Certificate(sa_json)
else:
    cred = credentials.Certificate(cred_path)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
