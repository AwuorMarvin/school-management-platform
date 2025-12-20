"""
Term model - Academic terms within a year.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Term(BaseModel):
    """
    Term model - Academic term within an academic year.
    
    Terms within the same academic year must not overlap.
    """
    
    __tablename__ = "term"
    
    academic_year_id: Mapped[UUID] = mapped_column(
        ForeignKey("academic_year.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    
    # Computed status (derived from dates)
    @property
    def status(self) -> str:
        """Derived status: ACTIVE if current date is within range, ARCHIVED otherwise."""
        today = date.today()
        return "ACTIVE" if self.start_date <= today <= self.end_date else "ARCHIVED"
    
    @property
    def is_current(self) -> bool:
        """Check if this term is currently active."""
        return self.status == "ACTIVE"
    
    # Relationships
    academic_year: Mapped["AcademicYear"] = relationship(back_populates="terms")
    
    __table_args__ = (
        CheckConstraint(
            "start_date < end_date",
            name="ck_term_dates"
        ),
        {"comment": "Academic term - dates must be within academic year and not overlap"}
    )
    
    def __repr__(self) -> str:
        return f"<Term(id={self.id}, name={self.name}, academic_year_id={self.academic_year_id})>"

