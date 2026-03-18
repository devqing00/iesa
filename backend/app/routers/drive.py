"""
Google Drive Browser Router

Exposes the departmental Google Drive folder as a navigable resource tree.
Students can browse folders, view file metadata, stream files (PDF, video),
and track their reading progress — all without leaving the app.

Endpoints:
    GET  /api/v1/drive/browse          — List folder contents (cached)
    GET  /api/v1/drive/file/{id}/meta  — Detailed file metadata + embed URL
    GET  /api/v1/drive/file/{id}/stream — Proxy file bytes (PDF, video, image)
    GET  /api/v1/drive/search          — Search files by name
    GET  /api/v1/drive/progress        — Get user's reading progress (all files)
    POST /api/v1/drive/progress        — Upsert reading progress for a file
    GET  /api/v1/drive/recent          — Recently viewed resources
    POST /api/v1/drive/bookmark        — Bookmark a page in a file
    DELETE /api/v1/drive/bookmark      — Remove a bookmark
"""

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.db import get_database
from app.core.security import (
    get_current_user,
    require_ipe_student,
    verify_firebase_id_token_raw,
    verify_token,
)
from app.core.error_handling import safe_detail
from app.core.drive import (
    DRIVE_ROOT_FOLDER_ID,
    list_folder,
    get_file_metadata,
    download_file_bytes,
    export_google_file_pdf_bytes,
    search_files,
    get_folder_breadcrumbs,
    classify_mime,
    is_previewable,
    get_embed_url,
    get_thumbnail_url,
    get_cached_folder,
    set_folder_cache,
    get_cached_cover,
    set_cached_cover,
)

logger = logging.getLogger("iesa_backend")
DRIVE_ENABLE_COVER_PREWARM = os.getenv("DRIVE_ENABLE_COVER_PREWARM", "0").strip().lower() in {"1", "true", "yes", "on"}

router = APIRouter(
    prefix="/api/v1/drive",
    tags=["drive"],
)

optional_bearer = HTTPBearer(auto_error=False)


# ── Pydantic models ─────────────────────────────────────────

class ProgressUpdate(BaseModel):
    fileId: str
    fileName: str
    fileMimeType: str = ""
    currentPage: Optional[int] = None
    totalPages: Optional[int] = None
    currentTime: Optional[float] = None  # For videos — seconds
    totalDuration: Optional[float] = None  # For videos — seconds
    scrollPercent: Optional[float] = None  # For docs — 0-100


class BookmarkCreate(BaseModel):
    fileId: str
    fileName: str
    page: Optional[int] = None
    timestamp: Optional[float] = None  # For videos — seconds
    label: Optional[str] = None


class BookmarkDelete(BaseModel):
    fileId: str
    bookmarkId: str


# ── Helpers ──────────────────────────────────────────────────

def _serialize_item(item: dict) -> dict:
    """Transform a Drive API file dict into a clean frontend-ready dict."""
    item_id = str(item.get("id") or "")
    item_name = str(item.get("name") or item.get("title") or "Untitled resource")
    mime = item.get("mimeType", "")
    file_type = classify_mime(mime)
    is_folder = file_type == "folder"
    size = int(item.get("size", 0)) if item.get("size") else None

    result = {
        "id": item_id,
        "name": item_name,
        "mimeType": mime,
        "fileType": file_type,
        "isFolder": is_folder,
        "size": size,
        "modifiedTime": item.get("modifiedTime"),
        "thumbnailUrl": item.get("thumbnailLink") or (
            get_thumbnail_url(item_id) if (not is_folder and item_id) else None
        ),
        "previewable": is_previewable(mime),
    }

    # Video duration if available
    video_meta = item.get("videoMediaMetadata")
    if video_meta:
        result["durationMs"] = video_meta.get("durationMillis")

    # Image dimensions
    image_meta = item.get("imageMediaMetadata")
    if image_meta:
        result["width"] = image_meta.get("width")
        result["height"] = image_meta.get("height")

    return result


def _pick_cover_item(items: List[dict]) -> Optional[dict]:
    """Pick a representative cover item from serialized folder items."""
    files = [item for item in items if not item.get("isFolder")]
    if not files:
        return None

    return (
        next((item for item in files if item.get("fileType") == "image" and item.get("previewable")), None)
        or next((item for item in files if item.get("fileType") == "image"), None)
        or next((item for item in files if item.get("previewable")), None)
        or files[0]
    )


