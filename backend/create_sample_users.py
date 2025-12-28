"""
Script to create sample users for testing.
Creates a school, campus, and users for all roles.
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Add backend directory to Python path
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.models.school import School
from app.models.campus import Campus
from app.models.user import User
import bcrypt

# Sample user credentials (passwords must be <= 72 bytes for bcrypt)
SAMPLE_USERS = [
    {
        "email": "superadmin@test.com",
        "password": "SuperAdmin123!",
        "phone": "+254712345600",
        "first_name": "Super",
        "last_name": "Admin",
        "role": "SUPER_ADMIN",
    },
    {
        "email": "schooladmin@test.com",
        "password": "SchoolAdmin123!",
        "phone": "+254712345601",
        "first_name": "School",
        "last_name": "Admin",
        "role": "SCHOOL_ADMIN",
    },
    {
        "email": "campusadmin@test.com",
        "password": "CampusAdmin123!",
        "phone": "+254712345602",
        "first_name": "Campus",
        "last_name": "Admin",
        "role": "CAMPUS_ADMIN",
    },
    {
        "email": "teacher@test.com",
        "password": "Teacher123!",
        "phone": "+254712345603",
        "first_name": "John",
        "last_name": "Teacher",
        "role": "TEACHER",
    },
    {
        "email": "parent@test.com",
        "password": "Parent123!",
        "phone": "+254712345604",
        "first_name": "Jane",
        "last_name": "Parent",
        "role": "PARENT",
    },
]


async def create_sample_data():
    """Create sample school, campus, and users."""
    # Disable statement cache for pgbouncer compatibility
    engine = create_async_engine(
        str(settings.DATABASE_URL),
        echo=False,
        connect_args={"statement_cache_size": 0}
    )
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # Check if school already exists
            result = await session.execute(select(School).where(School.subdomain == "test-school"))
            existing_school = result.scalar_one_or_none()

            if existing_school:
                print(f"[INFO] School 'Test School' already exists with ID: {existing_school.id}")
                school = existing_school
            else:
                # Create school
                school = School(
                    id=uuid4(),
                    name="Test School",
                    subdomain="test-school",
                    status="ACTIVE",
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                session.add(school)
                await session.flush()
                print(f"[OK] Created school: {school.name} (ID: {school.id})")

            # Check if campus already exists
            result = await session.execute(
                select(Campus).where(Campus.school_id == school.id, Campus.name == "Main Campus")
            )
            existing_campus = result.scalar_one_or_none()

            if existing_campus:
                print(f"[INFO] Campus 'Main Campus' already exists with ID: {existing_campus.id}")
                campus = existing_campus
            else:
                # Create campus
                campus = Campus(
                    id=uuid4(),
                    school_id=school.id,
                    name="Main Campus",
                    address="123 Test Street, Nairobi, Kenya",
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                session.add(campus)
                await session.flush()
                print(f"[OK] Created campus: {campus.name} (ID: {campus.id})")

            # Create users
            created_users = []
            for user_data in SAMPLE_USERS:
                # Check if user already exists
                result = await session.execute(
                    select(User).where(
                        User.school_id == school.id,
                        User.email == user_data["email"]
                    )
                )
                existing_user = result.scalar_one_or_none()

                if existing_user:
                    print(f"[INFO] User {user_data['email']} already exists")
                    created_users.append({
                        **user_data,
                        "exists": True,
                        "user_id": existing_user.id
                    })
                else:
                    # Determine campus_id based on role
                    campus_id = campus.id if user_data["role"] in ["CAMPUS_ADMIN", "TEACHER", "PARENT"] else None

                    # Hash password using bcrypt directly
                    password_bytes = user_data["password"].encode('utf-8')
                    password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12)).decode('utf-8')
                    
                    user = User(
                        id=uuid4(),
                        school_id=school.id,
                        email=user_data["email"],
                        phone_number=user_data["phone"],
                        password_hash=password_hash,
                        first_name=user_data["first_name"],
                        last_name=user_data["last_name"],
                        role=user_data["role"],
                        campus_id=campus_id,
                        status="ACTIVE",
                        created_at=datetime.now(UTC),
                        updated_at=datetime.now(UTC),
                    )
                    session.add(user)
                    await session.flush()
                    print(f"[OK] Created user: {user_data['email']} ({user_data['role']})")
                    created_users.append({
                        **user_data,
                        "exists": False,
                        "user_id": user.id
                    })

            await session.commit()
            print("\n" + "=" * 70)
            print("SAMPLE USERS CREATED SUCCESSFULLY")
            print("=" * 70 + "\n")

            print("CREDENTIALS FOR TESTING:\n")
            for user in created_users:
                status_text = "(already existed)" if user["exists"] else "(newly created)"
                print(f"Role: {user['role']}")
                print(f"  Email: {user['email']}")
                print(f"  Password: {user['password']}")
                print(f"  Phone: {user['phone']}")
                print(f"  Status: {status_text}")
                print()

            print("=" * 70)
            print("\nYou can now use these credentials to login at http://localhost:5173")
            print("=" * 70)

        except Exception as e:
            await session.rollback()
            print(f"\n[ERROR] Failed to create sample data: {e}")
            import traceback
            traceback.print_exc()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_sample_data())

