"""
Academic Year endpoints - CRUD operations for academic years.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, UTC, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_school_admin
from app.models.academic_year import AcademicYear
from app.models.term import Term
from app.schemas.academic_year import (
    AcademicYearCreate,
    AcademicYearUpdate,
    AcademicYearResponse,
    AcademicYearListResponse,
    TermMinimalResponse,
)

router = APIRouter()


# ============================================================================
# List Academic Years
# ============================================================================

@router.get("/academic-years", response_model=dict)
async def list_academic_years(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Number of records per page"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List all academic years for the current user's school.
    
    Permission: All authenticated users
    """
    offset = (page - 1) * page_size
    
    # Build query with tenant isolation
    query = select(AcademicYear).where(AcademicYear.school_id == current_user.school_id)
    count_query = select(func.count(AcademicYear.id)).where(AcademicYear.school_id == current_user.school_id)
    
    # Get total count
    total = (await db.execute(count_query)).scalar_one()
    
    # Apply pagination and ordering
    query = query.order_by(AcademicYear.start_date.desc()).offset(offset).limit(page_size)
    
    # Eager load terms
    query = query.options(selectinload(AcademicYear.terms))
    
    result = await db.execute(query)
    academic_years = result.scalars().all()
    
    # Determine current academic year (one that contains today's date)
    today = date.today()
    
    data = []
    for ay in academic_years:
        is_current = ay.start_date <= today <= ay.end_date
        term_count = len(ay.terms)
        
        data.append({
            "id": str(ay.id),
            "school_id": str(ay.school_id),
            "name": ay.name,
            "start_date": ay.start_date.isoformat(),
            "end_date": ay.end_date.isoformat(),
            "created_at": ay.created_at.isoformat(),
            "updated_at": ay.updated_at.isoformat(),
            "terms": [
                {
                    "id": str(t.id),
                    "name": t.name,
                    "start_date": t.start_date.isoformat(),
                    "end_date": t.end_date.isoformat(),
                }
                for t in ay.terms
            ],
            "term_count": term_count,
            "is_current": is_current,
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


# ============================================================================
# Get Academic Year
# ============================================================================

@router.get("/academic-years/{academic_year_id}", response_model=dict)
async def get_academic_year(
    academic_year_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get academic year details with all terms.
    
    Permission: All authenticated users
    """
    result = await db.execute(
        select(AcademicYear)
        .where(
            AcademicYear.id == academic_year_id,
            AcademicYear.school_id == current_user.school_id
        )
        .options(selectinload(AcademicYear.terms))
    )
    academic_year = result.scalar_one_or_none()
    
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "ACADEMIC_YEAR_NOT_FOUND",
                "message": "Academic year not found",
                "recovery": "Check the academic year ID"
            }
        )
    
    today = date.today()
    is_current = academic_year.start_date <= today <= academic_year.end_date
    
    return {
        "id": str(academic_year.id),
        "school_id": str(academic_year.school_id),
        "name": academic_year.name,
        "start_date": academic_year.start_date.isoformat(),
        "end_date": academic_year.end_date.isoformat(),
        "created_at": academic_year.created_at.isoformat(),
        "updated_at": academic_year.updated_at.isoformat(),
        "terms": [
            {
                "id": str(t.id),
                "name": t.name,
                "start_date": t.start_date.isoformat(),
                "end_date": t.end_date.isoformat(),
            }
            for t in academic_year.terms
        ],
        "is_current": is_current,
    }


# ============================================================================
# Create Academic Year
# ============================================================================

@router.post("/academic-years", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_academic_year(
    academic_year_data: AcademicYearCreate,
    current_user = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Create a new academic year.
    
    Permission: SCHOOL_ADMIN only
    """
    # Check for overlapping academic years
    overlap_query = select(AcademicYear).where(
        AcademicYear.school_id == current_user.school_id,
        or_(
            # New year starts during existing year
            and_(
                AcademicYear.start_date <= academic_year_data.start_date,
                academic_year_data.start_date <= AcademicYear.end_date
            ),
            # New year ends during existing year
            and_(
                AcademicYear.start_date <= academic_year_data.end_date,
                academic_year_data.end_date <= AcademicYear.end_date
            ),
            # New year completely contains existing year
            and_(
                academic_year_data.start_date <= AcademicYear.start_date,
                AcademicYear.end_date <= academic_year_data.end_date
            ),
        )
    )
    
    overlap_result = await db.execute(overlap_query)
    overlapping_year = overlap_result.scalar_one_or_none()
    
    if overlapping_year:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "ACADEMIC_YEAR_OVERLAP",
                "message": f"Academic year dates overlap with existing year '{overlapping_year.name}'",
                "recovery": "Choose non-overlapping dates",
                "details": {
                    "overlapping_year_id": str(overlapping_year.id),
                    "overlapping_year_name": overlapping_year.name,
                }
            }
        )
    
    # Check if name already exists
    name_check = await db.execute(
        select(AcademicYear).where(
            AcademicYear.school_id == current_user.school_id,
            AcademicYear.name == academic_year_data.name
        )
    )
    if name_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "ACADEMIC_YEAR_NAME_EXISTS",
                "message": f"Academic year with name '{academic_year_data.name}' already exists",
                "recovery": "Use a different name"
            }
        )
    
    # Create academic year
    academic_year = AcademicYear(
        school_id=current_user.school_id,
        name=academic_year_data.name,
        start_date=academic_year_data.start_date,
        end_date=academic_year_data.end_date,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(academic_year)
    await db.commit()
    await db.refresh(academic_year)
    
    return {
        "id": str(academic_year.id),
        "school_id": str(academic_year.school_id),
        "name": academic_year.name,
        "start_date": academic_year.start_date.isoformat(),
        "end_date": academic_year.end_date.isoformat(),
        "created_at": academic_year.created_at.isoformat(),
        "updated_at": academic_year.updated_at.isoformat(),
    }


# ============================================================================
# Update Academic Year
# ============================================================================

@router.put("/academic-years/{academic_year_id}", response_model=dict)
async def update_academic_year(
    academic_year_id: UUID,
    academic_year_data: AcademicYearUpdate,
    current_user = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update academic year information.
    
    Permission: SCHOOL_ADMIN only
    """
    result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.id == academic_year_id,
            AcademicYear.school_id == current_user.school_id
        )
    )
    academic_year = result.scalar_one_or_none()
    
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "ACADEMIC_YEAR_NOT_FOUND",
                "message": "Academic year not found",
                "recovery": "Check the academic year ID"
            }
        )
    
    # Update fields
    update_data = academic_year_data.model_dump(exclude_unset=True)
    
    # Check for name conflict if name is being updated
    if "name" in update_data and update_data["name"] != academic_year.name:
        name_check = await db.execute(
            select(AcademicYear).where(
                AcademicYear.school_id == current_user.school_id,
                AcademicYear.name == update_data["name"],
                AcademicYear.id != academic_year_id
            )
        )
        if name_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "ACADEMIC_YEAR_NAME_EXISTS",
                    "message": f"Academic year with name '{update_data['name']}' already exists",
                    "recovery": "Use a different name"
                }
            )
    
    # Check for date overlap if dates are being updated
    if "start_date" in update_data or "end_date" in update_data:
        start_date = update_data.get("start_date", academic_year.start_date)
        end_date = update_data.get("end_date", academic_year.end_date)
        
        overlap_query = select(AcademicYear).where(
            AcademicYear.school_id == current_user.school_id,
            AcademicYear.id != academic_year_id,
            or_(
                and_(
                    AcademicYear.start_date <= start_date,
                    start_date <= AcademicYear.end_date
                ),
                and_(
                    AcademicYear.start_date <= end_date,
                    end_date <= AcademicYear.end_date
                ),
                and_(
                    start_date <= AcademicYear.start_date,
                    AcademicYear.end_date <= end_date
                ),
            )
        )
        
        overlap_result = await db.execute(overlap_query)
        overlapping_year = overlap_result.scalar_one_or_none()
        
        if overlapping_year:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "ACADEMIC_YEAR_OVERLAP",
                    "message": f"Academic year dates overlap with existing year '{overlapping_year.name}'",
                    "recovery": "Choose non-overlapping dates",
                    "details": {
                        "overlapping_year_id": str(overlapping_year.id),
                        "overlapping_year_name": overlapping_year.name,
                    }
                }
            )
    
    # Apply updates
    for key, value in update_data.items():
        setattr(academic_year, key, value)
    
    academic_year.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(academic_year)
    
    return {
        "id": str(academic_year.id),
        "school_id": str(academic_year.school_id),
        "name": academic_year.name,
        "start_date": academic_year.start_date.isoformat(),
        "end_date": academic_year.end_date.isoformat(),
        "created_at": academic_year.created_at.isoformat(),
        "updated_at": academic_year.updated_at.isoformat(),
    }