async def _prewarm_cover_cache(db, folder_ids: List[str]):
    """Warm cover cache for child folders in the background (non-blocking)."""
    if not folder_ids:
        return

    loop = asyncio.get_event_loop()

    async def warm_one(folder_id: str):
        try:
            cached_cover = await get_cached_cover(db, folder_id)
            if cached_cover is not None:
                return

            cached_folder = await get_cached_folder(db, folder_id)
            if cached_folder and isinstance(cached_folder.get("items"), list):
                await set_cached_cover(db, folder_id, _pick_cover_item(cached_folder["items"]))
                return

            items_raw, _ = await loop.run_in_executor(None, lambda: list_folder(folder_id, None, 20))
            items = [_serialize_item(item) for item in items_raw]
            await set_cached_cover(db, folder_id, _pick_cover_item(items))
        except Exception as e:
            logger.debug("Drive cover prewarm skipped for %s: %s", folder_id, e)

    await asyncio.gather(*(warm_one(folder_id) for folder_id in folder_ids[:12]))


async def _stream_auth_user(
    token: Optional[str] = Query(None, description="Firebase access token (query fallback for media tags)"),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(optional_bearer),
):
    """Authenticate stream requests via Authorization header or query token."""
    if credentials:
        token_data = await verify_token(credentials)
    elif token:
        token_data = await verify_firebase_id_token_raw(token)
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_current_user(token_data)
    return await require_ipe_student(user)


# ── Endpoints ────────────────────────────────────────────────

@router.get("/browse")
async def browse_folder(
    folderId: Optional[str] = Query(None, description="Folder ID (omit for root)"),
    pageToken: Optional[str] = Query(None),
    pageSize: int = Query(100, ge=1, le=200),
    user: dict = Depends(require_ipe_student),
):
    """
    List the contents of a Drive folder.
    Results are cached in MongoDB for DRIVE_CACHE_TTL seconds.
    """
    root_id = DRIVE_ROOT_FOLDER_ID
    if not root_id:
        raise HTTPException(
            status_code=503,
            detail="Drive integration not configured. Set DRIVE_ROOT_FOLDER_ID.",
        )

    target_id = folderId or root_id
    db = get_database()
    stale_cached = await db["drive_cache"].find_one({"folderId": target_id}) if not pageToken else None

    # Check cache (only for first page)
    if not pageToken:
        cached = await get_cached_folder(db, target_id)
        if cached:
            return {
                "items": cached["items"],
                "breadcrumbs": cached["breadcrumbs"],
                "folderId": target_id,
                "rootId": root_id,
                "nextPageToken": None,
                "fromCache": True,
            }

    loop = asyncio.get_event_loop()
    try:
        items_raw, next_token = await loop.run_in_executor(
            None, lambda: list_folder(target_id, pageToken, pageSize)
        )
        if not pageToken and not items_raw:
            # Guard against transient empty responses from Drive API.
            retry_items_raw, retry_next_token = await loop.run_in_executor(
                None, lambda: list_folder(target_id, pageToken, pageSize)
            )
            if retry_items_raw:
                items_raw, next_token = retry_items_raw, retry_next_token
        breadcrumbs = await loop.run_in_executor(
            None, lambda: get_folder_breadcrumbs(target_id, root_id)
        )
    except Exception as e:
        logger.error("Drive browse error: %s", e)
        if stale_cached:
            logger.warning("Serving stale Drive cache for folder %s after browse failure", target_id)
            return {
                "items": stale_cached.get("items", []),
                "breadcrumbs": stale_cached.get("breadcrumbs", [{"id": root_id, "name": "Resources"}]),
                "folderId": target_id,
                "rootId": root_id,
                "nextPageToken": None,
                "fromCache": True,
                "stale": True,
            }
        raise HTTPException(status_code=502, detail=safe_detail("Failed to browse Drive folder", e))

    items = [_serialize_item(i) for i in items_raw]

    # Non-blocking: warm cover cache for child folders to speed gallery cards
    if not pageToken and DRIVE_ENABLE_COVER_PREWARM:
        child_folder_ids = [item["id"] for item in items if item.get("isFolder")]
        if child_folder_ids:
            asyncio.create_task(_prewarm_cover_cache(db, child_folder_ids[:4]))

    # Cache first-page results
    if not pageToken:
        try:
            await set_folder_cache(db, target_id, items, breadcrumbs)
        except Exception as cache_err:
            logger.warning("Failed to cache Drive folder %s: %s", target_id, cache_err)

    return {
        "items": items,
        "breadcrumbs": breadcrumbs,
        "folderId": target_id,
        "rootId": root_id,
        "nextPageToken": next_token,
        "fromCache": False,
    }


