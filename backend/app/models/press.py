"""
Press / Association Blog Models

Articles go through a workflow:
  draft → submitted → in_review → approved → published
                    ↘ revision_requested → (author edits) → submitted
                    ↘ rejected

Press unit members (enrolled in press unit) can write.
Press unit head reviews, gives feedback, approves/rejects.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from bson import ObjectId


ArticleStatus = Literal[
    "draft",              # Author working on it
    "submitted",          # Sent for review
    "in_review",          # Head is looking at it
    "revision_requested", # Head sent feedback, author must revise
    "approved",           # Head approved — ready to publish
    "published",          # Live on public blog
    "rejected",           # Head rejected
    "archived",           # Taken down from public
]

ArticleCategory = Literal[
    "news",
    "feature",
    "opinion",
    "interview",
    "event_coverage",
    "academic",
    "campus_life",
    "tech",
    "sports",
    "other",
]


# ─── Feedback (sub-document) ────────────────────────────

class Feedback(BaseModel):
    """A single feedback entry from the reviewer."""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    reviewerId: str
    reviewerName: str
    message: str = Field(..., min_length=1, max_length=2000)
    createdAt: datetime = Field(default_factory=datetime.utcnow)


# ─── Article Models ─────────────────────────────────────

class ArticleBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    content: str = Field(..., min_length=10, max_length=50000, description="Article body (HTML or markdown)")
    excerpt: Optional[str] = Field(None, max_length=500, description="Short summary for cards")
    category: ArticleCategory = Field(default="news")
    tags: List[str] = Field(default_factory=list, max_length=10)
    coverImageUrl: Optional[str] = Field(None, description="URL of cover image")


class ArticleCreate(ArticleBase):
    """Payload when an author creates a new article."""
    pass


class ArticleUpdate(BaseModel):
    """Partial update by the author (only while in draft / revision_requested)."""
    title: Optional[str] = Field(None, min_length=3, max_length=300)
    content: Optional[str] = Field(None, min_length=10, max_length=50000)
    excerpt: Optional[str] = Field(None, max_length=500)
    category: Optional[ArticleCategory] = None
    tags: Optional[List[str]] = None
    coverImageUrl: Optional[str] = None


class Article(ArticleBase):
    """Full article response model."""
    id: str = Field(alias="_id")
    slug: str
    authorId: str
    authorName: str
    authorProfilePicture: Optional[str] = None
    status: ArticleStatus = "draft"
    feedback: List[Feedback] = Field(default_factory=list)
    viewCount: int = Field(default=0)
    likeCount: int = Field(default=0)
    likedBy: List[str] = Field(default_factory=list, description="User IDs who liked")
    publishedAt: Optional[datetime] = None
    submittedAt: Optional[datetime] = None
    reviewedAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class ArticlePublic(BaseModel):
    """Slimmer model for public blog listing (no internal fields)."""
    id: str = Field(alias="_id")
    title: str
    slug: str
    excerpt: Optional[str] = None
    category: ArticleCategory
    tags: List[str] = Field(default_factory=list)
    coverImageUrl: Optional[str] = None
    authorName: str
    authorProfilePicture: Optional[str] = None
    viewCount: int = 0
    likeCount: int = 0
    publishedAt: Optional[datetime] = None
    createdAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class FeedbackCreate(BaseModel):
    """Payload when reviewer sends feedback."""
    message: str = Field(..., min_length=1, max_length=2000)
