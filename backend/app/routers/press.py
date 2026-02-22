"""
Press Router — Association Blog / Press Unit

Public endpoints (no auth):
  GET  /api/v1/press/published          — published articles list
  GET  /api/v1/press/published/{slug}   — single published article

Author endpoints (press unit member):
  GET  /api/v1/press/my-articles        — author's own articles
  POST /api/v1/press/                   — create article (draft)
  PUT  /api/v1/press/{id}               — update draft/revision article
  POST /api/v1/press/{id}/submit        — submit for review
  DEL  /api/v1/press/{id}               — delete own draft

Reviewer / Press-Head endpoints:
  GET  /api/v1/press/review-queue       — articles awaiting review
  GET  /api/v1/press/all                — all articles (any status)
  POST /api/v1/press/{id}/start-review  — mark as in_review
  POST /api/v1/press/{id}/approve       — approve article
  POST /api/v1/press/{id}/reject        — reject article
  POST /api/v1/press/{id}/request-revision — request changes + feedback
  POST /api/v1/press/{id}/feedback      — add feedback comment
  POST /api/v1/press/{id}/publish       — flip approved → published
  POST /api/v1/press/{id}/unpublish     — unpublish (back to approved)
  POST /api/v1/press/{id}/archive       — archive an article

Like (any authenticated user):
  POST /api/v1/press/{id}/like          — toggle like on published article
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import re

from app.models.press import (
    Article, ArticleCreate, ArticleUpdate,
    ArticlePublic, Feedback, FeedbackCreate,
)
from app.db import get_database
from app.core.security import get_current_user, verify_token
from app.core.sanitization import sanitize_html, validate_no_scripts

router = APIRouter(prefix="/api/v1/press", tags=["Press"])


# ─── Helpers ────────────────────────────────────────────

def _slugify(text: str) -> str:
    """Generate URL-friendly slug from title."""
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:120]


async def _check_press_member(user: dict, db) -> bool:
    """Check if user is a press unit member (has any press permission in their role).
    Super admins always have access."""
    roles = db["roles"]
    
    # Check for super admin (omnipotent access)
    super_admin = await roles.find_one({
        "userId": user["_id"],
        "position": "super_admin",
        "isActive": True
    })
    if super_admin:
        return True
    
    # Check for press-specific permissions or position
    user_role = await roles.find_one({
        "userId": user["_id"],
        "$or": [
            {"permissions": {"$in": ["press:write", "press:review", "press:publish", "press:manage"]}},
            {"position": {"$regex": "press", "$options": "i"}},
        ]
    })
    return user_role is not None


async def _check_press_head(user: dict, db) -> bool:
    """Check if user has press review/publish permissions (unit head).
    Super admins always have access."""
    roles = db["roles"]
    
    # Check for super admin (omnipotent access)
    super_admin = await roles.find_one({
        "userId": user["_id"],
        "position": "super_admin",
        "isActive": True
    })
    if super_admin:
        return True
    
    # Check for press head permissions
    user_role = await roles.find_one({
        "userId": user["_id"],
        "permissions": {"$in": ["press:review", "press:publish", "press:manage"]},
    })
    return user_role is not None


def _article_dict(doc: dict) -> dict:
    """Convert MongoDB document to serialisable dict."""
    doc["_id"] = str(doc["_id"])
    return doc


# ══════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS (no auth required)
# ══════════════════════════════════════════════════════════

@router.get("/published", response_model=List[ArticlePublic])
async def list_published_articles(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
):
    """List all published articles (public, no auth)."""
    db = get_database()
    articles = db["press_articles"]

    query: dict = {"status": "published"}
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"excerpt": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
        ]

    cursor = articles.find(query).sort("publishedAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_article_dict(d) for d in docs]


@router.get("/published/{slug}")
async def get_published_article(slug: str):
    """Get a single published article by slug (public, no auth). Increments view count."""
    db = get_database()
    articles = db["press_articles"]

    doc = await articles.find_one({"slug": slug, "status": "published"})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")

    # Increment view count
    await articles.update_one({"_id": doc["_id"]}, {"$inc": {"viewCount": 1}})
    doc["viewCount"] = doc.get("viewCount", 0) + 1

    # Strip sensitive fields from public response
    result = _article_dict(doc)
    result.pop("likedBy", None)
    return result


# ══════════════════════════════════════════════════════════
# AUTHOR ENDPOINTS (press unit members)
# ══════════════════════════════════════════════════════════

@router.get("/my-articles", response_model=List[Article])
async def list_my_articles(
    article_status: Optional[str] = Query(None, alias="status"),
    user: dict = Depends(get_current_user),
):
    """List articles authored by the current user."""
    db = get_database()
    articles = db["press_articles"]

    is_member = await _check_press_member(user, db)
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a press unit member")

    query: dict = {"authorId": user["_id"]}
    if article_status:
        query["status"] = article_status

    cursor = articles.find(query).sort("updatedAt", -1)
    docs = await cursor.to_list(length=100)
    return [_article_dict(d) for d in docs]


@router.post("/", response_model=Article, status_code=201)
async def create_article(
    payload: ArticleCreate,
    user: dict = Depends(get_current_user),
):
    """Create a new draft article."""
    db = get_database()
    articles = db["press_articles"]

    is_member = await _check_press_member(user, db)
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a press unit member")

    # Sanitize
    if not validate_no_scripts(payload.title):
        raise HTTPException(400, "Invalid characters in title")
    clean_content = sanitize_html(payload.content)

    # Generate unique slug
    base_slug = _slugify(payload.title)
    slug = base_slug
    counter = 1
    while await articles.find_one({"slug": slug}):
        slug = f"{base_slug}-{counter}"
        counter += 1

    now = datetime.utcnow()
    author_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get("email", "Author")

    doc = {
        "title": payload.title,
        "content": clean_content,
        "excerpt": payload.excerpt or "",
        "category": payload.category,
        "tags": payload.tags or [],
        "coverImageUrl": payload.coverImageUrl,
        "slug": slug,
        "authorId": user["_id"],
        "authorName": author_name,
        "authorProfilePicture": user.get("profilePictureUrl"),
        "status": "draft",
        "feedback": [],
        "viewCount": 0,
        "likeCount": 0,
        "likedBy": [],
        "publishedAt": None,
        "submittedAt": None,
        "reviewedAt": None,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await articles.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.put("/{article_id}", response_model=Article)
async def update_article(
    article_id: str,
    payload: ArticleUpdate,
    user: dict = Depends(get_current_user),
):
    """Update own article (only while draft or revision_requested)."""
    db = get_database()
    articles = db["press_articles"]

    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["authorId"] != user["_id"]:
        raise HTTPException(403, "Not your article")
    if doc["status"] not in ("draft", "revision_requested"):
        raise HTTPException(400, f"Cannot edit article in '{doc['status']}' status")

    updates: dict = {"updatedAt": datetime.utcnow()}
    for field in ("title", "content", "excerpt", "category", "tags", "coverImageUrl"):
        val = getattr(payload, field, None)
        if val is not None:
            if field == "content":
                val = sanitize_html(val)
            if field == "title":
                if not validate_no_scripts(val):
                    raise HTTPException(400, "Invalid characters in title")
            updates[field] = val

    # Re-generate slug if title changed
    if "title" in updates:
        base_slug = _slugify(updates["title"])
        slug = base_slug
        counter = 1
        while True:
            existing = await articles.find_one({"slug": slug, "_id": {"$ne": ObjectId(article_id)}})
            if not existing:
                break
            slug = f"{base_slug}-{counter}"
            counter += 1
        updates["slug"] = slug

    await articles.update_one({"_id": ObjectId(article_id)}, {"$set": updates})
    updated = await articles.find_one({"_id": ObjectId(article_id)})
    return _article_dict(updated)


@router.post("/{article_id}/submit")
async def submit_article(article_id: str, user: dict = Depends(get_current_user)):
    """Submit article for review (draft or revision_requested → submitted)."""
    db = get_database()
    articles = db["press_articles"]

    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["authorId"] != user["_id"]:
        raise HTTPException(403, "Not your article")
    if doc["status"] not in ("draft", "revision_requested"):
        raise HTTPException(400, f"Cannot submit from '{doc['status']}' status")

    await articles.update_one(
        {"_id": ObjectId(article_id)},
        {"$set": {"status": "submitted", "submittedAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}},
    )
    return {"message": "Article submitted for review", "status": "submitted"}


@router.delete("/{article_id}")
async def delete_article(article_id: str, user: dict = Depends(get_current_user)):
    """Delete own draft article."""
    db = get_database()
    articles = db["press_articles"]

    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["authorId"] != user["_id"]:
        raise HTTPException(403, "Not your article")
    if doc["status"] not in ("draft", "rejected"):
        raise HTTPException(400, "Can only delete drafts or rejected articles")

    await articles.delete_one({"_id": ObjectId(article_id)})
    return {"message": "Article deleted"}


# ══════════════════════════════════════════════════════════
# REVIEWER / PRESS HEAD ENDPOINTS
# ══════════════════════════════════════════════════════════

@router.get("/review-queue", response_model=List[Article])
async def get_review_queue(user: dict = Depends(get_current_user)):
    """Get all articles awaiting review (submitted + in_review)."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    cursor = articles.find({"status": {"$in": ["submitted", "in_review"]}}).sort("submittedAt", 1)
    docs = await cursor.to_list(length=100)
    return [_article_dict(d) for d in docs]