@router.get("/file/{file_id}/meta")
async def file_metadata(
    file_id: str,
    user: dict = Depends(require_ipe_student),
):
    """Get detailed metadata for a single file, including embed URL and progress."""
    loop = asyncio.get_event_loop()
    try:
        meta = await loop.run_in_executor(None, lambda: get_file_metadata(file_id))
    except Exception as e:
        logger.error("Drive file metadata error: %s", e)
        raise HTTPException(status_code=502, detail=safe_detail("Failed to fetch file metadata", e))

    mime = meta.get("mimeType", "")
    embed = get_embed_url(file_id, mime)

    # Get user's progress for this file
    db = get_database()
    user_id = user.get("_id") if isinstance(user.get("_id"), str) else str(user.get("_id", ""))
    progress = await db["drive_progress"].find_one(
        {"userId": user_id, "fileId": file_id},
        {"_id": 0, "userId": 0},
    )
    bookmarks = await db["drive_bookmarks"].find(
        {"userId": user_id, "fileId": file_id}
    ).sort("createdAt", 1).to_list(length=50)
    for b in bookmarks:
        b["_id"] = str(b["_id"])
        b.pop("userId", None)

    return {
        "id": meta["id"],
        "name": meta["name"],
        "mimeType": mime,
        "fileType": classify_mime(mime),
        "size": int(meta.get("size", 0)) if meta.get("size") else None,
        "modifiedTime": meta.get("modifiedTime"),
        "createdTime": meta.get("createdTime"),
        "description": meta.get("description"),
        "previewable": is_previewable(mime),
        "embedUrl": embed,
        "thumbnailUrl": meta.get("thumbnailLink") or get_thumbnail_url(file_id),
        "webViewLink": meta.get("webViewLink"),
        "progress": progress,
        "bookmarks": bookmarks,
    }


@router.get("/file/{file_id}/stream")
async def stream_file(
    file_id: str,
    download: bool = Query(False, description="Force download as attachment"),
    user: dict = Depends(_stream_auth_user),
):
    """
    Proxy-stream a Drive file's bytes to the browser.
    Used for PDFs (via react-pdf), videos (via <video>), and images.
    """
    loop = asyncio.get_event_loop()

    # Fetch metadata to get MIME type
    try:
        meta = await loop.run_in_executor(None, lambda: get_file_metadata(file_id))
    except Exception as e:
        raise HTTPException(status_code=502, detail=safe_detail("Failed to fetch file", e))

    mime = meta.get("mimeType", "application/octet-stream")

    # Google-native docs can't be streamed directly — redirect to export
    if mime.startswith("application/vnd.google-apps."):
        embed = get_embed_url(file_id, mime)
        if embed:
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=embed)
        raise HTTPException(status_code=400, detail="This file type cannot be streamed directly. Use the embed URL.")

    # Download file bytes
    try:
        buf = await loop.run_in_executor(None, lambda: download_file_bytes(file_id))
    except Exception as e:
        raise HTTPException(status_code=502, detail=safe_detail("Failed to download file", e))

    if buf.getbuffer().nbytes == 0:
        try:
            buf = await loop.run_in_executor(None, lambda: download_file_bytes(file_id))
        except Exception:
            pass

    if buf.getbuffer().nbytes == 0:
        raise HTTPException(status_code=502, detail="Drive returned an empty file stream. Please retry.")

    file_size = buf.getbuffer().nbytes
    file_name = meta.get("name", "download")

    disposition = "attachment" if download else "inline"

    headers = {
        "Content-Disposition": f'{disposition}; filename="{file_name}"',
        "Content-Length": str(file_size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
    }

    return StreamingResponse(
        buf,
        media_type=mime,
        headers=headers,
    )


@router.get("/file/{file_id}/export-pdf")
async def export_file_as_pdf(
    file_id: str,
    download: bool = Query(True, description="Download PDF as attachment"),
    user: dict = Depends(_stream_auth_user),
):
    """Convert supported Google-native files to PDF and stream the result."""
    loop = asyncio.get_event_loop()

    try:
        meta = await loop.run_in_executor(None, lambda: get_file_metadata(file_id))
    except Exception as e:
        raise HTTPException(status_code=502, detail=safe_detail("Failed to fetch file", e))

    mime = meta.get("mimeType", "")
    convertible_mimes = {
        "application/vnd.google-apps.document",
        "application/vnd.google-apps.spreadsheet",
        "application/vnd.google-apps.presentation",
    }
    if mime not in convertible_mimes:
        raise HTTPException(
            status_code=400,
            detail="PDF conversion is only available for Google Docs, Sheets, and Slides.",
        )

    try:
        buf = await loop.run_in_executor(None, lambda: export_google_file_pdf_bytes(file_id))
    except Exception as e:
        raise HTTPException(status_code=502, detail=safe_detail("Failed to convert file to PDF", e))

    if buf.getbuffer().nbytes == 0:
        try:
            buf = await loop.run_in_executor(None, lambda: export_google_file_pdf_bytes(file_id))
        except Exception:
            pass

    if buf.getbuffer().nbytes == 0:
        raise HTTPException(status_code=502, detail="Drive returned an empty PDF export. Please retry.")

    base_name = meta.get("name", "resource")
    if "." in base_name:
        base_name = base_name.rsplit(".", 1)[0]
    file_name = f"{base_name}.pdf"
    disposition = "attachment" if download else "inline"

    headers = {
        "Content-Disposition": f'{disposition}; filename="{file_name}"',
        "Content-Length": str(buf.getbuffer().nbytes),
        "Cache-Control": "private, max-age=3600",
    }

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers=headers,
    )


