"""
Teacher Class Assignment model.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class TeacherClassAssignment(BaseModel):
    """
    Teacher Class Assignment model.
    
    Links teachers to classes, optionally for specific subjects.
    Time-bound assignments with start_date and end_date.
    """
    
    __tablename__ = "teacher_class_assignment"
    
    teacher_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("class.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    subject_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("subject.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="NULL if teaching all subjects in class"
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="NULL for active assignment"
    )
    
    # Relationships
    teacher: Mapped["User"] = relationship()
    class_: Mapped["Class"] = relationship(back_populates="teacher_assignments")
    subject: Mapped["Subject | None"] = relationship()
    
    __table_args__ = (
        Index("idx_teacher_class_active", "teacher_id", "class_id", postgresql_where="end_date IS NULL"),
        {"comment": "Teacher assignments to classes/subjects - time-bound"}
    )
    
    def __repr__(self) -> str:
        status = "ACTIVE" if self.end_date is None else "ENDED"
        return f"<TeacherClassAssignment(teacher_id={self.teacher_id}, class_id={self.class_id}, status={status})>"

