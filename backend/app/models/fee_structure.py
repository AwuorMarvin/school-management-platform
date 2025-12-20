"""
Fee Structure model - Fee structures with line items per term per class.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class FeeStructure(BaseModel, TenantMixin):
    """
    Fee Structure model - Fee structures with line items.
    
    Defines fee structures for classes in terms with multiple line items.
    Supports versioning: editing creates new versions, preserving history.
    Can be scoped to TERM (single term) or YEAR (entire academic year).
    Supports multiple classes via FeeStructureClass junction table.
    """
    
    __tablename__ = "fee_structure"
    
    structure_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Name of the fee structure (e.g., 'Term 3 – PP1 – v2')"
    )
    campus_id: Mapped[UUID] = mapped_column(
        ForeignKey("campus.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Campus this fee structure applies to"
    )
    academic_year_id: Mapped[UUID] = mapped_column(
        ForeignKey("academic_year.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Academic year this structure belongs to"
    )
    term_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("term.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Term (nullable for YEAR-scoped structures)"
    )
    # Legacy field - kept for backward compatibility, but multi-class support uses fee_structure_class junction table
    class_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("class.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Legacy: Single class ID (deprecated - use fee_structure_class junction table for multi-class support)"
    )
    # TERM = regular per-term structure, YEAR = created as part of a yearly structure for the academic year
    structure_scope: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="TERM",
        comment="TERM | YEAR (YEAR indicates structure created as part of a yearly academic-year fee)",
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Version number (increments on edit)"
    )
    parent_structure_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("fee_structure.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Parent structure ID (for versioning - links to previous version)"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="INACTIVE",
        comment="ACTIVE | INACTIVE"
    )
    base_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Total of all line items (calculated field)"
    )
    effective_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When this structure becomes effective"
    )
    effective_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When this structure expires (for historical tracking)"
    )
    
    # Relationships
    campus: Mapped["Campus"] = relationship()
    academic_year: Mapped["AcademicYear"] = relationship()
    term: Mapped["Term | None"] = relationship()
    parent_structure: Mapped["FeeStructure | None"] = relationship(
        "FeeStructure",
        remote_side="FeeStructure.id",
        foreign_keys=[parent_structure_id]
    )
    child_structures: Mapped[list["FeeStructure"]] = relationship(
        "FeeStructure",
        foreign_keys=[parent_structure_id],
        remote_side="FeeStructure.id"
    )
    classes: Mapped[list["FeeStructureClass"]] = relationship(
        back_populates="fee_structure",
        cascade="all, delete-orphan"
    )
    line_items: Mapped[list["FeeLineItem"]] = relationship(
        back_populates="fee_structure",
        cascade="all, delete-orphan",
        order_by="FeeLineItem.display_order"
    )
    
    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE')",
            name="ck_fee_structure_status"
        ),
        CheckConstraint(
            "structure_scope IN ('TERM', 'YEAR')",
            name="ck_fee_structure_scope",
        ),
        CheckConstraint(
            "base_fee >= 0",
            name="ck_fee_structure_base_fee"
        ),
        CheckConstraint(
            "version > 0",
            name="ck_fee_structure_version"
        ),
        # Index for active structures (only one active per class+term)
        Index("idx_fee_structure_active", "campus_id", "academic_year_id", "term_id", "status", unique=False),
        {"comment": "Fee structures with line items per term per class - supports versioning"}
    )
    
    def __repr__(self) -> str:
        return f"<FeeStructure(id={self.id}, name={self.structure_name}, version={self.version}, scope={self.structure_scope}, status={self.status})>"


class FeeStructureClass(BaseModel):
    """
    Junction table for many-to-many relationship between FeeStructure and Class.
    
    Allows a fee structure to apply to multiple classes.
    """
    
    __tablename__ = "fee_structure_class"
    
    fee_structure_id: Mapped[UUID] = mapped_column(
        ForeignKey("fee_structure.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("class.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Relationships
    fee_structure: Mapped["FeeStructure"] = relationship(back_populates="classes")
    class_: Mapped["Class"] = relationship()
    
    __table_args__ = (
        {"comment": "Junction table: Fee structures to classes (many-to-many)"}
    )
    
    def __repr__(self) -> str:
        return f"<FeeStructureClass(fee_structure_id={self.fee_structure_id}, class_id={self.class_id})>"

