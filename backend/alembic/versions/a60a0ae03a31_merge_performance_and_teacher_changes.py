"""merge_performance_and_teacher_changes

Revision ID: a60a0ae03a31
Revises: e3f4a5b6c7d8, f2a3b4c5d6e7
Create Date: 2025-12-28 17:52:15.584619

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a60a0ae03a31'
down_revision: Union[str, Sequence[str], None] = ('e3f4a5b6c7d8', 'f2a3b4c5d6e7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
