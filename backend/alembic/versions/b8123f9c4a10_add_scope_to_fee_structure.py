"""add_scope_to_fee_structure

Revision ID: b8123f9c4a10
Revises: 7d2f4a1c3b21
Create Date: 2025-12-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b8123f9c4a10"
down_revision: Union[str, Sequence[str], None] = "7d2f4a1c3b21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  """Add structure_scope column to fee_structure."""
  op.add_column(
      "fee_structure",
      sa.Column(
          "structure_scope",
          sa.String(length=20),
          nullable=False,
          server_default="TERM",
          comment="TERM | YEAR (YEAR indicates this structure was created as part of a yearly fee for the academic year)",
      ),
  )
  op.create_check_constraint(
      "ck_fee_structure_scope",
      "fee_structure",
      "structure_scope IN ('TERM', 'YEAR')",
  )


def downgrade() -> None:
  """Remove structure_scope column from fee_structure."""
  op.drop_constraint("ck_fee_structure_scope", "fee_structure", type_="check")
  op.drop_column("fee_structure", "structure_scope")


