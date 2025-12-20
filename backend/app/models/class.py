"""
Class model - Classes within a campus and academic year.
"""

from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Class(BaseModel):
    """
    Class model - A class within a campus and academic year.
    
    Classes belong to a campus and academic year.
    Name must be unique within campus+academic_year.
    """
    
    __tablename__ = "class"
    
    campus_id: Mapped[UUID] = mapped_column(
        ForeignKey("campus.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    academic_year_id: Mapped[UUID] = mapped_column(
        ForeignKey("academic_year.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Max number of students (1-100)"
    )
    
    # Relationships
    campus: Mapped["Campus"] = relationship(back_populates="classes")
    academic_year: Mapped["AcademicYear"] = relationship(back_populates="classes")
    # Many-to-many relationship with Subject via ClassSubject junction table
    class_subjects: Mapped[list["ClassSubject"]] = relationship(
        back_populates="class_",
        cascade="all, delete-orphan"
    )
    student_assignments: Mapped[list["StudentClassHistory"]] = relationship(
        back_populates="class_",
        cascade="all, delete-orphan"
    )
    teacher_assignments: Mapped[list["TeacherClassAssignment"]] = relationship(
        back_populates="class_",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        UniqueConstraint("campus_id", "academic_year_id", "name", name="uq_class_campus_year_name"),
        CheckConstraint(
            "capacity IS NULL OR (capacity > 0 AND capacity <= 100)",
            name="ck_class_capacity"
        ),
        {"comment": "Class within campus and academic year"}
    )
    
    def __repr__(self) -> str:
        return f"<Class(id={self.id}, name={self.name}, campus_id={self.campus_id})>"

