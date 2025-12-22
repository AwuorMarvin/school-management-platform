from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import User


@pytest.mark.asyncio
async def test_parent_cannot_create_performance_report(
    async_client: AsyncClient,
    db_session: AsyncSession,
    parent_user: User,
    auth_headers_for_user,
):
    student_id = uuid4()
    academic_year_id = uuid4()
    term_id = uuid4()
    class_id = uuid4()
    subject_id = uuid4()

    headers = await auth_headers_for_user(parent_user)
    payload = {
        "student_id": str(student_id),
        "academic_year_id": str(academic_year_id),
        "term_id": str(term_id),
        "class_id": str(class_id),
        "subject_id": str(subject_id),
        "line_items": [
            {
                "area_label": "Algebra",
                "numeric_score": 80,
                "descriptive_score": "ME",
            }
        ],
    }

    response = await async_client.post("/performance", json=payload, headers=headers)
    assert response.status_code == 403
    body = response.json()
    assert body["detail"]["error_code"] == "PERMISSION_DENIED"


