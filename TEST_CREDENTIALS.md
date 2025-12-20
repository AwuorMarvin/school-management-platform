# Test User Credentials

## 🎯 Sample Users Created

All users belong to **Test School** with **Main Campus**.

### 1. Super Admin
- **Email:** `superadmin@test.com`
- **Password:** `SuperAdmin123!`
- **Phone:** `+254712345600`
- **Role:** `SUPER_ADMIN`
- **Scope:** Platform-wide access

### 2. School Admin
- **Email:** `schooladmin@test.com`
- **Password:** `SchoolAdmin123!`
- **Phone:** `+254712345601`
- **Role:** `SCHOOL_ADMIN`
- **Scope:** All campuses in the school

### 3. Campus Admin
- **Email:** `campusadmin@test.com`
- **Password:** `CampusAdmin123!`
- **Phone:** `+254712345602`
- **Role:** `CAMPUS_ADMIN`
- **Scope:** Main Campus only

### 4. Teacher
- **Email:** `teacher@test.com`
- **Password:** `Teacher123!`
- **Phone:** `+254712345603`
- **Role:** `TEACHER`
- **Scope:** Assigned classes only

### 5. Parent
- **Email:** `parent@test.com`
- **Password:** `Parent123!`
- **Phone:** `+254712345604`
- **Role:** `PARENT`
- **Scope:** Linked children only

## 🚀 How to Test

1. **Start Backend:**
   ```bash
   cd backend
   python run.py
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Login:**
   - Open `http://localhost:5173`
   - Use any of the credentials above
   - You'll be redirected to the dashboard

## 📝 Notes

- All passwords meet the requirements (8+ chars, uppercase, number, special char)
- All users are in `ACTIVE` status
- All users have passwords set (can login immediately)
- Phone numbers follow Kenya format (+254...)

## 🔄 Re-running the Script

If you need to recreate users, the script will:
- Skip creating the school/campus if they already exist
- Skip creating users if they already exist
- Only create new users if they don't exist

To force recreation, delete the users from the database first.

