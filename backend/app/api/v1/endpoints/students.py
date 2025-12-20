"""
Student endpoints - CRUD operations for students.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, UTC, timedelta, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_school_admin, require_campus_admin
from app.core.security import generate_secure_token, hash_token
from app.models.student import Student
from app.models.campus import Campus
from app.models.user import User
from app.models.parent import Parent
from app.models.student_parent import StudentParent
from app.models.account_setup_token import AccountSetupToken
from app.models.student_class_history import StudentClassHistory
from app.models.student_academic_enrollment import StudentAcademicEnrollment
from app.models.academic_year import AcademicYear
from app.models.term import Term
from app.models import Class
from app.models.transport_route import TransportRoute
from app.models.club_activity import ClubActivity
from app.models.student_club_activity import StudentClubActivity
from app.models.fee import Fee
from app.models.payment_history import PaymentHistory
from app.services.fee_calculation import calculate_student_fee, ensure_fee_record, calculate_student_fee_from_student
from app.schemas.student import (
    StudentCreate,
    StudentUpdate,
    StudentStatusChange,
    StudentResponse,
    LinkParentToStudent,
    StudentParentResponse,
)
from app.schemas.payment import PaymentCreate, PaymentResponse

router = APIRouter()

# State transition rules
ALLOWED_TRANSITIONS = {
    "INACTIVE": ["ACTIVE"],
    "ACTIVE": ["COMPLETED", "TRANSFERRED_OUT", "INACTIVE"],
    "COMPLETED": [],  # Terminal state
    "TRANSFERRED_OUT": [],  # Terminal state
}


def validate_status_transition(current_status: str, new_status: str) -> bool:
    """Validate if status transition is allowed."""
    allowed = ALLOWED_TRANSITIONS.get(current_status, [])
    return new_status in allowed


# ============================================================================
# List Students
# ============================================================================

@router.get("/students", response_model=dict)
async def list_students(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    campus_id: Optional[UUID] = Query(None, description="Filter by campus ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by name"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List students with filtering and pagination.
    
    Scope:
    - SCHOOL_ADMIN: All students in school
    - CAMPUS_ADMIN: Students in their campus only
    - TEACHER: Students in assigned classes (TODO: implement)
    - PARENT: Only their children (TODO: implement)
    """
    # Build base query with tenant isolation
    query = select(Student).where(Student.school_id == current_user.school_id)
    
    # Apply role-based filtering
    if current_user.role == "CAMPUS_ADMIN":
        if current_user.campus_id:
            query = query.where(Student.campus_id == current_user.campus_id)
    elif current_user.role == "SCHOOL_ADMIN":
        # Can filter by campus if provided
        if campus_id:
            # Verify campus belongs to school
            campus_result = await db.execute(
                select(Campus).where(
                    Campus.id == campus_id,
                    Campus.school_id == current_user.school_id
                )
            )
            if not campus_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "CAMPUS_NOT_FOUND", "message": "Campus not found"}
                )
            query = query.where(Student.campus_id == campus_id)
    # TODO: Add TEACHER and PARENT filtering
    
    # Apply filters
    if status:
        query = query.where(Student.status == status)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Student.first_name.ilike(search_pattern),
                Student.last_name.ilike(search_pattern),
                Student.middle_name.ilike(search_pattern)
            )
        )
    
    # Get total count
    count_query = select(Student).where(Student.school_id == current_user.school_id)
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        count_query = count_query.where(Student.campus_id == current_user.campus_id)
    if status:
        count_query = count_query.where(Student.status == status)
    if search:
        search_pattern = f"%{search}%"
        count_query = count_query.where(
            or_(
                Student.first_name.ilike(search_pattern),
                Student.last_name.ilike(search_pattern),
                Student.middle_name.ilike(search_pattern)
            )
        )
    
    total_result = await db.execute(select(Student.id).select_from(count_query.subquery()))
    total = len(total_result.all())
    
    # Apply pagination
    query = query.order_by(Student.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    students = result.scalars().all()
    
    # Get current active term for fee calculations
    today = date.today()
    current_term_result = await db.execute(
        select(Term)
        .join(AcademicYear)
        .where(
            AcademicYear.school_id == current_user.school_id,
            Term.start_date <= today,
            Term.end_date >= today
        )
        .order_by(Term.start_date.desc())
        .limit(1)
    )
    current_term = current_term_result.scalar_one_or_none()
    
    # Build student data with class and fee information
    student_data = []
    student_ids = [s.id for s in students]
    
    if student_ids:
        # Load current class assignments for all students
        class_history_result = await db.execute(
            select(StudentClassHistory)
            .where(
                StudentClassHistory.student_id.in_(student_ids),
                StudentClassHistory.end_date.is_(None)  # Active assignments only
            )
            .options(
                selectinload(StudentClassHistory.class_).selectinload(Class.academic_year)
            )
        )
        class_assignments = {h.student_id: h for h in class_history_result.scalars().all()}
        
        # Load fee records for current term (if exists)
        fee_records = {}
        if current_term:
            fee_result = await db.execute(
                select(Fee).where(
                    Fee.student_id.in_(student_ids),
                    Fee.term_id == current_term.id
                )
            )
            fee_records = {f.student_id: f for f in fee_result.scalars().all()}
    
    for s in students:
        # Get current class
        current_class = None
        if s.id in class_assignments:
            assignment = class_assignments[s.id]
            cls = assignment.class_
            current_class = {
                "id": str(cls.id),
                "name": cls.name,
                "academic_year": cls.academic_year.name if cls.academic_year else None,
            }
        
        # Get fee balance for current term
        fee_balance = None
        if current_term and s.id in fee_records:
            fee = fee_records[s.id]
            pending_amount = fee.expected_amount - fee.paid_amount
            fee_balance = {
                "expected_amount": str(fee.expected_amount),
                "paid_amount": str(fee.paid_amount),
                "pending_amount": str(pending_amount),
            }
        elif current_term:
            # No fee record exists yet, balance is 0
            fee_balance = {
                "expected_amount": "0.00",
                "paid_amount": "0.00",
                "pending_amount": "0.00",
            }
        
        student_data.append({
            "id": str(s.id),
            "first_name": s.first_name,
            "middle_name": s.middle_name,
            "last_name": s.last_name,
            "date_of_birth": s.date_of_birth.isoformat(),
            "status": s.status,
            "campus_id": str(s.campus_id),
            "created_at": s.created_at.isoformat(),
            "current_class": current_class,
            "fee_balance": fee_balance,
        })
    
    return {
        "data": student_data,
        "pagination": {
            "page": (skip // limit) + 1,
            "page_size": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": skip + limit < total,
            "has_previous": skip > 0,
        }
    }


# ============================================================================
# Get Student
# ============================================================================

@router.get("/students/{student_id}", response_model=dict)
async def get_student(
    student_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get a specific student by ID with tenant isolation.
    """
    query = select(Student).where(
        Student.id == student_id,
        Student.school_id == current_user.school_id
    )
    
    # Apply role-based filtering
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        query = query.where(Student.campus_id == current_user.campus_id)
    
    result = await db.execute(query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "STUDENT_NOT_FOUND",
                "message": "Student not found",
                "recovery": "Check the student ID and try again"
            }
        )
    
    # Load parents
    parent_links_result = await db.execute(
        select(StudentParent).where(StudentParent.student_id == student_id)
        .options(selectinload(StudentParent.parent).selectinload(Parent.user))
    )
    parent_links = parent_links_result.scalars().all()
    
    parents = []
    for link in parent_links:
        parent_user = link.parent.user
        parents.append({
            "id": str(link.parent.id),
            "user_id": str(parent_user.id),
            "role": link.role,
            "first_name": parent_user.first_name,
            "last_name": parent_user.last_name,
            "email": parent_user.email,
            "phone_number": parent_user.phone_number,
        })
    
    # Load class history with class and academic year details
    class_history_result = await db.execute(
        select(StudentClassHistory)
        .where(StudentClassHistory.student_id == student_id)
        .options(
            selectinload(StudentClassHistory.class_).selectinload(Class.academic_year),
            selectinload(StudentClassHistory.class_).selectinload(Class.campus)
        )
        .order_by(StudentClassHistory.start_date.desc())
    )
    class_history_list = class_history_result.scalars().all()
    
    # Find current class (active assignment)
    current_class_assignment = next(
        (h for h in class_history_list if h.end_date is None),
        None
    )
    
    current_class = None
    if current_class_assignment:
        cls = current_class_assignment.class_
        current_class = {
            "id": str(cls.id),
            "name": cls.name,
            "academic_year": cls.academic_year.name if cls.academic_year else None,
        }
    
    # Build class history array
    class_history = []
    for hist in class_history_list:
        cls = hist.class_
        class_history.append({
            "id": str(hist.id),
            "class_id": str(cls.id),
            "class_name": cls.name,
            "academic_year": cls.academic_year.name if cls.academic_year else None,
            "start_date": hist.start_date.isoformat(),
            "end_date": hist.end_date.isoformat() if hist.end_date else None,
            "is_active": hist.end_date is None,
        })
    
    # Determine transport info
    transport_route_info = None
    if student.transport_route_id:
        transport_result = await db.execute(
            select(TransportRoute).where(TransportRoute.id == student.transport_route_id)
        )
        route = transport_result.scalar_one_or_none()
        if route:
            transport_route_info = {
                "id": str(route.id),
                "zone": route.zone,
                "one_way_cost_per_term": str(route.one_way_cost_per_term),
                "two_way_cost_per_term": str(route.two_way_cost_per_term),
            }

    return {
        "id": str(student.id),
        "first_name": student.first_name,
        "middle_name": student.middle_name,
        "last_name": student.last_name,
        "date_of_birth": student.date_of_birth.isoformat(),
        "status": student.status,
        "campus_id": str(student.campus_id),
        "current_class": current_class,
        "class_history": class_history,
        "parents": parents,
        "transport_route": transport_route_info,
        "transport_type": student.transport_type,
        "created_at": student.created_at.isoformat(),
        "updated_at": student.updated_at.isoformat(),
    }


# ============================================================================
# Create Student
# ============================================================================

@router.post("/students", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_student(
    student_data: StudentCreate,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Create a new student.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # Verify campus belongs to school
    campus_result = await db.execute(
        select(Campus).where(
            Campus.id == student_data.campus_id,
            Campus.school_id == current_user.school_id
        )
    )
    campus = campus_result.scalar_one_or_none()
    
    if not campus:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CAMPUS_NOT_FOUND",
                "message": "Campus not found or does not belong to your school",
                "recovery": "Verify the campus ID"
            }
        )
    
    # CAMPUS_ADMIN can only create students in their campus
    if current_user.role == "CAMPUS_ADMIN":
        if current_user.campus_id != student_data.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only create students in your campus",
                    "recovery": "Use your campus ID"
                }
            )
    
    # Validate at least one parent is provided
    if not (student_data.father or student_data.mother or student_data.guardian):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "NO_PARENT_PROVIDED",
                "message": "At least one parent (father, mother, or guardian) must be provided",
                "recovery": "Provide at least one parent's information"
            }
        )
    
    # Validate transport route if provided
    transport_route = None
    if student_data.transport_route_id:
        transport_route_result = await db.execute(
            select(TransportRoute).where(
                TransportRoute.id == student_data.transport_route_id,
                TransportRoute.school_id == current_user.school_id
            )
        )
        transport_route = transport_route_result.scalar_one_or_none()
        
        if not transport_route:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "TRANSPORT_ROUTE_NOT_FOUND",
                    "message": "Transport route not found or does not belong to your school",
                    "recovery": "Verify the transport route ID"
                }
            )
    
    # Validate club activities if provided
    club_activities = []
    if student_data.club_activity_ids:
        club_activities_result = await db.execute(
            select(ClubActivity).where(
                ClubActivity.id.in_(student_data.club_activity_ids),
                ClubActivity.school_id == current_user.school_id
            )
        )
        club_activities = club_activities_result.scalars().all()
        
        if len(club_activities) != len(student_data.club_activity_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "CLUB_ACTIVITY_NOT_FOUND",
                    "message": "One or more club activities not found or do not belong to your school",
                    "recovery": "Verify all club activity IDs"
                }
            )
    
    # Create student
    student = Student(
        school_id=current_user.school_id,
        campus_id=student_data.campus_id,
        first_name=student_data.first_name,
        middle_name=student_data.middle_name,
        last_name=student_data.last_name,
        date_of_birth=student_data.date_of_birth,
        status=student_data.status,
        transport_route_id=student_data.transport_route_id,
        transport_type=student_data.transport_type,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(student)
    await db.flush()
    
    # Validate and assign class, academic_year, and term
    # Verify class exists and belongs to school/campus
    class_result = await db.execute(
        select(Class)
        .join(Campus)
        .where(
            Class.id == student_data.class_id,
            Campus.school_id == current_user.school_id,
            Class.campus_id == student_data.campus_id
        )
    )
    cls = class_result.scalar_one_or_none()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CLASS_NOT_FOUND",
                "message": "Class not found or does not belong to this campus",
                "recovery": "Verify the class ID and campus"
            }
        )
    
    # Verify academic_year exists, belongs to school, and is active
    academic_year_result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.id == student_data.academic_year_id,
            AcademicYear.school_id == current_user.school_id
        )
    )
    academic_year = academic_year_result.scalar_one_or_none()
    
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "ACADEMIC_YEAR_NOT_FOUND",
                "message": "Academic year not found or does not belong to your school",
                "recovery": "Verify the academic year ID"
            }
        )
    
    # Check if academic_year is active
    if academic_year.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "ACADEMIC_YEAR_INACTIVE",
                "message": f"Academic year '{academic_year.name}' is not active",
                "recovery": "Select an active academic year"
            }
        )
    
    # Verify term exists, belongs to academic_year, and is active
    term_result = await db.execute(
        select(Term).where(
            Term.id == student_data.term_id,
            Term.academic_year_id == student_data.academic_year_id
        )
    )
    term = term_result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TERM_NOT_FOUND",
                "message": "Term not found or does not belong to the selected academic year",
                "recovery": "Verify the term ID and academic year"
            }
        )
    
    # Check if term is active
    if term.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "TERM_INACTIVE",
                "message": f"Term '{term.name}' is not active",
                "recovery": "Select an active term"
            }
        )
    
    # Verify class's academic_year matches the provided academic_year
    if cls.academic_year_id != student_data.academic_year_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "CLASS_ACADEMIC_YEAR_MISMATCH",
                "message": "Class does not belong to the selected academic year",
                "recovery": "Select a class that belongs to the selected academic year"
            }
        )
    
    # Create student class assignment
    start_date = date.today()
    class_assignment = StudentClassHistory(
        student_id=student.id,
        class_id=student_data.class_id,
        start_date=start_date,
        end_date=None,  # Active assignment
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(class_assignment)
    
    # Create student academic enrollment
    enrollment = StudentAcademicEnrollment(
        student_id=student.id,
        academic_year_id=student_data.academic_year_id,
        term_id=student_data.term_id,
        start_date=start_date,
        end_date=None,  # Active enrollment
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(enrollment)
    
    # Link club activities to student
    club_activity_ids = []
    for club_activity in club_activities:
        student_club_activity = StudentClubActivity(
            student_id=student.id,
            club_activity_id=club_activity.id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(student_club_activity)
        club_activity_ids.append(club_activity.id)
    
    # Calculate and create fee record
    expected_fee = await calculate_student_fee(
        db=db,
        student_id=student.id,
        class_id=student_data.class_id,
        term_id=student_data.term_id,
        club_activity_ids=club_activity_ids if club_activity_ids else None,
        transport_route_id=student_data.transport_route_id,
        school_id=current_user.school_id
    )
    
    # Create fee record
    fee = await ensure_fee_record(
        db=db,
        student_id=student.id,
        term_id=student_data.term_id,
        expected_amount=expected_fee,
        school_id=current_user.school_id
    )
    db.add(fee)
    
    # Process parents
    parents_created = []
    parent_roles = [
        ("father", student_data.father, "FATHER"),
        ("mother", student_data.mother, "MOTHER"),
        ("guardian", student_data.guardian, "GUARDIAN"),
    ]
    
    for role_name, parent_info, role_code in parent_roles:
        if not parent_info:
            continue
        
        # Check if user exists by phone_number
        existing_user_result = await db.execute(
            select(User).where(
                User.phone_number == parent_info.phone_number,
                User.school_id == current_user.school_id
            )
        )
        existing_user = existing_user_result.scalar_one_or_none()
        
        if existing_user:
            # User exists - verify it's a PARENT role
            if existing_user.role != "PARENT":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "error_code": "PHONE_EXISTS_NOT_PARENT",
                        "message": f"Phone number {parent_info.phone_number} belongs to a {existing_user.role}, not a parent",
                        "recovery": "Use a different phone number or contact support"
                    }
                )
            
            # Get parent record
            parent_result = await db.execute(
                select(Parent).where(Parent.user_id == existing_user.id)
            )
            parent = parent_result.scalar_one_or_none()
            
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "error_code": "PARENT_RECORD_MISSING",
                        "message": "Parent record not found for existing user",
                        "recovery": "Contact support"
                    }
                )
            
            # Check if parent is already linked to this student with this role
            existing_link_result = await db.execute(
                select(StudentParent).where(
                    StudentParent.student_id == student.id,
                    StudentParent.parent_id == parent.id,
                    StudentParent.role == role_code
                )
            )
            if existing_link_result.scalar_one_or_none():
                continue  # Already linked, skip
            
            # Create student_parent link
            student_parent = StudentParent(
                student_id=student.id,
                parent_id=parent.id,
                role=role_code,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(student_parent)
            
            parents_created.append({
                "role": role_code,
                "parent_id": str(parent.id),
                "user_id": str(existing_user.id),
                "first_name": existing_user.first_name,
                "last_name": existing_user.last_name,
                "email": existing_user.email,
                "phone_number": existing_user.phone_number,
                "was_new_user": False,
                "setup_link_sent": False,
            })
        else:
            # Create new user and parent
            # Check email uniqueness
            email_check = await db.execute(
                select(User).where(
                    User.email == parent_info.email,
                    User.school_id == current_user.school_id
                )
            )
            if email_check.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "error_code": "EMAIL_ALREADY_EXISTS",
                        "message": f"Email {parent_info.email} already exists in this school",
                        "recovery": "Use a different email or link existing parent"
                    }
                )
            
            # Create user
            # Note: PENDING_SETUP is indicated by password_hash=None, not by status
            # Status must be ACTIVE or INACTIVE per database constraint
            new_user = User(
                school_id=current_user.school_id,
                email=parent_info.email,
                phone_number=parent_info.phone_number,
                first_name=parent_info.first_name,
                last_name=parent_info.last_name,
                role="PARENT",
                status="ACTIVE",  # PENDING_SETUP is indicated by password_hash=None
                password_hash=None,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(new_user)
            await db.flush()
            
            # Create parent record
            new_parent = Parent(
                school_id=current_user.school_id,
                user_id=new_user.id,
                id_number=parent_info.id_number,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(new_parent)
            await db.flush()
            
            # Generate account setup token
            setup_token = generate_secure_token()
            token_hash = hash_token(setup_token)
            expires_at = datetime.now(UTC) + timedelta(days=7)
            
            account_setup_token = AccountSetupToken(
                user_id=new_user.id,
                token_hash=token_hash,
                expires_at=expires_at,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(account_setup_token)
            
            # Create student_parent link
            student_parent = StudentParent(
                student_id=student.id,
                parent_id=new_parent.id,
                role=role_code,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(student_parent)
            
            # TODO: Queue SMS with setup link
            # SMS would contain: https://portal.school.com/setup-account?token={setup_token}
            
            parents_created.append({
                "role": role_code,
                "parent_id": str(new_parent.id),
                "user_id": str(new_user.id),
                "first_name": new_user.first_name,
                "last_name": new_user.last_name,
                "email": new_user.email,
                "phone_number": new_user.phone_number,
                "was_new_user": True,
                "setup_link_sent": True,
                "setup_token": setup_token,  # TODO: Remove in production, only for testing
            })
    
    await db.commit()
    await db.refresh(student)
    
    return {
        "student": {
            "id": str(student.id),
            "first_name": student.first_name,
            "middle_name": student.middle_name,
            "last_name": student.last_name,
            "date_of_birth": student.date_of_birth.isoformat(),
            "status": student.status,
            "campus_id": str(student.campus_id),
            "created_at": student.created_at.isoformat(),
        },
        "parents_created": parents_created,
    }


# ============================================================================
# Update Student
# ============================================================================

@router.put("/students/{student_id}", response_model=dict)
async def update_student(
    student_id: UUID,
    student_data: StudentUpdate,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update student information.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # Get student with tenant isolation
    query = select(Student).where(
        Student.id == student_id,
        Student.school_id == current_user.school_id
    )
    
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        query = query.where(Student.campus_id == current_user.campus_id)
    
    result = await db.execute(query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "STUDENT_NOT_FOUND",
                "message": "Student not found",
                "recovery": "Check the student ID"
            }
        )
    
    # Update fields
    update_data = student_data.model_dump(exclude_unset=True)
    
    if "campus_id" in update_data:
        # Verify new campus belongs to school
        campus_result = await db.execute(
            select(Campus).where(
                Campus.id == update_data["campus_id"],
                Campus.school_id == current_user.school_id
            )
        )
        if not campus_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "CAMPUS_NOT_FOUND", "message": "Campus not found"}
            )
        
        # CAMPUS_ADMIN cannot change campus
        if current_user.role == "CAMPUS_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "Campus admins cannot change student campus",
                    "recovery": "Contact school admin"
                }
            )
    
    for field, value in update_data.items():
        setattr(student, field, value)
    
    student.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(student)
    
    return {
        "id": str(student.id),
        "first_name": student.first_name,
        "middle_name": student.middle_name,
        "last_name": student.last_name,
        "date_of_birth": student.date_of_birth.isoformat(),
        "status": student.status,
        "campus_id": str(student.campus_id),
        "updated_at": student.updated_at.isoformat(),
    }


# ============================================================================
# Change Student Status (State Machine)
# ============================================================================

@router.patch("/students/{student_id}/status", response_model=dict)
async def change_student_status(
    student_id: UUID,
    status_data: StudentStatusChange,
    current_user: User = Depends(require_school_admin),  # Only SCHOOL_ADMIN
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Change student status following state machine rules.
    
    Permission: SCHOOL_ADMIN only
    """
    # Get student
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_user.school_id
        )
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "STUDENT_NOT_FOUND", "message": "Student not found"}
        )
    
    # Validate state transition
    if not validate_status_transition(student.status, status_data.status):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "INVALID_STATE_TRANSITION",
                "message": f"Cannot transition from {student.status} to {status_data.status}",
                "recovery": f"Allowed transitions from {student.status}: {', '.join(ALLOWED_TRANSITIONS.get(student.status, []))}",
                "details": {
                    "current_status": student.status,
                    "requested_status": status_data.status,
                    "allowed_transitions": ALLOWED_TRANSITIONS.get(student.status, [])
                }
            }
        )
    
    # Update status
    student.status = status_data.status
    student.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(student)
    
    return {
        "id": str(student.id),
        "status": student.status,
        "updated_at": student.updated_at.isoformat(),
    }


