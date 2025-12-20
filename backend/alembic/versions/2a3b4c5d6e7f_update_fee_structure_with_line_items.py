"""update_fee_structure_with_line_items

Revision ID: 2a3b4c5d6e7f
Revises: 1f1e9757711f
Create Date: 2025-01-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2a3b4c5d6e7f'
down_revision: Union[str, Sequence[str], None] = '1f1e9757711f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Update fee structure with line items, adjustments, and global discounts."""
    
    # 1. Update fee_structure table
    op.add_column('fee_structure', sa.Column('structure_name', sa.String(length=200), nullable=False, server_default='Fee Structure', comment='Name of the fee structure'))
    op.add_column('fee_structure', sa.Column('status', sa.String(length=20), nullable=False, server_default='INACTIVE', comment='ACTIVE | INACTIVE'))
    
    # Drop old unique constraint
    op.drop_constraint('uq_fee_structure_class_term', 'fee_structure', type_='unique')
    
    # Add new index for active structures
    op.create_index('idx_fee_structure_active', 'fee_structure', ['class_id', 'term_id', 'status'], unique=False)
    
    # Update base_fee to have default
    op.alter_column('fee_structure', 'base_fee', server_default='0.00')
    
    # 2. Create fee_line_item table
    op.create_table(
        'fee_line_item',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('fee_structure_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('item_name', sa.String(length=200), nullable=False, comment="Name of the fee line item (e.g., 'Tuition', 'Books', 'Uniform')"),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False, comment='Amount for this line item'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0', comment='Order in which to display line items'),
        sa.ForeignKeyConstraint(['fee_structure_id'], ['fee_structure.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("amount >= 0", name='ck_fee_line_item_amount'),
        comment='Individual line items within a fee structure'
    )
    op.create_index(op.f('ix_fee_line_item_fee_structure_id'), 'fee_line_item', ['fee_structure_id'], unique=False)
    
    # 3. Create fee_adjustment table
    op.create_table(
        'fee_adjustment',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False, comment='School (tenant) this record belongs to'),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('adjustment_type', sa.String(length=20), nullable=False, comment='FIXED_AMOUNT | PERCENTAGE'),
        sa.Column('adjustment_value', sa.Numeric(10, 2), nullable=False, comment='Discount amount (KES) or percentage (%)'),
        sa.Column('reason', sa.Text(), nullable=False, comment='Reason for adjustment (required)'),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=False, comment='User who created the adjustment'),
        sa.ForeignKeyConstraint(['school_id'], ['school.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['student.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['term_id'], ['term.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['user.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("adjustment_type IN ('FIXED_AMOUNT', 'PERCENTAGE')", name='ck_fee_adjustment_type'),
        sa.CheckConstraint("adjustment_value >= 0", name='ck_fee_adjustment_value'),
        comment='Per-student fee adjustments (discounts)'
    )
    op.create_index(op.f('ix_fee_adjustment_school_id'), 'fee_adjustment', ['school_id'], unique=False)
    op.create_index(op.f('ix_fee_adjustment_student_id'), 'fee_adjustment', ['student_id'], unique=False)
    op.create_index(op.f('ix_fee_adjustment_term_id'), 'fee_adjustment', ['term_id'], unique=False)
    op.create_index(op.f('ix_fee_adjustment_created_by_user_id'), 'fee_adjustment', ['created_by_user_id'], unique=False)
    
    # 4. Create global_discount table
    op.create_table(
        'global_discount',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False, comment='School (tenant) this record belongs to'),
        sa.Column('discount_name', sa.String(length=200), nullable=False, comment="Name of the discount (e.g., 'Early Payment Discount')"),
        sa.Column('discount_type', sa.String(length=20), nullable=False, comment='FIXED_AMOUNT | PERCENTAGE'),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False, comment='Discount amount (KES) or percentage (%)'),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('applies_to', sa.String(length=20), nullable=False, comment='ALL_STUDENTS | SELECTED_CAMPUSES | SELECTED_CLASSES'),
        sa.Column('condition_type', sa.String(length=50), nullable=True, comment='PAYMENT_BEFORE_DATE | NONE'),
        sa.Column('condition_value', sa.Text(), nullable=True, comment='Condition value (e.g., date for PAYMENT_BEFORE_DATE)'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', comment='Whether this discount is currently active'),
        sa.ForeignKeyConstraint(['school_id'], ['school.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['term_id'], ['term.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("discount_type IN ('FIXED_AMOUNT', 'PERCENTAGE')", name='ck_global_discount_type'),
        sa.CheckConstraint("discount_value >= 0", name='ck_global_discount_value'),
        sa.CheckConstraint("applies_to IN ('ALL_STUDENTS', 'SELECTED_CAMPUSES', 'SELECTED_CLASSES')", name='ck_global_discount_applies_to'),
        comment='Global discount rules for fee structures'
    )
    op.create_index(op.f('ix_global_discount_school_id'), 'global_discount', ['school_id'], unique=False)
    op.create_index(op.f('ix_global_discount_term_id'), 'global_discount', ['term_id'], unique=False)
    
    # 5. Create global_discount_campus junction table
    op.create_table(
        'global_discount_campus',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('global_discount_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('campus_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['global_discount_id'], ['global_discount.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['campus_id'], ['campus.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        comment='Many-to-many relationship between global discounts and campuses'
    )
    op.create_index(op.f('ix_global_discount_campus_global_discount_id'), 'global_discount_campus', ['global_discount_id'], unique=False)
    op.create_index(op.f('ix_global_discount_campus_campus_id'), 'global_discount_campus', ['campus_id'], unique=False)
    
    # 6. Create global_discount_class junction table
    op.create_table(
        'global_discount_class',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('global_discount_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('class_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['global_discount_id'], ['global_discount.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['class_id'], ['class.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        comment='Many-to-many relationship between global discounts and classes'
    )
    op.create_index(op.f('ix_global_discount_class_global_discount_id'), 'global_discount_class', ['global_discount_id'], unique=False)
    op.create_index(op.f('ix_global_discount_class_class_id'), 'global_discount_class', ['class_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema - Remove fee structure line items, adjustments, and global discounts."""
    
    # Drop junction tables
    op.drop_index(op.f('ix_global_discount_class_class_id'), table_name='global_discount_class')
    op.drop_index(op.f('ix_global_discount_class_global_discount_id'), table_name='global_discount_class')
    op.drop_table('global_discount_class')
    
    op.drop_index(op.f('ix_global_discount_campus_campus_id'), table_name='global_discount_campus')
    op.drop_index(op.f('ix_global_discount_campus_global_discount_id'), table_name='global_discount_campus')
    op.drop_table('global_discount_campus')
    
    # Drop global_discount table
    op.drop_index(op.f('ix_global_discount_term_id'), table_name='global_discount')
    op.drop_index(op.f('ix_global_discount_school_id'), table_name='global_discount')
    op.drop_table('global_discount')
    
    # Drop fee_adjustment table
    op.drop_index(op.f('ix_fee_adjustment_created_by_user_id'), table_name='fee_adjustment')
    op.drop_index(op.f('ix_fee_adjustment_term_id'), table_name='fee_adjustment')
    op.drop_index(op.f('ix_fee_adjustment_student_id'), table_name='fee_adjustment')
    op.drop_index(op.f('ix_fee_adjustment_school_id'), table_name='fee_adjustment')
    op.drop_table('fee_adjustment')
    
    # Drop fee_line_item table
    op.drop_index(op.f('ix_fee_line_item_fee_structure_id'), table_name='fee_line_item')
    op.drop_table('fee_line_item')
    
    # Revert fee_structure table changes
    op.drop_index('idx_fee_structure_active', table_name='fee_structure')
    op.drop_column('fee_structure', 'status')
    op.drop_column('fee_structure', 'structure_name')
    op.create_unique_constraint('uq_fee_structure_class_term', 'fee_structure', ['class_id', 'term_id'])
    op.alter_column('fee_structure', 'base_fee', server_default=None)

