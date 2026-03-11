"""
Google Drive Service Layer

Provides authenticated access to Google Drive via a service account.
The service account must have been granted viewer/editor access to the
root folder that contains the departmental resources.

Features:
- Folder browsing (list subfolders + files)
- File metadata retrieval
- File content streaming (proxy for PDFs, videos, etc.)
- Embed URL generation for Google Docs/Sheets/Slides
- Folder structure caching in MongoDB (TTL-based)

Environment variables:
- GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 — base64-encoded service-account JSON
  (falls back to FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 if not set)
- DRIVE_ROOT_FOLDER_ID — the shared root folder ID (required)
- DRIVE_CACHE_TTL — cache duration in seconds (default 600 = 10 min)
"""

import os
import io
import json
import base64
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from functools import lru_cache

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

logger = logging.getLogger("iesa_backend")

# ── Configuration ────────────────────────────────────────────

DRIVE_ROOT_FOLDER_ID = os.getenv("DRIVE_ROOT_FOLDER_ID", "")
DRIVE_CACHE_TTL = int(os.getenv("DRIVE_CACHE_TTL", "600"))  # 10 minutes

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# MIME type mappings
GOOGLE_MIME_TYPES = {
    "application/vnd.google-apps.folder": "folder",
    "application/vnd.google-apps.document": "google_doc",
    "application/vnd.google-apps.spreadsheet": "google_sheet",
    "application/vnd.google-apps.presentation": "google_slide",
    "application/vnd.google-apps.form": "google_form",
}

VIEWABLE_MIME_TYPES = {
    "application/pdf": "pdf",
    "video/mp4": "video",
    "video/webm": "video",
    "video/quicktime": "video",
    "video/x-matroska": "video",
    "image/jpeg": "image",
    "image/png": "image",
    "image/gif": "image",
    "image/webp": "image",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/msword": "doc",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.ms-excel": "xls",
    "text/plain": "text",
    "text/markdown": "text",
}


def _get_credentials():
    """Build Google credentials from env-based service-account JSON."""
    # Try dedicated Drive key, fall back to Firebase key
    b64 = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64") or os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64", ""
    )
    if not b64:
        raise RuntimeError(
            "No Google service account configured. "
            "Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON_BASE64."
        )
    info = json.loads(base64.b64decode(b64))
    return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)


@lru_cache(maxsize=1)
def get_drive_service():
    """
    Build and cache a Google Drive API v3 service instance.
    The LRU cache ensures only one service object exists per process.
    """
    creds = _get_credentials()
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    logger.info("Google Drive API service initialised")
    return service


# ── File type helpers ────────────────────────────────────────

def classify_mime(mime_type: str) -> str:
    """Return a simplified file-type string for the frontend."""
    if mime_type in GOOGLE_MIME_TYPES:
        return GOOGLE_MIME_TYPES[mime_type]
    if mime_type in VIEWABLE_MIME_TYPES:
        return VIEWABLE_MIME_TYPES[mime_type]
    return "other"


def is_previewable(mime_type: str) -> bool:
    """Whether the file can be previewed inline (not just downloaded)."""
    return (
        mime_type in GOOGLE_MIME_TYPES
        or mime_type in VIEWABLE_MIME_TYPES
    )


def get_embed_url(file_id: str, mime_type: str) -> Optional[str]:
    """
    Return an embed/preview URL for a Google-native file or Office doc.
    For PDFs/images/videos, the frontend uses the /stream proxy instead.
    """
    if mime_type == "application/vnd.google-apps.document":
        return f"https://docs.google.com/document/d/{file_id}/preview"
    if mime_type == "application/vnd.google-apps.spreadsheet":
        return f"https://docs.google.com/spreadsheets/d/{file_id}/preview"
    if mime_type == "application/vnd.google-apps.presentation":
        return f"https://docs.google.com/presentation/d/{file_id}/preview"
    # Office docs via Google viewer
    if mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/msword",
        "application/vnd.ms-powerpoint",
        "application/vnd.ms-excel",
    ):
        return f"https://docs.google.com/viewer?srcid={file_id}&pid=explorer&efh=false&a=v&chrome=false&embedded=true"
    return None


def get_thumbnail_url(file_id: str, size: int = 400) -> str:
    """Public thumbnail URL for images (works for most Drive files)."""
    return f"https://drive.google.com/thumbnail?id={file_id}&sz=s{size}"


# ── Core API wrappers (sync — must be run via run_in_executor) ───

def list_folder(folder_id: str, page_token: Optional[str] = None, page_size: int = 100):
    """
    List contents of a Drive folder (folders first, then files).
    Returns (items, nextPageToken).
    """
    service = get_drive_service()
    query = f"'{folder_id}' in parents and trashed = false"
    fields = (
        "nextPageToken, files(id, name, mimeType, size, modifiedTime, "
        "iconLink, thumbnailLink, webViewLink, webContentLink, "
        "imageMediaMetadata, videoMediaMetadata)"
    )
    result = (
        service.files()
        .list(
            q=query,
            fields=fields,
            pageSize=page_size,
            pageToken=page_token,
            orderBy="folder,name",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        )
        .execute()
    )
    items = result.get("files", [])
    next_token = result.get("nextPageToken")
    return items, next_token


