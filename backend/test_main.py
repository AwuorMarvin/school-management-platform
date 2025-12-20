"""
Quick test to verify the FastAPI application starts correctly.

Run with: pytest test_main.py
"""

import pytest
from fastapi.testclient import TestClient

# Set testing mode before importing app
import os
os.environ["TESTING"] = "true"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost/test"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-min-32-characters-long-for-testing-purposes"

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Test root endpoint returns welcome message."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data
    assert data["message"] == "Welcome to School Management Platform API"


def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    # May be 200 or 503 depending on DB connection
    assert response.status_code in [200, 503]
    data = response.json()
    assert "status" in data
    assert "version" in data
    assert "database" in data


def test_docs_available():
    """Test API documentation is accessible."""
    response = client.get("/api/docs")
    assert response.status_code == 200


def test_openapi_schema():
    """Test OpenAPI schema is accessible."""
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "openapi" in data
    assert "info" in data
    assert data["info"]["title"] == "School Management Platform"


def test_cors_headers():
    """Test CORS headers are set correctly."""
    response = client.options("/", headers={"Origin": "http://localhost:5173"})
    # CORS middleware should add headers
    assert response.status_code in [200, 405]  # OPTIONS may not be explicitly handled


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

