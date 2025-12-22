"""create_teacher_table

Revision ID: e1f2a3b4c5d6
Revises: d7e8f9a0b1c2
Create Date: 2024-12-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Create teacher table.
    
    Teacher table extends user with teacher-specific fields:
    - salutation, middle_name, national_id, tsc_number
    - date_of_birth, gender
    - campus_id (required, enforced at DB level)
    - school_id (denormalized for tenant isolation)
    """
    
    # Create teacher table
    op.create_table(
        'teacher',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('salutation', sa.String(length=10), nullable=False),
        sa.Column('middle_name', sa.String(length=100), nullable=True),
        sa.Column('national_id', sa.String(length=50), nullable=False),
        sa.Column('tsc_number', sa.String(length=50), nullable=True),
        sa.Column('date_of_birth', sa.Date(), nullable=False),
        sa.Column('gender', sa.String(length=10), nullable=False),
        sa.Column('campus_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['campus_id'], ['campus.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['school_id'], ['school.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_teacher_user_id'),
        sa.UniqueConstraint('school_id', 'national_id', name='uq_teacher_school_national_id'),
        sa.CheckConstraint(
            "salutation IN ('Mr', 'Mrs', 'Miss', 'Dr', 'Prof')",
            name='ck_teacher_salutation'
        ),
        sa.CheckConstraint(
            "gender IN ('MALE', 'FEMALE', 'OTHER')",
            name='ck_teacher_gender'
        ),
        comment='Teacher record - extends user with teacher-specific data'
    )
    
    # Create indexes
    op.create_index('idx_teacher_user', 'teacher', ['user_id'], unique=False)
    op.create_index('idx_teacher_campus', 'teacher', ['campus_id', 'school_id'], unique=False)
    op.create_index('idx_teacher_school', 'teacher', ['school_id'], unique=False)


def downgrade() -> None:
    """Drop teacher table."""
    op.drop_index('idx_teacher_school', table_name='teacher')
    op.drop_index('idx_teacher_campus', table_name='teacher')
    op.drop_index('idx_teacher_user', table_name='teacher')
    op.drop_table('teacher')

