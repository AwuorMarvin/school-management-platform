"""
Student One-Off Fee model - Tracks one-off fees paid by students.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class StudentOneOffFee(BaseModel):
    """
    Student One-Off Fee model - Tracks one-off fees paid by students.
    
    One-off fees are charged only once per student per academic year.
    This table tracks which students have paid which one-off fees.
    """
    
    __tablename__ = "student_one_off_fee"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student who paid this one-off fee"
    )
    fee_line_item_id: Mapped[UUID] = mapped_column(
        ForeignKey("fee_line_item.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="The one-off fee line item that was paid"
    )
    academic_year_id: Mapped[UUID] = mapped_column(
        ForeignKey("academic_year.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Academic year this one-off fee applies to"
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When this one-off fee was paid (NULL if not yet paid)"
    )
    
    # Relationships
    student: Mapped["Student"] = relationship()
    fee_line_item: Mapped["FeeLineItem"] = relationship()
    academic_year: Mapped["AcademicYear"] = relationship()
    
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "fee_line_item_id",
            "academic_year_id",
            name="uq_student_one_off_fee"
        ),
        {"comment": "Tracks one-off fees paid by students per academic year"}
    )
    
    def __repr__(self) -> str:
        return f"<StudentOneOffFee(student_id={self.student_id}, fee_line_item_id={self.fee_line_item_id}, academic_year_id={self.academic_year_id})>"