@router.get("/all", response_model=List[Article])
async def get_all_articles(
    article_status: Optional[str] = Query(None, alias="status"),
    user: dict = Depends(get_current_user),
):
    """Get all articles (any status). Press head / admin only."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    query: dict = {}
    if article_status:
        query["status"] = article_status

    cursor = articles.find(query).sort("updatedAt", -1)
    docs = await cursor.to_list(length=200)
    return [_article_dict(d) for d in docs]


# ══════════════════════════════════════════════════════════
# STATS (press head) — MUST be before /{article_id} to avoid route shadowing
# ══════════════════════════════════════════════════════════

@router.get("/stats/overview")
async def press_stats(user: dict = Depends(get_current_user)):
    """Get press dashboard stats."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]

    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_counts = {}
    async for doc in articles.aggregate(pipeline):
        status_counts[doc["_id"]] = doc["count"]

    total_views = 0
    total_likes = 0
    async for doc in articles.find({"status": "published"}, {"viewCount": 1, "likeCount": 1}):
        total_views += doc.get("viewCount", 0)
        total_likes += doc.get("likeCount", 0)

    return {
        "statusCounts": status_counts,
        "totalPublished": status_counts.get("published", 0),
        "totalDrafts": status_counts.get("draft", 0),
        "pendingReview": status_counts.get("submitted", 0) + status_counts.get("in_review", 0),
        "totalViews": total_views,
        "totalLikes": total_likes,
    }


