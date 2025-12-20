# Models Guide - SQLAlchemy 2.0

This directory contains all database models using SQLAlchemy 2.0 with async support.

## Base Classes

### `BaseModel`
The main base class for all models. Provides:
- `id`: UUID primary key (auto-generated with uuid4)
- `created_at`: Timestamp (auto-set on creation)
- `updated_at`: Timestamp (auto-set on update)

```python
from app.models.base import BaseModel

class School(BaseModel):
    __tablename__ = "school"
    
    name: Mapped[str] = mapped_column(String(200), nullable=False)
```

### `TenantMixin`
Adds multi-tenant support. Provides:
- `school_id`: UUID foreign key to `school` table (indexed)
- Automatic CASCADE delete

```python
from app.models.base import BaseModel, TenantMixin

class Student(BaseModel, TenantMixin):
    __tablename__ = "student"
    
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # school_id automatically added by TenantMixin
```

### `TimestampMixin`
Standalone mixin for timestamps (already included in BaseModel):
- `created_at`: Auto-set on creation
- `updated_at`: Auto-set on update

## Type Annotations (SQLAlchemy 2.0)

SQLAlchemy 2.0 uses `Mapped[]` for type safety:

```python
# Required field
name: Mapped[str] = mapped_column(String(100))

# Optional field (nullable)
middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

# UUID field
id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

# Boolean with default
is_active: Mapped[bool] = mapped_column(Boolean, default=True)

# Integer with constraints
age: Mapped[int] = mapped_column(Integer, nullable=False)

# Datetime
created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

# Text (unlimited length)
description: Mapped[str | None] = mapped_column(Text, nullable=True)
```

## Common Patterns

### 1. Simple Model

```python
from app.models.base import BaseModel
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

class School(BaseModel):
    __tablename__ = "school"
    
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    subdomain: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
```

### 2. Model with Tenant Isolation

```python
from app.models.base import BaseModel, TenantMixin

class Student(BaseModel, TenantMixin):
    __tablename__ = "student"
    
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    
    # school_id is automatically added by TenantMixin
```

### 3. Foreign Keys

```python
from uuid import UUID
from sqlalchemy import ForeignKey

class Student(BaseModel, TenantMixin):
    __tablename__ = "student"
    
    campus_id: Mapped[UUID] = mapped_column(
        ForeignKey("campus.id", ondelete="CASCADE"),
        nullable=False,
        index=True  # Always index foreign keys
    )
```

### 4. Relationships

```python
from sqlalchemy.orm import relationship

class School(BaseModel):
    __tablename__ = "school"
    
    name: Mapped[str] = mapped_column(String(200))
    
    # One-to-many
    students: Mapped[list["Student"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )

class Student(BaseModel):
    __tablename__ = "student"
    
    school_id: Mapped[UUID] = mapped_column(ForeignKey("school.id"))
    
    # Many-to-one
    school: Mapped["School"] = relationship(back_populates="students")
```

### 5. Composite Unique Constraints

```python
from sqlalchemy import UniqueConstraint

class Campus(BaseModel, TenantMixin):
    __tablename__ = "campus"
    
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    
    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_campus_school_name"),
        {"comment": "Campus with unique name per school"}
    )
```

### 6. Check Constraints

```python
from sqlalchemy import CheckConstraint

class Student(BaseModel):
    __tablename__ = "student"
    
    status: Mapped[str] = mapped_column(String(20))
    
    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'COMPLETED', 'TRANSFERRED_OUT')",
            name="ck_student_status"
        ),
    )
```

### 7. Indexes

```python
from sqlalchemy import Index

class User(BaseModel):
    __tablename__ = "user"
    
    email: Mapped[str] = mapped_column(String(255), index=True)  # Simple index
    phone_number: Mapped[str] = mapped_column(String(20))
    
    __table_args__ = (
        # Composite index
        Index("ix_user_email_phone", "email", "phone_number"),
        # Partial index
        Index("ix_user_active_email", "email", postgresql_where="status = 'ACTIVE'"),
    )
```

### 8. Enum Fields (Using String)

