"""
add_transport_direction_and_costs

Revision ID: 3c1f2a7b9d10
Revises: 9ed93876ae96
Create Date: 2025-12-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "3c1f2a7b9d10"
down_revision: Union[str, Sequence[str], None] = "2a3b4c5d6e7f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add one-way/two-way transport costs and student transport type."""

    # --- TransportRoute: add one-way and two-way cost columns ---
    op.add_column(
        "transport_route",
        sa.Column(
            "one_way_cost_per_term",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0.00",
            comment="One-way transport cost per term",
        ),
    )
    op.add_column(
        "transport_route",
        sa.Column(
            "two_way_cost_per_term",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0.00",
            comment="Two-way transport cost per term",
        ),
    )

    # Backfill new columns from existing cost_per_term so behaviour stays the same
    op.execute(
        text(
            """
            UPDATE transport_route
            SET
                one_way_cost_per_term = cost_per_term,
                two_way_cost_per_term = cost_per_term
            """
        )
    )

    # Drop old check constraint (if it exists) and replace with a new one covering both columns
    try:
        op.drop_constraint("ck_transport_route_cost", "transport_route", type_="check")
    except Exception:
        # Constraint may not exist or may have a different name; ignore
        pass

    op.create_check_constraint(
        "ck_transport_route_costs_non_negative",
        "transport_route",
        "one_way_cost_per_term >= 0 AND two_way_cost_per_term >= 0",
    )

    # Remove server defaults now that data is backfilled
    op.alter_column(
        "transport_route",
        "one_way_cost_per_term",
        server_default=None,
    )
    op.alter_column(
        "transport_route",
        "two_way_cost_per_term",
        server_default=None,
    )

    # --- Student: add transport_type column ---
    op.add_column(
        "student",
        sa.Column(
            "transport_type",
            sa.String(length=20),
            nullable=True,
            comment="ONE_WAY | TWO_WAY (optional)",
        ),
    )
    op.create_check_constraint(
        "ck_student_transport_type",
        "student",
        "(transport_type IN ('ONE_WAY', 'TWO_WAY')) OR transport_type IS NULL",
    )


def downgrade() -> None:
    """Revert transport direction and costs changes."""

    # --- Student: drop transport_type ---
    op.drop_constraint("ck_student_transport_type", "student", type_="check")
    op.drop_column("student", "transport_type")

    # --- TransportRoute: drop new costs and restore old constraint ---
    op.drop_constraint("ck_transport_route_costs_non_negative", "transport_route", type_="check")
    op.drop_column("transport_route", "two_way_cost_per_term")
    op.drop_column("transport_route", "one_way_cost_per_term")

    # Restore original non-negative constraint on cost_per_term (name may differ from original)
    op.create_check_constraint(
        "ck_transport_route_cost",
        "transport_route",
        "cost_per_term >= 0",
    )


