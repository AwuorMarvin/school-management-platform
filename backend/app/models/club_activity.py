"""
Club Activity model - Clubs and Extra-Curricular Activities.
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class ClubActivity(BaseModel, TenantMixin):
    """
    Club Activity model - Clubs and Extra-Curricular Activities.
    
    Can be either a CLUB (e.g., Debating Club) or EXTRA_CURRICULAR (e.g., Swimming).
    Linked to academic year, term, classes, and has a teacher/instructor.
    """
    
    __tablename__ = "club_activity"
    
    service_name: Mapped[str] = mapped_column(String(200), nullable=False, comment="Name of the club/activity")
    activity_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="CLUB | EXTRA_CURRICULAR"
    )
    cost_per_term: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Cost per term for this activity"
    )
    teacher_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Teacher/Instructor assigned to this activity"
    )
    academic_year_id: Mapped[UUID] = mapped_column(
        ForeignKey("academic_year.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    term_id: Mapped[UUID] = mapped_column(
        ForeignKey("term.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Relationships
    teacher: Mapped["User | None"] = relationship()
    academic_year: Mapped["AcademicYear"] = relationship()
    term: Mapped["Term"] = relationship()
    class_activities: Mapped[list["ClubActivityClass"]] = relationship(
        back_populates="club_activity",
        cascade="all, delete-orphan"
    )
    student_activities: Mapped[list["StudentClubActivity"]] = relationship(
        back_populates="club_activity",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        CheckConstraint(
            "activity_type IN ('CLUB', 'EXTRA_CURRICULAR')",
            name="ck_club_activity_type"
        ),
        CheckConstraint(
            "cost_per_term >= 0",
            name="ck_club_activity_cost"
        ),
        {"comment": "Clubs and Extra-Curricular Activities"}
    )
    
    def __repr__(self) -> str:
        return f"<ClubActivity(id={self.id}, service_name={self.service_name}, type={self.activity_type})>"

