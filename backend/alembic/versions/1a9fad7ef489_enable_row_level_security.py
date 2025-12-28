"""enable_row_level_security

Revision ID: 1a9fad7ef489
Revises: a60a0ae03a31
Create Date: 2025-12-28 18:08:18.169719

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a9fad7ef489'
down_revision: Union[str, Sequence[str], None] = 'a60a0ae03a31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Enable Row Level Security (RLS) on all tenant-scoped tables.
    
    This migration:
    1. Enables RLS on all tables with school_id (direct tenant isolation)
    2. Enables RLS on tables tenant-scoped through foreign keys
    3. Creates RLS policies that filter by school_id using session variables
    
    IMPORTANT: For RLS to work, you must:
    1. Create a non-superuser database role (RLS doesn't apply to superusers)
    2. Update your connection string to use the new role
    3. Set the session variable 'app.school_id' for each connection based on JWT token
    
    See RLS_SETUP.md for detailed setup instructions.
    """
    
    # ============================================================================
    # Helper Function: Get Current School ID from Session
    # ============================================================================
    # This function retrieves the school_id from the session variable set by the application
    # Created in public schema (default)
    op.execute("""
        CREATE OR REPLACE FUNCTION current_school_id() 
        RETURNS UUID AS $$
        BEGIN
            RETURN current_setting('app.school_id', true)::UUID;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE;
    """)
    
    # ============================================================================
    # Tables with DIRECT school_id (using TenantMixin)
    # ============================================================================
    tables_with_school_id = [
        'campus',
        'user',
        'parent',
        'teacher',
        'student',
        'academic_year',
        'subject',
        'announcement',
        'notice_board_item',
        'message_log',
        'transport_route',
        'fee_structure',
        'fee_adjustment',
        'global_discount',
        'club_activity',
        'performance_report',
        'performance_line_item',
    ]
    
    for table in tables_with_school_id:
        # Enable RLS
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;')
        
        # Policy: Users can only see rows from their school
        op.execute(f"""
            CREATE POLICY "{table}_school_isolation" ON "{table}"
            FOR ALL
            USING (school_id = current_school_id())
            WITH CHECK (school_id = current_school_id());
        """)
    
    # ============================================================================
    # Tables WITHOUT direct school_id but tenant-scoped through foreign keys
    # ============================================================================
    
    # Class: scoped via campus_id -> campus.school_id
    op.execute('ALTER TABLE "class" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "class_school_isolation" ON "class"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM campus 
                WHERE campus.id = "class".campus_id 
                AND campus.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM campus 
                WHERE campus.id = "class".campus_id 
                AND campus.school_id = current_school_id()
            )
        );
    """)
    
    # Term: scoped via academic_year_id -> academic_year.school_id
    op.execute('ALTER TABLE "term" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "term_school_isolation" ON "term"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM academic_year 
                WHERE academic_year.id = "term".academic_year_id 
                AND academic_year.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM academic_year 
                WHERE academic_year.id = "term".academic_year_id 
                AND academic_year.school_id = current_school_id()
            )
        );
    """)
    
    # Fee: scoped via student_id -> student.school_id
    op.execute('ALTER TABLE "fee" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "fee_school_isolation" ON "fee"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM student 
                WHERE student.id = "fee".student_id 
                AND student.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM student 
                WHERE student.id = "fee".student_id 
                AND student.school_id = current_school_id()
            )
        );
    """)
    
    # Payment History: scoped via fee_id -> fee.student_id -> student.school_id
    op.execute('ALTER TABLE "payment_history" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "payment_history_school_isolation" ON "payment_history"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM fee
                JOIN student ON student.id = fee.student_id
                WHERE fee.id = "payment_history".fee_id 
                AND student.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM fee
                JOIN student ON student.id = fee.student_id
                WHERE fee.id = "payment_history".fee_id 
                AND student.school_id = current_school_id()
            )
        );
    """)
    
    # Student-related junction/child tables (scoped via student_id -> student.school_id)
    student_child_tables = [
        'student_parent',
        'student_class_history',
        'student_academic_enrollment',
        'student_performance',
        'student_term_comment',
        'student_document',
        'student_club_activity',
        'student_one_off_fee',
    ]
    
    for table in student_child_tables:
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;')
        op.execute(f"""
            CREATE POLICY "{table}_school_isolation" ON "{table}"
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM student 
                    WHERE student.id = "{table}".student_id 
                    AND student.school_id = current_school_id()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM student 
                    WHERE student.id = "{table}".student_id 
                    AND student.school_id = current_school_id()
                )
            );
        """)
    
    # Fee Line Item: scoped via fee_structure_id -> fee_structure.school_id
    op.execute('ALTER TABLE "fee_line_item" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "fee_line_item_school_isolation" ON "fee_line_item"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM fee_structure 
                WHERE fee_structure.id = "fee_line_item".fee_structure_id 
                AND fee_structure.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM fee_structure 
                WHERE fee_structure.id = "fee_line_item".fee_structure_id 
                AND fee_structure.school_id = current_school_id()
            )
        );
    """)
    
    # Fee Structure Class: scoped via fee_structure_id -> fee_structure.school_id
    op.execute('ALTER TABLE "fee_structure_class" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "fee_structure_class_school_isolation" ON "fee_structure_class"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM fee_structure 
                WHERE fee_structure.id = "fee_structure_class".fee_structure_id 
                AND fee_structure.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM fee_structure 
                WHERE fee_structure.id = "fee_structure_class".fee_structure_id 
                AND fee_structure.school_id = current_school_id()
            )
        );
    """)
    
    # Class Subject: scoped via class_id -> class.campus_id -> campus.school_id
    op.execute('ALTER TABLE "class_subject" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "class_subject_school_isolation" ON "class_subject"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM "class"
                JOIN campus ON campus.id = "class".campus_id
                WHERE "class".id = "class_subject".class_id 
                AND campus.school_id = current_school_id()
            )
            AND EXISTS (
                SELECT 1 FROM subject 
                WHERE subject.id = "class_subject".subject_id 
                AND subject.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM "class"
                JOIN campus ON campus.id = "class".campus_id
                WHERE "class".id = "class_subject".class_id 
                AND campus.school_id = current_school_id()
            )
            AND EXISTS (
                SELECT 1 FROM subject 
                WHERE subject.id = "class_subject".subject_id 
                AND subject.school_id = current_school_id()
            )
        );
    """)
    
    # Club Activity Class: scoped via club_activity_id -> club_activity.school_id
    # and class_id -> class.campus_id -> campus.school_id
    op.execute('ALTER TABLE "club_activity_class" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "club_activity_class_school_isolation" ON "club_activity_class"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM club_activity 
                WHERE club_activity.id = "club_activity_class".club_activity_id 
                AND club_activity.school_id = current_school_id()
            )
            AND EXISTS (
                SELECT 1 FROM "class"
                JOIN campus ON campus.id = "class".campus_id
                WHERE "class".id = "club_activity_class".class_id 
                AND campus.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM club_activity 
                WHERE club_activity.id = "club_activity_class".club_activity_id 
                AND club_activity.school_id = current_school_id()
            )
            AND EXISTS (
                SELECT 1 FROM "class"
                JOIN campus ON campus.id = "class".campus_id
                WHERE "class".id = "club_activity_class".class_id 
                AND campus.school_id = current_school_id()
            )
        );
    """)
    
    # Teacher Class Assignment: scoped via teacher_id -> teacher.school_id
    # and class_id -> class.campus_id -> campus.school_id
    op.execute('ALTER TABLE "teacher_class_assignment" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "teacher_class_assignment_school_isolation" ON "teacher_class_assignment"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM teacher 
                WHERE teacher.id = "teacher_class_assignment".teacher_id 
                AND teacher.school_id = current_school_id()
            )
            AND EXISTS (
                SELECT 1 FROM "class"
                JOIN campus ON campus.id = "class".campus_id
                WHERE "class".id = "teacher_class_assignment".class_id 
                AND campus.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM teacher 
                WHERE teacher.id = "teacher_class_assignment".teacher_id 
                AND teacher.school_id = current_school_id()
            )
            AND EXISTS (
                SELECT 1 FROM "class"
                JOIN campus ON campus.id = "class".campus_id
                WHERE "class".id = "teacher_class_assignment".class_id 
                AND campus.school_id = current_school_id()
            )
        );
    """)
    
    # Global Discount Campus: scoped via global_discount_id -> global_discount.school_id
    op.execute('ALTER TABLE "global_discount_campus" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "global_discount_campus_school_isolation" ON "global_discount_campus"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM global_discount 
                WHERE global_discount.id = "global_discount_campus".global_discount_id 
                AND global_discount.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM global_discount 
                WHERE global_discount.id = "global_discount_campus".global_discount_id 
                AND global_discount.school_id = current_school_id()
            )
        );
    """)
    
    # Global Discount Class: scoped via global_discount_id -> global_discount.school_id
    op.execute('ALTER TABLE "global_discount_class" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "global_discount_class_school_isolation" ON "global_discount_class"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM global_discount 
                WHERE global_discount.id = "global_discount_class".global_discount_id 
                AND global_discount.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM global_discount 
                WHERE global_discount.id = "global_discount_class".global_discount_id 
                AND global_discount.school_id = current_school_id()
            )
        );
    """)
    
    # Announcement Attachment: scoped via announcement_id -> announcement.school_id
    op.execute('ALTER TABLE "announcement_attachment" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "announcement_attachment_school_isolation" ON "announcement_attachment"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM announcement 
                WHERE announcement.id = "announcement_attachment".announcement_id 
                AND announcement.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM announcement 
                WHERE announcement.id = "announcement_attachment".announcement_id 
                AND announcement.school_id = current_school_id()
            )
        );
    """)
    
    # Notice Board Attachment: scoped via notice_board_item_id -> notice_board_item.school_id
    op.execute('ALTER TABLE "notice_board_attachment" ENABLE ROW LEVEL SECURITY;')
    op.execute("""
        CREATE POLICY "notice_board_attachment_school_isolation" ON "notice_board_attachment"
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM notice_board_item 
                WHERE notice_board_item.id = "notice_board_attachment".notice_board_item_id 
                AND notice_board_item.school_id = current_school_id()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM notice_board_item 
                WHERE notice_board_item.id = "notice_board_attachment".notice_board_item_id 
                AND notice_board_item.school_id = current_school_id()
            )
        );
    """)
    
    # Token tables: scoped via user_id -> user.school_id
    # Note: These might need special handling for password reset tokens that work across schools
    # For now, we'll scope them to the user's school
    token_tables = [
        'refresh_token',
        'account_setup_token',
        'password_reset_token',
    ]
    
    for table in token_tables:
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;')
        op.execute(f"""
            CREATE POLICY "{table}_school_isolation" ON "{table}"
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM "user" 
                    WHERE "user".id = "{table}".user_id 
                    AND "user".school_id = current_school_id()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM "user" 
                    WHERE "user".id = "{table}".user_id 
                    AND "user".school_id = current_school_id()
                )
            );
        """)
    
    # School table: Do NOT enable RLS - this is the root tenant table
    # All users need to see their own school record for authentication/validation


