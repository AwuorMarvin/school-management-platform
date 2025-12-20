"""
Example model demonstrating SQLAlchemy 2.0 patterns.

This file shows how to create models using the base classes.
DELETE THIS FILE after understanding the patterns.
"""

from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


# ============================================================================
# Example 1: Simple Model with BaseModel
# ============================================================================
class ExampleSchool(BaseModel):
    """
    Example school model.
    
    Inherits from BaseModel which provides:
    - id: UUID (primary key)
    - created_at: datetime
    - updated_at: datetime
    """
    
    __tablename__ = "example_school"
    
    # Required fields
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    subdomain: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    
    # Optional fields
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Boolean field with default
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relationship example (one-to-many)
    # students: Mapped[list["ExampleStudent"]] = relationship(back_populates="school")


# ============================================================================
# Example 2: Model with Tenant Isolation
# ============================================================================
class ExampleStudent(BaseModel, TenantMixin):
    """
    Example student model with tenant isolation.
    
    Inherits from:
    - BaseModel: id, created_at, updated_at
    - TenantMixin: school_id (with index and foreign key)
    """
    
    __tablename__ = "example_student"
    
    # Student fields
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Optional middle name
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    # Enum-like field using String with check constraint
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        comment="Student status: ACTIVE, INACTIVE, COMPLETED, TRANSFERRED_OUT"
    )
    
    # Foreign key to another table
    campus_id: Mapped[UUID] = mapped_column(
        ForeignKey("example_campus.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Relationships
    # campus: Mapped["ExampleCampus"] = relationship(back_populates="students")
    # school: Mapped["ExampleSchool"] = relationship()


# ============================================================================
# Example 3: Model with Composite Unique Constraint
# ============================================================================
class ExampleCampus(BaseModel, TenantMixin):
    """
    Example campus model with composite unique constraint.
    
    Demonstrates:
    - Tenant isolation (school_id from TenantMixin)
    - Composite unique constraint (school_id + name)
    - Table-level constraints
    """
    
    __tablename__ = "example_campus"
    __table_args__ = (
        # Composite unique constraint
        {"comment": "Campus belongs to a school and has unique name within school"},
    )
    
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Note: Composite uniqueness enforced by unique constraint
    # UNIQUE(school_id, name) - defined at table level or via Index


# ============================================================================
# Example 4: Many-to-Many Relationship (Association Table)
# ============================================================================
class ExampleStudentParent(BaseModel):
    """
    Example association table for many-to-many relationship.
    
    Demonstrates:
    - Many-to-many between Student and Parent
    - Additional fields on association table (role)
    - Composite primary key alternative pattern
    """
    
    __tablename__ = "example_student_parent"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("example_student.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    parent_id: Mapped[UUID] = mapped_column(
        ForeignKey("example_parent.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Additional field on association table
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Parent role: FATHER, MOTHER, GUARDIAN"
    )
    
    # Relationships
    # student: Mapped["ExampleStudent"] = relationship()
    # parent: Mapped["ExampleParent"] = relationship()


class ExampleParent(BaseModel, TenantMixin):
    """Example parent model."""
    
    __tablename__ = "example_parent"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("example_user.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )
    
    id_number: Mapped[str] = mapped_column(String(50), nullable=False)


class ExampleUser(BaseModel, TenantMixin):
    """Example user model."""
    
    __tablename__ = "example_user"
    
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    
    # Composite unique constraints
    __table_args__ = (
        # Email unique per school
        # Phone unique per school
        {"comment": "User with tenant-scoped unique email and phone"},
    )


# ============================================================================
# Common Patterns Summary
# ============================================================================
"""
1. Simple Model:
   class MyModel(BaseModel):
       __tablename__ = "my_table"
       name: Mapped[str] = mapped_column(String(100))

2. With Tenant Isolation:
   class MyModel(BaseModel, TenantMixin):
       __tablename__ = "my_table"
       name: Mapped[str] = mapped_column(String(100))
       # Automatically gets school_id field with FK and index

3. Required vs Optional Fields:
   required: Mapped[str] = mapped_column(String(100))
   optional: Mapped[str | None] = mapped_column(String(100), nullable=True)

4. Foreign Keys:
   parent_id: Mapped[UUID] = mapped_column(
       ForeignKey("parent_table.id", ondelete="CASCADE"),
       nullable=False,
       index=True
   )

5. Relationships (one-to-many):
   children: Mapped[list["ChildModel"]] = relationship(back_populates="parent")

6. Relationships (many-to-one):
   parent: Mapped["ParentModel"] = relationship(back_populates="children")

7. Default Values:
   status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
   is_active: Mapped[bool] = mapped_column(Boolean, default=True)

8. Indexes:
   - Foreign keys automatically indexed
   - Additional indexes: index=True in mapped_column
   - Composite indexes: use Index in __table_args__

9. Unique Constraints:
   - Single column: unique=True
   - Composite: UniqueConstraint in __table_args__
"""

