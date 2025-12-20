"""
Campus endpoints - List campuses for current user's school.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.campus import Campus
from app.models.user import User

router = APIRouter()


# ============================================================================
# List Campuses
# ============================================================================

@router.get("/campuses", response_model=dict)
async def list_campuses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List all campuses for the current user's school.
    
    Returns:
    - SCHOOL_ADMIN: All campuses in school
    - CAMPUS_ADMIN: Only their assigned campus
    - Others: All campuses in school (for selection purposes)
    """
    # Build query
    query = select(Campus).where(Campus.school_id == current_user.school_id)
    
    # CAMPUS_ADMIN only sees their campus
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        query = query.where(Campus.id == current_user.campus_id)
    
    result = await db.execute(query.order_by(Campus.name))
    campuses = result.scalars().all()
    
    return {
        "data": [
            {
                "id": str(c.id),
                "name": c.name,
                "address": c.address,
                "school_id": str(c.school_id),
            }
            for c in campuses
        ]
    }

