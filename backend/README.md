# School Management Platform - Backend

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
```

**Important settings to update:**

- `DATABASE_URL`: Your PostgreSQL connection string
- `JWT_SECRET_KEY`: Generate a strong secret key:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(64))"
  ```
- AWS credentials (for production)
- Email/SMS provider credentials (for production)

### 3. Database Setup

Create PostgreSQL database:

```sql
CREATE DATABASE school_management_db;
CREATE USER school_user WITH PASSWORD 'school_pass';
GRANT ALL PRIVILEGES ON DATABASE school_management_db TO school_user;
```

Initialize database with Alembic:

```bash
# Initialize Alembic (first time only)
alembic init alembic

# Create initial migration
alembic revision --autogenerate -m "Initial schema"

# Apply migrations
alembic upgrade head
```

### 4. Run the Application

Development mode with hot reload:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Production mode:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py          # Settings & environment variables
│   │   └── database.py        # Database configuration
│   ├── models/                # SQLAlchemy models
│   ├── schemas/               # Pydantic schemas
│   ├── api/
│   │   └── v1/
│   │       └── endpoints/     # API route handlers
│   └── services/              # Business logic
├── tests/                     # Test files
├── alembic/                   # Database migrations
├── requirements.txt           # Python dependencies
└── .env.example              # Environment variables template
```

## Core Configuration

### Settings (`app/core/config.py`)

Uses Pydantic Settings for type-safe configuration:

```python
from app.core.config import settings

# Access settings
db_url = settings.DATABASE_URL
jwt_secret = settings.JWT_SECRET_KEY

# Check environment
if settings.is_production:
    # Production-specific logic
    pass
```

### Database (`app/core/database.py`)

SQLAlchemy 2.0 async session management:

```python
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from fastapi import Depends

@router.get("/students")
async def list_students(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Student))
    return result.scalars().all()
```

## Development Workflow

1. **Create models** in `app/models/`
2. **Create schemas** in `app/schemas/`
3. **Generate migration**: `alembic revision --autogenerate -m "Description"`
4. **Review migration** in `alembic/versions/`
5. **Apply migration**: `alembic upgrade head`
6. **Create endpoints** in `app/api/v1/endpoints/`
7. **Write tests** in `tests/`

## Testing

Run tests:

```bash
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific test file
pytest tests/test_auth.py
```

## Security Best Practices

1. **Never commit `.env` file** (already in .gitignore)
2. **Use strong JWT secret** (min 64 chars in production)
3. **Enable HTTPS** in production
4. **Rotate credentials** regularly
5. **Review CORS origins** before production deployment

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Yes | - | Secret key for JWT signing |
| `AWS_ACCESS_KEY_ID` | Production | - | AWS access key for S3 |
| `SENDGRID_API_KEY` | Production | - | SendGrid API key for emails |
| `AFRICAS_TALKING_API_KEY` | Production | - | SMS provider API key |

See `.env.example` for complete list.

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql -h localhost -U school_user -d school_management_db

# Check if PostgreSQL is running
pg_isready
```

### Import Errors

Ensure you're in the backend directory and have activated your virtual environment:

```bash
cd backend
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

### Migration Errors

Reset migrations (development only):

```bash
# Drop all tables
alembic downgrade base

# Reapply migrations
alembic upgrade head
```

## API Documentation

Once running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## License

Proprietary - All rights reserved

