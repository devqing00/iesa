from fastapi import APIRouter, Depends
from app.db import get_database
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/directory")
async def get_alumni_directory(
    current_user: User = Depends(get_current_user)
):
    """
    Fetch all alumni for the directory.
    This is intentionally separate from the admin users endpoint
    so any student/alumni can view the directory securely without exposing
    all system users.
    """
    db = get_database()
    
    # Base query for alumni
    query = {
        "currentLevel": "Alumni",
        "isActive": True
    }
    
    # Fetch limited fields
    cursor = db.users.find(
        query,
        {
            "_id": 1,
            "firstName": 1,
            "lastName": 1,
            "currentLevel": 1,
            "profilePictureUrl": 1,
            "openToMentorship": 1,
            "mentorshipBio": 1,
            "skills": 1,
            "bio": 1,
            "email": 1 # Include email so they can network/contact
        }
    ).sort("firstName", 1)
    
    alumni_list = await cursor.to_list(length=1000)
    
    # Map _id to id
    for item in alumni_list:
        item["id"] = str(item.pop("_id"))
        
    return alumni_list
