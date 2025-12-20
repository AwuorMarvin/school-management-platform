"""add_fee_structure_v2_fields_versioning_one_off

Revision ID: 3972e3035615
Revises: 0b2a5f72b316
Create Date: 2025-12-19 19:50:07.651888

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3972e3035615'
down_revision: Union[str, Sequence[str], None] = '0b2a5f72b316'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
