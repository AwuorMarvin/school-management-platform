"""
Fee Structure endpoints - List and academic year fee overview.
"""

from typing import Optional
from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.fee_structure import FeeStructure, FeeStructureClass
from app.models.academic_year import AcademicYear
from app.models.term import Term
from app.models.campus import Campus
from app.models import Class
from app.schemas.fee_structure import (
    AcademicYearFeeOverviewResponse, 
    AcademicYearFeeOverviewRow,
    FeeStructureListResponse,
    FeeStructureResponse
)

router = APIRouter()


# ============================================================================
# List Fee Structures
# ============================================================================

@router.get("/fee-structures", response_model=FeeStructureListResponse)
async def list_fee_structures(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=100, description="Number of records to return"),
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year ID"),
    term_id: Optional[UUID] = Query(None, description="Filter by term ID"),
    class_id: Optional[UUID] = Query(None, description="Filter by class ID"),
    campus_id: Optional[UUID] = Query(None, description="Filter by campus ID"),
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE, INACTIVE)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> FeeStructureListResponse:
    """
    List fee structures with filtering and pagination.
    
    Permission: All authenticated users (scope-filtered by school)
    """
    # Build base query with tenant isolation
    query = select(FeeStructure).where(FeeStructure.school_id == current_user.school_id)
    count_query = select(func.count(FeeStructure.id)).where(FeeStructure.school_id == current_user.school_id)
    
    # Apply academic year filter
    if academic_year_id:
        # Validate academic year belongs to school
        ay_result = await db.execute(
            select(AcademicYear).where(
                AcademicYear.id == academic_year_id,
                AcademicYear.school_id == current_user.school_id
            )
        )
        if not ay_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "ACADEMIC_YEAR_NOT_FOUND",
                    "message": "Academic year not found or does not belong to your school"
                }
            )
        query = query.where(FeeStructure.academic_year_id == academic_year_id)
        count_query = count_query.where(FeeStructure.academic_year_id == academic_year_id)
    
    # Apply term filter
    if term_id:
        query = query.where(FeeStructure.term_id == term_id)
        count_query = count_query.where(FeeStructure.term_id == term_id)
    
    # Apply status filter
    if status:
        if status not in ["ACTIVE", "INACTIVE"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "INVALID_STATUS",
                    "message": "Status must be ACTIVE or INACTIVE"
                }
            )
        query = query.where(FeeStructure.status == status)
        count_query = count_query.where(FeeStructure.status == status)
    
    # Apply class filter - check both legacy class_id and junction table
    if class_id:
        # Check if class exists and belongs to school
        class_result = await db.execute(
            select(Class)
            .join(Campus)
            .where(
                Class.id == class_id,
                Campus.school_id == current_user.school_id
            )
        )
        if not class_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "CLASS_NOT_FOUND",
                    "message": "Class not found or does not belong to your school"
                }
            )
        
        # Filter by class_id (legacy) OR by fee_structure_class junction table
        query = query.where(
            or_(
                FeeStructure.class_id == class_id,
                FeeStructure.id.in_(
                    select(FeeStructureClass.fee_structure_id).where(
                        FeeStructureClass.class_id == class_id
                    )
                )
            )
        )
        count_query = count_query.where(
            or_(
                FeeStructure.class_id == class_id,
                FeeStructure.id.in_(
                    select(FeeStructureClass.fee_structure_id).where(
                        FeeStructureClass.class_id == class_id
                    )
                )
            )
        )
    
    # Apply campus filter
    if campus_id:
        # Validate campus belongs to school
        campus_result = await db.execute(
            select(Campus).where(
                Campus.id == campus_id,
                Campus.school_id == current_user.school_id
            )
        )
        if not campus_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "CAMPUS_NOT_FOUND",
                    "message": "Campus not found or does not belong to your school"
                }
            )
        query = query.where(FeeStructure.campus_id == campus_id)
        count_query = count_query.where(FeeStructure.campus_id == campus_id)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Load relationships
    query = query.options(
        selectinload(FeeStructure.line_items),
        selectinload(FeeStructure.classes).selectinload(FeeStructureClass.class_),
        selectinload(FeeStructure.campus),
        selectinload(FeeStructure.academic_year),
        selectinload(FeeStructure.term)
    )
    
    # Order by created_at descending (most recent first)
    query = query.order_by(FeeStructure.created_at.desc())
    
    result = await db.execute(query)
    structures = result.scalars().all()
    
    # Convert to response format
    data = []
    for structure in structures:
        # Get class IDs from junction table or legacy field
        class_ids = []
        if structure.classes:
            class_ids = [fsc.class_id for fsc in structure.classes]
        elif structure.class_id:
            class_ids = [structure.class_id]
        
        # Get class details
        classes_data = []
        if structure.classes:
            classes_data = [
                {"id": str(fsc.class_id), "name": fsc.class_.name if fsc.class_ else "Unknown"}
                for fsc in structure.classes
            ]
        
        data.append(FeeStructureResponse(
            id=structure.id,
            school_id=structure.school_id,
            structure_name=structure.structure_name,
            campus_id=structure.campus_id,
            academic_year_id=structure.academic_year_id,
            term_id=structure.term_id,
            structure_scope=structure.structure_scope,
            version=structure.version,
            parent_structure_id=structure.parent_structure_id,
            status=structure.status,
            base_fee=structure.base_fee,
            effective_from=structure.effective_from.isoformat() if structure.effective_from else None,
            effective_to=structure.effective_to.isoformat() if structure.effective_to else None,
            created_at=structure.created_at.isoformat(),
            updated_at=structure.updated_at.isoformat() if structure.updated_at else None,
            class_ids=class_ids,
            classes=classes_data,
            campus={"id": str(structure.campus.id), "name": structure.campus.name} if structure.campus else None,
            academic_year={"id": str(structure.academic_year.id), "name": structure.academic_year.name} if structure.academic_year else None,
            term={"id": str(structure.term.id), "name": structure.term.name} if structure.term else None,
            line_items=[
                {
                    "id": item.id,
                    "item_name": item.item_name,
                    "amount": item.amount,
                    "display_order": item.display_order,
                    "is_annual": item.is_annual,
                    "is_one_off": item.is_one_off
                }
                for item in structure.line_items
            ]
        ))
    
    # Calculate pagination info
    total_pages = (total + limit - 1) // limit if limit > 0 else 0
    current_page = (skip // limit) + 1 if limit > 0 else 1
    
    return FeeStructureListResponse(
        data=data,
        pagination={
            "page": current_page,
            "page_size": limit,
            "total": total,
            "total_pages": total_pages,
            "has_next": skip + limit < total,
            "has_previous": skip > 0
        }
    )


# ============================================================================
# Academic Year Fee Overview
# ============================================================================

@router.get("/fee-structures/academic-year-overview", response_model=AcademicYearFeeOverviewResponse)
async def get_academic_year_fee_overview(
    academic_year_id: UUID = Query(..., description="Academic year ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> AcademicYearFeeOverviewResponse:
    """
    Get fee structure overview for an academic year.
    
    Returns fee structure data grouped by campus and class, showing amounts for:
    - Term 1, Term 2, Term 3
    - Annual fees
    - One-off fees
    - Total
    
    Permission: All authenticated users (scope-filtered by school)
    """
    # Validate academic year exists and belongs to school
    academic_year_result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.id == academic_year_id,
            AcademicYear.school_id == current_user.school_id
        )
    )
    academic_year = academic_year_result.scalar_one_or_none()
    
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "ACADEMIC_YEAR_NOT_FOUND",
                "message": "Academic year not found or does not belong to your school"
            }
        )
    
    # Get all terms for this academic year
    terms_result = await db.execute(
        select(Term)
        .where(Term.academic_year_id == academic_year_id)
        .order_by(Term.start_date)
    )
    terms = terms_result.scalars().all()
    
    # Identify term 1, term 2, term 3 (assuming sorted by start_date)
    term_1_id = terms[0].id if len(terms) > 0 else None
    term_2_id = terms[1].id if len(terms) > 1 else None
    term_3_id = terms[2].id if len(terms) > 2 else None
    
    # Get all fee structures for this academic year
    # Load line items and classes relationships
    structures_result = await db.execute(
        select(FeeStructure)
        .options(
            selectinload(FeeStructure.line_items),
            selectinload(FeeStructure.classes).selectinload(FeeStructureClass.class_)
        )
        .where(
            FeeStructure.academic_year_id == academic_year_id,
            FeeStructure.school_id == current_user.school_id
        )
        .order_by(FeeStructure.created_at.desc())
    )
    structures = structures_result.scalars().all()
    
    # Group structures by (campus_id, class_id, term_id)
    # Use the most recent structure for each combination
    structure_map: dict[tuple[UUID, UUID, UUID | None], FeeStructure] = {}
    
    for structure in structures:
        # Get classes for this structure
        class_ids = []
        if structure.classes:
            class_ids = [fsc.class_id for fsc in structure.classes]
        elif structure.class_id:  # Legacy support
            class_ids = [structure.class_id]
        
        # Create entries for each class
        for class_id in class_ids:
            key = (structure.campus_id, class_id, structure.term_id)
            # Keep only the most recent structure (already sorted by created_at desc)
            if key not in structure_map:
                structure_map[key] = structure
    
    # Get all unique campus-class combinations
    campus_class_combinations: dict[tuple[UUID, UUID], dict] = {}
    
    # Get campus and class details
    campus_ids = set()
    class_ids = set()
    for (campus_id, class_id, _) in structure_map.keys():
        campus_ids.add(campus_id)
        class_ids.add(class_id)
    
    # Fetch campus and class details
    if campus_ids:
        campuses_result = await db.execute(
            select(Campus).where(Campus.id.in_(campus_ids))
        )
        campuses = {c.id: c for c in campuses_result.scalars().all()}
    else:
        campuses = {}
    
    if class_ids:
        classes_result = await db.execute(
            select(Class).where(Class.id.in_(class_ids))
        )
        classes = {c.id: c for c in classes_result.scalars().all()}
    else:
        classes = {}
    
    # Aggregate amounts by campus and class
    for (campus_id, class_id, term_id), structure in structure_map.items():
        key = (campus_id, class_id)
        
        if key not in campus_class_combinations:
            campus = campuses.get(campus_id)
            class_ = classes.get(class_id)
            campus_class_combinations[key] = {
                "campus_id": campus_id,
                "campus_name": campus.name if campus else "Unknown",
                "class_id": class_id,
                "class_name": class_.name if class_ else "Unknown",
                "term_1_amount": Decimal("0.00"),
                "term_2_amount": Decimal("0.00"),
                "term_3_amount": Decimal("0.00"),
                "annual_amount": Decimal("0.00"),
                "one_off_amount": Decimal("0.00"),
                "structure_ids": []
            }
        
        row = campus_class_combinations[key]
        row["structure_ids"].append(structure.id)
        
        # Calculate amounts from line items
        if structure.line_items:
            for line_item in structure.line_items:
                amount = line_item.amount
                
                if line_item.is_one_off:
                    # One-off items should only be counted once per academic year
                    # Count them if: structure is YEAR-scoped (term_id is None) OR it's in term 1
                    if term_id is None or term_id == term_1_id:
                        row["one_off_amount"] += amount
                elif line_item.is_annual:
                    # Annual items should only be counted once per academic year
                    # Count them if: structure is YEAR-scoped (term_id is None) OR it's in term 1
                    if term_id is None or term_id == term_1_id:
                        row["annual_amount"] += amount
                else:
                    # Regular term fees - only count if structure has a specific term
                    if term_id == term_1_id:
                        row["term_1_amount"] += amount
                    elif term_id == term_2_id:
                        row["term_2_amount"] += amount
                    elif term_id == term_3_id:
                        row["term_3_amount"] += amount
                    # Note: YEAR-scoped structures (term_id is None) don't contribute to term-specific amounts
    
    # Convert to response format and calculate totals
    rows = []
    for key, row_data in campus_class_combinations.items():
        total = (
            row_data["term_1_amount"] +
            row_data["term_2_amount"] +
            row_data["term_3_amount"] +
            row_data["annual_amount"] +
            row_data["one_off_amount"]
        )
        
        # Collect line items from all structures for this row
        line_items_list = []
        # Track annual/one-off items to avoid duplicates (only show from term 1 or YEAR-scoped)
        annual_items_collected = set()
        one_off_items_collected = set()
        
        # Process structures - collect all line items
        for structure_id in row_data["structure_ids"]:
            # Find the structure
            structure = next((s for s in structures if s.id == structure_id), None)
            if not structure or not structure.line_items:
                continue
                
            for line_item in structure.line_items:
                # Determine which term/category this item belongs to
                term_name = None
                should_include = False
                
                if line_item.is_one_off:
                    # Only include one-off items from term 1 or YEAR-scoped structures, and only once
                    if (structure.term_id is None or structure.term_id == term_1_id):
                        item_key = f"{line_item.item_name}_{float(line_item.amount)}"
                        if item_key not in one_off_items_collected:
                            term_name = "ONE_OFF"
                            should_include = True
                            one_off_items_collected.add(item_key)
                elif line_item.is_annual:
                    # Only include annual items from term 1 or YEAR-scoped structures, and only once
                    if (structure.term_id is None or structure.term_id == term_1_id):
                        item_key = f"{line_item.item_name}_{float(line_item.amount)}"
                        if item_key not in annual_items_collected:
                            term_name = "ANNUAL"
                            should_include = True
                            annual_items_collected.add(item_key)
                else:
                    # Regular term fees - include from the appropriate term
                    if structure.term_id == term_1_id:
                        term_name = "TERM_1"
                        should_include = True
                    elif structure.term_id == term_2_id:
                        term_name = "TERM_2"
                        should_include = True
                    elif structure.term_id == term_3_id:
                        term_name = "TERM_3"
                        should_include = True
                
                if should_include and term_name:
                    line_items_list.append({
                        "term": term_name,
                        "item_name": line_item.item_name,
                        "amount": float(line_item.amount),
                        "is_annual": line_item.is_annual,
                        "is_one_off": line_item.is_one_off,
                        "display_order": line_item.display_order
                    })
        
        rows.append(AcademicYearFeeOverviewRow(
            campus_id=row_data["campus_id"],
            campus_name=row_data["campus_name"],
            class_id=row_data["class_id"],
            class_name=row_data["class_name"],
            term_1_amount=row_data["term_1_amount"] if row_data["term_1_amount"] > 0 else None,
            term_2_amount=row_data["term_2_amount"] if row_data["term_2_amount"] > 0 else None,
            term_3_amount=row_data["term_3_amount"] if row_data["term_3_amount"] > 0 else None,
            annual_amount=row_data["annual_amount"] if row_data["annual_amount"] > 0 else None,
            one_off_amount=row_data["one_off_amount"] if row_data["one_off_amount"] > 0 else None,
            total_amount=total,
            structure_ids=row_data["structure_ids"],
            line_items=line_items_list if line_items_list else None
        ))
    
    # Sort rows by campus name, then class name
    rows.sort(key=lambda r: (r.campus_name, r.class_name))
    
    return AcademicYearFeeOverviewResponse(
        academic_year_id=academic_year_id,
        academic_year_name=academic_year.name,
        rows=rows
    )

