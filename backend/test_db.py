"""
Database Connection Test Script

Simple script to test PostgreSQL database connection.
Tests async engine setup and connectivity.
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to Python path so we can import app modules
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine

from app.core.config import settings


async def test_database_connection() -> bool:
    """
    Test database connection and print results.
    
    Returns:
        bool: True if connection successful, False otherwise
    """
    print("=" * 60)
    print("Database Connection Test")
    print("=" * 60)
    print()
    
    # Display connection info (masked password)
    db_url = str(settings.DATABASE_URL)
    if "@" in db_url:
        # Mask password in URL for display
        parts = db_url.split("@")
        if "://" in parts[0]:
            protocol_user = parts[0].split("://")
            if ":" in protocol_user[1]:
                user_pass = protocol_user[1].split(":")
                masked_url = f"{protocol_user[0]}://{user_pass[0]}:****@{parts[1]}"
            else:
                masked_url = db_url
        else:
            masked_url = db_url
    else:
        masked_url = db_url
    
    print(f"Database URL: {masked_url}")
    print(f"Environment: {settings.ENVIRONMENT}")
    print()
    
    # Create async engine
    print("Creating async engine...")
    try:
        engine: AsyncEngine = create_async_engine(
            str(settings.DATABASE_URL),
            poolclass=None,  # No pooling for test
            echo=False,
        )
        print("[OK] Engine created successfully")
        print()
    except Exception as e:
        print(f"[ERROR] Failed to create engine: {e}")
        return False
    
    # Test connection
    print("Testing connection...")
    try:
        async with engine.connect() as connection:
            print("[OK] Connection established")
            print()
            
            # Get PostgreSQL version
            print("Querying PostgreSQL version...")
            result = await connection.execute(text("SELECT version()"))
            version = result.scalar()
            
            print("[OK] PostgreSQL Version:")
            print(f"   {version}")
            print()
            
            # Get database name
            result = await connection.execute(text("SELECT current_database()"))
            db_name = result.scalar()
            print(f"[OK] Connected to database: {db_name}")
            print()
            
            # Get current user
            result = await connection.execute(text("SELECT current_user"))
            db_user = result.scalar()
            print(f"[OK] Connected as user: {db_user}")
            print()
            
            # Test basic query
            result = await connection.execute(text("SELECT 1 as test"))
            test_value = result.scalar()
            if test_value == 1:
                print("[OK] Basic query test passed")
            else:
                print(f"[ERROR] Basic query test failed (got {test_value})")
                return False
            print()
            
            print("=" * 60)
            print("[SUCCESS] ALL TESTS PASSED - Database connection successful!")
            print("=" * 60)
            return True
            
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        print()
        print("=" * 60)
        print("[FAILED] DATABASE CONNECTION FAILED")
        print("=" * 60)
        print()
        print("Troubleshooting:")
        print("1. Check if PostgreSQL is running")
        print("2. Verify DATABASE_URL in .env file")
        print("3. Check database credentials")
        print("4. Ensure database exists")
        print("5. Check firewall/network settings")
        return False
    
    finally:
        # Clean up
        await engine.dispose()
        print("Engine disposed")


async def main() -> None:
    """Main entry point."""
    try:
        success = await test_database_connection()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

