from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.main import app
from app.routers import drive as drive_router


class FakeDriveResponse:
    def __init__(self, status_code: int, headers: dict[str, str], chunks: list[bytes], text: str = ""):
        self.status_code = status_code
        self.headers = headers
        self._chunks = chunks
        self.text = text
        self.closed = False

    def iter_content(self, chunk_size: int = 65536):
        for chunk in self._chunks:
            yield chunk

    def close(self):
        self.closed = True


@pytest.fixture
def override_drive_auth_dependencies():
    async def fake_stream_user():
        return {
            "_id": "507f1f77bcf86cd799439011",
            "role": "student",
            "department": "Industrial Engineering",
        }

    async def fake_require_ipe_student():
        return {
            "_id": "507f1f77bcf86cd799439011",
            "role": "student",
            "department": "Industrial Engineering",
        }

    app.dependency_overrides[drive_router._stream_auth_user] = fake_stream_user
    app.dependency_overrides[drive_router.require_ipe_student] = fake_require_ipe_student
    yield
    app.dependency_overrides.pop(drive_router._stream_auth_user, None)
    app.dependency_overrides.pop(drive_router.require_ipe_student, None)


@pytest.mark.asyncio
async def test_stream_endpoint_passthroughs_range_and_partial_status(client, monkeypatch, override_drive_auth_dependencies):
    captured = {}

    def fake_get_file_metadata(_file_id: str):
        return {
            "mimeType": "application/pdf",
            "name": "sample.pdf",
        }

    def fake_open_drive_file_stream(_file_id: str, range_header: str | None = None):
        captured["range"] = range_header
        return FakeDriveResponse(
            status_code=206,
            headers={
                "content-range": "bytes 0-99/500",
                "accept-ranges": "bytes",
                "content-length": "100",
            },
            chunks=[b"x" * 100],
        )

    monkeypatch.setattr(drive_router, "get_file_metadata", fake_get_file_metadata)
    monkeypatch.setattr(drive_router, "open_drive_file_stream", fake_open_drive_file_stream)

    res = await client.get(
        "/api/v1/drive/file/f1/stream",
        headers={"Range": "bytes=0-99"},
    )

    assert res.status_code == 206
    assert res.headers.get("content-range") == "bytes 0-99/500"
    assert res.headers.get("accept-ranges") == "bytes"
    assert res.headers.get("content-length") == "100"
    assert captured["range"] == "bytes=0-99"
    assert len(res.content) == 100


@pytest.mark.asyncio
async def test_viewer_telemetry_endpoint_persists_snapshot(client, monkeypatch, override_drive_auth_dependencies):
    telemetry_collection = SimpleNamespace(insert_one=AsyncMock())

    class FakeDB(dict):
        def __getitem__(self, key):
            if key == "drive_viewer_telemetry":
                return telemetry_collection
            raise KeyError(key)

    monkeypatch.setattr(drive_router, "get_database", lambda: FakeDB())

    payload = {
        "fileId": "f1",
        "fileName": "Large.pdf",
        "fileMimeType": "application/pdf",
        "eventType": "loaded",
        "totalPages": 300,
        "currentPage": 1,
        "renderedPagesCount": 5,
        "peakRenderedPages": 7,
        "zoom": 1,
        "devicePixelRatio": 1.25,
        "lowMemoryMode": True,
        "cacheStatus": "cached",
        "loadDurationMs": 312,
    }

    res = await client.post("/api/v1/drive/viewer-telemetry", json=payload)

    assert res.status_code == 200
    assert res.json().get("ok") is True
    telemetry_collection.insert_one.assert_awaited_once()
    inserted = telemetry_collection.insert_one.await_args.args[0]
    assert inserted["fileId"] == "f1"
    assert inserted["eventType"] == "loaded"
    assert inserted["renderedPagesCount"] == 5


@pytest.mark.asyncio
async def test_page_note_upsert_endpoint_saves_note(client, monkeypatch, override_drive_auth_dependencies):
    notes_collection = SimpleNamespace(update_one=AsyncMock())

    class FakeDB(dict):
        def __getitem__(self, key):
            if key == "drive_page_notes":
                return notes_collection
            raise KeyError(key)

    monkeypatch.setattr(drive_router, "get_database", lambda: FakeDB())

    payload = {
        "fileId": "f1",
        "fileName": "Large.pdf",
        "page": 14,
        "note": "Key equation summary",
    }

    res = await client.post("/api/v1/drive/page-note", json=payload)

    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["deleted"] is False
    notes_collection.update_one.assert_awaited_once()
    call_args = notes_collection.update_one.await_args.args
    assert call_args[0]["page"] == 14
