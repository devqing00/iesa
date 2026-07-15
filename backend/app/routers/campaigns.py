from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.db import get_database

router = APIRouter(prefix="/api/v1/campaigns", tags=["Automated Campaigns"])

class CampaignCreate(BaseModel):
    name: str = Field(..., max_length=100)
    triggerType: str = Field(..., description="e.g. unpaid_due, inactive_student")
    conditionValue: str = Field(..., description="e.g. paymentId or days inactive")
    actionType: str = Field(..., description="e.g. email, in_app")
    messageTemplate: str = Field(...)
    intervalDays: int = Field(default=3, ge=1)
    isActive: bool = Field(default=True)

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    triggerType: Optional[str] = None
    conditionValue: Optional[str] = None
    actionType: Optional[str] = None
    messageTemplate: Optional[str] = None
    intervalDays: Optional[int] = None
    isActive: Optional[bool] = None

class CampaignResponse(CampaignCreate):
    id: str
    createdAt: datetime
    updatedAt: datetime
    lastRunAt: Optional[datetime] = None

@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign: CampaignCreate,
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("admin:manage")),
):
    """Create a new automated drip campaign."""
    db = get_database()
    
    doc = campaign.dict()
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = doc["createdAt"]
    doc["lastRunAt"] = None
    doc["createdBy"] = current_user["_id"]
    
    result = await db["campaigns"].insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@router.get("/", response_model=List[CampaignResponse])
async def get_campaigns(
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("admin:dashboard")),
):
    """List all campaigns."""
    db = get_database()
    campaigns = await db["campaigns"].find({}).sort("createdAt", -1).to_list(length=100)
    
    for c in campaigns:
        c["id"] = str(c["_id"])
        
    return campaigns

@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: str,
    update_data: CampaignUpdate,
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("admin:manage")),
):
    """Update a campaign."""
    db = get_database()
    
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
        
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    update_dict["updatedAt"] = datetime.now(timezone.utc)
    
    result = await db["campaigns"].find_one_and_update(
        {"_id": ObjectId(campaign_id)},
        {"$set": update_dict},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    result["id"] = str(result["_id"])
    return result

@router.put("/{campaign_id}/toggle", response_model=CampaignResponse)
async def toggle_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("admin:manage")),
):
    """Toggle a campaign's active status."""
    db = get_database()
    
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
        
    campaign = await db["campaigns"].find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    new_status = not campaign.get("isActive", True)
    
    result = await db["campaigns"].find_one_and_update(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"isActive": new_status, "updatedAt": datetime.now(timezone.utc)}},
        return_document=True
    )
    
    result["id"] = str(result["_id"])
    return result

@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("admin:manage")),
):
    """Delete a campaign."""
    db = get_database()
    
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
        
    result = await db["campaigns"].delete_one({"_id": ObjectId(campaign_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
