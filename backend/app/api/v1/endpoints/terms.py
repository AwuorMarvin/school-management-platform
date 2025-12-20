"""
Term endpoints - CRUD operations for terms.
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
from app.models.term import Term
from app.models.academic_year import AcademicYear
from app.schemas.term import (
    TermCreate,
    TermUpdate,
    TermResponse,
    TermListResponse,
    AcademicYearMinimalResponse,
)

router = APIRouter()


# ============================================================================
# List Terms
# ============================================================================

@router.get("/terms", response_model=dict)
async def list_terms(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Number of records per page"),
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year ID"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List all terms for the current user's school.
    
    Permission: All authenticated users
    """
    offset = (page - 1) * page_size
    
    # Build query - join with academic_year to filter by school_id
    query = select(Term).join(AcademicYear).where(AcademicYear.school_id == current_user.school_id)
    count_query = select(func.count(Term.id)).join(AcademicYear).where(AcademicYear.school_id == current_user.school_id)
    
    # Apply academic year filter
    if academic_year_id:
        # Verify academic year belongs to school
        ay_check = await db.execute(
            select(AcademicYear).where(
                AcademicYear.id == academic_year_id,
                AcademicYear.school_id == current_user.school_id
            )
        )
        if not ay_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "ACADEMIC_YEAR_NOT_FOUND",
                    "message": "Academic year not found or does not belong to your school"
                }
            )
        query = query.where(Term.academic_year_id == academic_year_id)
        count_query = count_query.where(Term.academic_year_id == academic_year_id)
    
    # Get total count
    total = (await db.execute(count_query)).scalar_one()
    
    # Apply pagination and ordering
    query = query.order_by(Term.start_date.desc()).offset(offset).limit(page_size)
    
    # Eager load academic year
    query = query.options(selectinload(Term.academic_year))
    
    result = await db.execute(query)
    terms = result.scalars().all()
    
    # Determine current term (one that contains today's date)
    today = date.today()
    
    data = []
    for term in terms:
        is_current = term.start_date <= today <= term.end_date
        
        data.append({
            "id": str(term.id),
            "academic_year_id": str(term.academic_year_id),
            "name": term.name,
            "start_date": term.start_date.isoformat(),
            "end_date": term.end_date.isoformat(),
            "created_at": term.created_at.isoformat(),
            "updated_at": term.updated_at.isoformat(),
            "academic_year": {
                "id": str(term.academic_year.id),
                "name": term.academic_year.name,
            } if term.academic_year else None,
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
# Get Term
# ============================================================================

@router.get("/terms/{term_id}", response_model=dict)
async def get_term(
    term_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get term details.
    
    Permission: All authenticated users
    """
    result = await db.execute(
        select(Term)
        .join(AcademicYear)
        .where(
            Term.id == term_id,
            AcademicYear.school_id == current_user.school_id
        )
        .options(selectinload(Term.academic_year))
    )
    term = result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TERM_NOT_FOUND",
                "message": "Term not found",
                "recovery": "Check the term ID"
            }
        )
    
    today = date.today()
    is_current = term.start_date <= today <= term.end_date
    
    return {
        "id": str(term.id),
        "academic_year_id": str(term.academic_year_id),
        "name": term.name,
        "start_date": term.start_date.isoformat(),
        "end_date": term.end_date.isoformat(),
        "created_at": term.created_at.isoformat(),
        "updated_at": term.updated_at.isoformat(),
        "academic_year": {
            "id": str(term.academic_year.id),
            "name": term.academic_year.name,
        } if term.academic_year else None,
        "is_current": is_current,
    }


# ============================================================================
# Create Term
# ============================================================================

@router.post("/academic-years/{academic_year_id}/terms", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_term(
    academic_year_id: UUID,
    term_data: TermCreate,
    current_user = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Create a new term within an academic year.
    
    Permission: SCHOOL_ADMIN only
    """
    # Verify academic year exists and belongs to school
    ay_result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.id == academic_year_id,
            AcademicYear.school_id == current_user.school_id
        )
    )
    academic_year = ay_result.scalar_one_or_none()
    
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "ACADEMIC_YEAR_NOT_FOUND",
                "message": "Academic year not found or does not belong to your school",
                "recovery": "Check the academic year ID"
            }
        )
    
    # Validate term dates are within academic year
    if term_data.start_date < academic_year.start_date or term_data.end_date > academic_year.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "TERM_OUTSIDE_ACADEMIC_YEAR",
                "message": f"Term dates must be within academic year {academic_year.start_date.isoformat()} to {academic_year.end_date.isoformat()}",
                "recovery": "Adjust term dates to fall within the academic year"
            }
        )
    
    # Check for overlapping terms within the same academic year
    overlap_query = select(Term).where(
        Term.academic_year_id == academic_year_id,
        or_(
            # New term starts during existing term
            and_(
                Term.start_date <= term_data.start_date,
                term_data.start_date <= Term.end_date
            ),
            # New term ends during existing term
            and_(
                Term.start_date <= term_data.end_date,
                term_data.end_date <= Term.end_date
            ),
            # New term completely contains existing term
            and_(
                term_data.start_date <= Term.start_date,
                Term.end_date <= term_data.end_date
            ),
        )
    )
    
    overlap_result = await db.execute(overlap_query)
    overlapping_term = overlap_result.scalar_one_or_none()
    
    if overlapping_term:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "TERM_OVERLAP",
                "message": f"Term dates overlap with existing term '{overlapping_term.name}'",
                "recovery": "Choose non-overlapping dates within the academic year",
                "details": {
                    "overlapping_term_id": str(overlapping_term.id),
                    "overlapping_term_name": overlapping_term.name,
                }
            }
        )
    
    # Create term
    term = Term(
        academic_year_id=academic_year_id,
        name=term_data.name,
        start_date=term_data.start_date,
        end_date=term_data.end_date,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(term)
    await db.commit()
    await db.refresh(term)
    
    return {
        "id": str(term.id),
        "academic_year_id": str(term.academic_year_id),
        "name": term.name,
        "start_date": term.start_date.isoformat(),
        "end_date": term.end_date.isoformat(),
        "created_at": term.created_at.isoformat(),
        "updated_at": term.updated_at.isoformat(),
    }


# ============================================================================
# Update Term
# ============================================================================

@router.put("/terms/{term_id}", response_model=dict)
async def update_term(
    term_id: UUID,
    term_data: TermUpdate,
    current_user = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update term information.
    
    Permission: SCHOOL_ADMIN only
    """
    result = await db.execute(
        select(Term)
        .join(AcademicYear)
        .where(
            Term.id == term_id,
            AcademicYear.school_id == current_user.school_id
        )
        .options(selectinload(Term.academic_year))
    )
    term = result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TERM_NOT_FOUND",
                "message": "Term not found",
                "recovery": "Check the term ID"
            }
        )
    
    # Update fields
    update_data = term_data.model_dump(exclude_unset=True)
    
    # Validate dates are within academic year if dates are being updated
    if "start_date" in update_data or "end_date" in update_data:
        start_date = update_data.get("start_date", term.start_date)
        end_date = update_data.get("end_date", term.end_date)
        
        if start_date < term.academic_year.start_date or end_date > term.academic_year.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "TERM_OUTSIDE_ACADEMIC_YEAR",
                    "message": f"Term dates must be within academic year {term.academic_year.start_date.isoformat()} to {term.academic_year.end_date.isoformat()}",
                    "recovery": "Adjust term dates to fall within the academic year"
                }
            )
        
        # Check for overlap with other terms in the same academic year
        overlap_query = select(Term).where(
            Term.academic_year_id == term.academic_year_id,
            Term.id != term_id,
            or_(
                and_(
                    Term.start_date <= start_date,
                    start_date <= Term.end_date
                ),
                and_(
                    Term.start_date <= end_date,
                    end_date <= Term.end_date
                ),
                and_(
                    start_date <= Term.start_date,
                    Term.end_date <= end_date
                ),
            )
        )
        
        overlap_result = await db.execute(overlap_query)
        overlapping_term = overlap_result.scalar_one_or_none()
        
        if overlapping_term:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "TERM_OVERLAP",
                    "message": f"Term dates overlap with existing term '{overlapping_term.name}'",
                    "recovery": "Choose non-overlapping dates within the academic year",
                    "details": {
                        "overlapping_term_id": str(overlapping_term.id),
                        "overlapping_term_name": overlapping_term.name,
                    }
                }
            )
    
    # Apply updates
    for key, value in update_data.items():
        setattr(term, key, value)
    
    term.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(term)
    
    return {
        "id": str(term.id),
        "academic_year_id": str(term.academic_year_id),
        "name": term.name,
        "start_date": term.start_date.isoformat(),
        "end_date": term.end_date.isoformat(),
        "created_at": term.created_at.isoformat(),
        "updated_at": term.updated_at.isoformat(),
    }

