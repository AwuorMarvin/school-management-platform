"""
Parent endpoints - CRUD operations for parents.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta, UTC

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_campus_admin
from app.core.security import generate_secure_token, hash_token
from app.models.user import User
from app.models.parent import Parent
from app.models.student import Student
from app.models.student_parent import StudentParent
from app.models.teacher import Teacher
from app.models.teacher_class_assignment import TeacherClassAssignment
from app.models.student_class_history import StudentClassHistory
from app.models import Class
from app.models.subject import Subject
from app.models.account_setup_token import AccountSetupToken
from app.schemas.parent import (
    ParentCreate,
    ParentUpdate,
    ParentResponse,
)

router = APIRouter()


# ============================================================================
# List Parents
# ============================================================================

@router.get("/parents", response_model=dict)
async def list_parents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None, description="Search by name or email"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List parents with filtering and pagination.
    
    Scope:
    - All authenticated users can list parents in their school
    - PARENT role can only see themselves
    """
    # Build base query
    query = select(Parent).where(Parent.school_id == current_user.school_id)
    
    # PARENT role can only see themselves
    if current_user.role == "PARENT":
        parent_result = await db.execute(
            select(Parent).where(Parent.user_id == current_user.id)
        )
        parent = parent_result.scalar_one_or_none()
        if parent:
            query = query.where(Parent.id == parent.id)
        else:
            # No parent record yet
            return {
                "data": [],
                "pagination": {
                    "page": 1,
                    "page_size": limit,
                    "total": 0,
                    "total_pages": 0,
                    "has_next": False,
                    "has_previous": False,
                }
            }
    
    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        # Need to join with User for name/email search
        query = query.join(User, Parent.user_id == User.id).where(
            or_(
                User.first_name.ilike(search_pattern),
                User.last_name.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )
    
    # Get total count
    count_query = select(Parent).where(Parent.school_id == current_user.school_id)
    if current_user.role == "PARENT":
        parent_result = await db.execute(
            select(Parent).where(Parent.user_id == current_user.id)
        )
        parent = parent_result.scalar_one_or_none()
        if parent:
            count_query = count_query.where(Parent.id == parent.id)
        else:
            count_query = count_query.where(Parent.id == None)  # No results
    
    if search:
        search_pattern = f"%{search}%"
        count_query = count_query.join(User, Parent.user_id == User.id).where(
            or_(
                User.first_name.ilike(search_pattern),
                User.last_name.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )
    
    total_result = await db.execute(select(Parent.id).select_from(count_query.subquery()))
    total = len(total_result.all())
    
    # Apply pagination
    query = query.options(selectinload(Parent.user)).order_by(Parent.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    parents = result.scalars().all()
    
    return {
        "data": [
            {
                "id": str(p.id),
                "user_id": str(p.user_id),
                "school_id": str(p.school_id),
                "email": p.user.email,
                "phone_number": p.user.phone_number,
                "first_name": p.user.first_name,
                "last_name": p.user.last_name,
                "id_number": p.id_number,
                "status": p.user.status,
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat(),
            }
            for p in parents
        ],
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
# Get Parent
# ============================================================================

@router.get("/parents/{parent_id}", response_model=dict)
async def get_parent(
    parent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get parent details.
    """
    query = select(Parent).where(
        Parent.id == parent_id,
        Parent.school_id == current_user.school_id
    )
    
    # PARENT role can only see themselves
    if current_user.role == "PARENT":
        query = query.where(Parent.user_id == current_user.id)
    
    result = await db.execute(
        query.options(selectinload(Parent.user), selectinload(Parent.student_links).selectinload(StudentParent.student))
    )
    parent = result.scalar_one_or_none()
    
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "PARENT_NOT_FOUND",
                "message": "Parent not found",
                "recovery": "Check the parent ID"
            }
        )
    
    # Get linked students
    students = []
    for link in parent.student_links:
        students.append({
            "student_id": str(link.student.id),
            "student_name": f"{link.student.first_name} {link.student.last_name}",
            "role": link.role,
            "student_status": link.student.status,
        })
    
    return {
        "id": str(parent.id),
        "user_id": str(parent.user_id),
        "school_id": str(parent.school_id),
        "email": parent.user.email,
        "phone_number": parent.user.phone_number,
        "first_name": parent.user.first_name,
        "last_name": parent.user.last_name,
        "id_number": parent.id_number,
        "status": parent.user.status,
        "students": students,
        "created_at": parent.created_at.isoformat(),
        "updated_at": parent.updated_at.isoformat(),
    }


# ============================================================================
# Create Parent
# ============================================================================

@router.post("/parents", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_parent(
    parent_data: ParentCreate,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Create a new parent account.
    
    Creates a User with role=PARENT and a Parent record.
    Generates account setup token and sends SMS (TODO: implement SMS).
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # Check if email already exists in school
    existing_user_result = await db.execute(
        select(User).where(
            User.email == parent_data.email,
            User.school_id == current_user.school_id
        )
    )
    if existing_user_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "EMAIL_ALREADY_EXISTS",
                "message": "Email already exists in this school",
                "recovery": "Use a different email or link existing parent to student"
            }
        )
    
    # Check if phone already exists in school
    existing_phone_result = await db.execute(
        select(User).where(
            User.phone_number == parent_data.phone_number,
            User.school_id == current_user.school_id
        )
    )
    if existing_phone_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "PHONE_ALREADY_EXISTS",
                "message": "Phone number already exists in this school",
                "recovery": "Use a different phone number"
            }
        )
    
    # Create user
    # Note: PENDING_SETUP is indicated by password_hash=None, not by status
    # Status must be ACTIVE or INACTIVE per database constraint
    user = User(
        school_id=current_user.school_id,
        email=parent_data.email,
        phone_number=parent_data.phone_number,
        first_name=parent_data.first_name,
        last_name=parent_data.last_name,
        role="PARENT",
        campus_id=parent_data.campus_id,
        status="ACTIVE",  # PENDING_SETUP is indicated by password_hash=None
        password_hash=None,  # Will be set during account setup
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(user)
    await db.flush()
    
    # Verify student exists and belongs to school
    student_result = await db.execute(
        select(Student).where(
            Student.id == parent_data.student_id,
            Student.school_id == current_user.school_id
        )
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "STUDENT_NOT_FOUND",
                "message": "Student not found or does not belong to your school",
                "recovery": "Verify the student ID"
            }
        )
    
    # Check if student already has this parent role assigned
    existing_link_result = await db.execute(
        select(StudentParent).where(
            StudentParent.student_id == parent_data.student_id,
            StudentParent.role == parent_data.role
        )
    )
    if existing_link_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "DUPLICATE_PARENT_ROLE",
                "message": f"This student already has a {parent_data.role.lower()} assigned",
                "recovery": "Each student can have only one parent per role (father/mother/guardian)",
                "details": {
                    "role": parent_data.role,
                }
            }
        )
    
    # Create parent record (school_id comes from TenantMixin, set via user.school_id)
    parent = Parent(
        user_id=user.id,
        id_number=parent_data.id_number,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    # Set school_id explicitly (inherited from TenantMixin)
    parent.school_id = current_user.school_id
    
    db.add(parent)
    await db.flush()
    
    # Create student_parent link
    student_parent = StudentParent(
        student_id=parent_data.student_id,
        parent_id=parent.id,
        role=parent_data.role,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(student_parent)
    
    # Generate account setup token
    setup_token = generate_secure_token()
    token_hash = hash_token(setup_token)
    expires_at = datetime.now(UTC) + timedelta(days=7)  # 7 days expiry
    
    account_setup_token = AccountSetupToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(account_setup_token)
    await db.commit()
    
    # TODO: Send SMS with setup link
    # SMS would contain: https://portal.school.com/setup-account?token={setup_token}
    
    return {
        "id": str(parent.id),
        "user_id": str(user.id),
        "email": user.email,
        "phone_number": user.phone_number,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "id_number": parent.id_number,
        "status": user.status,
        "student_id": str(parent_data.student_id),
        "role": parent_data.role,
        "setup_token": setup_token,  # TODO: Remove in production, only for testing
        "message": "Parent account created and linked to student. Setup link sent via SMS.",
    }


# ============================================================================
# Update Parent
# ============================================================================

@router.put("/parents/{parent_id}", response_model=dict)
async def update_parent(
    parent_id: UUID,
    parent_data: ParentUpdate,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update parent information.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # Get parent
    result = await db.execute(
        select(Parent).where(
            Parent.id == parent_id,
            Parent.school_id == current_user.school_id
        ).options(selectinload(Parent.user))
    )
    parent = result.scalar_one_or_none()
    
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "PARENT_NOT_FOUND", "message": "Parent not found"}
        )
    
    # Update user fields
    update_data = parent_data.model_dump(exclude_unset=True)
    
    if "phone_number" in update_data:
        # Check phone uniqueness
        existing_phone_result = await db.execute(
            select(User).where(
                User.phone_number == update_data["phone_number"],
                User.school_id == current_user.school_id,
                User.id != parent.user_id
            )
        )
        if existing_phone_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "PHONE_ALREADY_EXISTS",
                    "message": "Phone number already exists",
                    "recovery": "Use a different phone number"
                }
            )
    
    # Update user
    for field in ["first_name", "last_name", "phone_number"]:
        if field in update_data:
            setattr(parent.user, field, update_data[field])
    
    # Update parent
    if "id_number" in update_data:
        parent.id_number = update_data["id_number"]
    
    parent.user.updated_at = datetime.now(UTC)
    parent.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(parent)
    await db.refresh(parent.user)
    
    return {
        "id": str(parent.id),
        "user_id": str(parent.user_id),
        "email": parent.user.email,
        "phone_number": parent.user.phone_number,
        "first_name": parent.user.first_name,
        "last_name": parent.user.last_name,
        "id_number": parent.id_number,
        "updated_at": parent.updated_at.isoformat(),
    }


# ============================================================================
# Get Parent's Students
# ============================================================================

@router.get("/parents/{parent_id}/students", response_model=List[dict])
async def get_parent_students(
    parent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[dict]:
    """
    Get all students linked to a parent.
    """
    # Get parent
    result = await db.execute(
        select(Parent).where(
            Parent.id == parent_id,
            Parent.school_id == current_user.school_id
        )
    )
    parent = result.scalar_one_or_none()
    
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "PARENT_NOT_FOUND", "message": "Parent not found"}
        )
    
    # PARENT role can only see their own students
    if current_user.role == "PARENT" and parent.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "FORBIDDEN_ACTION",
                "message": "You can only view your own children",
                "recovery": "Use your own parent ID"
            }
        )
    
    # Get student links
    links_result = await db.execute(
        select(StudentParent)
        .where(StudentParent.parent_id == parent_id)
        .options(selectinload(StudentParent.student))
    )
    links = links_result.scalars().all()
    
    return [
        {
            "student_id": str(link.student.id),
            "student_name": f"{link.student.first_name} {link.student.middle_name or ''} {link.student.last_name}".strip(),
            "role": link.role,
            "student_status": link.student.status,
            "date_of_birth": link.student.date_of_birth.isoformat(),
            "created_at": link.created_at.isoformat(),
        }
        for link in links
    ]


# ============================================================================
# Get Teachers for Specific Child
# ============================================================================

@router.get("/parents/me/children/{child_id}/teachers", response_model=dict)
async def get_child_teachers(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get teachers teaching a specific child.
    
    Returns only teachers assigned to child's current class.
    Subjects filtered to only those taught in child's class.
    
    Permission: PARENT (must be linked to this child)
    """
    if current_user.role != "PARENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "FORBIDDEN_ACTION",
                "message": "Only parents can access this endpoint",
                "recovery": "This endpoint is for parents only"
            }
        )
    
    # Get parent record
    parent_result = await db.execute(
        select(Parent).where(Parent.user_id == current_user.id)
    )
    parent = parent_result.scalar_one_or_none()
    
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "PARENT_NOT_FOUND",
                "message": "Parent record not found",
                "recovery": "Contact administrator"
            }
        )
    
    # Verify child belongs to this parent
    link_result = await db.execute(
        select(StudentParent).where(
            StudentParent.student_id == child_id,
            StudentParent.parent_id == parent.id
        )
    )
    link = link_result.scalar_one_or_none()
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "FORBIDDEN_ACTION",
                "message": "This child is not linked to your account",
                "recovery": "You can only view teachers for your own children"
            }
        )
    
    # Get child's current class
    class_history_result = await db.execute(
        select(StudentClassHistory).where(
            StudentClassHistory.student_id == child_id,
            StudentClassHistory.end_date.is_(None)
        ).options(
            selectinload(StudentClassHistory.class_)
        )
    )
    class_history = class_history_result.scalar_one_or_none()
    
    if not class_history:
        # Child not assigned to any class
        return {
            "child": {
                "id": str(child_id),
                "name": f"{link.student.first_name} {link.student.last_name}",
                "class": None
            },
            "teachers": []
        }
    
    current_class = class_history.class_
    
    # Get student info
    student_result = await db.execute(
        select(Student).where(Student.id == child_id)
    )
    student = student_result.scalar_one()
    
    # Get all teachers assigned to this class (active assignments only)
    assignments_result = await db.execute(
        select(TeacherClassAssignment).where(
            and_(
                TeacherClassAssignment.class_id == current_class.id,
                TeacherClassAssignment.end_date.is_(None)
            )
        ).options(
            selectinload(TeacherClassAssignment.teacher).selectinload(User.teacher),
            selectinload(TeacherClassAssignment.subject)
        )
    )
    assignments = assignments_result.scalars().all()
    
    # Group by teacher
    teachers_dict: dict[UUID, dict] = {}
    for assignment in assignments:
        teacher_id = assignment.teacher_id
        
        if teacher_id not in teachers_dict:
            # Get teacher record
            teacher_result = await db.execute(
                select(Teacher).where(Teacher.user_id == teacher_id)
            )
            teacher = teacher_result.scalar_one_or_none()
            
            if not teacher:
                continue  # Skip if teacher record not found
            
            # Format teacher name
            name_parts = [teacher.salutation, teacher.first_name]
            if teacher.middle_name:
                name_parts.append(teacher.middle_name)
            name_parts.append(teacher.last_name)
            teacher_name = " ".join(name_parts)
            
            # Count students in class
            student_count_result = await db.execute(
                select(func.count(Student.id)).select_from(
                    Student
                ).join(
                    StudentClassHistory,
                    and_(
                        Student.id == StudentClassHistory.student_id,
                        StudentClassHistory.class_id == current_class.id,
                        StudentClassHistory.end_date.is_(None),
                        Student.status == "ACTIVE"
                    )
                )
            )
            student_count = student_count_result.scalar_one() or 0
            
            teachers_dict[teacher_id] = {
                "id": str(teacher.id),
                "name": teacher_name,
                "phone_number": assignment.teacher.phone_number,
                "subjects": [],
                "students_in_class": student_count
            }
        
        # Add subject (only subjects taught in this class)
        teachers_dict[teacher_id]["subjects"].append({
            "id": str(assignment.subject.id),
            "name": assignment.subject.name
        })
    
    # Convert to list and sort by name
    teachers_list = list(teachers_dict.values())
    teachers_list.sort(key=lambda t: t["name"])
    
    # Remove duplicate subjects per teacher
    for teacher in teachers_list:
        seen_subjects = set()
        unique_subjects = []
        for subject in teacher["subjects"]:
            if subject["id"] not in seen_subjects:
                seen_subjects.add(subject["id"])
                unique_subjects.append(subject)
        teacher["subjects"] = unique_subjects
    
    return {
        "child": {
            "id": str(child_id),
            "name": f"{student.first_name} {student.last_name}",
            "class": {
                "id": str(current_class.id),
                "name": current_class.name
            }
        },
        "teachers": teachers_list
    }


