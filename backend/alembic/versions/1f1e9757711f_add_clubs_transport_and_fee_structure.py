"""add_clubs_transport_and_fee_structure

Revision ID: 1f1e9757711f
Revises: 9ed93876ae96
Create Date: 2025-12-19 01:25:26.639197

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '1f1e9757711f'
down_revision: Union[str, Sequence[str], None] = '9ed93876ae96'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add clubs, transport routes, and fee structure tables."""
    
    # Create transport_route table
    op.create_table(
        'transport_route',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False, comment='School (tenant) this record belongs to'),
        sa.Column('zone', sa.String(length=100), nullable=False, comment="Zone name (e.g., 'Zone A', 'Westlands')"),
        sa.Column('description', sa.Text(), nullable=True, comment='Description of the route/zone'),
        sa.Column('cost_per_term', sa.Numeric(10, 2), nullable=False, server_default='0.00', comment='Transport cost per term'),
        sa.ForeignKeyConstraint(['school_id'], ['school.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("cost_per_term >= 0", name='ck_transport_route_cost'),
        comment='School transport routes/zones'
    )
    op.create_index(op.f('ix_transport_route_school_id'), 'transport_route', ['school_id'], unique=False)
    
    # Create club_activity table
    op.create_table(
        'club_activity',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False, comment='School (tenant) this record belongs to'),
        sa.Column('service_name', sa.String(length=200), nullable=False, comment='Name of the club/activity'),
        sa.Column('activity_type', sa.String(length=20), nullable=False, comment='CLUB | EXTRA_CURRICULAR'),
        sa.Column('cost_per_term', sa.Numeric(10, 2), nullable=False, server_default='0.00', comment='Cost per term for this activity'),
        sa.Column('teacher_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Teacher/Instructor assigned to this activity'),
        sa.Column('academic_year_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['school_id'], ['school.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['teacher_id'], ['user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['academic_year_id'], ['academic_year.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['term_id'], ['term.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("activity_type IN ('CLUB', 'EXTRA_CURRICULAR')", name='ck_club_activity_type'),
        sa.CheckConstraint("cost_per_term >= 0", name='ck_club_activity_cost'),
        comment='Clubs and Extra-Curricular Activities'
    )
    op.create_index(op.f('ix_club_activity_school_id'), 'club_activity', ['school_id'], unique=False)
    op.create_index(op.f('ix_club_activity_teacher_id'), 'club_activity', ['teacher_id'], unique=False)
    op.create_index(op.f('ix_club_activity_academic_year_id'), 'club_activity', ['academic_year_id'], unique=False)
    op.create_index(op.f('ix_club_activity_term_id'), 'club_activity', ['term_id'], unique=False)
    
    # Create club_activity_class junction table
    op.create_table(
        'club_activity_class',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('club_activity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('class_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['club_activity_id'], ['club_activity.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['class_id'], ['class.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('club_activity_id', 'class_id', name='uq_club_activity_class'),
        comment='Many-to-many relationship between club activities and classes'
    )
    op.create_index(op.f('ix_club_activity_class_club_activity_id'), 'club_activity_class', ['club_activity_id'], unique=False)
    op.create_index(op.f('ix_club_activity_class_class_id'), 'club_activity_class', ['class_id'], unique=False)
    
    # Create student_club_activity junction table
    op.create_table(
        'student_club_activity',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('club_activity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['student.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['club_activity_id'], ['club_activity.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'club_activity_id', name='uq_student_club_activity'),
        comment='Many-to-many relationship between students and club activities'
    )
    op.create_index(op.f('ix_student_club_activity_student_id'), 'student_club_activity', ['student_id'], unique=False)
    op.create_index(op.f('ix_student_club_activity_club_activity_id'), 'student_club_activity', ['club_activity_id'], unique=False)
    
    # Create fee_structure table
    op.create_table(
        'fee_structure',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False, comment='School (tenant) this record belongs to'),
        sa.Column('class_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('base_fee', sa.Numeric(10, 2), nullable=False, comment='Base fee amount for this class and term'),
        sa.ForeignKeyConstraint(['school_id'], ['school.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['class_id'], ['class.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['term_id'], ['term.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('class_id', 'term_id', name='uq_fee_structure_class_term'),
        sa.CheckConstraint("base_fee >= 0", name='ck_fee_structure_base_fee'),
        comment='Base fee structure per term per class'
    )
    op.create_index(op.f('ix_fee_structure_school_id'), 'fee_structure', ['school_id'], unique=False)
    op.create_index(op.f('ix_fee_structure_class_id'), 'fee_structure', ['class_id'], unique=False)
    op.create_index(op.f('ix_fee_structure_term_id'), 'fee_structure', ['term_id'], unique=False)
    
    # Add transport_route_id to student table
    op.add_column('student', sa.Column('transport_route_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Transport route/zone assigned to student'))
    op.create_index(op.f('ix_student_transport_route_id'), 'student', ['transport_route_id'], unique=False)
    op.create_foreign_key('fk_student_transport_route', 'student', 'transport_route', ['transport_route_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema - Remove clubs, transport routes, and fee structure tables."""
    
    # Remove transport_route_id from student table
    op.drop_constraint('fk_student_transport_route', 'student', type_='foreignkey')
    op.drop_index(op.f('ix_student_transport_route_id'), table_name='student')
    op.drop_column('student', 'transport_route_id')
    
    # Drop fee_structure table
    op.drop_index(op.f('ix_fee_structure_term_id'), table_name='fee_structure')
    op.drop_index(op.f('ix_fee_structure_class_id'), table_name='fee_structure')
    op.drop_index(op.f('ix_fee_structure_school_id'), table_name='fee_structure')
    op.drop_table('fee_structure')
    
    # Drop student_club_activity junction table
    op.drop_index(op.f('ix_student_club_activity_club_activity_id'), table_name='student_club_activity')
    op.drop_index(op.f('ix_student_club_activity_student_id'), table_name='student_club_activity')
    op.drop_table('student_club_activity')
    
    # Drop club_activity_class junction table
    op.drop_index(op.f('ix_club_activity_class_class_id'), table_name='club_activity_class')
    op.drop_index(op.f('ix_club_activity_class_club_activity_id'), table_name='club_activity_class')
    op.drop_table('club_activity_class')
    
    # Drop club_activity table
    op.drop_index(op.f('ix_club_activity_term_id'), table_name='club_activity')
    op.drop_index(op.f('ix_club_activity_academic_year_id'), table_name='club_activity')
    op.drop_index(op.f('ix_club_activity_teacher_id'), table_name='club_activity')
    op.drop_index(op.f('ix_club_activity_school_id'), table_name='club_activity')
    op.drop_table('club_activity')
    
    # Drop transport_route table
    op.drop_index(op.f('ix_transport_route_school_id'), table_name='transport_route')
    op.drop_table('transport_route')
