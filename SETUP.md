# School Management Platform - Setup Guide

## Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Create virtual environment (if not exists):**
```bash
python -m venv venv
```

3. **Activate virtual environment:**
   - Windows: `venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`

4. **Install dependencies:**
```bash
pip install -r requirements.txt
```

5. **Create `.env` file:**
```bash
cp .env.example .env
```

6. **Update `.env` with your database credentials:**
```env
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/school_management_dev
JWT_SECRET_KEY=your-secret-key-min-32-characters-long
```

7. **Run database migrations:**
```bash
alembic upgrade head
```

8. **Start the backend server:**
```bash
python run.py
```

The API will be available at `http://localhost:8000`
API docs at `http://localhost:8000/api/docs`

## Frontend Setup

1. **Navigate to frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start development server:**
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Testing the Application

1. **Start both servers:**
   - Backend: `http://localhost:8000`
   - Frontend: `http://localhost:5173`

2. **Access the application:**
   - Open `http://localhost:5173` in your browser
   - You'll see the login page

3. **Create a test user (via database or API):**
   - You'll need to create a user in the database first
   - Or use the API to create one (endpoints coming soon)

## API Endpoints Available

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/setup-account` - Complete account setup
- `POST /api/v1/auth/request-password-reset` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/change-password` - Change password (authenticated)
- `GET /api/v1/auth/me` - Get current user (authenticated)

### Students
- `GET /api/v1/students` - List students (authenticated)
- `GET /api/v1/students/{id}` - Get student by ID (authenticated)

## Next Steps

1. Create a test user in the database
2. Test login functionality
3. Add more endpoints as needed
4. Expand frontend features

