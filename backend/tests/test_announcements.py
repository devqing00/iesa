"""
Tests for Announcement Router & Personalization Services
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.routers.announcements import (
    _notify_students_of_announcement,
    _fire_announcement_notifications,
)
from app.models.announcement import Attachment


@pytest.mark.asyncio
async def test_notify_students_personalization_and_attachments():
    """Verify students receive personalized email content and attachments."""
    mock_db = MagicMock()
    mock_cursor = MagicMock()
    student_1_id = ObjectId()
    student_2_id = ObjectId()
    mock_cursor.to_list = AsyncMock(
        return_value=[
            {
                "_id": student_1_id,
                "email": "alex@example.com",
                "firstName": "Alex",
                "lastName": "Adeyemi",
                "matricNumber": "219876",
                "currentLevel": "300L",
                "department": "Industrial Engineering",
            },
            {
                "_id": student_2_id,
                "email": "chioma@example.com",
                "firstName": "Chioma",
                "lastName": "Okonkwo",
                "matricNumber": "218492",
                "currentLevel": "400L",
                "department": "Industrial Engineering",
            },
        ]
    )
    mock_db["users"].find.return_value = mock_cursor

    attachments = [
        {
            "name": "Syllabus.pdf",
            "url": "https://res.cloudinary.com/test/raw/upload/syllabus.pdf",
            "fileType": "pdf",
            "size": 2048,
        }
    ]

    with patch("app.routers.announcements._resolve_target_user_ids", new_callable=AsyncMock) as mock_resolve, \
         patch("app.routers.announcements.send_announcement_email", new_callable=AsyncMock) as mock_send_email:

        mock_resolve.return_value = [str(student_1_id), str(student_2_id)]

        await _notify_students_of_announcement(
            session_id="session-1",
            target_levels=["300L", "400L"],
            title="Important for {{first_name}} ({{level}})",
            content="<p>Dear {{student_name}}, your matric is {{matric_no}}.</p>",
            priority="high",
            db=mock_db,
            target_audience="all",
            target_user_ids=[],
            attachments=attachments,
        )

        assert mock_send_email.call_count == 2

        # Check Alex's email
        call_1_kwargs = mock_send_email.call_args_list[0].kwargs
        assert call_1_kwargs["to"] == "alex@example.com"
        assert call_1_kwargs["student_name"] == "Alex Adeyemi"
        assert "Important for Alex (300L)" in call_1_kwargs["title"]
        assert "Dear Alex Adeyemi, your matric is 219876." in call_1_kwargs["content"]
        assert len(call_1_kwargs["attachments"]) == 1
        assert call_1_kwargs["attachments"][0]["name"] == "Syllabus.pdf"

        # Check Chioma's email
        call_2_kwargs = mock_send_email.call_args_list[1].kwargs
        assert call_2_kwargs["to"] == "chioma@example.com"
        assert call_2_kwargs["student_name"] == "Chioma Okonkwo"
        assert "Important for Chioma (400L)" in call_2_kwargs["title"]
        assert "Dear Chioma Okonkwo, your matric is 218492." in call_2_kwargs["content"]


@pytest.mark.asyncio
async def test_fire_announcement_notifications_html_stripping():
    """Verify HTML tags are stripped from in-app notification bell previews."""
    mock_db = MagicMock()
    user_id = ObjectId()
    ann_id = ObjectId()

    with patch("app.routers.announcements._resolve_target_user_ids", new_callable=AsyncMock) as mock_resolve, \
         patch("app.routers.notifications.create_bulk_notifications", new_callable=AsyncMock) as mock_bulk:

        mock_resolve.return_value = [str(user_id)]

        rich_html = "<h1>Attention!</h1><p>Please check the <strong>new schedule</strong>.</p>"
        ann_doc = {
            "_id": ann_id,
            "title": "Semester Update",
            "content": rich_html,
            "sessionId": "sess-1",
            "targetLevels": ["300L"],
            "targetAudience": "all",
        }

        await _fire_announcement_notifications(ann_doc, mock_db)

        mock_bulk.assert_awaited_once()
        sent_message = mock_bulk.call_args.kwargs["message"]
        # HTML tags should be stripped
        assert "<p>" not in sent_message
        assert "<h1>" not in sent_message
        assert "<strong>" not in sent_message
        assert "Attention! Please check the new schedule." in sent_message


@pytest.mark.asyncio
async def test_notify_students_custom_emails_registered_and_external():
    """Verify custom email list sends to both registered students (personalized) and external guests."""
    from app.routers.announcements import _resolve_target_user_ids, _user_matches_target_audience

    mock_db = MagicMock()
    mock_cursor = MagicMock()
    reg_student_id = ObjectId()
    mock_cursor.to_list = AsyncMock(
        return_value=[
            {
                "_id": reg_student_id,
                "email": "student@ui.edu.ng",
                "firstName": "Tolu",
                "lastName": "Fashola",
                "matricNumber": "210999",
                "currentLevel": "500L",
                "department": "Industrial Engineering",
            }
        ]
    )
    mock_db["users"].find.return_value = mock_cursor

    custom_list = [
        "student@ui.edu.ng",
        "STUDENT@UI.EDU.NG",  # duplicate with casing
        "external.guest@gmail.com",
    ]

    with patch("app.routers.announcements.send_announcement_email", new_callable=AsyncMock) as mock_send_email:
        await _notify_students_of_announcement(
            session_id="session-1",
            target_levels=None,
            title="Update for {{first_name}}",
            content="Hello {{student_name}}, your dept is {{department}}.",
            priority="normal",
            db=mock_db,
            target_audience="custom_emails",
            custom_emails=custom_list,
        )

        # Deduplication: 3 inputs with 1 duplicate -> 2 dispatched emails
        assert mock_send_email.call_count == 2

        calls = {c.kwargs["to"]: c.kwargs for c in mock_send_email.call_args_list}
        assert "student@ui.edu.ng" in calls
        assert "external.guest@gmail.com" in calls

        # Registered student resolved from DB
        assert calls["student@ui.edu.ng"]["student_name"] == "Tolu Fashola"
        assert "Update for Tolu" in calls["student@ui.edu.ng"]["title"]
        assert "Hello Tolu Fashola, your dept is Industrial Engineering." in calls["student@ui.edu.ng"]["content"]

        # External recipient synthesized
        assert calls["external.guest@gmail.com"]["student_name"] == "External Guest"
        assert "Update for External" in calls["external.guest@gmail.com"]["title"]
        assert "Hello External Guest, your dept is External." in calls["external.guest@gmail.com"]["content"]


@pytest.mark.asyncio
async def test_resolve_target_user_ids_custom_emails():
    """Verify registered student IDs are resolved from custom email list."""
    from app.routers.announcements import _resolve_target_user_ids

    mock_db = MagicMock()
    mock_cursor = MagicMock()
    reg_id = ObjectId()
    mock_cursor.to_list = AsyncMock(return_value=[{"_id": reg_id}])
    mock_db["users"].find.return_value = mock_cursor

    uids = await _resolve_target_user_ids(
        mock_db,
        session_id="sess-1",
        target_levels=[],
        target_audience="custom_emails",
        target_user_ids=[],
        custom_emails=["student@ui.edu.ng", "unregistered@external.org"],
    )

    assert uids == [str(reg_id)]
    find_query = mock_db["users"].find.call_args[0][0]
    assert "$or" in find_query


def test_announcement_email_template_rendering_with_rich_html():
    """Verify EmailService renders rich HTML and sanitizes scripts with re without NameError."""
    from app.core.email import EmailService, EmailTemplate

    service = EmailService()
    subject, html = service._render_template(
        EmailTemplate.ANNOUNCEMENT,
        {
            "student_name": "Alex Adeyemi",
            "title": "Special Workshop Announcement",
            "content": "<p>Hello <b>world</b>!</p><script>alert('bad')</script>",
            "priority": "urgent",
            "target_label": "300L Students",
            "attachments": [
                {"name": "Guide.pdf", "url": "https://example.com/guide.pdf", "size": 1024000}
            ],
        },
    )

    assert "Special Workshop Announcement" in subject
    assert "Hello <b>world</b>!" in html
    assert "<script>" not in html
    assert "Guide.pdf" in html
    assert "1000 KB" in html

