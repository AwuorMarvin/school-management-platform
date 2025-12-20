"""Quick script to verify all tables were created."""

import asyncio
from sqlalchemy import text
from app.core.database import engine


async def check_tables():
    """Check all tables in database."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
        )
        tables = [row[0] for row in result]
        
        print(f"\n[OK] Total tables created: {len(tables)}\n")
        print("Tables:")
        for table in sorted(tables):
            print(f"  - {table}")
        
        expected_tables = [
            "account_setup_token",
            "academic_year",
            "announcement",
            "announcement_attachment",
            "campus",
            "class",
            "fee",
            "message_log",
            "notice_board_attachment",
            "notice_board_item",
            "parent",
            "password_reset_token",
            "payment_history",
            "refresh_token",
            "school",
            "student",
            "student_class_history",
            "student_document",
            "student_parent",
            "student_performance",
            "student_term_comment",
            "subject",
            "teacher_class_assignment",
            "term",
            "user",
        ]
        
        print(f"\n[OK] Expected: {len(expected_tables)} tables")
        print(f"[OK] Found: {len(tables)} tables")
        
        missing = set(expected_tables) - set(tables)
        if missing:
            print(f"\n[ERROR] Missing tables: {missing}")
        else:
            print("\n[SUCCESS] All 25 tables created successfully!")
        
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(check_tables())

