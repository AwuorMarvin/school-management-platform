"""
Fee model - Student fee tracking.
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, Text, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Fee(BaseModel):
    """
    Fee model - Expected and paid fees per student per term.
    
    Tracks expected amount, paid amount, and calculates pending.
    One fee record per student per term.
    """
    
    __tablename__ = "fee"
    
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
    expected_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Expected fee amount"
    )
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Total amount paid"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Relationships
    student: Mapped["Student"] = relationship()
    term: Mapped["Term"] = relationship()
    payment_history: Mapped[list["PaymentHistory"]] = relationship(
        back_populates="fee",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        UniqueConstraint("student_id", "term_id", name="uq_fee_student_term"),
        CheckConstraint(
            "expected_amount >= 0",
            name="ck_fee_expected_amount"
        ),
        CheckConstraint(
            "paid_amount >= 0",
            name="ck_fee_paid_amount"
        ),
        Index("idx_fee_student", "student_id"),
        Index("idx_fee_term", "term_id"),
        {"comment": "Fee tracking - expected and paid amounts per student per term"}
    )
    
    @property
    def pending_amount(self) -> Decimal:
        """Calculate pending amount."""
        return max(Decimal("0.00"), self.expected_amount - self.paid_amount)
    
    def __repr__(self) -> str:
        return f"<Fee(student_id={self.student_id}, term_id={self.term_id}, expected={self.expected_amount}, paid={self.paid_amount})>"

