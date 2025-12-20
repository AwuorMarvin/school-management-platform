"""
Global Discount endpoints - CRUD operations for global discount rules.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, UTC
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_school_admin
from app.models.global_discount import GlobalDiscount, GlobalDiscountCampus, GlobalDiscountClass
from app.models.user import User
from app.models.term import Term
from app.models.campus import Campus
from app.models import Class
from app.schemas.global_discount import (
    GlobalDiscountCreate,
    GlobalDiscountUpdate,
    GlobalDiscountResponse,
    GlobalDiscountListResponse,
)

router = APIRouter()


# ============================================================================
# List Global Discounts
# ============================================================================

@router.get("/global-discounts", response_model=GlobalDiscountListResponse)
async def list_global_discounts(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    term_id: Optional[UUID] = Query(None, description="Filter by term ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GlobalDiscountListResponse:
    """
    List global discounts with filtering and pagination.
    
    Permission: All authenticated users
    """
    query = select(GlobalDiscount).where(GlobalDiscount.school_id == current_user.school_id)
    
    if term_id:
        query = query.where(GlobalDiscount.term_id == term_id)
    
    if is_active is not None:
        query = query.where(GlobalDiscount.is_active == is_active)
    
    # Get total count
    count_query = select(func.count(GlobalDiscount.id)).where(GlobalDiscount.school_id == current_user.school_id)
    if term_id:
        count_query = count_query.where(GlobalDiscount.term_id == term_id)
    if is_active is not None:
        count_query = count_query.where(GlobalDiscount.is_active == is_active)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Load relationships
    query = query.options(
        selectinload(GlobalDiscount.term),
        selectinload(GlobalDiscount.campus_discounts).selectinload(GlobalDiscountCampus.campus),
        selectinload(GlobalDiscount.class_discounts).selectinload(GlobalDiscountClass.class_)
    )
    
    result = await db.execute(query)
    discounts = result.scalars().all()
    
    # Format response
    data = []
    for discount in discounts:
        data.append({
            "id": discount.id,
            "school_id": discount.school_id,
            "discount_name": discount.discount_name,
            "discount_type": discount.discount_type,
            "discount_value": discount.discount_value,
            "term_id": discount.term_id,
            "applies_to": discount.applies_to,
            "condition_type": discount.condition_type,
            "condition_value": discount.condition_value,
            "is_active": discount.is_active,
            "created_at": discount.created_at.isoformat(),
            "updated_at": discount.updated_at.isoformat() if discount.updated_at else None,
            "term": {
                "id": discount.term.id,
                "name": discount.term.name,
            } if discount.term else None,
            "campus_discounts": [
                {
                    "id": cd.id,
                    "campus_id": cd.campus_id,
                    "campus": {
                        "id": cd.campus.id,
                        "name": cd.campus.name,
                    } if cd.campus else None,
                }
                for cd in discount.campus_discounts
            ],
            "class_discounts": [
                {
                    "id": cd.id,
                    "class_id": cd.class_id,
                    "class_": {
                        "id": cd.class_.id,
                        "name": cd.class_.name,
                    } if cd.class_ else None,
                }
                for cd in discount.class_discounts
            ],
        })
    
    return GlobalDiscountListResponse(
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
# Get Global Discount
# ============================================================================

@router.get("/global-discounts/{discount_id}", response_model=GlobalDiscountResponse)
async def get_global_discount(
    discount_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GlobalDiscountResponse:
    """
    Get a single global discount by ID.
    
    Permission: All authenticated users
    """
    result = await db.execute(
        select(GlobalDiscount)
        .where(
            GlobalDiscount.id == discount_id,
            GlobalDiscount.school_id == current_user.school_id
        )
        .options(
            selectinload(GlobalDiscount.term),
            selectinload(GlobalDiscount.campus_discounts).selectinload(GlobalDiscountCampus.campus),
            selectinload(GlobalDiscount.class_discounts).selectinload(GlobalDiscountClass.class_)
        )
    )
    discount = result.scalar_one_or_none()
    
    if not discount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "GLOBAL_DISCOUNT_NOT_FOUND", "message": "Global discount not found"}
        )
    
    return GlobalDiscountResponse(
        id=discount.id,
        school_id=discount.school_id,
        discount_name=discount.discount_name,
        discount_type=discount.discount_type,
        discount_value=discount.discount_value,
        term_id=discount.term_id,
        applies_to=discount.applies_to,
        condition_type=discount.condition_type,
        condition_value=discount.condition_value,
        is_active=discount.is_active,
        created_at=discount.created_at.isoformat(),
        updated_at=discount.updated_at.isoformat() if discount.updated_at else None,
        term={
            "id": discount.term.id,
            "name": discount.term.name,
        } if discount.term else None,
        campus_discounts=[
            {
                "id": cd.id,
                "campus_id": cd.campus_id,
                "campus": {
                    "id": cd.campus.id,
                    "name": cd.campus.name,
                } if cd.campus else None,
            }
            for cd in discount.campus_discounts
        ],
        class_discounts=[
            {
                "id": cd.id,
                "class_id": cd.class_id,
                "class_": {
                    "id": cd.class_.id,
                    "name": cd.class_.name,
                } if cd.class_ else None,
            }
            for cd in discount.class_discounts
        ],
    )


# ============================================================================
# Create Global Discount
# ============================================================================

@router.post("/global-discounts", response_model=GlobalDiscountResponse, status_code=status.HTTP_201_CREATED)
async def create_global_discount(
    discount_data: GlobalDiscountCreate,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> GlobalDiscountResponse:
    """
    Create a new global discount.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    
    Business Rules:
    - Only one active global discount per term
    - If creating an active discount, deactivate others for the same term
    """
    # Validate term exists
    term_result = await db.execute(
        select(Term).where(Term.id == discount_data.term_id)
    )
    term = term_result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "TERM_NOT_FOUND", "message": "Term not found"}
        )
    
    # Validate discount value based on type
    if discount_data.discount_type == "PERCENTAGE" and discount_data.discount_value > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_DISCOUNT_VALUE",
                "message": "Percentage discount cannot exceed 100%"
            }
        )
    
    # Validate selection IDs are provided when needed
    if discount_data.applies_to == "SELECTED_CAMPUSES" and (not discount_data.campus_ids or len(discount_data.campus_ids) == 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "MISSING_CAMPUS_IDS",
                "message": "campus_ids is required when applies_to = SELECTED_CAMPUSES"
            }
        )
    
    if discount_data.applies_to == "SELECTED_CLASSES" and (not discount_data.class_ids or len(discount_data.class_ids) == 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "MISSING_CLASS_IDS",
                "message": "class_ids is required when applies_to = SELECTED_CLASSES"
            }
        )
    
    # If activating this discount, deactivate others for the same term
    if discount_data.is_active:
        existing_result = await db.execute(
            select(GlobalDiscount).where(
                GlobalDiscount.term_id == discount_data.term_id,
                GlobalDiscount.school_id == current_user.school_id,
                GlobalDiscount.is_active == True
            )
        )
        existing_discounts = existing_result.scalars().all()
        for existing in existing_discounts:
            existing.is_active = False
            existing.updated_at = datetime.now(UTC)
    
    # Create global discount
    discount = GlobalDiscount(
        school_id=current_user.school_id,
        discount_name=discount_data.discount_name,
        discount_type=discount_data.discount_type,
        discount_value=discount_data.discount_value,
        term_id=discount_data.term_id,
        applies_to=discount_data.applies_to,
        condition_type=discount_data.condition_type,
        condition_value=discount_data.condition_value,
        is_active=discount_data.is_active,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(discount)
    await db.flush()
    
    # Create campus relationships if needed
    if discount_data.applies_to == "SELECTED_CAMPUSES" and discount_data.campus_ids:
        # Validate campuses belong to school
        campuses_result = await db.execute(
            select(Campus).where(
                Campus.id.in_(discount_data.campus_ids),
                Campus.school_id == current_user.school_id
            )
        )
        campuses = campuses_result.scalars().all()
        
        if len(campuses) != len(discount_data.campus_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "CAMPUS_NOT_FOUND", "message": "One or more campuses not found"}
            )
        
        for campus in campuses:
            campus_discount = GlobalDiscountCampus(
                global_discount_id=discount.id,
                campus_id=campus.id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(campus_discount)
    
    # Create class relationships if needed
    if discount_data.applies_to == "SELECTED_CLASSES" and discount_data.class_ids:
        # Validate classes belong to school
        classes_result = await db.execute(
            select(Class)
            .join(Campus)
            .where(
                Class.id.in_(discount_data.class_ids),
                Campus.school_id == current_user.school_id
            )
        )
        classes = classes_result.scalars().all()
        
        if len(classes) != len(discount_data.class_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "CLASS_NOT_FOUND", "message": "One or more classes not found"}
            )
        
        for class_ in classes:
            class_discount = GlobalDiscountClass(
                global_discount_id=discount.id,
                class_id=class_.id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(class_discount)
    
    await db.commit()
    await db.refresh(discount)
    
    # Load relationships for response
    result = await db.execute(
        select(GlobalDiscount)
        .where(GlobalDiscount.id == discount.id)
        .options(
            selectinload(GlobalDiscount.term),
            selectinload(GlobalDiscount.campus_discounts).selectinload(GlobalDiscountCampus.campus),
            selectinload(GlobalDiscount.class_discounts).selectinload(GlobalDiscountClass.class_)
        )
    )
    discount = result.scalar_one()
    
    return GlobalDiscountResponse(
        id=discount.id,
        school_id=discount.school_id,
        discount_name=discount.discount_name,
        discount_type=discount.discount_type,
        discount_value=discount.discount_value,
        term_id=discount.term_id,
        applies_to=discount.applies_to,
        condition_type=discount.condition_type,
        condition_value=discount.condition_value,
        is_active=discount.is_active,
        created_at=discount.created_at.isoformat(),
        updated_at=discount.updated_at.isoformat() if discount.updated_at else None,
        term={
            "id": discount.term.id,
            "name": discount.term.name,
        } if discount.term else None,
        campus_discounts=[
            {
                "id": cd.id,
                "campus_id": cd.campus_id,
                "campus": {
                    "id": cd.campus.id,
                    "name": cd.campus.name,
                } if cd.campus else None,
            }
            for cd in discount.campus_discounts
        ],
        class_discounts=[
            {
                "id": cd.id,
                "class_id": cd.class_id,
                "class_": {
                    "id": cd.class_.id,
                    "name": cd.class_.name,
                } if cd.class_ else None,
            }
            for cd in discount.class_discounts
        ],
    )


# ============================================================================
# Update Global Discount
# ============================================================================

@router.put("/global-discounts/{discount_id}", response_model=GlobalDiscountResponse)
async def update_global_discount(
    discount_id: UUID,
    discount_data: GlobalDiscountUpdate,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> GlobalDiscountResponse:
    """
    Update a global discount.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    result = await db.execute(
        select(GlobalDiscount).where(
            GlobalDiscount.id == discount_id,
            GlobalDiscount.school_id == current_user.school_id
        )
    )
    discount = result.scalar_one_or_none()
    
    if not discount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "GLOBAL_DISCOUNT_NOT_FOUND", "message": "Global discount not found"}
        )
    
    # Update fields
    if discount_data.discount_name is not None:
        discount.discount_name = discount_data.discount_name
    
    if discount_data.discount_type is not None:
        discount.discount_type = discount_data.discount_type
    
    if discount_data.discount_value is not None:
        # Validate discount value based on type
        discount_type = discount_data.discount_type or discount.discount_type
        if discount_type == "PERCENTAGE" and discount_data.discount_value > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "INVALID_DISCOUNT_VALUE",
                    "message": "Percentage discount cannot exceed 100%"
                }
            )
        discount.discount_value = discount_data.discount_value
    
    if discount_data.applies_to is not None:
        discount.applies_to = discount_data.applies_to
    
    if discount_data.condition_type is not None:
        discount.condition_type = discount_data.condition_type
    
    if discount_data.condition_value is not None:
        discount.condition_value = discount_data.condition_value
    
    # Handle is_active change
    if discount_data.is_active is not None:
        if discount_data.is_active and not discount.is_active:
            # If activating, deactivate others for the same term
            existing_result = await db.execute(
                select(GlobalDiscount).where(
                    GlobalDiscount.term_id == discount.term_id,
                    GlobalDiscount.school_id == current_user.school_id,
                    GlobalDiscount.is_active == True,
                    GlobalDiscount.id != discount.id
                )
            )
            existing_discounts = existing_result.scalars().all()
            for existing in existing_discounts:
                existing.is_active = False
                existing.updated_at = datetime.now(UTC)
        
        discount.is_active = discount_data.is_active
    
    discount.updated_at = datetime.now(UTC)
    
    # Update campus relationships if provided
    if discount_data.campus_ids is not None:
        # Remove existing relationships
        existing_campus_result = await db.execute(
            select(GlobalDiscountCampus).where(GlobalDiscountCampus.global_discount_id == discount.id)
        )
        existing_campuses = existing_campus_result.scalars().all()
        for existing in existing_campuses:
            db.delete(existing)
        
        # Add new relationships
        if discount_data.campus_ids:
            campuses_result = await db.execute(
                select(Campus).where(
                    Campus.id.in_(discount_data.campus_ids),
                    Campus.school_id == current_user.school_id
                )
            )
            campuses = campuses_result.scalars().all()
            
            if len(campuses) != len(discount_data.campus_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "CAMPUS_NOT_FOUND", "message": "One or more campuses not found"}
                )
            
            for campus in campuses:
                campus_discount = GlobalDiscountCampus(
                    global_discount_id=discount.id,
                    campus_id=campus.id,
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                db.add(campus_discount)
    
    # Update class relationships if provided
    if discount_data.class_ids is not None:
        # Remove existing relationships
        existing_class_result = await db.execute(
            select(GlobalDiscountClass).where(GlobalDiscountClass.global_discount_id == discount.id)
        )
        existing_classes = existing_class_result.scalars().all()
        for existing in existing_classes:
            db.delete(existing)
        
        # Add new relationships
        if discount_data.class_ids:
            classes_result = await db.execute(
                select(Class)
                .join(Campus)
                .where(
                    Class.id.in_(discount_data.class_ids),
                    Campus.school_id == current_user.school_id
                )
            )
            classes = classes_result.scalars().all()
            
            if len(classes) != len(discount_data.class_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "CLASS_NOT_FOUND", "message": "One or more classes not found"}
                )
            
            for class_ in classes:
                class_discount = GlobalDiscountClass(
                    global_discount_id=discount.id,
                    class_id=class_.id,
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                db.add(class_discount)
    
    await db.commit()
    await db.refresh(discount)
    
    # Load relationships for response
    result = await db.execute(
        select(GlobalDiscount)
        .where(GlobalDiscount.id == discount.id)
        .options(
            selectinload(GlobalDiscount.term),
            selectinload(GlobalDiscount.campus_discounts).selectinload(GlobalDiscountCampus.campus),
            selectinload(GlobalDiscount.class_discounts).selectinload(GlobalDiscountClass.class_)
        )
    )
    discount = result.scalar_one()
    
    return GlobalDiscountResponse(
        id=discount.id,
        school_id=discount.school_id,
        discount_name=discount.discount_name,
        discount_type=discount.discount_type,
        discount_value=discount.discount_value,
        term_id=discount.term_id,
        applies_to=discount.applies_to,
        condition_type=discount.condition_type,
        condition_value=discount.condition_value,
        is_active=discount.is_active,
        created_at=discount.created_at.isoformat(),
        updated_at=discount.updated_at.isoformat() if discount.updated_at else None,
        term={
            "id": discount.term.id,
            "name": discount.term.name,
        } if discount.term else None,
        campus_discounts=[
            {
                "id": cd.id,
                "campus_id": cd.campus_id,
                "campus": {
                    "id": cd.campus.id,
                    "name": cd.campus.name,
                } if cd.campus else None,
            }
            for cd in discount.campus_discounts
        ],
        class_discounts=[
            {
                "id": cd.id,
                "class_id": cd.class_id,
                "class_": {
                    "id": cd.class_.id,
                    "name": cd.class_.name,
                } if cd.class_ else None,
            }
            for cd in discount.class_discounts
        ],
    )


# ============================================================================
# Delete Global Discount
# ============================================================================

@router.delete("/global-discounts/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_global_discount(
    discount_id: UUID,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a global discount.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    result = await db.execute(
        select(GlobalDiscount).where(
            GlobalDiscount.id == discount_id,
            GlobalDiscount.school_id == current_user.school_id
        )
    )
    discount = result.scalar_one_or_none()
    
    if not discount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "GLOBAL_DISCOUNT_NOT_FOUND", "message": "Global discount not found"}
        )
    
    db.delete(discount)
    await db.commit()

