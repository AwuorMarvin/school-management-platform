"""
Student-Parent relationship model.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, String, CheckConstraint, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class StudentParent(BaseModel):
    """
    Student-Parent relationship model.
    
    Links students to parents with role (FATHER, MOTHER, GUARDIAN).
    Enforces max 1 parent per role per student.
    """
    
    __tablename__ = "student_parent"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    parent_id: Mapped[UUID] = mapped_column(
        ForeignKey("parent.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="FATHER | MOTHER | GUARDIAN"
    )
    
    # Relationships
    student: Mapped["Student"] = relationship(back_populates="parent_links")
    parent: Mapped["Parent"] = relationship(back_populates="student_links")
    
    __table_args__ = (
        UniqueConstraint("student_id", "role", name="uq_student_parent_role"),
        CheckConstraint(
            "role IN ('FATHER', 'MOTHER', 'GUARDIAN')",
            name="ck_student_parent_role"
        ),
        Index("idx_student_parent_parent", "parent_id"),
        {"comment": "Student-parent relationships with role constraints"}
    )
    
    def __repr__(self) -> str:
        return f"<StudentParent(student_id={self.student_id}, parent_id={self.parent_id}, role={self.role})>"

