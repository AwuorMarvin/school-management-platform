"""
Transport Route model - School transport routes.
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class TransportRoute(BaseModel, TenantMixin):
    """
    Transport Route model - School transport routes/zones.
    
    Defines transport zones served by the school transport.
    Each route has a zone name, description, and cost per term.
    """
    
    __tablename__ = "transport_route"
    
    zone: Mapped[str] = mapped_column(String(100), nullable=False, comment="Zone name (e.g., 'Zone A', 'Westlands')")
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Description of the route/zone"
    )
    # Legacy total cost column (kept for backward compatibility; treated as two-way cost)
    cost_per_term: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="(Deprecated) Transport cost per term - kept for backward compatibility"
    )
    one_way_cost_per_term: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="One-way transport cost per term"
    )
    two_way_cost_per_term: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Two-way transport cost per term"
    )
    
    # Relationships
    students: Mapped[list["Student"]] = relationship(back_populates="transport_route")
    
    __table_args__ = (
        CheckConstraint(
            "one_way_cost_per_term >= 0 AND two_way_cost_per_term >= 0",
            name="ck_transport_route_costs_non_negative"
        ),
        {"comment": "School transport routes/zones"}
    )
    
    def __repr__(self) -> str:
        return f"<TransportRoute(id={self.id}, zone={self.zone}, cost={self.cost_per_term})>"