def downgrade() -> None:
    """Downgrade schema - disable RLS and drop policies."""
    
    # Drop all policies
    tables_to_process = [
        'campus', 'user', 'parent', 'teacher', 'student', 'academic_year', 'subject',
        'announcement', 'notice_board_item', 'message_log', 'transport_route',
        'fee_structure', 'fee_adjustment', 'global_discount', 'club_activity',
        'performance_report', 'performance_line_item',
        'class', 'term', 'fee', 'payment_history',
        'student_parent', 'student_class_history', 'student_academic_enrollment',
        'student_performance', 'student_term_comment', 'student_document',
        'student_club_activity', 'student_one_off_fee',
        'fee_line_item', 'fee_structure_class', 'class_subject', 'club_activity_class',
        'teacher_class_assignment', 'global_discount_campus', 'global_discount_class',
        'announcement_attachment', 'notice_board_attachment',
        'refresh_token', 'account_setup_token', 'password_reset_token',
    ]
    
    for table in tables_to_process:
        try:
            op.execute(f'DROP POLICY IF EXISTS "{table}_school_isolation" ON "{table}";')
        except Exception:
            pass  # Policy might not exist
        try:
            op.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY;')
        except Exception:
            pass  # RLS might not be enabled
    
    # Drop helper function
    op.execute('DROP FUNCTION IF EXISTS current_school_id();')
