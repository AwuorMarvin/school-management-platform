"""
Fee Adjustment model - Per-student fee adjustments (discounts).
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class FeeAdjustment(BaseModel, TenantMixin):
    """
    Fee Adjustment model - Per-student fee adjustments.
    
    Tracks discounts or adjustments applied to individual students.
    Adjustments are applied on top of the base fee structure.
    """
    
    __tablename__ = "fee_adjustment"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    term_id: Mapped[UUID] = mapped_column(
        ForeignKey("term.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    adjustment_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="FIXED_AMOUNT | PERCENTAGE"
    )
    adjustment_value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Discount amount (KES) or percentage (%)"
    )
    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Reason for adjustment (required)"
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="User who created the adjustment"
    )
    
    # Relationships
    student: Mapped["Student"] = relationship()
    term: Mapped["Term"] = relationship()
    created_by: Mapped["User"] = relationship()
    
    __table_args__ = (
        CheckConstraint(
            "adjustment_type IN ('FIXED_AMOUNT', 'PERCENTAGE')",
            name="ck_fee_adjustment_type"
        ),
        CheckConstraint(
            "adjustment_value >= 0",
            name="ck_fee_adjustment_value"
        ),
        # Percentage validation handled in application logic
        {"comment": "Per-student fee adjustments (discounts)"}
    )
    
    def __repr__(self) -> str:
        return f"<FeeAdjustment(student_id={self.student_id}, term_id={self.term_id}, type={self.adjustment_type}, value={self.adjustment_value})>"