# ============================================================================
# Link Parent to Student
# ============================================================================

@router.post("/students/{student_id}/parents", response_model=dict, status_code=status.HTTP_201_CREATED)
async def link_parent_to_student(
    student_id: UUID,
    link_data: LinkParentToStudent,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Link an existing parent to a student.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # Get student
    query = select(Student).where(
        Student.id == student_id,
        Student.school_id == current_user.school_id
    )
    
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        query = query.where(Student.campus_id == current_user.campus_id)
    
    result = await db.execute(query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "STUDENT_NOT_FOUND", "message": "Student not found"}
        )
    
    # Get parent (must be in same school and role=PARENT)
    parent_result = await db.execute(
        select(Parent).where(
            Parent.id == link_data.parent_id,
            Parent.school_id == current_user.school_id
        )
    )
    parent = parent_result.scalar_one_or_none()
    
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "PARENT_NOT_FOUND", "message": "Parent not found"}
        )
    
    # Verify parent user has PARENT role
    parent_user_result = await db.execute(
        select(User).where(User.id == parent.user_id)
    )
    parent_user = parent_user_result.scalar_one_or_none()
    
    if not parent_user or parent_user.role != "PARENT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_PARENT",
                "message": "User is not a parent",
                "recovery": "Use a user with PARENT role"
            }
        )
    
    # Check if link already exists
    existing_link_result = await db.execute(
        select(StudentParent).where(
            StudentParent.student_id == student_id,
            StudentParent.role == link_data.role
        )
    )
    existing_link = existing_link_result.scalar_one_or_none()
    
    if existing_link:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "PARENT_ROLE_EXISTS",
                "message": f"Student already has a {link_data.role} linked",
                "recovery": "Remove existing link first or use a different role"
            }
        )
    
    # Create link
    student_parent = StudentParent(
        student_id=student_id,
        parent_id=link_data.parent_id,
        role=link_data.role,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(student_parent)
    await db.commit()
    await db.refresh(student_parent)
    
    return {
        "student_id": str(student_parent.student_id),
        "parent_id": str(student_parent.parent_id),
        "role": student_parent.role,
        "created_at": student_parent.created_at.isoformat(),
    }


# ============================================================================
# Get Student's Parents
# ============================================================================

@router.get("/students/{student_id}/parents", response_model=List[dict])
async def get_student_parents(
    student_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[dict]:
    """
    Get all parents linked to a student.
    """
    # Get student with tenant isolation
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_user.school_id
        )
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "STUDENT_NOT_FOUND", "message": "Student not found"}
        )
    
    # Get parent links
    links_result = await db.execute(
        select(StudentParent)
        .where(StudentParent.student_id == student_id)
        .options(selectinload(StudentParent.parent).selectinload(Parent.user))
    )
    links = links_result.scalars().all()
    
    return [
        {
            "parent_id": str(link.parent.id),
            "user_id": str(link.parent.user.id),
            "role": link.role,
            "first_name": link.parent.user.first_name,
            "last_name": link.parent.user.last_name,
            "email": link.parent.user.email,
            "phone_number": link.parent.user.phone_number,
            "created_at": link.created_at.isoformat(),
        }
        for link in links
    ]


