"""
Student model - Student records.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class Student(BaseModel, TenantMixin):
    """
    Student model - Student records with tenant isolation.
    
    Students belong to exactly one campus.
    Status: INACTIVE → ACTIVE → COMPLETED/TRANSFERRED_OUT
    """
    
    __tablename__ = "student"
    
    campus_id: Mapped[UUID] = mapped_column(
        ForeignKey("campus.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        index=True,
        comment="INACTIVE | ACTIVE | COMPLETED | TRANSFERRED_OUT"
    )
    transport_route_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("transport_route.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Transport route/zone assigned to student"
    )
    transport_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="ONE_WAY | TWO_WAY (optional)"
    )
    
    # Relationships
    campus: Mapped["Campus"] = relationship(back_populates="students")
    transport_route: Mapped["TransportRoute | None"] = relationship(back_populates="students")
    club_activities: Mapped[list["StudentClubActivity"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan"
    )
    parent_links: Mapped[list["StudentParent"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan"
    )
    class_history: Mapped[list["StudentClassHistory"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan"
    )
    academic_enrollments: Mapped[list["StudentAcademicEnrollment"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        CheckConstraint(
            "status IN ('INACTIVE', 'ACTIVE', 'COMPLETED', 'TRANSFERRED_OUT')",
            name="ck_student_status"
        ),
        CheckConstraint(
            "(transport_type IN ('ONE_WAY', 'TWO_WAY')) OR transport_type IS NULL",
            name="ck_student_transport_type"
        ),
        Index("idx_student_school_campus", "school_id", "campus_id"),
        {"comment": "Student records with tenant and campus isolation"}
    )
    
    def __repr__(self) -> str:
        return f"<Student(id={self.id}, name={self.first_name} {self.last_name}, status={self.status})>"