def get_file_metadata(file_id: str) -> dict:
    """Fetch detailed metadata for a single file."""
    service = get_drive_service()
    fields = (
        "id, name, mimeType, size, modifiedTime, createdTime, "
        "iconLink, thumbnailLink, webViewLink, webContentLink, "
        "description, imageMediaMetadata, videoMediaMetadata, "
        "parents"
    )
    return (
        service.files()
        .get(fileId=file_id, fields=fields, supportsAllDrives=True)
        .execute()
    )


def download_file_bytes(file_id: str) -> io.BytesIO:
    """Download a file's contents into an in-memory buffer."""
    service = get_drive_service()
    request = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buf.seek(0)
    return buf


def search_files(query_text: str, folder_id: Optional[str] = None, page_size: int = 30):
    """Search files by name across the entire departmental Drive folder tree.
    
    Uses Google Drive API's `name contains` query within the root folder's
    accessible files. The service account only has access to files shared
    with it, so results are inherently scoped to departmental resources.
    
    If folder_id is provided, restricts to that folder and its subfolders
    by first collecting all descendant folder IDs recursively.
    """
    service = get_drive_service()
    root = folder_id or DRIVE_ROOT_FOLDER_ID

    # Escape single quotes in search query for Drive API
    safe_query = query_text.replace("'", "\\'")

    if folder_id:
        # Restricted search: collect all descendant folder IDs, then search within them
        all_folder_ids = _collect_descendant_folders(service, root)
        all_folder_ids.add(root)

        # Drive API doesn't support OR on parents easily, so we batch search
        # across folder groups (max ~10 parents per query to stay within limits)
        all_results = []
        folder_list = list(all_folder_ids)
        batch_size = 10
        for i in range(0, len(folder_list), batch_size):
            batch = folder_list[i : i + batch_size]
            parent_clauses = " or ".join(f"'{fid}' in parents" for fid in batch)
            q = f"name contains '{safe_query}' and trashed = false and ({parent_clauses})"
            fields = "files(id, name, mimeType, size, modifiedTime, parents, thumbnailLink, webViewLink)"
            result = (
                service.files()
                .list(q=q, fields=fields, pageSize=page_size, supportsAllDrives=True, includeItemsFromAllDrives=True)
                .execute()
            )
            all_results.extend(result.get("files", []))
            if len(all_results) >= page_size:
                break
        return all_results[:page_size]
    else:
        # Global search within full root tree — use fullText contains for richer matching
        # fullText searches file name, description, and indexable content
        q = f"(name contains '{safe_query}' or fullText contains '{safe_query}') and trashed = false"
        fields = "files(id, name, mimeType, size, modifiedTime, parents, thumbnailLink, webViewLink)"
        result = (
            service.files()
            .list(q=q, fields=fields, pageSize=page_size, supportsAllDrives=True, includeItemsFromAllDrives=True)
            .execute()
        )
        return result.get("files", [])


def _collect_descendant_folders(service, parent_id: str, max_depth: int = 8) -> set:
    """Recursively collect all subfolder IDs under a given parent folder."""
    folder_ids = set()
    queue = [parent_id]
    depth = 0
    while queue and depth < max_depth:
        next_queue = []
        for pid in queue:
            q = f"'{pid}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            try:
                result = (
                    service.files()
                    .list(q=q, fields="files(id)", pageSize=200, supportsAllDrives=True, includeItemsFromAllDrives=True)
                    .execute()
                )
                for f in result.get("files", []):
                    if f["id"] not in folder_ids:
                        folder_ids.add(f["id"])
                        next_queue.append(f["id"])
            except Exception:
                continue
        queue = next_queue
        depth += 1
    return folder_ids


def get_folder_breadcrumbs(file_id: str, root_id: str) -> List[dict]:
    """
    Build breadcrumb trail from a file/folder up to the root folder.
    Returns list of {id, name} from root → current.
    """
    service = get_drive_service()
    crumbs = []
    current = file_id
    seen = set()
    while current and current != root_id and current not in seen:
        seen.add(current)
        try:
            meta = (
                service.files()
                .get(fileId=current, fields="id, name, parents", supportsAllDrives=True)
                .execute()
            )
            crumbs.append({"id": meta["id"], "name": meta["name"]})
            parents = meta.get("parents", [])
            current = parents[0] if parents else None
        except Exception:
            break

    # Add root itself
    if current == root_id or file_id == root_id:
        try:
            root_meta = (
                service.files()
                .get(fileId=root_id, fields="id, name", supportsAllDrives=True)
                .execute()
            )
            crumbs.append({"id": root_meta["id"], "name": root_meta["name"]})
        except Exception:
            crumbs.append({"id": root_id, "name": "Resources"})

    crumbs.reverse()
    return crumbs


# ── MongoDB cache helpers ────────────────────────────────────

async def get_cached_folder(db, folder_id: str) -> Optional[dict]:
    """Return cached folder listing if it exists and hasn't expired."""
    doc = await db["drive_cache"].find_one({"folderId": folder_id})
    if doc and doc.get("expiresAt", datetime.min.replace(tzinfo=timezone.utc)) > datetime.now(timezone.utc):
        return doc
    return None


async def set_folder_cache(db, folder_id: str, items: list, breadcrumbs: list):
    """Upsert folder listing into cache with TTL."""
    await db["drive_cache"].update_one(
        {"folderId": folder_id},
        {
            "$set": {
                "items": items,
                "breadcrumbs": breadcrumbs,
                "cachedAt": datetime.now(timezone.utc),
                "expiresAt": datetime.now(timezone.utc) + timedelta(seconds=DRIVE_CACHE_TTL),
            }
        },
        upsert=True,
    )
