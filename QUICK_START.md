# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# or: source venv/bin/activate  # Linux/Mac

pip install -r requirements.txt

# Update .env with your database credentials
# Then run:
alembic upgrade head
python run.py
```

Backend runs at: `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

### 3. Test the Application

1. Open `http://localhost:5173` in your browser
2. You'll see the login page
3. **Note:** You need to create a test user first (see below)

## 📝 Creating a Test User

You can create a test user directly in the database:

```sql
-- First, create a school
INSERT INTO school (id, name, subdomain, status, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'Test School',
    'test-school',
    'ACTIVE',
    NOW(),
    NOW()
);

-- Then create a user (replace school_id with the ID from above)
INSERT INTO "user" (
    id, school_id, email, phone_number, password_hash,
    first_name, last_name, role, status, created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'YOUR_SCHOOL_ID_HERE',
    'admin@test.com',
    '+254712345678',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5',  -- password: Test123!@#
    'Admin',
    'User',
    'SCHOOL_ADMIN',
    'ACTIVE',
    NOW(),
    NOW()
);
```

**Or use Python to hash the password:**

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash("Test123!@#")
print(hashed)
```

## 🎯 Available Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - Logout

### Students
- `GET /api/v1/students` - List students
- `GET /api/v1/students/{id}` - Get student details

## 📚 Documentation

- API Docs: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

## 🐛 Troubleshooting

### Backend won't start
- Check database connection in `.env`
- Ensure PostgreSQL is running
- Verify all dependencies are installed

### Frontend won't start
- Run `npm install` again
- Check Node.js version (18+ required)
- Clear `node_modules` and reinstall

### Can't login
- Verify user exists in database
- Check password hash is correct
- Ensure user status is 'ACTIVE'
- Check backend logs for errors

