"""
Global Discount model - School-wide or class-wide discount rules.
"""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class GlobalDiscount(BaseModel, TenantMixin):
    """
    Global Discount model - Discount rules that apply to multiple students.
    
    Can be applied to:
    - All students in school
    - Specific campuses
    - Specific classes
    
    Only one global discount can be active per term.
    """
    
    __tablename__ = "global_discount"
    
    discount_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Name of the discount (e.g., 'Early Payment Discount')"
    )
    discount_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="FIXED_AMOUNT | PERCENTAGE"
    )
    discount_value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Discount amount (KES) or percentage (%)"
    )
    term_id: Mapped[UUID] = mapped_column(
        ForeignKey("term.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    applies_to: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="ALL_STUDENTS | SELECTED_CAMPUSES | SELECTED_CLASSES"
    )
    condition_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="PAYMENT_BEFORE_DATE | NONE"
    )
    condition_value: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Condition value (e.g., date for PAYMENT_BEFORE_DATE)"
    )
    is_active: Mapped[bool] = mapped_column(
        default=True,
        comment="Whether this discount is currently active"
    )
    
    # Relationships
    term: Mapped["Term"] = relationship()
    
    # Many-to-many relationships (via junction tables)
    campus_discounts: Mapped[list["GlobalDiscountCampus"]] = relationship(
        back_populates="global_discount",
        cascade="all, delete-orphan"
    )
    class_discounts: Mapped[list["GlobalDiscountClass"]] = relationship(
        back_populates="global_discount",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        CheckConstraint(
            "discount_type IN ('FIXED_AMOUNT', 'PERCENTAGE')",
            name="ck_global_discount_type"
        ),
        CheckConstraint(
            "discount_value >= 0",
            name="ck_global_discount_value"
        ),
        # Percentage validation (max 100%) handled in application logic
        CheckConstraint(
            "applies_to IN ('ALL_STUDENTS', 'SELECTED_CAMPUSES', 'SELECTED_CLASSES')",
            name="ck_global_discount_applies_to"
        ),
        {"comment": "Global discount rules for fee structures"}
    )
    
    def __repr__(self) -> str:
        return f"<GlobalDiscount(id={self.id}, name={self.discount_name}, type={self.discount_type}, value={self.discount_value})>"


class GlobalDiscountCampus(BaseModel):
    """
    Junction table for global discounts and campuses.
    """
    
    __tablename__ = "global_discount_campus"
    
    global_discount_id: Mapped[UUID] = mapped_column(
        ForeignKey("global_discount.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    campus_id: Mapped[UUID] = mapped_column(
        ForeignKey("campus.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Relationships
    global_discount: Mapped["GlobalDiscount"] = relationship(back_populates="campus_discounts")
    campus: Mapped["Campus"] = relationship()
    
    __table_args__ = (
        {"comment": "Many-to-many relationship between global discounts and campuses"}
    )


class GlobalDiscountClass(BaseModel):
    """
    Junction table for global discounts and classes.
    """
    
    __tablename__ = "global_discount_class"
    
    global_discount_id: Mapped[UUID] = mapped_column(
        ForeignKey("global_discount.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("class.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Relationships
    global_discount: Mapped["GlobalDiscount"] = relationship(back_populates="class_discounts")
    class_: Mapped["Class"] = relationship()
    
    __table_args__ = (
        {"comment": "Many-to-many relationship between global discounts and classes"}
    )

