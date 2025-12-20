# Quick Start Guide

Get the School Management Platform API running in under 5 minutes!

## Prerequisites

- Python 3.11+
- PostgreSQL 15+ (running)

## Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

## Step 2: Configure Environment

Copy and edit the environment file:

```bash
cp .env.example .env
```

**Minimal configuration for development:**

Edit `.env` and set these required values:

```env
# Database (must be running)
DATABASE_URL=postgresql+asyncpg://school_user:school_pass@localhost:5432/school_management_db

# JWT Secret (generate a strong one)
JWT_SECRET_KEY=your-super-secret-jwt-key-min-32-chars-here

# Debug mode
DEBUG=true
ENVIRONMENT=development
```

**Generate a secure JWT secret:**

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Step 3: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE school_management_db;
CREATE USER school_user WITH PASSWORD 'school_pass';
GRANT ALL PRIVILEGES ON DATABASE school_management_db TO school_user;
\q
```

## Step 4: Run the Application

### Option A: Using the run script

```bash
python run.py
```

### Option B: Using uvicorn directly

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Option C: Using the main.py

```bash
python -m app.main
```

## Step 5: Verify It's Working

Open your browser and visit:

- **API Root**: http://localhost:8000/
- **Health Check**: http://localhost:8000/health
- **API Docs (Swagger)**: http://localhost:8000/api/docs
- **API Docs (ReDoc)**: http://localhost:8000/api/redoc

You should see the welcome message and health status!

## Testing

Run the test suite:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test
pytest test_main.py -v
```

## What You Get

✅ FastAPI application running on http://localhost:8000  
✅ Automatic API documentation at `/api/docs`  
✅ CORS enabled for React frontend (localhost:5173)  
✅ Health check endpoint for monitoring  
✅ Global error handlers  
✅ Database connection management  
✅ Structured logging  
✅ Development mode with auto-reload  

## Next Steps

1. **Create Models** - Define your database schema in `app/models/`
2. **Run Migrations** - Set up Alembic and create initial migration
3. **Create API Endpoints** - Build your REST API in `app/api/v1/endpoints/`
4. **Add Authentication** - Implement JWT auth endpoints
5. **Write Tests** - Add test coverage for your endpoints

## Troubleshooting

### Database Connection Failed

Check if PostgreSQL is running:

```bash
# On Linux/Mac
sudo systemctl status postgresql

# Check connection
psql -h localhost -U school_user -d school_management_db
```

### Port Already in Use

Change the port in `run.py` or use:

```bash
uvicorn app.main:app --reload --port 8001
```

### Import Errors

Make sure you're in the `backend` directory:

```bash
cd backend
python run.py
```

### Environment Variables Not Loaded

Verify `.env` file exists and has correct values:

```bash
cat .env | grep DATABASE_URL
```

## Development Tips

### Auto-reload on Changes

The development server automatically reloads when you change code files.

### View Logs

All logs are printed to console with timestamps.

### Debug Mode

When `DEBUG=true`, you get:
- Detailed error messages
- SQL query logging (if `DATABASE_ECHO=true`)
- Additional debug endpoints

### Hot Reload

FastAPI's built-in reload watches for file changes and restarts automatically.

## API Documentation

The Swagger UI at `/api/docs` provides:
- Interactive API testing
- Request/response schemas
- Authentication testing
- Example values

## Environment Variables

See `.env.example` for all available configuration options.

**Essential:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET_KEY` - Secret for JWT signing

**Optional (for dev):**
- `DEBUG=true` - Enable debug mode
- `DATABASE_ECHO=true` - Log SQL queries
- `SMS_ENABLED=false` - Disable SMS in dev
- `EMAIL_ENABLED=false` - Disable email in dev

## Ready to Build!

Your API is now running and ready for development! 🚀

Check out `backend/README.md` for detailed documentation.

