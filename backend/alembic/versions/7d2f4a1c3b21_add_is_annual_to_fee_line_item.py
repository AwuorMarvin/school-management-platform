"""add_is_annual_to_fee_line_item

Revision ID: 7d2f4a1c3b21
Revises: 3c1f2a7b9d10
Create Date: 2025-12-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7d2f4a1c3b21"
down_revision: Union[str, Sequence[str], None] = "3c1f2a7b9d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_annual flag to fee_line_item."""
    op.add_column(
        "fee_line_item",
        sa.Column(
            "is_annual",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="If true, this line item is charged once per academic year (annual); otherwise per term",
        ),
    )


def downgrade() -> None:
    """Remove is_annual flag from fee_line_item."""
    op.drop_column("fee_line_item", "is_annual")


