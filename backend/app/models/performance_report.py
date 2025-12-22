"""
Performance report models - Subject performance with detailed line items.
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import ForeignKey, Numeric, String, Text, Integer, Boolean, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class PerformanceReport(BaseModel, TenantMixin):
    """
    Performance report for a student in a specific subject, class, term and academic year.

    One report per (student, subject, class, term, academic year, teacher, school).
    """

    __tablename__ = "performance_report"

    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student this report belongs to",
    )
    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("class.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Class the student was in for this report",
    )
    subject_id: Mapped[UUID] = mapped_column(
        ForeignKey("subject.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Subject this report is for",
    )
    teacher_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Teacher responsible for this subject in this class",
    )
    academic_year_id: Mapped[UUID] = mapped_column(
        ForeignKey("academic_year.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Academic year for this report",
    )
    term_id: Mapped[UUID] = mapped_column(
        ForeignKey("term.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Term for this report",
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="User who entered this report",
    )
    updated_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Last user who updated this report",
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Soft delete flag for performance reports",
    )

    # Relationships
    student: Mapped["Student"] = relationship()
    subject: Mapped["Subject"] = relationship()
    term: Mapped["Term"] = relationship()
    cls: Mapped["Class"] = relationship(
        "Class",
        foreign_keys=[class_id],
    )
    academic_year: Mapped["AcademicYear"] = relationship(
        "AcademicYear",
        foreign_keys=[academic_year_id],
    )
    teacher: Mapped["User"] = relationship(foreign_keys=[teacher_id])
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_user_id])
    updated_by: Mapped["User | None"] = relationship(foreign_keys=[updated_by_user_id])
    line_items: Mapped[list["PerformanceLineItem"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index(
            "idx_performance_report_student_subject_term_teacher",
            "school_id",
            "student_id",
            "subject_id",
            "class_id",
            "academic_year_id",
            "term_id",
            "teacher_id",
            unique=True,
        ),
        {
            "comment": "Student performance report per subject/class/term/teacher with detailed line items"
        },
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<PerformanceReport(id={self.id}, student_id={self.student_id}, "
            f"subject_id={self.subject_id}, term_id={self.term_id}, teacher_id={self.teacher_id})>"
        )


class PerformanceLineItem(BaseModel, TenantMixin):
    """
    Detailed performance line item within a performance report.

    Each line item represents a performance area (e.g., Algebra) with scores and comments.
    """

    __tablename__ = "performance_line_item"

    report_id: Mapped[UUID] = mapped_column(
        ForeignKey("performance_report.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent performance report",
    )
    area_label: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Performance area name (e.g., 'Algebra')",
    )
    numeric_score: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
        comment="Optional numeric score for this area",
    )
    descriptive_score: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Optional descriptive score (e.g., 'ME' for Meeting Expectations)",
    )
    comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Optional detailed comment for this performance area",
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Ordering of line items within the report (1–5)",
    )

    # Relationships
    report: Mapped[PerformanceReport] = relationship(back_populates="line_items")

    __table_args__ = (
        CheckConstraint(
            "numeric_score IS NOT NULL OR descriptive_score IS NOT NULL",
            name="ck_performance_line_item_has_score",
        ),
        CheckConstraint(
            "position >= 1 AND position <= 5",
            name="ck_performance_line_item_position_range",
        ),
        {
            "comment": "Detailed performance areas within a performance report (max 5 per report)"
        },
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<PerformanceLineItem(id={self.id}, area_label={self.area_label})>"