# ============================================================================
# Record Payment
# ============================================================================

@router.post("/students/{student_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_200_OK)
async def record_payment(
    student_id: UUID,
    payment_data: PaymentCreate,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> PaymentResponse:
    """
    Record a payment for a student.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    
    Accepts student_id and term_id, gets or creates fee record, and records payment.
    """
    from decimal import Decimal
    from datetime import date as date_type
    
    # Validate student exists and user has access
    student_result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_user.school_id
        )
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "STUDENT_NOT_FOUND",
                "message": "Student not found",
                "recovery": "Verify the student ID"
            }
        )
    
    # Check campus access for CAMPUS_ADMIN
    if current_user.role == "CAMPUS_ADMIN":
        class_history_result = await db.execute(
            select(StudentClassHistory).where(
                StudentClassHistory.student_id == student_id,
                StudentClassHistory.end_date.is_(None)
            )
        )
        class_history = class_history_result.scalar_one_or_none()
        if class_history:
            class_result = await db.execute(
                select(Class).where(Class.id == class_history.class_id)
            )
            class_ = class_result.scalar_one_or_none()
            if class_ and class_.campus_id != current_user.campus_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "FORBIDDEN_ACTION",
                        "message": "Student is not in your campus",
                        "recovery": "You can only record payments for students in your campus"
                    }
                )
    
    # Get term_id from request
    term_id = payment_data.term_id
    
    # Validate term exists and belongs to school (join with AcademicYear to check school_id)
    term_result = await db.execute(
        select(Term)
        .join(AcademicYear)
        .where(
            Term.id == term_id,
            AcademicYear.school_id == current_user.school_id
        )
    )
    term = term_result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TERM_NOT_FOUND",
                "message": "Term not found or does not belong to your school",
                "recovery": "Verify the term ID"
            }
        )
    
    # Get payment details
    amount = payment_data.amount
    payment_date = payment_data.payment_date or date_type.today()
    payment_method = payment_data.payment_method
    reference_number = payment_data.reference_number
    
    # Get or create fee record
    fee_result = await db.execute(
        select(Fee).where(
            Fee.student_id == student_id,
            Fee.term_id == term_id
        )
    )
    fee = fee_result.scalar_one_or_none()
    
    if not fee:
        # Calculate expected fee and create fee record
        expected_fee = await calculate_student_fee_from_student(db, student, term_id)
        fee = await ensure_fee_record(
            db=db,
            student_id=student_id,
            term_id=term_id,
            expected_amount=expected_fee,
            school_id=current_user.school_id
        )
        await db.flush()  # Ensure fee has an ID
    
    # Check if payment would exceed expected fee
    new_paid_amount = fee.paid_amount + amount
    if new_paid_amount > fee.expected_amount:
        excess = new_paid_amount - fee.expected_amount
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "PAYMENT_EXCEEDS_EXPECTED",
                "message": "Payment amount would exceed expected fee",
                "recovery": "Reduce payment amount or adjust expected fee first",
                "details": {
                    "expected_amount": float(fee.expected_amount),
                    "paid_amount": float(fee.paid_amount),
                    "payment_attempt": float(amount),
                    "excess": float(excess)
                }
            }
        )
    
    # Update fee paid_amount
    fee.paid_amount = new_paid_amount
    fee.updated_at = datetime.now(UTC)
    
    # Create payment history record
    payment_history = PaymentHistory(
        fee_id=fee.id,
        amount=amount,
        payment_date=payment_date,
        payment_method=payment_method,
        reference_number=reference_number,
        recorded_by_user_id=current_user.id
    )
    db.add(payment_history)
    
    await db.commit()
    await db.refresh(fee)
    await db.refresh(payment_history)
    
    # Get the last payment for response
    last_payment = {
        "amount": float(payment_history.amount),
        "payment_date": payment_history.payment_date.isoformat(),
        "payment_method": payment_history.payment_method,
        "reference_number": payment_history.reference_number
    }
    
    return {
        "id": str(fee.id),
        "student": {
            "id": str(student.id),
            "first_name": student.first_name,
            "last_name": student.last_name
        },
        "term": {
            "id": str(term.id),
            "name": term.name
        },
        "expected_amount": float(fee.expected_amount),
        "paid_amount": float(fee.paid_amount),
        "pending_amount": float(fee.pending_amount),
        "last_payment": last_payment,
        "updated_at": fee.updated_at.isoformat()
    }
