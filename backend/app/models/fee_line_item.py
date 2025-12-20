"""
Fee Line Item model - Individual line items within a fee structure.
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class FeeLineItem(BaseModel):
    """
    Fee Line Item model - Individual fee components.
    
    Each fee structure can have multiple line items (e.g., Tuition, Books, Uniform).
    Line items are immutable once the fee structure is active.
    """
    
    __tablename__ = "fee_line_item"
    
    fee_structure_id: Mapped[UUID] = mapped_column(
        ForeignKey("fee_structure.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    item_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Name of the fee line item (e.g., 'Tuition', 'Books', 'Uniform')"
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Amount for this line item"
    )
    is_annual: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="If true, this line item is charged once per academic year (annual); otherwise per term",
    )
    is_one_off: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="If true, this line item is charged once for new students only (one-off fee)",
    )
    display_order: Mapped[int] = mapped_column(
        default=0,
        comment="Order in which to display line items"
    )
    
    # Relationships
    fee_structure: Mapped["FeeStructure"] = relationship(back_populates="line_items")
    
    __table_args__ = (
        CheckConstraint(
            "amount >= 0",
            name="ck_fee_line_item_amount"
        ),
        CheckConstraint(
            "NOT (is_annual = true AND is_one_off = true)",
            name="ck_fee_line_item_type_exclusive"
        ),
        {"comment": "Individual line items within a fee structure"}
    )
    
    def __repr__(self) -> str:
        return f"<FeeLineItem(id={self.id}, item_name={self.item_name}, amount={self.amount})>"

