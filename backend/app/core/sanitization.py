"""
Input Sanitization Utilities

Prevents XSS attacks by sanitizing user input.
Strips HTML tags and dangerous characters from text fields.
"""

import re
import html
from typing import Any, Dict, List, Union, Optional


def sanitize_html(text: str, allow_tags: Optional[List[str]] = None) -> str:
    """
    Remove HTML tags from text to prevent XSS attacks.
    
    Args:
        text: Input text that may contain HTML
        allow_tags: List of allowed HTML tags (e.g., ['b', 'i', 'u'])
                   If None, all tags are stripped
    
    Returns:
        Sanitized text with HTML entities escaped
    """
    if not text or not isinstance(text, str):
        return text
    
    if allow_tags is None:
        # Strip all HTML tags
        text = re.sub(r'<[^>]+>', '', text)
    else:
        # Strip all tags except allowed ones
        allowed_pattern = '|'.join(allow_tags)
        text = re.sub(
            r'<(?!\s*\/?\s*(' + allowed_pattern + r')\b)[^>]*>',
            '',
            text
        )
    
    # Escape remaining HTML entities
    text = html.escape(text, quote=False)
    
    return text.strip()


def sanitize_string(text: str, max_length: Optional[int] = None) -> str:
    """
    Basic string sanitization:
    - Remove leading/trailing whitespace
    - Replace multiple spaces with single space
    - Optionally truncate to max length
    
    Args:
        text: Input string
        max_length: Maximum allowed length (None for no limit)
    
    Returns:
        Sanitized string
    """
    if not text or not isinstance(text, str):
        return text
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    # Replace multiple spaces with single space
    text = re.sub(r'\s+', ' ', text)
    
    # Truncate if needed
    if max_length and len(text) > max_length:
        text = text[:max_length].strip()
    
    return text


def sanitize_dict(data: Dict[str, Any], fields_to_sanitize: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Sanitize specific fields in a dictionary.
    
    Args:
        data: Input dictionary
        fields_to_sanitize: List of field names to sanitize (None = all string fields)
    
    Returns:
        Dictionary with sanitized fields
    """
    if not data or not isinstance(data, dict):
        return data
    
    sanitized = {}
    
    for key, value in data.items():
        # Determine if this field should be sanitized
        should_sanitize = (
            fields_to_sanitize is None or 
            key in fields_to_sanitize
        )
        
        if should_sanitize and isinstance(value, str):
            # Sanitize string fields
            sanitized[key] = sanitize_html(value)
        elif isinstance(value, dict):
            # Recursively sanitize nested dicts
            sanitized[key] = sanitize_dict(value, fields_to_sanitize)
        elif isinstance(value, list):
            # Sanitize list items if they're strings
            sanitized[key] = [
                sanitize_html(item) if isinstance(item, str) else item
                for item in value
            ]
        else:
            # Keep non-string values as-is
            sanitized[key] = value
    
    return sanitized


# Common text fields that should be sanitized
TEXT_FIELDS = [
    'title', 'description', 'content', 'body', 'message',
    'name', 'firstName', 'lastName', 'bio', 'location',
    'venue', 'caption', 'note', 'reason', 'details'
]


def sanitize_request_data(data: Union[Dict, List, str], strict: bool = True) -> Union[Dict, List, str]:
    """
    Main sanitization function for request data.
    
    Args:
        data: Request body (dict, list, or string)
        strict: If True, sanitize all text fields. If False, only sanitize known dangerous fields
    
    Returns:
        Sanitized data
    """
    if isinstance(data, str):
        return sanitize_html(data)
    
    elif isinstance(data, dict):
        fields = TEXT_FIELDS if strict else None
        return sanitize_dict(data, fields)
    
    elif isinstance(data, list):
        return [sanitize_request_data(item, strict) for item in data]
    
    else:
        return data


def validate_no_scripts(text: str) -> bool:
    """
    Check if text contains script tags or javascript: protocol.
    
    Args:
        text: Input text
    
    Returns:
        True if safe, False if contains dangerous patterns
    """
    if not text or not isinstance(text, str):
        return True
    
    dangerous_patterns = [
        r'<script[^>]*>',
        r'javascript:',
        r'on\w+\s*=',  # Event handlers like onclick=
        r'<iframe[^>]*>',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return False
    
    return True