@router.get("/{article_id}", response_model=Article)
async def get_article_detail(article_id: str, user: dict = Depends(get_current_user)):
    """Get single article detail — author can see own, head can see any."""
    db = get_database()
    articles = db["press_articles"]

    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")

    is_head = await _check_press_head(user, db)
    if doc["authorId"] != user["_id"] and not is_head:
        raise HTTPException(403, "Access denied")

    return _article_dict(doc)


@router.post("/{article_id}/start-review")
async def start_review(article_id: str, user: dict = Depends(get_current_user)):
    """Mark submitted article as in_review."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["status"] != "submitted":
        raise HTTPException(400, f"Article is '{doc['status']}', expected 'submitted'")

    await articles.update_one(
        {"_id": ObjectId(article_id)},
        {"$set": {"status": "in_review", "updatedAt": datetime.utcnow()}},
    )
    return {"message": "Article is now in review", "status": "in_review"}


@router.post("/{article_id}/approve")
async def approve_article(article_id: str, user: dict = Depends(get_current_user)):
    """Approve article (submitted/in_review → approved)."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["status"] not in ("submitted", "in_review"):
        raise HTTPException(400, f"Cannot approve from '{doc['status']}' status")

    reviewer_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Reviewer"
    await articles.update_one(
        {"_id": ObjectId(article_id)},
        {"$set": {"status": "approved", "reviewedAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}},
    )
    return {"message": "Article approved", "status": "approved"}


@router.post("/{article_id}/reject")
async def reject_article(
    article_id: str,
    payload: FeedbackCreate,
    user: dict = Depends(get_current_user),
):
    """Reject article with reason."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["status"] not in ("submitted", "in_review"):
        raise HTTPException(400, f"Cannot reject from '{doc['status']}' status")

    reviewer_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Reviewer"
    fb = Feedback(
        reviewerId=user["_id"],
        reviewerName=reviewer_name,
        message=payload.message,
    )

    await articles.update_one(
        {"_id": ObjectId(article_id)},
        {
            "$set": {"status": "rejected", "reviewedAt": datetime.utcnow(), "updatedAt": datetime.utcnow()},
            "$push": {"feedback": fb.model_dump()},
        },
    )
    return {"message": "Article rejected", "status": "rejected"}


@router.post("/{article_id}/request-revision")
async def request_revision(
    article_id: str,
    payload: FeedbackCreate,
    user: dict = Depends(get_current_user),
):
    """Request revisions with feedback (submitted/in_review → revision_requested)."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["status"] not in ("submitted", "in_review"):
        raise HTTPException(400, f"Cannot request revision from '{doc['status']}' status")

    reviewer_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Reviewer"
    fb = Feedback(
        reviewerId=user["_id"],
        reviewerName=reviewer_name,
        message=payload.message,
    )

    await articles.update_one(
        {"_id": ObjectId(article_id)},
        {
            "$set": {"status": "revision_requested", "updatedAt": datetime.utcnow()},
            "$push": {"feedback": fb.model_dump()},
        },
    )
    return {"message": "Revision requested — author has been notified", "status": "revision_requested"}


@router.post("/{article_id}/feedback")
async def add_feedback(
    article_id: str,
    payload: FeedbackCreate,
    user: dict = Depends(get_current_user),
):
    """Add a feedback comment (head can post on any status)."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")

    reviewer_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Reviewer"
    fb = Feedback(
        reviewerId=user["_id"],
        reviewerName=reviewer_name,
        message=payload.message,
    )

    await articles.update_one(
        {"_id": ObjectId(article_id)},
        {
            "$push": {"feedback": fb.model_dump()},
            "$set": {"updatedAt": datetime.utcnow()},
        },
    )
    return {"message": "Feedback added"}


@router.post("/{article_id}/publish")
async def publish_article(article_id: str, user: dict = Depends(get_current_user)):
    """Publish an approved article to the public blog."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["status"] != "approved":
        raise HTTPException(400, f"Can only publish approved articles (current: '{doc['status']}')")

    await articles.update_one(
        {"_id": ObjectId(article_id)},
        {"$set": {"status": "published", "publishedAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}},
    )
    return {"message": "Article is now live!", "status": "published"}


@router.post("/{article_id}/unpublish")
async def unpublish_article(article_id: str, user: dict = Depends(get_current_user)):
    """Take article off public blog (back to approved)."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["status"] != "published":
        raise HTTPException(400, "Article is not published")

    await articles.update_one(
        {"_id": ObjectId(article_id)},
        {"$set": {"status": "approved", "updatedAt": datetime.utcnow()}},
    )
    return {"message": "Article unpublished", "status": "approved"}


@router.post("/{article_id}/archive")
async def archive_article(article_id: str, user: dict = Depends(get_current_user)):
    """Archive an article."""
    db = get_database()
    is_head = await _check_press_head(user, db)
    if not is_head:
        raise HTTPException(403, "Press head permissions required")

    articles = db["press_articles"]
    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")

    await articles.update_one(
        {"_id": ObjectId(article_id)},
        {"$set": {"status": "archived", "updatedAt": datetime.utcnow()}},
    )
    return {"message": "Article archived", "status": "archived"}


# ══════════════════════════════════════════════════════════
# LIKE / ENGAGEMENT (any authenticated user)
# ══════════════════════════════════════════════════════════

@router.post("/{article_id}/like")
async def toggle_like(article_id: str, user: dict = Depends(get_current_user)):
    """Toggle like on a published article."""
    db = get_database()
    articles = db["press_articles"]

    doc = await articles.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article not found")
    if doc["status"] != "published":
        raise HTTPException(400, "Can only like published articles")

    liked_by = doc.get("likedBy", [])
    if user["_id"] in liked_by:
        # Unlike
        await articles.update_one(
            {"_id": ObjectId(article_id)},
            {"$pull": {"likedBy": user["_id"]}, "$inc": {"likeCount": -1}},
        )
        return {"liked": False, "likeCount": doc.get("likeCount", 1) - 1}
    else:
        # Like
        await articles.update_one(
            {"_id": ObjectId(article_id)},
            {"$push": {"likedBy": user["_id"]}, "$inc": {"likeCount": 1}},
        )
        return {"liked": True, "likeCount": doc.get("likeCount", 0) + 1}
