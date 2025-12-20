"""
Fee Adjustment endpoints - CRUD operations for per-student fee adjustments.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, UTC
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_school_admin
from app.models.fee_adjustment import FeeAdjustment
from app.models.user import User
from app.models.student import Student
from app.models.term import Term
from app.schemas.fee_adjustment import (
    FeeAdjustmentCreate,
    FeeAdjustmentUpdate,
    FeeAdjustmentResponse,
    FeeAdjustmentListResponse,
)

router = APIRouter()


# ============================================================================
# List Fee Adjustments
# ============================================================================

@router.get("/fee-adjustments", response_model=FeeAdjustmentListResponse)
async def list_fee_adjustments(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    student_id: Optional[UUID] = Query(None, description="Filter by student ID"),
    term_id: Optional[UUID] = Query(None, description="Filter by term ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> FeeAdjustmentListResponse:
    """
    List fee adjustments with filtering and pagination.
    
    Permission: All authenticated users (scope-filtered)
    """
    query = select(FeeAdjustment).where(FeeAdjustment.school_id == current_user.school_id)
    
    if student_id:
        query = query.where(FeeAdjustment.student_id == student_id)
    
    if term_id:
        query = query.where(FeeAdjustment.term_id == term_id)
    
    # Get total count
    count_query = select(func.count(FeeAdjustment.id)).where(FeeAdjustment.school_id == current_user.school_id)
    if student_id:
        count_query = count_query.where(FeeAdjustment.student_id == student_id)
    if term_id:
        count_query = count_query.where(FeeAdjustment.term_id == term_id)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Load relationships
    query = query.options(
        selectinload(FeeAdjustment.student),
        selectinload(FeeAdjustment.term),
        selectinload(FeeAdjustment.created_by)
    )
    
    result = await db.execute(query)
    adjustments = result.scalars().all()
    
    # Format response
    data = []
    for adj in adjustments:
        data.append({
            "id": adj.id,
            "school_id": adj.school_id,
            "student_id": adj.student_id,
            "term_id": adj.term_id,
            "adjustment_type": adj.adjustment_type,
            "adjustment_value": adj.adjustment_value,
            "reason": adj.reason,
            "created_by_user_id": adj.created_by_user_id,
            "created_at": adj.created_at.isoformat(),
            "updated_at": adj.updated_at.isoformat() if adj.updated_at else None,
            "student": {
                "id": adj.student.id,
                "first_name": adj.student.first_name,
                "last_name": adj.student.last_name,
            } if adj.student else None,
            "term": {
                "id": adj.term.id,
                "name": adj.term.name,
            } if adj.term else None,
            "created_by": {
                "id": adj.created_by.id,
                "first_name": adj.created_by.first_name,
                "last_name": adj.created_by.last_name,
            } if adj.created_by else None,
        })
    
    return FeeAdjustmentListResponse(
        data=data,
        pagination={
            "page": (skip // limit) + 1,
            "page_size": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if total > 0 else 0,
            "has_next": (skip + limit) < total,
            "has_previous": skip > 0,
        }
    )


# ============================================================================
# Get Fee Adjustment
# ============================================================================

@router.get("/fee-adjustments/{adjustment_id}", response_model=FeeAdjustmentResponse)
async def get_fee_adjustment(
    adjustment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> FeeAdjustmentResponse:
    """
    Get a single fee adjustment by ID.
    
    Permission: All authenticated users
    """
    result = await db.execute(
        select(FeeAdjustment)
        .where(
            FeeAdjustment.id == adjustment_id,
            FeeAdjustment.school_id == current_user.school_id
        )
        .options(
            selectinload(FeeAdjustment.student),
            selectinload(FeeAdjustment.term),
            selectinload(FeeAdjustment.created_by)
        )
    )
    adjustment = result.scalar_one_or_none()
    
    if not adjustment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "FEE_ADJUSTMENT_NOT_FOUND", "message": "Fee adjustment not found"}
        )
    
    return FeeAdjustmentResponse(
        id=adjustment.id,
        school_id=adjustment.school_id,
        student_id=adjustment.student_id,
        term_id=adjustment.term_id,
        adjustment_type=adjustment.adjustment_type,
        adjustment_value=adjustment.adjustment_value,
        reason=adjustment.reason,
        created_by_user_id=adjustment.created_by_user_id,
        created_at=adjustment.created_at.isoformat(),
        updated_at=adjustment.updated_at.isoformat() if adjustment.updated_at else None,
        student={
            "id": adjustment.student.id,
            "first_name": adjustment.student.first_name,
            "last_name": adjustment.student.last_name,
        } if adjustment.student else None,
        term={
            "id": adjustment.term.id,
            "name": adjustment.term.name,
        } if adjustment.term else None,
        created_by={
            "id": adjustment.created_by.id,
            "first_name": adjustment.created_by.first_name,
            "last_name": adjustment.created_by.last_name,
        } if adjustment.created_by else None,
    )


# ============================================================================
# Create Fee Adjustment
# ============================================================================

@router.post("/fee-adjustments", response_model=FeeAdjustmentResponse, status_code=status.HTTP_201_CREATED)
async def create_fee_adjustment(
    adjustment_data: FeeAdjustmentCreate,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> FeeAdjustmentResponse:
    """
    Create a new fee adjustment for a student.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    # Validate student belongs to school
    student_result = await db.execute(
        select(Student).where(
            Student.id == adjustment_data.student_id,
            Student.school_id == current_user.school_id
        )
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "STUDENT_NOT_FOUND", "message": "Student not found or does not belong to your school"}
        )
    
    # Validate term exists
    term_result = await db.execute(
        select(Term).where(Term.id == adjustment_data.term_id)
    )
    term = term_result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "TERM_NOT_FOUND", "message": "Term not found"}
        )
    
    # Validate adjustment value based on type
    if adjustment_data.adjustment_type == "PERCENTAGE" and adjustment_data.adjustment_value > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_ADJUSTMENT_VALUE",
                "message": "Percentage adjustment cannot exceed 100%"
            }
        )
    
    # Create fee adjustment
    adjustment = FeeAdjustment(
        school_id=current_user.school_id,
        student_id=adjustment_data.student_id,
        term_id=adjustment_data.term_id,
        adjustment_type=adjustment_data.adjustment_type,
        adjustment_value=adjustment_data.adjustment_value,
        reason=adjustment_data.reason,
        created_by_user_id=current_user.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(adjustment)
    await db.commit()
    await db.refresh(adjustment)
    
    # Load relationships for response
    result = await db.execute(
        select(FeeAdjustment)
        .where(FeeAdjustment.id == adjustment.id)
        .options(
            selectinload(FeeAdjustment.student),
            selectinload(FeeAdjustment.term),
            selectinload(FeeAdjustment.created_by)
        )
    )
    adjustment = result.scalar_one()
    
    return FeeAdjustmentResponse(
        id=adjustment.id,
        school_id=adjustment.school_id,
        student_id=adjustment.student_id,
        term_id=adjustment.term_id,
        adjustment_type=adjustment.adjustment_type,
        adjustment_value=adjustment.adjustment_value,
        reason=adjustment.reason,
        created_by_user_id=adjustment.created_by_user_id,
        created_at=adjustment.created_at.isoformat(),
        updated_at=adjustment.updated_at.isoformat() if adjustment.updated_at else None,
        student={
            "id": adjustment.student.id,
            "first_name": adjustment.student.first_name,
            "last_name": adjustment.student.last_name,
        } if adjustment.student else None,
        term={
            "id": adjustment.term.id,
            "name": adjustment.term.name,
        } if adjustment.term else None,
        created_by={
            "id": adjustment.created_by.id,
            "first_name": adjustment.created_by.first_name,
            "last_name": adjustment.created_by.last_name,
        } if adjustment.created_by else None,
    )


# ============================================================================
# Update Fee Adjustment
# ============================================================================

@router.put("/fee-adjustments/{adjustment_id}", response_model=FeeAdjustmentResponse)
async def update_fee_adjustment(
    adjustment_id: UUID,
    adjustment_data: FeeAdjustmentUpdate,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> FeeAdjustmentResponse:
    """
    Update a fee adjustment.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    result = await db.execute(
        select(FeeAdjustment).where(
            FeeAdjustment.id == adjustment_id,
            FeeAdjustment.school_id == current_user.school_id
        )
    )
    adjustment = result.scalar_one_or_none()
    
    if not adjustment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "FEE_ADJUSTMENT_NOT_FOUND", "message": "Fee adjustment not found"}
        )
    
    # Update fields
    if adjustment_data.adjustment_type is not None:
        adjustment.adjustment_type = adjustment_data.adjustment_type
    
    if adjustment_data.adjustment_value is not None:
        # Validate adjustment value based on type
        adjustment_type = adjustment_data.adjustment_type or adjustment.adjustment_type
        if adjustment_type == "PERCENTAGE" and adjustment_data.adjustment_value > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "INVALID_ADJUSTMENT_VALUE",
                    "message": "Percentage adjustment cannot exceed 100%"
                }
            )
        adjustment.adjustment_value = adjustment_data.adjustment_value
    
    if adjustment_data.reason is not None:
        adjustment.reason = adjustment_data.reason
    
    adjustment.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(adjustment)
    
    # Load relationships for response
    result = await db.execute(
        select(FeeAdjustment)
        .where(FeeAdjustment.id == adjustment.id)
        .options(
            selectinload(FeeAdjustment.student),
            selectinload(FeeAdjustment.term),
            selectinload(FeeAdjustment.created_by)
        )
    )
    adjustment = result.scalar_one()
    
    return FeeAdjustmentResponse(
        id=adjustment.id,
        school_id=adjustment.school_id,
        student_id=adjustment.student_id,
        term_id=adjustment.term_id,
        adjustment_type=adjustment.adjustment_type,
        adjustment_value=adjustment.adjustment_value,
        reason=adjustment.reason,
        created_by_user_id=adjustment.created_by_user_id,
        created_at=adjustment.created_at.isoformat(),
        updated_at=adjustment.updated_at.isoformat() if adjustment.updated_at else None,
        student={
            "id": adjustment.student.id,
            "first_name": adjustment.student.first_name,
            "last_name": adjustment.student.last_name,
        } if adjustment.student else None,
        term={
            "id": adjustment.term.id,
            "name": adjustment.term.name,
        } if adjustment.term else None,
        created_by={
            "id": adjustment.created_by.id,
            "first_name": adjustment.created_by.first_name,
            "last_name": adjustment.created_by.last_name,
        } if adjustment.created_by else None,
    )


# ============================================================================
# Delete Fee Adjustment
# ============================================================================

@router.delete("/fee-adjustments/{adjustment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fee_adjustment(
    adjustment_id: UUID,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a fee adjustment.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    result = await db.execute(
        select(FeeAdjustment).where(
            FeeAdjustment.id == adjustment_id,
            FeeAdjustment.school_id == current_user.school_id
        )
    )
    adjustment = result.scalar_one_or_none()
    
    if not adjustment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "FEE_ADJUSTMENT_NOT_FOUND", "message": "Fee adjustment not found"}
        )
    
    db.delete(adjustment)
    await db.commit()

