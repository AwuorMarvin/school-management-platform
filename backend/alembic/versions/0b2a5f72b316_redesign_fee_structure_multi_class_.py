"""redesign_fee_structure_multi_class_support

Revision ID: 0b2a5f72b316
Revises: b8123f9c4a10
Create Date: 2025-12-19 19:44:20.548958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0b2a5f72b316'
down_revision: Union[str, Sequence[str], None] = 'b8123f9c4a10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