@router.get("/search")
async def search_drive(
    q: str = Query(..., min_length=2, max_length=100, description="Search query"),
    folderId: Optional[str] = Query(None, description="Restrict search to folder"),
    user: dict = Depends(require_ipe_student),
):
    """Search files by name within the departmental Drive."""
    loop = asyncio.get_event_loop()
    try:
        results = await loop.run_in_executor(
            None, lambda: search_files(q, folderId)
        )
    except Exception as e:
        logger.error("Drive search error: %s", e)
        raise HTTPException(status_code=502, detail=safe_detail("Drive search failed", e))

    safe_results: list[dict] = []
    for raw in results:
        try:
            serialized = _serialize_item(raw)
            if serialized.get("id"):
                safe_results.append(serialized)
            else:
                logger.warning("Drive search skipping item without id: keys=%s", list(raw.keys()))
        except Exception as e:
            logger.warning("Drive search skipping malformed item: %s", e)

    return {
        "results": safe_results,
        "query": q,
    }


@router.get("/covers")
async def get_folder_covers(
    folder_ids: str = Query(..., description="Comma-separated folder IDs"),
    user: dict = Depends(require_ipe_student),
):
    """Get representative cover items for many folders in one request (cached)."""
    db = get_database()
    loop = asyncio.get_event_loop()

    folder_list = [folder_id.strip() for folder_id in folder_ids.split(",") if folder_id.strip()]
    # preserve order while deduplicating
    seen = set()
    folder_list = [folder_id for folder_id in folder_list if not (folder_id in seen or seen.add(folder_id))]

    if not folder_list:
        return {"covers": {}, "count": 0}

    if len(folder_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 folder IDs per request")

    async def resolve_cover(folder_id: str):
        cached_cover = await get_cached_cover(db, folder_id)
        if cached_cover is not None:
            return folder_id, cached_cover

        cached_folder = await get_cached_folder(db, folder_id)
        if cached_folder and isinstance(cached_folder.get("items"), list):
            cover = _pick_cover_item(cached_folder["items"])
            await set_cached_cover(db, folder_id, cover)
            return folder_id, cover

        try:
            items_raw, _ = await loop.run_in_executor(
                None, lambda: list_folder(folder_id, None, 20)
            )
            items = [_serialize_item(item) for item in items_raw]
            cover = _pick_cover_item(items)
            await set_cached_cover(db, folder_id, cover)
            return folder_id, cover
        except Exception as e:
            logger.warning("Drive cover fetch failed for folder %s: %s", folder_id, e)
            return folder_id, None

    results = await asyncio.gather(*(resolve_cover(folder_id) for folder_id in folder_list))
    covers: Dict[str, Optional[dict]] = {folder_id: cover for folder_id, cover in results}

    return {
        "covers": covers,
        "count": len(covers),
    }


# ── Progress Tracking ────────────────────────────────────────

@router.get("/progress")
async def get_all_progress(
    user: dict = Depends(require_ipe_student),
):
    """Get reading/viewing progress for all files the user has opened."""
    db = get_database()
    user_id = user.get("_id") if isinstance(user.get("_id"), str) else str(user.get("_id", ""))
    docs = await db["drive_progress"].find(
        {"userId": user_id},
        {"_id": 0, "userId": 0},
    ).sort("lastOpenedAt", -1).to_list(length=500)
    return {"progress": docs}


@router.post("/progress")
async def upsert_progress(
    body: ProgressUpdate,
    user: dict = Depends(require_ipe_student),
):
    """Create or update reading/viewing progress for a file."""
    db = get_database()
    user_id = user.get("_id") if isinstance(user.get("_id"), str) else str(user.get("_id", ""))
    now = datetime.now(timezone.utc)

    # Calculate percent complete
    pct = None
    if body.currentPage and body.totalPages and body.totalPages > 0:
        pct = round((body.currentPage / body.totalPages) * 100, 1)
    elif body.currentTime and body.totalDuration and body.totalDuration > 0:
        pct = round((body.currentTime / body.totalDuration) * 100, 1)
    elif body.scrollPercent is not None:
        pct = round(body.scrollPercent, 1)

    update: dict = {
        "$set": {
            "fileName": body.fileName,
            "fileMimeType": body.fileMimeType,
            "lastOpenedAt": now,
            "percentComplete": pct,
        },
        "$setOnInsert": {
            "userId": user_id,
            "fileId": body.fileId,
            "firstOpenedAt": now,
        },
        "$inc": {"openCount": 1},
    }

    # Only set fields that are provided
    if body.currentPage is not None:
        update["$set"]["currentPage"] = body.currentPage
    if body.totalPages is not None:
        update["$set"]["totalPages"] = body.totalPages
    if body.currentTime is not None:
        update["$set"]["currentTime"] = body.currentTime
    if body.totalDuration is not None:
        update["$set"]["totalDuration"] = body.totalDuration

    await db["drive_progress"].update_one(
        {"userId": user_id, "fileId": body.fileId},
        update,
        upsert=True,
    )

    return {"ok": True}


@router.get("/recent")
async def get_recent(
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(require_ipe_student),
):
    """Get recently viewed files sorted by last opened."""
    db = get_database()
    user_id = user.get("_id") if isinstance(user.get("_id"), str) else str(user.get("_id", ""))
    docs = await db["drive_progress"].find(
        {"userId": user_id},
        {"_id": 0, "userId": 0},
    ).sort("lastOpenedAt", -1).to_list(length=limit)
    return {"recent": docs}


# ── Bookmarks ────────────────────────────────────────────────

@router.post("/bookmark")
async def create_bookmark(
    body: BookmarkCreate,
    user: dict = Depends(require_ipe_student),
):
    """Bookmark a specific page/timestamp in a file."""
    db = get_database()
    user_id = user.get("_id") if isinstance(user.get("_id"), str) else str(user.get("_id", ""))
    now = datetime.now(timezone.utc)

    doc = {
        "userId": user_id,
        "fileId": body.fileId,
        "fileName": body.fileName,
        "page": body.page,
        "timestamp": body.timestamp,
        "label": body.label or (f"Page {body.page}" if body.page else f"{body.timestamp:.0f}s"),
        "createdAt": now,
    }
    result = await db["drive_bookmarks"].insert_one(doc)
    return {"ok": True, "bookmarkId": str(result.inserted_id)}


@router.delete("/bookmark")
async def delete_bookmark(
    body: BookmarkDelete,
    user: dict = Depends(require_ipe_student),
):
    """Remove a bookmark."""
    db = get_database()
    user_id = user.get("_id") if isinstance(user.get("_id"), str) else str(user.get("_id", ""))
    result = await db["drive_bookmarks"].delete_one(
        {"_id": ObjectId(body.bookmarkId), "userId": user_id, "fileId": body.fileId}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return {"ok": True}
