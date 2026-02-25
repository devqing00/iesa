"""
Notification Utilities

Centralized helpers for resolving notification email addresses
based on each user's `notificationEmailPreference` field.

Also provides a helper that determines whether to send email,
in-app notification, or both based on `notificationChannelPreference`.
"""

from typing import List
import logging

logger = logging.getLogger("iesa_backend")


def get_notification_emails(user_doc: dict) -> List[str]:
    """
    Return the email address(es) to send notifications to,
    based on the user's notificationEmailPreference.

    Preference rules:
    - "primary" → primary email only
    - "secondary" → secondary email if verified, else fallback to primary
    - "both" → both emails (secondary only if verified)

    Always returns at least one email (the primary).
    """
    primary = user_doc.get("email", "")
    secondary = user_doc.get("secondaryEmail")
    secondary_verified = user_doc.get("secondaryEmailVerified", False)
    preference = user_doc.get("notificationEmailPreference", "primary")

    if preference == "secondary":
        if secondary and secondary_verified:
            return [secondary]
        # Fallback to primary if secondary not available or not verified
        logger.warning(
            f"User {user_doc.get('_id')} prefers secondary email but it is "
            f"{'not verified' if secondary else 'not set'}. Falling back to primary."
        )
        return [primary] if primary else []

    if preference == "both":
        emails = [primary] if primary else []
        if secondary and secondary_verified:
            emails.append(secondary)
        return emails

    # Default: "primary"
    return [primary] if primary else []


def should_send_email(user_doc: dict) -> bool:
    """
    Check if the user wants email notifications.
    Based on `notificationChannelPreference`:
    - "email" → True
    - "both" → True
    - "in_app" → False
    """
    pref = user_doc.get("notificationChannelPreference", "both")
    return pref in ("email", "both")


def should_send_in_app(user_doc: dict) -> bool:
    """
    Check if the user wants in-app notifications.
    Based on `notificationChannelPreference`:
    - "in_app" → True
    - "both" → True
    - "email" → False
    """
    pref = user_doc.get("notificationChannelPreference", "both")
    return pref in ("in_app", "both")
