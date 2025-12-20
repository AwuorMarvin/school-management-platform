"""
Tests for student creation with parent information.
"""

import pytest
from uuid import uuid4
from datetime import date, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.models import User, School, Campus, Student, Parent
from app.core.security import hash_password
from app.core.database import get_db

client = TestClient(app)


@pytest.fixture
def test_school(db_session):
    """Create a test school."""
    school = School(
        id=uuid4(),
        name="Test School",
        subdomain="test",
        status="ACTIVE",
    )
    db_session.add(school)
    db_session.commit()
    return school


@pytest.fixture
def test_campus(db_session, test_school):
    """Create a test campus."""
    campus = Campus(
        id=uuid4(),
        school_id=test_school.id,
        name="Main Campus",
        address="123 Test St",
    )
    db_session.add(campus)
    db_session.commit()
    return campus


@pytest.fixture
def test_admin_user(db_session, test_school, test_campus):
    """Create a test admin user."""
    user = User(
        id=uuid4(),
        school_id=test_school.id,
        campus_id=test_campus.id,
        email="admin@test.com",
        phone_number="+254712345678",
        password_hash=hash_password("password123"),
        first_name="Admin",
        last_name="User",
        role="SCHOOL_ADMIN",
        status="ACTIVE",
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def auth_headers(test_admin_user):
    """Get authentication headers."""
    # TODO: Implement JWT token generation for tests
    # For now, this is a placeholder
    return {"Authorization": "Bearer test-token"}


def test_create_student_with_father_only(db_session, test_school, test_campus, test_admin_user, auth_headers):
    """Test creating a student with only father information."""
    student_data = {
        "campus_id": str(test_campus.id),
        "first_name": "John",
        "last_name": "Doe",
        "date_of_birth": (date.today() - timedelta(days=365 * 10)).isoformat(),
        "status": "ACTIVE",
        "father": {
            "first_name": "Father",
            "last_name": "Doe",
            "phone_number": "+254712345679",
            "email": "father@test.com",
            "id_number": "12345678",
        },
    }
    
    response = client.post("/api/v1/students", json=student_data, headers=auth_headers)
    
    assert response.status_code == 201
    data = response.json()
    assert "student" in data
    assert "parents_created" in data
    assert len(data["parents_created"]) == 1
    assert data["parents_created"][0]["role"] == "FATHER"
    assert data["parents_created"][0]["was_new_user"] is True


def test_create_student_with_all_parents(db_session, test_school, test_campus, test_admin_user, auth_headers):
    """Test creating a student with father, mother, and guardian."""
    student_data = {
        "campus_id": str(test_campus.id),
        "first_name": "Jane",
        "middle_name": "Ann",
        "last_name": "Doe",
        "date_of_birth": (date.today() - timedelta(days=365 * 8)).isoformat(),
        "status": "ACTIVE",
        "father": {
            "first_name": "Father",
            "last_name": "Doe",
            "phone_number": "+254712345680",
            "email": "father2@test.com",
            "id_number": "12345679",
        },
        "mother": {
            "first_name": "Mother",
            "last_name": "Doe",
            "phone_number": "+254712345681",
            "email": "mother@test.com",
            "id_number": "12345680",
        },
        "guardian": {
            "first_name": "Guardian",
            "last_name": "Smith",
            "phone_number": "+254712345682",
            "email": "guardian@test.com",
            "id_number": "12345681",
        },
    }
    
    response = client.post("/api/v1/students", json=student_data, headers=auth_headers)
    
    assert response.status_code == 201
    data = response.json()
    assert "student" in data
    assert "parents_created" in data
    assert len(data["parents_created"]) == 3


def test_create_student_no_parents_fails(db_session, test_school, test_campus, test_admin_user, auth_headers):
    """Test that creating a student without any parent fails."""
    student_data = {
        "campus_id": str(test_campus.id),
        "first_name": "John",
        "last_name": "Doe",
        "date_of_birth": (date.today() - timedelta(days=365 * 10)).isoformat(),
        "status": "ACTIVE",
    }
    
    response = client.post("/api/v1/students", json=student_data, headers=auth_headers)
    
    assert response.status_code == 400
    assert "NO_PARENT_PROVIDED" in response.json()["detail"].get("error_code", "")


def test_create_student_invalid_campus_fails(db_session, test_school, test_admin_user, auth_headers):
    """Test that creating a student with invalid campus ID fails."""
    student_data = {
        "campus_id": str(uuid4()),  # Non-existent campus
        "first_name": "John",
        "last_name": "Doe",
        "date_of_birth": (date.today() - timedelta(days=365 * 10)).isoformat(),
        "status": "ACTIVE",
        "father": {
            "first_name": "Father",
            "last_name": "Doe",
            "phone_number": "+254712345683",
            "email": "father3@test.com",
            "id_number": "12345682",
        },
    }
    
    response = client.post("/api/v1/students", json=student_data, headers=auth_headers)
    
    assert response.status_code == 404
    assert "CAMPUS_NOT_FOUND" in response.json()["detail"].get("error_code", "")


def test_create_student_duplicate_parent_phone(db_session, test_school, test_campus, test_admin_user, auth_headers):
    """Test creating a student with a parent phone that already exists links to existing parent."""
    # Create existing parent
    existing_user = User(
        id=uuid4(),
        school_id=test_school.id,
        email="existing@test.com",
        phone_number="+254712345684",
        password_hash=None,
        first_name="Existing",
        last_name="Parent",
        role="PARENT",
        status="ACTIVE",  # PENDING_SETUP is indicated by password_hash=None
    )
    db_session.add(existing_user)
    db_session.flush()
    
    existing_parent = Parent(
        school_id=test_school.id,
        user_id=existing_user.id,
        id_number="99999999",
    )
    db_session.add(existing_parent)
    db_session.commit()
    
    # Try to create student with same phone
    student_data = {
        "campus_id": str(test_campus.id),
        "first_name": "New",
        "last_name": "Student",
        "date_of_birth": (date.today() - timedelta(days=365 * 9)).isoformat(),
        "status": "ACTIVE",
        "father": {
            "first_name": "Different",
            "last_name": "Name",
            "phone_number": "+254712345684",  # Same phone
            "email": "different@test.com",
            "id_number": "88888888",
        },
    }
    
    response = client.post("/api/v1/students", json=student_data, headers=auth_headers)
    
    assert response.status_code == 201
    data = response.json()
    assert "parents_created" in data
    # Should link to existing parent, not create new
    assert data["parents_created"][0]["was_new_user"] is False