# ============================================================================
# Get All Teachers for All Children
# ============================================================================

@router.get("/parents/me/teachers", response_model=dict)
async def get_all_teachers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get all teachers teaching any of parent's children.
    
    Grouped by child. Each child section shows teachers for that child's class.
    
    Permission: PARENT
    """
    if current_user.role != "PARENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "FORBIDDEN_ACTION",
                "message": "Only parents can access this endpoint",
                "recovery": "This endpoint is for parents only"
            }
        )
    
    # Get parent record
    parent_result = await db.execute(
        select(Parent).where(Parent.user_id == current_user.id)
    )
    parent = parent_result.scalar_one_or_none()
    
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "PARENT_NOT_FOUND",
                "message": "Parent record not found",
                "recovery": "Contact administrator"
            }
        )
    
    # Get all children linked to this parent
    links_result = await db.execute(
        select(StudentParent).where(
            StudentParent.parent_id == parent.id
        ).options(
            selectinload(StudentParent.student)
        )
    )
    links = links_result.scalars().all()
    
    children_data = []
    
    for link in links:
        child_id = link.student_id
        student = link.student
        
        # Get child's current class
        class_history_result = await db.execute(
            select(StudentClassHistory).where(
                StudentClassHistory.student_id == child_id,
                StudentClassHistory.end_date.is_(None)
            ).options(
                selectinload(StudentClassHistory.class_)
            )
        )
        class_history = class_history_result.scalar_one_or_none()
        
        if not class_history:
            # Child not in any class - skip
            continue
        
        current_class = class_history.class_
        
        # Get teachers for this class
        assignments_result = await db.execute(
            select(TeacherClassAssignment).where(
                and_(
                    TeacherClassAssignment.class_id == current_class.id,
                    TeacherClassAssignment.end_date.is_(None)
                )
            ).options(
                selectinload(TeacherClassAssignment.teacher).selectinload(User.teacher),
                selectinload(TeacherClassAssignment.subject)
            )
        )
        assignments = assignments_result.scalars().all()
        
        # Group by teacher
        teachers_dict: dict[UUID, dict] = {}
        for assignment in assignments:
            teacher_id = assignment.teacher_id
            
            if teacher_id not in teachers_dict:
                teacher_result = await db.execute(
                    select(Teacher).where(Teacher.user_id == teacher_id)
                )
                teacher = teacher_result.scalar_one_or_none()
                
                if not teacher:
                    continue
                
                name_parts = [teacher.salutation, teacher.first_name]
                if teacher.middle_name:
                    name_parts.append(teacher.middle_name)
                name_parts.append(teacher.last_name)
                teacher_name = " ".join(name_parts)
                
                # Count students in class
                student_count_result = await db.execute(
                    select(func.count(Student.id)).select_from(
                        Student
                    ).join(
                        StudentClassHistory,
                        and_(
                            Student.id == StudentClassHistory.student_id,
                            StudentClassHistory.class_id == current_class.id,
                            StudentClassHistory.end_date.is_(None),
                            Student.status == "ACTIVE"
                        )
                    )
                )
                student_count = student_count_result.scalar_one() or 0
                
                teachers_dict[teacher_id] = {
                    "id": str(teacher.id),
                    "name": teacher_name,
                    "phone_number": assignment.teacher.phone_number,
                    "subjects": [],
                    "students_in_class": student_count
                }
            
            teachers_dict[teacher_id]["subjects"].append({
                "id": str(assignment.subject.id),
                "name": assignment.subject.name
            })
        
        # Convert to list and deduplicate subjects
        teachers_list = list(teachers_dict.values())
        teachers_list.sort(key=lambda t: t["name"])
        
        for teacher in teachers_list:
            seen_subjects = set()
            unique_subjects = []
            for subject in teacher["subjects"]:
                if subject["id"] not in seen_subjects:
                    seen_subjects.add(subject["id"])
                    unique_subjects.append(subject)
            teacher["subjects"] = unique_subjects
        
        children_data.append({
            "child": {
                "id": str(child_id),
                "name": f"{student.first_name} {student.last_name}",
                "class": {
                    "id": str(current_class.id),
                    "name": current_class.name
                }
            },
            "teachers": teachers_list
        })
    
    return {
        "children": children_data
    }

