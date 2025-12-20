"""
Academic Year model.
"""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class AcademicYear(BaseModel, TenantMixin):
    """
    Academic Year model - Defines a school year.
    
    Academic years must not overlap.
    """
    
    __tablename__ = "academic_year"
    
    name: Mapped[str] = mapped_column(String(50), nullable=False)
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
        """Check if this academic year is currently active."""
        return self.status == "ACTIVE"
    
    # Relationships
    terms: Mapped[list["Term"]] = relationship(
        back_populates="academic_year",
        cascade="all, delete-orphan"
    )
    classes: Mapped[list["Class"]] = relationship(
        back_populates="academic_year",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_academic_year_school_name"),
        CheckConstraint(
            "start_date < end_date",
            name="ck_academic_year_dates"
        ),
        {"comment": "Academic year with non-overlapping date ranges"}
    )
    
    def __repr__(self) -> str:
        return f"<AcademicYear(id={self.id}, name={self.name}, school_id={self.school_id})>"