```python
class Student(BaseModel):
    __tablename__ = "student"
    
    # Store as string, validate in application layer
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        comment="Values: ACTIVE, INACTIVE, COMPLETED, TRANSFERRED_OUT"
    )
```

### 9. Many-to-Many with Association Table

```python
class StudentParent(BaseModel):
    __tablename__ = "student_parent"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False
    )
    parent_id: Mapped[UUID] = mapped_column(
        ForeignKey("parent.id", ondelete="CASCADE"),
        nullable=False
    )
    role: Mapped[str] = mapped_column(String(20))  # FATHER, MOTHER, GUARDIAN
    
    __table_args__ = (
        UniqueConstraint("student_id", "role", name="uq_student_parent_role"),
    )
```

## Model Registration

**IMPORTANT**: All models must be imported in `__init__.py` for Alembic to detect them:

```python
# backend/app/models/__init__.py
from app.models.base import Base, BaseModel, TenantMixin
from app.models.school import School
from app.models.student import Student
from app.models.user import User

__all__ = ["Base", "BaseModel", "TenantMixin", "School", "Student", "User"]
```

## Querying Models (Async)

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Select all
async def get_all_students(db: AsyncSession):
    result = await db.execute(select(Student))
    return result.scalars().all()

# Select with filter
async def get_student_by_id(db: AsyncSession, student_id: UUID):
    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    return result.scalar_one_or_none()

# Select with join
async def get_students_with_school(db: AsyncSession):
    result = await db.execute(
        select(Student, School)
        .join(School, Student.school_id == School.id)
    )
    return result.all()

# Insert
async def create_student(db: AsyncSession, data: dict):
    student = Student(**data)
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student

# Update
async def update_student(db: AsyncSession, student_id: UUID, data: dict):
    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    if student:
        for key, value in data.items():
            setattr(student, key, value)
        await db.commit()
        await db.refresh(student)
    return student

# Delete
async def delete_student(db: AsyncSession, student_id: UUID):
    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    if student:
        await db.delete(student)
        await db.commit()
```

## Migrations with Alembic

After creating or modifying models:

```bash
# Generate migration
alembic revision --autogenerate -m "Add student model"

# Review migration file in alembic/versions/

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Best Practices

1. **Always use `Mapped[]` type hints** for SQLAlchemy 2.0
2. **Always inherit from `BaseModel`** for consistency
3. **Use `TenantMixin`** for multi-tenant models
4. **Always index foreign keys** (index=True)
5. **Use CHECK constraints** for enum-like fields
6. **Document fields** with comments
7. **Use CASCADE deletes** appropriately
8. **Validate in application layer**, not just database
9. **Import all models in `__init__.py`** for Alembic
10. **Use async operations** everywhere

## Example: Complete Model

```python
from uuid import UUID
from sqlalchemy import ForeignKey, String, Text, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel, TenantMixin

class Student(BaseModel, TenantMixin):
    """Student model with full tenant isolation."""
    
    __tablename__ = "student"
    
    # Basic fields
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Status field with constraint
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        comment="ACTIVE | INACTIVE | COMPLETED | TRANSFERRED_OUT"
    )
    
    # Foreign keys
    campus_id: Mapped[UUID] = mapped_column(
        ForeignKey("campus.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Relationships
    campus: Mapped["Campus"] = relationship(back_populates="students")
    school: Mapped["School"] = relationship()
    
    # Table constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'COMPLETED', 'TRANSFERRED_OUT')",
            name="ck_student_status"
        ),
        {"comment": "Student records with tenant isolation"}
    )
    
    def __repr__(self) -> str:
        return f"<Student(id={self.id}, name={self.first_name} {self.last_name})>"
```

## Files

- `base.py` - Base classes (BaseModel, TenantMixin, TimestampMixin)
- `example.py` - Example models (DELETE after reviewing)
- `__init__.py` - Model registration (import all models here)
- `README.md` - This guide

## Next Steps

1. Review `example.py` for patterns
2. Create your models (school, user, student, etc.)
3. Import all models in `__init__.py`
4. Generate Alembic migration
5. Apply migration to database

