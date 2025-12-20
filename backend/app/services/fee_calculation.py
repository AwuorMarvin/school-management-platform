"""
Fee Calculation Service - Calculate student fees based on class, term, clubs, transport, discounts, and adjustments.
"""

from decimal import Decimal
from uuid import UUID
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.fee_structure import FeeStructure, FeeStructureClass
from app.models.fee_line_item import FeeLineItem
from app.models.fee_adjustment import FeeAdjustment
from app.models.global_discount import GlobalDiscount, GlobalDiscountCampus, GlobalDiscountClass
from app.models.club_activity import ClubActivity
from app.models.student_club_activity import StudentClubActivity
from app.models.transport_route import TransportRoute
from app.models.student import Student
from app.models.student_one_off_fee import StudentOneOffFee
from app.models.student_academic_enrollment import StudentAcademicEnrollment
from app.models import Class
from app.models.campus import Campus
from app.models.term import Term
from app.models.academic_year import AcademicYear


async def calculate_student_fee(
    db: AsyncSession,
    student_id: UUID,
    class_id: UUID,
    term_id: UUID,
    club_activity_ids: Optional[list[UUID]] = None,
    transport_route_id: Optional[UUID] = None,
    school_id: Optional[UUID] = None,
    include_discounts: bool = True,
    include_adjustments: bool = True
) -> Decimal:
    """
    Calculate effective expected fee for a student.
    
    Formula:
    - Base fee (sum of line items from ACTIVE FeeStructure)
    - Plus: Sum of all club/activity fees
    - Plus: Transport route fee (if assigned)
    - Minus: Global discounts (if applicable)
    - Minus: Per-student adjustments (if any)
    
    Args:
        db: Database session
        student_id: Student ID (for validation and adjustments)
        class_id: Class ID
        term_id: Term ID
        club_activity_ids: List of club/activity IDs (optional)
        transport_route_id: Transport route ID (optional)
        school_id: School ID for tenant isolation
        include_discounts: Whether to apply global discounts
        include_adjustments: Whether to apply per-student adjustments
    
    Returns:
        Effective expected fee amount (after discounts and adjustments)
    """
    total_fee = Decimal("0.00")
    
    # Get term and academic year info
    term_result = await db.execute(select(Term).where(Term.id == term_id))
    term_obj = term_result.scalar_one_or_none()
    
    if not term_obj:
        return Decimal("0.00")
    
    academic_year_id = term_obj.academic_year_id
    
    # Get student enrollment info to determine if new student
    enrollment_result = await db.execute(
        select(StudentAcademicEnrollment)
        .where(
            StudentAcademicEnrollment.student_id == student_id,
            StudentAcademicEnrollment.academic_year_id == academic_year_id
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()
    enrollment_term_id = enrollment.enrollment_term_id if enrollment else None
    
    # Check if student is new (enrolled in this term or later)
    is_new_student = enrollment_term_id == term_id if enrollment_term_id else False
    
    # Get existing one-off fees for this student in this academic year
    one_off_fees_result = await db.execute(
        select(StudentOneOffFee.fee_line_item_id)
        .where(
            StudentOneOffFee.student_id == student_id,
            StudentOneOffFee.academic_year_id == academic_year_id,
            StudentOneOffFee.paid_at.isnot(None)  # Only count paid one-off fees
        )
    )
    paid_one_off_line_item_ids = set(one_off_fees_result.scalars().all())
    
    # 1. Get fee structure for this class+term (supporting multi-class via junction table)
    # Priority: ACTIVE structures, then most recent
    fee_structure_result = await db.execute(
        select(FeeStructure)
        .join(FeeStructureClass, FeeStructure.id == FeeStructureClass.fee_structure_id)
        .where(
            FeeStructureClass.class_id == class_id,
            FeeStructure.term_id == term_id,
            FeeStructure.status == "ACTIVE",
            FeeStructure.school_id == school_id
        )
        .options(selectinload(FeeStructure.line_items))
        .order_by(FeeStructure.created_at.desc())
        .limit(1)
    )
    fee_structure = fee_structure_result.scalar_one_or_none()
    
    # Fallback: Try YEAR-scoped structures if no TERM-scoped found
    if not fee_structure:
        fee_structure_result = await db.execute(
            select(FeeStructure)
            .join(FeeStructureClass, FeeStructure.id == FeeStructureClass.fee_structure_id)
            .where(
                FeeStructureClass.class_id == class_id,
                FeeStructure.academic_year_id == academic_year_id,
                FeeStructure.structure_scope == "YEAR",
                FeeStructure.term_id == term_id,  # YEAR structures still have term_id for organization
                FeeStructure.status == "ACTIVE",
                FeeStructure.school_id == school_id
            )
            .options(selectinload(FeeStructure.line_items))
            .order_by(FeeStructure.created_at.desc())
            .limit(1)
        )
        fee_structure = fee_structure_result.scalar_one_or_none()
    
    # Backward compatibility: Try old class_id field (for legacy structures)
    # This is a fallback for structures created before the junction table migration
    if not fee_structure:
        fee_structure_result = await db.execute(
            select(FeeStructure)
            .where(
                FeeStructure.class_id == class_id,
                FeeStructure.term_id == term_id,
                FeeStructure.status == "ACTIVE",
                FeeStructure.school_id == school_id
            )
            .options(selectinload(FeeStructure.line_items))
            .order_by(FeeStructure.created_at.desc())
            .limit(1)
        )
        fee_structure = fee_structure_result.scalar_one_or_none()
        
        # If found via class_id, ensure it has a junction table entry
        if fee_structure:
            junction_check = await db.execute(
                select(FeeStructureClass).where(
                    FeeStructureClass.fee_structure_id == fee_structure.id,
                    FeeStructureClass.class_id == class_id
                )
            )
            if not junction_check.scalar_one_or_none():
                # Create junction table entry for backward compatibility
                fs_class = FeeStructureClass(
                    fee_structure_id=fee_structure.id,
                    class_id=class_id,
                    created_at=fee_structure.created_at,
                )
                db.add(fs_class)
                await db.commit()
    
    if fee_structure and fee_structure.line_items:
        # Process line items based on type
        for item in fee_structure.line_items:
            # One-off fees: Only for new students and not already paid
            if item.is_one_off:
                if is_new_student and item.id not in paid_one_off_line_item_ids:
                    total_fee += item.amount
                    # Mark as applicable (will be recorded when fee is paid)
            # Annual fees: Only once per academic year, check if already paid
            elif item.is_annual:
                # Check if this annual fee was already paid in this academic year
                annual_paid_result = await db.execute(
                    select(StudentOneOffFee)
                    .where(
                        StudentOneOffFee.student_id == student_id,
                        StudentOneOffFee.fee_line_item_id == item.id,
                        StudentOneOffFee.academic_year_id == academic_year_id,
                        StudentOneOffFee.paid_at.isnot(None)
                    )
                )
                if not annual_paid_result.scalar_one_or_none():
                    # Only charge in first term of academic year (or if enrollment term)
                    terms_in_year_result = await db.execute(
                        select(Term)
                        .where(Term.academic_year_id == academic_year_id)
                        .order_by(Term.start_date)
                    )
                    terms_in_year = terms_in_year_result.scalars().all()
                    if terms_in_year:
                        first_term = terms_in_year[0]
                        # Charge in enrollment term if new student, otherwise first term
                        charge_term_id = enrollment_term_id if is_new_student and enrollment_term_id else first_term.id
                        if term_id == charge_term_id:
                            total_fee += item.amount
            # Termly fees: Charge every term (if term >= enrollment term)
            else:
                # Only charge if term >= enrollment term
                should_charge_termly = True
                if enrollment_term_id:
                    # Get enrollment term start date for comparison
                    enroll_term_result = await db.execute(
                        select(Term.start_date).where(Term.id == enrollment_term_id)
                    )
                    enroll_term_start = enroll_term_result.scalar_one_or_none()
                    if enroll_term_start:
                        # Only charge if current term starts on or after enrollment term
                        should_charge_termly = term_obj.start_date >= enroll_term_start
                
                if should_charge_termly:
                    total_fee += item.amount
    elif fee_structure:
        # Fallback to base_fee if no line items
        total_fee += fee_structure.base_fee
    # If no active fee structure exists, base fee is 0 (admin should set it up)
    
    # 2. Add club/activity fees
    if club_activity_ids:
        club_activities_result = await db.execute(
            select(ClubActivity).where(
                ClubActivity.id.in_(club_activity_ids),
                ClubActivity.term_id == term_id
            )
        )
        club_activities = club_activities_result.scalars().all()
        
        for activity in club_activities:
            total_fee += activity.cost_per_term
    
    # 3. Add transport route fee
    if transport_route_id:
        transport_route_result = await db.execute(
            select(TransportRoute).where(TransportRoute.id == transport_route_id)
        )
        transport_route = transport_route_result.scalar_one_or_none()

        if transport_route:
            # Determine student's transport type (ONE_WAY / TWO_WAY). Default to TWO_WAY.
            student_result = await db.execute(
                select(Student.transport_type).where(Student.id == student_id)
            )
            transport_type = student_result.scalar_one_or_none()

            if transport_type == "ONE_WAY":
                total_fee += transport_route.one_way_cost_per_term
            else:
                # Default to two-way if type is missing or invalid
                total_fee += transport_route.two_way_cost_per_term
    
    # 4. Apply global discounts (if enabled)
    if include_discounts and school_id:
        global_discounts = await get_applicable_global_discounts(
            db=db,
            student_id=student_id,
            class_id=class_id,
            term_id=term_id,
            school_id=school_id
        )
        
        for discount in global_discounts:
            if discount.discount_type == "FIXED_AMOUNT":
                total_fee = max(Decimal("0.00"), total_fee - discount.discount_value)
            elif discount.discount_type == "PERCENTAGE":
                discount_amount = (total_fee * discount.discount_value) / Decimal("100.00")
                total_fee = max(Decimal("0.00"), total_fee - discount_amount)
    
    # 5. Apply per-student adjustments (if enabled)
    if include_adjustments:
        adjustments_result = await db.execute(
            select(FeeAdjustment).where(
                FeeAdjustment.student_id == student_id,
                FeeAdjustment.term_id == term_id
            )
        )
        adjustments = adjustments_result.scalars().all()
        
        for adjustment in adjustments:
            if adjustment.adjustment_type == "FIXED_AMOUNT":
                total_fee = max(Decimal("0.00"), total_fee - adjustment.adjustment_value)
            elif adjustment.adjustment_type == "PERCENTAGE":
                discount_amount = (total_fee * adjustment.adjustment_value) / Decimal("100.00")
                total_fee = max(Decimal("0.00"), total_fee - discount_amount)
    
    return total_fee


async def get_applicable_global_discounts(
    db: AsyncSession,
    student_id: UUID,
    class_id: UUID,
    term_id: UUID,
    school_id: UUID
) -> list[GlobalDiscount]:
    """
    Get global discounts applicable to a student.
    
    Args:
        db: Database session
        student_id: Student ID
        class_id: Class ID
        term_id: Term ID
        school_id: School ID
    
    Returns:
        List of applicable global discounts
    """
    # Get student's campus
    student_result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        return []
    
    # Get student's class to find campus
    class_result = await db.execute(
        select(Class).where(Class.id == class_id)
    )
    class_ = class_result.scalar_one_or_none()
    
    if not class_:
        return []
    
    campus_id = class_.campus_id
    
    # Get active global discounts for this term
    discounts_result = await db.execute(
        select(GlobalDiscount)
        .where(
            GlobalDiscount.term_id == term_id,
            GlobalDiscount.school_id == school_id,
            GlobalDiscount.is_active == True
        )
        .options(
            selectinload(GlobalDiscount.campus_discounts),
            selectinload(GlobalDiscount.class_discounts)
        )
    )
    all_discounts = discounts_result.scalars().all()
    
    applicable_discounts = []
    
    for discount in all_discounts:
        if discount.applies_to == "ALL_STUDENTS":
            applicable_discounts.append(discount)
        elif discount.applies_to == "SELECTED_CAMPUSES":
            # Check if student's campus is in the list
            campus_ids = [cd.campus_id for cd in discount.campus_discounts]
            if campus_id in campus_ids:
                applicable_discounts.append(discount)
        elif discount.applies_to == "SELECTED_CLASSES":
            # Check if student's class is in the list
            class_ids = [cd.class_id for cd in discount.class_discounts]
            if class_id in class_ids:
                applicable_discounts.append(discount)
    
    return applicable_discounts


async def calculate_student_fee_from_student(
    db: AsyncSession,
    student: Student,
    term_id: UUID
) -> Decimal:
    """
    Calculate fee for a student based on their current assignments.
    
    This is a convenience function that extracts the necessary information
    from the student object and their relationships.
    
    Args:
        db: Database session
        student: Student object (with relationships loaded)
        term_id: Term ID to calculate fee for
    
    Returns:
        Total expected fee amount
    """
    # Get student's current class assignment
    from app.models.student_class_history import StudentClassHistory
    
    class_assignment_result = await db.execute(
        select(StudentClassHistory)
        .where(
            StudentClassHistory.student_id == student.id,
            StudentClassHistory.end_date.is_(None)  # Active assignment
        )
        .order_by(StudentClassHistory.start_date.desc())
        .limit(1)
    )
    class_assignment = class_assignment_result.scalar_one_or_none()
    
    if not class_assignment:
        return Decimal("0.00")
    
    class_id = class_assignment.class_id
    
    # Get student's club activities for this term
    club_activities_result = await db.execute(
        select(StudentClubActivity)
        .join(ClubActivity)
        .where(
            StudentClubActivity.student_id == student.id,
            ClubActivity.term_id == term_id
        )
    )
    club_activity_links = club_activities_result.scalars().all()
    club_activity_ids = [link.club_activity_id for link in club_activity_links]
    
    # Get transport route
    transport_route_id = student.transport_route_id
    
    return await calculate_student_fee(
        db=db,
        student_id=student.id,
        class_id=class_id,
        term_id=term_id,
        club_activity_ids=club_activity_ids if club_activity_ids else None,
        transport_route_id=transport_route_id,
        school_id=student.school_id
    )


async def ensure_fee_record(
    db: AsyncSession,
    student_id: UUID,
    term_id: UUID,
    expected_amount: Decimal,
    school_id: UUID
) -> "Fee":
    """
    Ensure a fee record exists for a student and term.
    Creates one if it doesn't exist, updates expected_amount if it does.
    
    Args:
        db: Database session
        student_id: Student ID
        term_id: Term ID
        expected_amount: Expected fee amount
        school_id: School ID for validation
    
    Returns:
        Fee record (created or updated)
    """
    from app.models.fee import Fee
    from datetime import datetime, UTC
    
    # Check if fee record exists
    fee_result = await db.execute(
        select(Fee).where(
            Fee.student_id == student_id,
            Fee.term_id == term_id
        )
    )
    fee = fee_result.scalar_one_or_none()
    
    if fee:
        # Update expected amount if different
        if fee.expected_amount != expected_amount:
            fee.expected_amount = expected_amount
            fee.updated_at = datetime.now(UTC)
    else:
        # Create new fee record
        fee = Fee(
            student_id=student_id,
            term_id=term_id,
            expected_amount=expected_amount,
            paid_amount=Decimal("0.00"),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(fee)
    
    return fee

