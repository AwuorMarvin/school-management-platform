"""
Payment History model - Payment records.
"""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PaymentHistory(BaseModel):
    """
    Payment History model - Individual payment records.
    
    Tracks each payment toward a fee.
    Cannot be deleted (audit trail).
    """
    
    __tablename__ = "payment_history"
    
    fee_id: Mapped[UUID] = mapped_column(
        ForeignKey("fee.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Payment amount"
    )
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payment_method: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="e.g., Cash, M-Pesa, Bank Transfer"
    )
    reference_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Transaction reference"
    )
    recorded_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Relationships
    fee: Mapped["Fee"] = relationship(back_populates="payment_history")
    recorded_by: Mapped["User"] = relationship()
    
    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_payment_history_amount"
        ),
        Index("idx_payment_history_date", "payment_date"),
        {"comment": "Payment history - audit trail of all payments"}
    )
    
    def __repr__(self) -> str:
        return f"<PaymentHistory(id={self.id}, fee_id={self.fee_id}, amount={self.amount}, date={self.payment_date})>"

