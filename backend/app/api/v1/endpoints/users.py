"""
User endpoints - List users (for admin use).
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_school_admin
from app.models.user import User

router = APIRouter()


# ============================================================================
# List Users
# ============================================================================

@router.get("/users", response_model=dict)
async def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Number of records per page"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List users in the school.
    
    Permission: All authenticated users (filtered by school)
    Note: For listing teachers, use role=TEACHER filter
    """
    offset = (page - 1) * page_size
    
    # Build query - only users in same school
    query = select(User).where(
        User.school_id == current_user.school_id
    )
    count_query = select(func.count(User.id)).where(
        User.school_id == current_user.school_id
    )
    
    # Apply filters
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    
    if status:
        query = query.where(User.status == status)
        count_query = count_query.where(User.status == status)
    
    # Get total count
    total = (await db.execute(count_query)).scalar_one()
    
    # Apply pagination and ordering
    query = query.order_by(User.last_name, User.first_name).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    data = []
    for user in users:
        data.append({
            "id": str(user.id),
            "email": user.email,
            "phone_number": user.phone_number,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "status": user.status,
            "campus_id": str(user.campus_id) if user.campus_id else None,
            "campus": {
                "id": str(user.campus.id),
                "name": user.campus.name,
            } if user.campus else None,
        })
    
    return {
        "data": data,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": (page * page_size) < total,
            "has_previous": page > 1,
        }
    }

