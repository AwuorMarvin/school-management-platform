# School Management Platform

## Complete API Specification (MVP) - CORRECTED

---

## 0. Authority & Scope

This document is the **authoritative, complete REST API contract** for the MVP. It MUST be used directly for:

* Backend implementation
* Frontend integration
* LLM-based code generation

**Base URL:** `/api/v1`

**Global Rules:**
* All requests require authentication (except public auth endpoints)
* All requests use JSON (Content-Type: application/json)
* All responses use JSON
* All authenticated requests include: `Authorization: Bearer {jwt_token}`
* All data is tenant-scoped via `school_id` in the JWT token

---

## 1. Global Standards

### 1.1 Pagination Standard

All list endpoints support pagination with these query parameters:

* `page`: Integer (default: 1, min: 1)
* `page_size`: Integer (default: 20, min: 1, max: 100)

**Paginated Response Format:**
```json
{
  "data": [ /* array of resources */ ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_previous": false
  }
}
```

### 1.2 Error Response Format

All errors follow this structure:
```json
{
  "error_code": "ERROR_CODE",
  "message": "Human-readable explanation",
  "recovery": "Suggested corrective action",
  "details": { /* optional context-specific data */ }
}
```

### 1.3 Timestamp Format

All timestamps use ISO 8601 format: `2024-01-15T10:30:00Z`

### 1.4 Date Format

All dates use ISO 8601 format: `YYYY-MM-DD` (e.g., `2024-01-15`)

---

## 2. Authentication & Authorization

### 2.1 Login

**POST** `/auth/login`

**Permission:** Public

**Description:** Authenticate user with email and password. Returns JWT tokens.

**Request:**
```json
{
  "email": "user@school.com",
  "password": "MySecurePass123!",
  "remember_me": false
}
```

**Validation:**
* email: Required, valid RFC 5322 format
* password: Required
* remember_me: Optional, boolean (default: false)

**Business Logic:**
1. Validate email format
2. Check rate limit (5 attempts per 15 minutes per email)
3. Find user by email in school context
4. Check user status is ACTIVE (not INACTIVE)
5. Verify password hash with bcrypt
6. Check password_hash is not NULL (account setup complete)
7. Generate JWT access token (24h expiry)
8. Generate refresh token (30d expiry if remember_me, else 24h)
9. Store refresh token in database
10. Log successful login
11. Update last_login_at timestamp
12. Return tokens and user details

**Success Response (200):**
```json
{
  "access_token": "jwt_access_token_here",
  "refresh_token": "jwt_refresh_token_here",
  "expires_in": 86400,
  "user": {
    "id": "dd0e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@example.com",
    "phone_number": "+254712345678",
    "school_id": "aa0e8400-e29b-41d4-a716-446655440000",
    "role": "PARENT",
    "first_name": "John",
    "last_name": "Doe",
    "status": "ACTIVE"
  }
}
```

**Error Responses:**

**401: INVALID_CREDENTIALS**
```json
{
  "error_code": "INVALID_CREDENTIALS",
  "message": "Invalid email or password",
  "recovery": "Check your credentials and try again. Use 'Forgot Password?' if needed."
}
```

**401: ACCOUNT_INACTIVE**
```json
{
  "error_code": "ACCOUNT_INACTIVE",
  "message": "Your account has been deactivated",
  "recovery": "Contact your school administrator for assistance"
}
```

**401: ACCOUNT_PENDING_SETUP**
```json
{
  "error_code": "ACCOUNT_PENDING_SETUP",
  "message": "Account setup not completed",
  "recovery": "Please complete account setup using the link sent to your phone via SMS",
  "details": {
    "phone_number": "+254712***678"
  }
}
```

**429: RATE_LIMIT_EXCEEDED**
```json
{
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many login attempts",
  "recovery": "Please wait 15 minutes before trying again",
  "details": {
    "retry_after_seconds": 900
  }
}
```

---

### 2.2 Setup Account (First Time)

**POST** `/auth/setup-account`

**Permission:** Public (requires valid setup token)

**Description:** Complete first-time account setup. User receives setup token via SMS and uses it to create password.

**Request:**
```json
{
  "token": "setup_token_from_sms_link",
  "password": "MySecurePass123!",
  "password_confirmation": "MySecurePass123!"
}
```

**Validation:**
* token: Required, string
* password: Required, must meet requirements:
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 number
  - At least 1 special character (@$!%*?&)
* password_confirmation: Required, must match password

**Business Logic:**
1. Find token in account_setup_token table by token_hash
2. Validate token exists
3. Validate token not expired (< 7 days old, expires_at > now)
4. Validate token not already used (used_at IS NULL)
5. Validate password meets requirements
6. Validate passwords match
7. Hash password with bcrypt (cost: 12)
8. Update user.password_hash
9. Update user.status to ACTIVE
10. Mark token as used (set used_at = now)
11. Generate JWT tokens (auto-login)
12. Return tokens and user details

**Success Response (200):**
```json
{
  "access_token": "jwt_access_token_here",
  "refresh_token": "jwt_refresh_token_here",
  "expires_in": 86400,
  "user": {
    "id": "dd0e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@example.com",
    "phone_number": "+254712345678",
    "school_id": "aa0e8400-e29b-41d4-a716-446655440000",
    "role": "PARENT",
    "first_name": "John",
    "last_name": "Doe",
    "status": "ACTIVE"
  },
  "message": "Account setup successful! You are now logged in."
}
```

**Error Responses:**

**400: INVALID_TOKEN**
```json
{
  "error_code": "INVALID_TOKEN",
  "message": "Setup token is invalid or not found",
  "recovery": "Contact your school administrator to receive a new setup link"
}
```

**400: TOKEN_EXPIRED**
```json
{
  "error_code": "TOKEN_EXPIRED",
  "message": "This setup link has expired",
  "recovery": "Contact your school administrator to receive a new setup link",
  "details": {
    "expired_at": "2024-01-22T10:30:00Z"
  }
}
```

**400: TOKEN_ALREADY_USED**
```json
{
  "error_code": "TOKEN_ALREADY_USED",
  "message": "This setup link has already been used",
  "recovery": "Your account is already set up. Use the login page to sign in.",
  "details": {
    "used_at": "2024-01-16T09:15:00Z"
  }
}
```

**400: PASSWORDS_DO_NOT_MATCH**
```json
{
  "error_code": "PASSWORDS_DO_NOT_MATCH",
  "message": "Password and confirmation do not match",
  "recovery": "Ensure both password fields are identical"
}
```

**400: INVALID_PASSWORD_FORMAT**
```json
{
  "error_code": "INVALID_PASSWORD_FORMAT",
  "message": "Password does not meet security requirements",
  "recovery": "Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character",
  "details": {
    "requirements": {
      "min_length": 8,
      "requires_uppercase": true,
      "requires_number": true,
      "requires_special_char": true,
      "allowed_special_chars": "@$!%*?&"
    }
  }
}
```

---

### 2.3 Request Password Reset

**POST** `/auth/request-password-reset`

**Permission:** Public

**Description:** Request password reset link. Link sent via email (not SMS to save costs).

**Request:**
```json
{
  "email": "john.doe@example.com"
}
```

**Validation:**
* email: Required, valid format

**Business Logic:**
1. Validate email format
2. Check rate limit (3 requests per hour per email)
3. Find user by email (silent fail if not found - security)
4. If user found:
   a. Generate secure reset token
   b. Hash token and store in password_reset_token table
   c. Set expires_at = now + 1 hour
   d. Send email with reset link
   e. Log in message_log
5. Always return success (prevent email enumeration)

**Success Response (200):**
```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Note:** Response is always 200 even if email doesn't exist (security best practice to prevent email enumeration).

**Error Responses:**

**429: TOO_MANY_RESET_REQUESTS**
```json
{
  "error_code": "TOO_MANY_RESET_REQUESTS",
  "message": "Too many password reset requests",
  "recovery": "Please wait before requesting another reset link",
  "details": {
    "retry_after_seconds": 3600
  }
}
```

**Email Template:**
```
Subject: Reset Your Password - [School Name]

Hi [Name],

Click the link below to reset your password:
https://portal.[school].com/reset-password?token=xyz789abc

This link expires in 1 hour.

If you didn't request this, please ignore this email.
```

---

### 2.4 Reset Password

**POST** `/auth/reset-password`

**Permission:** Public (requires valid reset token)

**Description:** Reset password using token from email.

**Request:**
```json
{
  "token": "reset_token_from_email",
  "password": "MyNewSecurePass123!",
  "password_confirmation": "MyNewSecurePass123!"
}
```

**Validation:**
* token: Required
* password: Required, must meet requirements
* password_confirmation: Required, must match password

**Business Logic:**
1. Find token in password_reset_token table
2. Validate token exists
3. Validate token not expired (< 1 hour old)
4. Validate token not already used (used_at IS NULL)
5. Validate password meets requirements
6. Validate passwords match
7. Hash new password with bcrypt
8. Update user.password_hash
9. Mark token as used
10. Revoke all existing refresh tokens for this user (force re-login everywhere)
11. Log password change event

**Success Response (200):**
```json
{
  "message": "Password reset successfully. You can now login with your new password."
}
```

**Error Responses:**

**400: INVALID_TOKEN**
```json
{
  "error_code": "INVALID_TOKEN",
  "message": "Reset token is invalid or not found",
  "recovery": "Request a new password reset link"
}
```

**400: TOKEN_EXPIRED**
```json
{
  "error_code": "TOKEN_EXPIRED",
  "message": "This password reset link has expired",
  "recovery": "Request a new password reset link. Links are valid for 1 hour.",
  "details": {
    "expired_at": "2024-01-15T11:30:00Z"
  }
}
```

**400: TOKEN_ALREADY_USED**
```json
{
  "error_code": "TOKEN_ALREADY_USED",
  "message": "This reset link has already been used",
  "recovery": "If you need to reset your password again, request a new link"
}
```

**400: PASSWORDS_DO_NOT_MATCH**
```json
{
  "error_code": "PASSWORDS_DO_NOT_MATCH",
  "message": "Password and confirmation do not match",
  "recovery": "Ensure both password fields are identical"
}
```

**400: INVALID_PASSWORD_FORMAT**
```json
{
  "error_code": "INVALID_PASSWORD_FORMAT",
  "message": "Password does not meet security requirements",
  "recovery": "Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character"
}
```

---

### 2.5 Refresh Token

**POST** `/auth/refresh`

**Permission:** Public (requires valid refresh token)

**Description:** Obtain new access token using refresh token.

**Request:**
```json
{
  "refresh_token": "refresh_jwt_token"
}
```

**Validation:**
* refresh_token: Required

**Business Logic:**
1. Decode refresh token
2. Find token in refresh_token table
3. Validate token not expired
4. Validate token not revoked (revoked_at IS NULL)
5. Find user and validate status is ACTIVE
6. Generate new access token (24h expiry)
7. Return new access token

**Success Response (200):**
```json
{
  "access_token": "new_jwt_access_token",
  "expires_in": 86400
}
```

**Error Responses:**

**401: AUTH_TOKEN_EXPIRED**
```json
{
  "error_code": "AUTH_TOKEN_EXPIRED",
  "message": "Refresh token has expired",
  "recovery": "Please login again"
}
```

**401: AUTH_TOKEN_REVOKED**
```json
{
  "error_code": "AUTH_TOKEN_REVOKED",
  "message": "Refresh token has been revoked",
  "recovery": "Please login again"
}
```

**401: AUTH_TOKEN_INVALID**
```json
{
  "error_code": "AUTH_TOKEN_INVALID",
  "message": "Invalid refresh token",
  "recovery": "Please login again"
}
```

---

### 2.6 Logout

**POST** `/auth/logout`

**Permission:** Authenticated

**Description:** Logout and revoke refresh token.

**Request:**
```json
{
  "refresh_token": "refresh_jwt_token"
}
```

**Business Logic:**
1. Find refresh token in database
2. Set revoked_at = now
3. Access token will naturally expire (cannot be revoked early - stateless JWT)

**Success Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### 2.7 Change Password (Authenticated)

**POST** `/auth/change-password`

**Permission:** Authenticated

**Description:** Change password while logged in.

**Request:**
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewSecurePass123!",
  "new_password_confirmation": "NewSecurePass123!"
}
```

**Validation:**
* current_password: Required
* new_password: Required, must meet requirements
* new_password_confirmation: Required, must match new_password

**Business Logic:**
1. Verify current_password is correct
2. Validate new password meets requirements
3. Validate new password != old password
4. Hash new password with bcrypt
5. Update user.password_hash
6. Revoke all refresh tokens (force re-login everywhere)
7. Log password change event

**Success Response (200):**
```json
{
  "message": "Password changed successfully. Please login again with your new password."
}
```

**Error Responses:**

**401: INVALID_CREDENTIALS**
```json
{
  "error_code": "INVALID_CREDENTIALS",
  "message": "Current password is incorrect",
  "recovery": "Enter your correct current password"
}
```

**400: PASSWORDS_DO_NOT_MATCH**
```json
{
  "error_code": "PASSWORDS_DO_NOT_MATCH",
  "message": "New password and confirmation do not match",
  "recovery": "Ensure both new password fields are identical"
}
```

**400: SAME_AS_OLD_PASSWORD**
```json
{
  "error_code": "SAME_AS_OLD_PASSWORD",
  "message": "New password cannot be the same as current password",
  "recovery": "Choose a different password"
}
```

---

## 3. User Management

### 3.1 Get Current User

**GET** `/auth/me`

**Permission:** Authenticated

**Description:** Get current logged-in user details.

**Success Response (200):**
```json
{
  "id": "dd0e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "phone_number": "+254712345678",
  "first_name": "John",
  "last_name": "Doe",
  "role": "PARENT",
  "status": "ACTIVE",
  "school": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "name": "Springfield Academy",
    "subdomain": "springfield"
  },
  "campus": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Main Campus"
  },
  "last_login_at": "2024-01-15T10:30:00Z",
  "created_at": "2024-01-10T09:00:00Z"
}
```

---

## 4. Campus Management

### 4.1 List Campuses

**GET** `/campuses`

**Permission:** All authenticated users in school

**Query Parameters:**
* `page`: Integer (default: 1)
* `page_size`: Integer (default: 20, max: 100)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "name": "Main Campus",
      "address": "123 Education Street, Nairobi",
      "student_count": 450,
      "teacher_count": 35,
      "created_at": "2023-01-15T10:00:00Z"
    },
    {
      "id": "780e8400-e29b-41d4-a716-446655440000",
      "name": "East Campus",
      "address": "456 Learning Avenue, Nairobi",
      "student_count": 320,
      "teacher_count": 28,
      "created_at": "2023-06-20T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false
  }
}
```

---

### 4.2 Get Campus Details

**GET** `/campuses/{campus_id}`

**Permission:** All authenticated users in school

**Success Response (200):**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "name": "Main Campus",
  "address": "123 Education Street, Nairobi",
  "student_count": 450,
  "teacher_count": 35,
  "created_at": "2023-01-15T10:00:00Z"
}
```

---

### 4.3 Create Campus

**POST** `/campuses`

**Permission:** SCHOOL_ADMIN

**Request:**
```json
{
  "name": "North Campus",
  "address": "789 Knowledge Road, Nairobi"
}
```

**Validation:**
* name: Required, 1-200 chars, unique within school
* address: Optional, max 500 chars

**Success Response (201):**
```json
{
  "id": "790e8400-e29b-41d4-a716-446655440000",
  "name": "North Campus",
  "address": "789 Knowledge Road, Nairobi",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**

**409: DUPLICATE_CAMPUS_NAME**
```json
{
  "error_code": "DUPLICATE_CAMPUS_NAME",
  "message": "A campus named 'North Campus' already exists in your school",
  "recovery": "Choose a different campus name"
}
```

---

### 4.4 Update Campus

**PUT** `/campuses/{campus_id}`

**Permission:** SCHOOL_ADMIN

**Request:**
```json
{
  "name": "North Campus - Extended",
  "address": "789 Knowledge Road, Nairobi (Extended Facility)"
}
```

**Success Response (200):**
```json
{
  "id": "790e8400-e29b-41d4-a716-446655440000",
  "name": "North Campus - Extended",
  "address": "789 Knowledge Road, Nairobi (Extended Facility)",
  "updated_at": "2024-01-20T14:30:00Z"
}
```

---

## 5. Student Management

### 5.1 Create Student (with Parents)

**POST** `/students`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Admit a student immediately with parent details. Creates parent accounts and sends SMS with setup links.

**Request:**
```json
{
  "campus_id": "770e8400-e29b-41d4-a716-446655440000",
  "first_name": "Jane",
  "middle_name": "Ann",
  "last_name": "Doe",
  "date_of_birth": "2016-03-12",
  "father": {
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+254712345678",
    "email": "john.doe@example.com",
    "id_number": "12345678"
  },
  "mother": {
    "first_name": "Mary",
    "last_name": "Doe",
    "phone_number": "+254723456789",
    "email": "mary.doe@example.com",
    "id_number": "23456789"
  },
  "guardian": {
    "first_name": "James",
    "last_name": "Smith",
    "phone_number": "+254734567890",
    "email": "james.smith@example.com",
    "id_number": "34567890"
  }
}
```

**Validation:**

**Student fields:**
* campus_id: Required, must exist and belong to user's school
* first_name: Required, 1-100 chars, letters/spaces/hyphens/apostrophes only
* middle_name: Optional, same rules as first_name
* last_name: Required, 1-100 chars, same rules as first_name
* date_of_birth: Required, ISO date format, must be in past, student age 2-25 years

**Parent fields (at least ONE parent required - father, mother, or guardian):**
* first_name: Required, 1-100 chars
* last_name: Required, 1-100 chars
* phone_number: Required, must match `^\+254[17]\d{8}$`, unique within school
* email: Required, valid format, unique within school
* id_number: Required, 1-50 chars (National ID or Passport)

**Business Logic:**
1. Validate CAMPUS_ADMIN can only create in their campus
2. Validate at least one parent is provided (father, mother, or guardian)
3. Begin database transaction
4. Create student with status=ACTIVE
5. For each parent provided:
   a. Check if user exists with this phone_number in school
   b. If exists: 
      - Verify it's a PARENT role
      - Verify parent role isn't already assigned to this student
      - Create student_parent link
   c. If not exists:
      - Create new user with role=PARENT, status=PENDING_SETUP, password_hash=NULL
      - Create parent record
      - Create student_parent link with role (FATHER/MOTHER/GUARDIAN)
      - Generate account_setup_token (expires in 7 days)
      - Queue SMS with setup link
      - Insert message_log
6. Commit transaction
7. Return complete response with student and parent details

**SMS Message Template:**
```
Welcome to [School Name]!

Your child [Student Name] has been enrolled in [Class/Grade].

Set up your parent account:
https://portal.[school].com/setup?token=abc123xyz

This link expires in 7 days.
```

**Success Response (201):**
```json
{
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "middle_name": "Ann",
    "last_name": "Doe",
    "date_of_birth": "2016-03-12",
    "status": "ACTIVE",
    "campus": {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "name": "Main Campus"
    },
    "created_at": "2024-01-15T10:30:00Z"
  },
  "parents_created": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440000",
      "role": "FATHER",
      "user_id": "dd0e8400-e29b-41d4-a716-446655440000",
      "first_name": "John",
      "last_name": "Doe",
      "phone_number": "+254712345678",
      "email": "john.doe@example.com",
      "was_new_user": true,
      "setup_link_sent": true,
      "sms_status": "delivered"
    },
    {
      "id": "ee0e8400-e29b-41d4-a716-446655440000",
      "role": "MOTHER",
      "user_id": "ff0e8400-e29b-41d4-a716-446655440000",
      "first_name": "Mary",
      "last_name": "Doe",
      "phone_number": "+254723456789",
      "email": "mary.doe@example.com",
      "was_new_user": true,
      "setup_link_sent": true,
      "sms_status": "delivered"
    },
    {
      "id": "110e8400-e29b-41d4-a716-446655440000",
      "role": "GUARDIAN",
      "user_id": "120e8400-e29b-41d4-a716-446655440000",
      "first_name": "James",
      "last_name": "Smith",
      "phone_number": "+254734567890",
      "email": "james.smith@example.com",
      "was_new_user": false,
      "setup_link_sent": false,
      "sms_status": "not_sent"
    }
  ]
}
```

**Error Responses:**

**400: VALIDATION_ERROR**
```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "recovery": "Fix the validation errors and try again",
  "details": {
    "fields": {
      "date_of_birth": ["Must be a valid date in the past"],
      "father.phone_number": ["Must match pattern +254[17]xxxxxxxx"]
    }
  }
}
```

**400: NO_PARENT_PROVIDED**
```json
{
  "error_code": "NO_PARENT_PROVIDED",
  "message": "At least one parent (father, mother, or guardian) must be provided",
  "recovery": "Include details for at least one parent"
}
```

**403: FORBIDDEN_ACTION**
```json
{
  "error_code": "FORBIDDEN_ACTION",
  "message": "Campus Admin can only create students in their assigned campus",
  "recovery": "Select a campus you manage",
  "details": {
    "your_campus_id": "770e8400-e29b-41d4-a716-446655440000",
    "requested_campus_id": "aa0e8400-e29b-41d4-a716-446655440000"
  }
}
```

**404: CAMPUS_NOT_FOUND**
```json
{
  "error_code": "CAMPUS_NOT_FOUND",
  "message": "Campus not found or does not belong to your school",
  "recovery": "Provide a valid campus_id from your school"
}
```

**409: DUPLICATE_PHONE_NUMBER**
```json
{
  "error_code": "DUPLICATE_PHONE_NUMBER",
  "message": "Phone number +254712345678 is already registered in your school",
  "recovery": "Use a different phone number or link to existing parent",
  "details": {
    "field": "father.phone_number",
    "phone_number": "+254712345678",
    "existing_user_id": "dd0e8400-e29b-41d4-a716-446655440000"
  }
}
```

**409: DUPLICATE_EMAIL**
```json
{
  "error_code": "DUPLICATE_EMAIL",
  "message": "Email mary.doe@example.com is already registered in your school",
  "recovery": "Use a different email or link to existing parent",
  "details": {
    "field": "mother.email",
    "email": "mary.doe@example.com",
    "existing_user_id": "ff0e8400-e29b-41d4-a716-446655440000"
  }
}
```

**409: DUPLICATE_PARENT_ROLE**
```json
{
  "error_code": "DUPLICATE_PARENT_ROLE",
  "message": "This student already has a father assigned",
  "recovery": "Cannot assign multiple parents with the same role",
  "details": {
    "role": "FATHER",
    "existing_parent_id": "cc0e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### 5.2 List Students

**GET** `/students`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN, TEACHER, PARENT

**Scope:**
* SCHOOL_ADMIN: All students in their school
* CAMPUS_ADMIN: Students in their campus only
* TEACHER: Students in classes they're assigned to
* PARENT: Only their linked children (filters are ignored)

**Query Parameters:**
* `campus_id`: UUID (optional, SCHOOL_ADMIN only)
* `class_id`: UUID (optional)
* `status`: Enum (optional) - ACTIVE, INACTIVE, COMPLETED, TRANSFERRED_OUT
* `search`: String (optional) - Search first_name, last_name
* `page`: Integer (default: 1)
* `page_size`: Integer (default: 20, max: 100)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440000",
      "first_name": "Jane",
      "middle_name": "Ann",
      "last_name": "Doe",
      "date_of_birth": "2016-03-12",
      "status": "ACTIVE",
      "campus": {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "name": "Main Campus"
      },
      "current_class": {
        "id": "130e8400-e29b-41d4-a716-446655440000",
        "name": "Grade 3A"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 280,
    "total_pages": 14,
    "has_next": true,
    "has_previous": false
  }
}
```

---

### 5.3 Get Student Details

**GET** `/students/{student_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN, TEACHER (if assigned), PARENT (if linked)

**Scope:**
* Admins: Students in their scope
* Teacher: Students in assigned classes
* Parent: Only their children

**Success Response (200):**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440000",
  "first_name": "Jane",
  "middle_name": "Ann",
  "last_name": "Doe",
  "date_of_birth": "2016-03-12",
  "status": "ACTIVE",
  "campus": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Main Campus"
  },
  "current_class": {
    "id": "130e8400-e29b-41d4-a716-446655440000",
    "name": "Grade 3A",
    "academic_year": "2024"
  },
  "parents": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440000",
      "role": "FATHER",
      "first_name": "John",
      "last_name": "Doe",
      "phone_number": "+254712345678",
      "email": "john.doe@example.com"
    },
    {
      "id": "ee0e8400-e29b-41d4-a716-446655440000",
      "role": "MOTHER",
      "first_name": "Mary",
      "last_name": "Doe",
      "phone_number": "+254723456789",
      "email": "mary.doe@example.com"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**

**404: STUDENT_NOT_FOUND**
```json
{
  "error_code": "STUDENT_NOT_FOUND",
  "message": "Student not found",
  "recovery": "Verify the student ID is correct"
}
```

**403: FORBIDDEN_ACTION**
```json
{
  "error_code": "FORBIDDEN_ACTION",
  "message": "You don't have permission to view this student",
  "recovery": "You can only view students in your scope"
}
```

---

### 5.4 Update Student

**PUT** `/students/{student_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Scope:**
* SCHOOL_ADMIN: Students in their school
* CAMPUS_ADMIN: Students in their campus

**Request:**
```json
{
  "first_name": "Jane",
  "middle_name": "Ann",
  "last_name": "Doe-Smith",
  "date_of_birth": "2016-03-12",
  "campus_id": "770e8400-e29b-41d4-a716-446655440000"
}
```

**Validation:**
* All fields optional but follow same rules as create
* campus_id: If changed, must belong to school and CAMPUS_ADMIN cannot change

**Success Response (200):**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440000",
  "first_name": "Jane",
  "middle_name": "Ann",
  "last_name": "Doe-Smith",
  "date_of_birth": "2016-03-12",
  "status": "ACTIVE",
  "campus_id": "770e8400-e29b-41d4-a716-446655440000",
  "updated_at": "2024-01-20T14:30:00Z"
}
```

---

### 5.5 Update Student Status

**PATCH** `/students/{student_id}/status`

**Permission:** SCHOOL_ADMIN only (NOT CAMPUS_ADMIN)

**Description:** Change student status. Terminal states (COMPLETED, TRANSFERRED_OUT) cannot be reversed.

**Request:**
```json
{
  "status": "COMPLETED"
}
```

**Validation:**
* status: Required, enum (INACTIVE, ACTIVE, COMPLETED, TRANSFERRED_OUT)

**State Transition Rules:**
* INACTIVE → ACTIVE: Allowed
* ACTIVE → COMPLETED: Allowed (graduation)
* ACTIVE → TRANSFERRED_OUT: Allowed (left school)
* ACTIVE → INACTIVE: Allowed (suspension/leave)
* COMPLETED → Any: NOT ALLOWED (terminal state)
* TRANSFERRED_OUT → Any: NOT ALLOWED (terminal state)

**Success Response (200):**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "updated_at": "2024-01-20T14:30:00Z"
}
```

**Error Responses:**

**409: INVALID_STATE_TRANSITION**
```json
{
  "error_code": "INVALID_STATE_TRANSITION",
  "message": "Cannot transition from COMPLETED to ACTIVE",
  "recovery": "COMPLETED is a terminal state and cannot be changed",
  "details": {
    "current_status": "COMPLETED",
    "requested_status": "ACTIVE",
    "allowed_transitions": []
  }
}
```

---

### 5.6 Link Parent to Student

**POST** `/students/{student_id}/parents`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Link an existing parent user to a student. Used when parent already exists in the system.

**Request:**
```json
{
  "parent_user_id": "dd0e8400-e29b-41d4-a716-446655440000",
  "role": "FATHER"
}
```

**Validation:**
* parent_user_id: Required, must be a user with role=PARENT in same school
* role: Required, enum (FATHER, MOTHER, GUARDIAN)

**Business Logic:**
1. Verify parent_user exists and has role=PARENT
2. Verify parent belongs to same school as student
3. Check student doesn't already have this parent role assigned
4. Create student_parent link

**Success Response (201):**
```json
{
  "id": "140e8400-e29b-41d4-a716-446655440000",
  "student_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "parent": {
    "id": "dd0e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+254712345678",
    "email": "john.doe@example.com"
  },
  "role": "FATHER",
  "created_at": "2024-01-15T11:00:00Z"
}
```

**Error Responses:**

**404: PARENT_NOT_FOUND**
```json
{
  "error_code": "PARENT_NOT_FOUND",
  "message": "Parent user not found or does not have PARENT role",
  "recovery": "Verify the user ID and ensure they have PARENT role"
}
```

**409: DUPLICATE_PARENT_ROLE**
```json
{
  "error_code": "DUPLICATE_PARENT_ROLE",
  "message": "This student already has a father assigned",
  "recovery": "Each student can have only one parent per role (father/mother/guardian)",
  "details": {
    "role": "FATHER",
    "existing_parent_id": "cc0e8400-e29b-41d4-a716-446655440000"
  }
}
```

**409: PARENT_ALREADY_LINKED**
```json
{
  "error_code": "PARENT_ALREADY_LINKED",
  "message": "This parent is already linked to this student with role MOTHER",
  "recovery": "Parent is already linked - cannot link with a different role"
}
```

---

### 5.7 Get Student's Parents

**GET** `/students/{student_id}/parents`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN, TEACHER (if assigned), PARENT (if linked to this student)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440000",
      "role": "FATHER",
      "user": {
        "id": "dd0e8400-e29b-41d4-a716-446655440000",
        "first_name": "John",
        "last_name": "Doe",
        "phone_number": "+254712345678",
        "email": "john.doe@example.com"
      }
    },
    {
      "id": "ee0e8400-e29b-41d4-a716-446655440000",
      "role": "MOTHER",
      "user": {
        "id": "ff0e8400-e29b-41d4-a716-446655440000",
        "first_name": "Mary",
        "last_name": "Doe",
        "phone_number": "+254723456789",
        "email": "mary.doe@example.com"
      }
    }
  ]
}
```

---

### 5.8 Unlink Parent from Student

**DELETE** `/students/{student_id}/parents/{parent_id}`

**Permission:** SCHOOL_ADMIN only

**Description:** Remove parent-student link. Does NOT delete the parent user.

**Success Response (204):**
No content

**Error Responses:**

**400: CANNOT_REMOVE_LAST_PARENT**
```json
{
  "error_code": "CANNOT_REMOVE_LAST_PARENT",
  "message": "Cannot remove the last parent - student must have at least one parent",
  "recovery": "Add another parent before removing this one"
}
```

---

## 6. Academic Structure

### 6.1 Create Academic Year

**POST** `/academic-years`

**Permission:** SCHOOL_ADMIN

**Description:** Create a new academic year for the school.

**Request:**
```json
{
  "name": "2024",
  "start_date": "2024-01-08",
  "end_date": "2024-12-20"
}
```

**Validation:**
* name: Required, 1-50 chars, unique within school
* start_date: Required, ISO date
* end_date: Required, ISO date, must be after start_date

**Business Logic:**
1. Validate dates don't overlap with existing academic years
2. Create academic year

**Success Response (201):**
```json
{
  "id": "150e8400-e29b-41d4-a716-446655440000",
  "name": "2024",
  "start_date": "2024-01-08",
  "end_date": "2024-12-20",
  "created_at": "2024-01-05T10:00:00Z"
}
```

**Error Responses:**

**409: ACADEMIC_YEAR_OVERLAP**
```json
{
  "error_code": "ACADEMIC_YEAR_OVERLAP",
  "message": "Academic year dates overlap with existing year '2023'",
  "recovery": "Choose non-overlapping dates",
  "details": {
    "overlapping_year_id": "160e8400-e29b-41d4-a716-446655440000",
    "overlapping_year_name": "2023"
  }
}
```

---

### 6.2 List Academic Years

**GET** `/academic-years`

**Permission:** All authenticated users in school

**Query Parameters:**
* `page`: Integer (default: 1)
* `page_size`: Integer (default: 20, max: 100)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "150e8400-e29b-41d4-a716-446655440000",
      "name": "2024",
      "start_date": "2024-01-08",
      "end_date": "2024-12-20",
      "term_count": 3,
      "is_current": true
    },
    {
      "id": "160e8400-e29b-41d4-a716-446655440000",
      "name": "2023",
      "start_date": "2023-01-09",
      "end_date": "2023-12-15",
      "term_count": 3,
      "is_current": false
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 2,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false
  }
}
```

---

### 6.3 Get Academic Year Details

**GET** `/academic-years/{academic_year_id}`

**Permission:** All authenticated users in school

**Success Response (200):**
```json
{
  "id": "150e8400-e29b-41d4-a716-446655440000",
  "name": "2024",
  "start_date": "2024-01-08",
  "end_date": "2024-12-20",
  "terms": [
    {
      "id": "170e8400-e29b-41d4-a716-446655440000",
      "name": "Term 1",
      "start_date": "2024-01-08",
      "end_date": "2024-04-05"
    },
    {
      "id": "180e8400-e29b-41d4-a716-446655440000",
      "name": "Term 2",
      "start_date": "2024-05-06",
      "end_date": "2024-08-16"
    },
    {
      "id": "190e8400-e29b-41d4-a716-446655440000",
      "name": "Term 3",
      "start_date": "2024-09-02",
      "end_date": "2024-12-20"
    }
  ],
  "created_at": "2024-01-05T10:00:00Z"
}
```

---

### 6.4 Update Academic Year

**PUT** `/academic-years/{academic_year_id}`

**Permission:** SCHOOL_ADMIN

**Request:**
```json
{
  "name": "2024/2025",
  "start_date": "2024-01-08",
  "end_date": "2024-12-20"
}
```

**Success Response (200):**
```json
{
  "id": "150e8400-e29b-41d4-a716-446655440000",
  "name": "2024/2025",
  "start_date": "2024-01-08",
  "end_date": "2024-12-20",
  "updated_at": "2024-01-20T14:30:00Z"
}
```

---

### 6.5 Create Term

**POST** `/academic-years/{academic_year_id}/terms`

**Permission:** SCHOOL_ADMIN

**Description:** Create a term within an academic year.

**Request:**
```json
{
  "name": "Term 1",
  "start_date": "2024-01-08",
  "end_date": "2024-04-05"
}
```

**Validation:**
* name: Required, 1-100 chars
* start_date: Required, must be within academic year dates
* end_date: Required, must be within academic year dates, after start_date

**Business Logic:**
1. Validate dates are within academic year bounds
2. Check for term overlap within the same academic year
3. Create term

**Success Response (201):**
```json
{
  "id": "170e8400-e29b-41d4-a716-446655440000",
  "academic_year_id": "150e8400-e29b-41d4-a716-446655440000",
  "name": "Term 1",
  "start_date": "2024-01-08",
  "end_date": "2024-04-05",
  "created_at": "2024-01-05T11:00:00Z"
}
```

**Error Responses:**

**409: TERM_OVERLAP**
```json
{
  "error_code": "TERM_OVERLAP",
  "message": "Term dates overlap with existing term 'Term 2'",
  "recovery": "Choose non-overlapping dates within the academic year",
  "details": {
    "overlapping_term_id": "180e8400-e29b-41d4-a716-446655440000",
    "overlapping_term_name": "Term 2"
  }
}
```

**400: TERM_OUTSIDE_ACADEMIC_YEAR**
```json
{
  "error_code": "TERM_OUTSIDE_ACADEMIC_YEAR",
  "message": "Term dates must be within academic year 2024-01-08 to 2024-12-20",
  "recovery": "Adjust term dates to fall within the academic year"
}
```

---

### 6.6 List Terms

**GET** `/terms`

**Permission:** All authenticated users in school

**Query Parameters:**
* `academic_year_id`: UUID (optional) - Filter by academic year
* `page`: Integer (default: 1)
* `page_size`: Integer (default: 20, max: 100)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "170e8400-e29b-41d4-a716-446655440000",
      "name": "Term 1",
      "academic_year": {
        "id": "150e8400-e29b-41d4-a716-446655440000",
        "name": "2024"
      },
      "start_date": "2024-01-08",
      "end_date": "2024-04-05",
      "is_current": false
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 3,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false
  }
}
```

---

### 6.7 Get Term Details

**GET** `/terms/{term_id}`

**Permission:** All authenticated users in school

**Success Response (200):**
```json
{
  "id": "170e8400-e29b-41d4-a716-446655440000",
  "name": "Term 1",
  "academic_year": {
    "id": "150e8400-e29b-41d4-a716-446655440000",
    "name": "2024"
  },
  "start_date": "2024-01-08",
  "end_date": "2024-04-05",
  "created_at": "2024-01-05T11:00:00Z"
}
```

---

### 6.8 Update Term

**PUT** `/terms/{term_id}`

**Permission:** SCHOOL_ADMIN

**Request:**
```json
{
  "name": "Term 1 - 2024",
  "start_date": "2024-01-08",
  "end_date": "2024-04-05"
}
```

**Success Response (200):**
```json
{
  "id": "170e8400-e29b-41d4-a716-446655440000",
  "name": "Term 1 - 2024",
  "start_date": "2024-01-08",
  "end_date": "2024-04-05",
  "updated_at": "2024-01-20T14:30:00Z"
}
```

---

## 7. Classes & Subjects

### 7.1 Create Class

**POST** `/classes`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Scope:**
* SCHOOL_ADMIN: Can create class for any campus in school
* CAMPUS_ADMIN: Can create class only in their campus

**Request:**
```json
{
  "campus_id": "770e8400-e29b-41d4-a716-446655440000",
  "academic_year_id": "150e8400-e29b-41d4-a716-446655440000",
  "name": "Grade 3A",
  "capacity": 30
}
```

**Validation:**
* campus_id: Required, must belong to user's school
* academic_year_id: Required, must belong to school
* name: Required, 1-100 chars, unique within campus+academic_year
* capacity: Optional, integer, min 1, max 100

**Business Logic:**
1. CAMPUS_ADMIN can only create in their campus
2. Validate name uniqueness: SELECT WHERE campus_id = X AND academic_year_id = Y AND name = Z
3. Create class

**Success Response (201):**
```json
{
  "id": "130e8400-e29b-41d4-a716-446655440000",
  "campus": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Main Campus"
  },
  "academic_year": {
    "id": "150e8400-e29b-41d4-a716-446655440000",
    "name": "2024"
  },
  "name": "Grade 3A",
  "capacity": 30,
  "student_count": 0,
  "created_at": "2024-01-15T12:00:00Z"
}
```

**Error Responses:**

**409: DUPLICATE_CLASS_NAME**
```json
{
  "error_code": "DUPLICATE_CLASS_NAME",
  "message": "A class named 'Grade 3A' already exists for this campus and academic year",
  "recovery": "Choose a different class name"
}
```

---

### 7.2 List Classes

**GET** `/classes`

**Permission:** All authenticated users in school

**Scope:**
* SCHOOL_ADMIN: All classes in school
* CAMPUS_ADMIN: Classes in their campus
* TEACHER: Classes they're assigned to
* PARENT: Classes their children are in

**Query Parameters:**
* `campus_id`: UUID (optional, SCHOOL_ADMIN only)
* `academic_year_id`: UUID (optional)
* `search`: String (optional) - Search by name
* `page`: Integer (default: 1)
* `page_size`: Integer (default: 20, max: 100)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "130e8400-e29b-41d4-a716-446655440000",
      "name": "Grade 3A",
      "campus": {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "name": "Main Campus"
      },
      "academic_year": {
        "id": "150e8400-e29b-41d4-a716-446655440000",
        "name": "2024"
      },
      "capacity": 30,
      "student_count": 28,
      "teacher_count": 3
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 12,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false
  }
}
```

---

### 7.3 Get Class Details

**GET** `/classes/{class_id}`

**Permission:** All authenticated users with access to this class

**Success Response (200):**
```json
{
  "id": "130e8400-e29b-41d4-a716-446655440000",
  "name": "Grade 3A",
  "campus": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Main Campus"
  },
  "academic_year": {
    "id": "150e8400-e29b-41d4-a716-446655440000",
    "name": "2024"
  },
  "capacity": 30,
  "student_count": 28,
  "created_at": "2024-01-15T12:00:00Z"
}
```

---

### 7.4 Update Class

**PUT** `/classes/{class_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN (if their campus)

**Request:**
```json
{
  "name": "Grade 3A - Updated",
  "capacity": 32
}
```

**Success Response (200):**
```json
{
  "id": "130e8400-e29b-41d4-a716-446655440000",
  "name": "Grade 3A - Updated",
  "capacity": 32,
  "updated_at": "2024-01-20T14:30:00Z"
}
```

---

### 7.5 Create Subject

**POST** `/classes/{class_id}/subjects`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Create a subject for a class.

**Request:**
```json
{
  "name": "Mathematics",
  "code": "MATH301"
}
```

**Validation:**
* name: Required, 1-200 chars
* code: Optional, 1-20 chars, unique within class

**Success Response (201):**
```json
{
  "id": "1a0e8400-e29b-41d4-a716-446655440000",
  "class_id": "130e8400-e29b-41d4-a716-446655440000",
  "name": "Mathematics",
  "code": "MATH301",
  "created_at": "2024-01-15T13:00:00Z"
}
```

---

### 7.6 List Subjects

**GET** `/classes/{class_id}/subjects`

**Permission:** All authenticated users with access to this class

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "1a0e8400-e29b-41d4-a716-446655440000",
      "name": "Mathematics",
      "code": "MATH301"
    },
    {
      "id": "1b0e8400-e29b-41d4-a716-446655440000",
      "name": "English",
      "code": "ENG301"
    },
    {
      "id": "1c0e8400-e29b-41d4-a716-446655440000",
      "name": "Science",
      "code": "SCI301"
    }
  ]
}
```

---

### 7.7 Update Subject

**PUT** `/subjects/{subject_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Request:**
```json
{
  "name": "Advanced Mathematics",
  "code": "MATH301A"
}
```

**Success Response (200):**
```json
{
  "id": "1a0e8400-e29b-41d4-a716-446655440000",
  "name": "Advanced Mathematics",
  "code": "MATH301A",
  "updated_at": "2024-01-20T14:30:00Z"
}
```

---

### 7.8 Delete Subject

**DELETE** `/subjects/{subject_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Soft delete subject. Cannot delete if performance records exist.

**Success Response (204):**
No content

**Error Responses:**

**409: SUBJECT_HAS_PERFORMANCE_RECORDS**
```json
{
  "error_code": "SUBJECT_HAS_PERFORMANCE_RECORDS",
  "message": "Cannot delete subject with existing performance records",
  "recovery": "Archive the subject instead or remove all performance records first",
  "details": {
    "performance_count": 45
  }
}
```

---

## 8. Student & Teacher Assignment

### 8.1 Assign Student to Class

**POST** `/classes/{class_id}/students`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Assign student to a class. Automatically closes previous active assignment.

**Request:**
```json
{
  "student_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "start_date": "2024-01-08"
}
```

**Validation:**
* student_id: Required, student must exist and belong to same school
* start_date: Optional, defaults to today, ISO date format

**Business Logic:**
1. Check student belongs to same school
2. Find active class assignment (end_date IS NULL)
3. If exists: set end_date = start_date - 1 day
4. Create new assignment with start_date, end_date = NULL

**Success Response (201):**
```json
{
  "id": "1d0e8400-e29b-41d4-a716-446655440000",
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "class": {
    "id": "130e8400-e29b-41d4-a716-446655440000",
    "name": "Grade 3A"
  },
  "start_date": "2024-01-08",
  "end_date": null,
  "created_at": "2024-01-08T09:00:00Z"
}
```

**Error Responses:**

**409: STUDENT_ALREADY_IN_CLASS**
```json
{
  "error_code": "STUDENT_ALREADY_IN_CLASS",
  "message": "Student is already assigned to this class",
  "recovery": "Student is currently in this class"
}
```

**400: CLASS_AT_CAPACITY**
```json
{
  "error_code": "CLASS_AT_CAPACITY",
  "message": "Class has reached maximum capacity of 30 students",
  "recovery": "Increase class capacity or assign to a different class"
}
```

---

### 8.2 List Students in Class

**GET** `/classes/{class_id}/students`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN, TEACHER (if assigned to class), PARENT (if child in class)

**Query Parameters:**
* `status`: Enum (optional) - Filter by student status
* `page`: Integer (default: 1)
* `page_size`: Integer (default: 20, max: 100)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440000",
      "first_name": "Jane",
      "middle_name": "Ann",
      "last_name": "Doe",
      "status": "ACTIVE",
      "assignment": {
        "id": "1d0e8400-e29b-41d4-a716-446655440000",
        "start_date": "2024-01-08",
        "end_date": null
      }
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 28,
    "total_pages": 2,
    "has_next": true,
    "has_previous": false
  }
}
```

---

### 8.3 Remove Student from Class

**DELETE** `/classes/{class_id}/students/{student_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** End student's active assignment to this class.

**Success Response (200):**
```json
{
  "id": "1d0e8400-e29b-41d4-a716-446655440000",
  "end_date": "2024-01-20",
  "updated_at": "2024-01-20T10:00:00Z"
}
```

---

### 8.4 Assign Teacher to Class

**POST** `/classes/{class_id}/teachers`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Assign a teacher to a class, optionally for a specific subject.

**Request:**
```json
{
  "teacher_id": "880e8400-e29b-41d4-a716-446655440000",
  "subject_id": "1a0e8400-e29b-41d4-a716-446655440000",
  "start_date": "2024-01-08"
}
```

**Validation:**
* teacher_id: Required, user must have role=TEACHER
* subject_id: Optional, if provided must belong to this class
* start_date: Optional, defaults to today

**Business Logic:**
1. Verify teacher exists and has role=TEACHER in same school
2. If subject_id provided, verify it belongs to this class
3. Check for duplicate assignment (same teacher, class, subject combination)
4. Create assignment with end_date = NULL

**Success Response (201):**
```json
{
  "id": "1e0e8400-e29b-41d4-a716-446655440000",
  "teacher": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Smith"
  },
  "class": {
    "id": "130e8400-e29b-41d4-a716-446655440000",
    "name": "Grade 3A"
  },
  "subject": {
    "id": "1a0e8400-e29b-41d4-a716-446655440000",
    "name": "Mathematics"
  },
  "start_date": "2024-01-08",
  "end_date": null,
  "created_at": "2024-01-08T09:00:00Z"
}
```

**Error Responses:**

**409: TEACHER_ALREADY_ASSIGNED**
```json
{
  "error_code": "TEACHER_ALREADY_ASSIGNED",
  "message": "Teacher is already assigned to this class for Mathematics",
  "recovery": "Teacher already has an active assignment for this class and subject"
}
```

---

### 8.5 List Teachers in Class

**GET** `/classes/{class_id}/teachers`

**Permission:** All authenticated users with access to class

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "1e0e8400-e29b-41d4-a716-446655440000",
      "teacher": {
        "id": "880e8400-e29b-41d4-a716-446655440000",
        "first_name": "John",
        "last_name": "Smith",
        "email": "john.smith@school.com"
      },
      "subject": {
        "id": "1a0e8400-e29b-41d4-a716-446655440000",
        "name": "Mathematics"
      },
      "start_date": "2024-01-08",
      "end_date": null
    }
  ]
}
```

---

### 8.6 Remove Teacher from Class

**DELETE** `/classes/{class_id}/teachers/{teacher_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Query Parameters:**
* `subject_id`: UUID (optional) - If provided, only remove assignment for this subject

**Description:** End teacher's assignment. If subject_id provided, only ends that subject assignment. Otherwise ends all assignments for this class.

**Success Response (204):**
No content

---

## 9. Academic Performance

### 9.1 Enter/Update Subject Performance

**PUT** `/students/{student_id}/performance`

**Permission:** TEACHER (if assigned to class/subject), SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Enter or update a student's performance for a subject in a term. Upsert operation.

**Request:**
```json
{
  "subject_id": "1a0e8400-e29b-41d4-a716-446655440000",
  "term_id": "170e8400-e29b-41d4-a716-446655440000",
  "grade": "B+",
  "subject_comment": "Shows good understanding. Needs to work on problem-solving speed."
}
```

**Validation:**
* subject_id: Required, must exist
* term_id: Required, must exist
* grade: Optional, 1-10 chars (e.g., A, A+, B, 85%, etc.)
* subject_comment: Optional, max 1000 chars

**Permission Logic:**
* TEACHER: Can only enter for students in their assigned class AND for subjects they teach
* ADMIN: Can enter for any student

**Business Logic:**
1. If TEACHER: verify assignment
   * Check teacher_class_assignment WHERE teacher_id = X AND class_id = student's class
   * If subject_id provided in assignment, must match
2. Verify student is assigned to a class
3. Verify subject belongs to student's current class
4. Upsert student_performance record (unique on student_id, subject_id, term_id)
5. Record who entered/updated (entered_by_user_id)

**Success Response (200):**
```json
{
  "id": "1f0e8400-e29b-41d4-a716-446655440000",
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "subject": {
    "id": "1a0e8400-e29b-41d4-a716-446655440000",
    "name": "Mathematics"
  },
  "term": {
    "id": "170e8400-e29b-41d4-a716-446655440000",
    "name": "Term 1"
  },
  "grade": "B+",
  "subject_comment": "Shows good understanding. Needs to work on problem-solving speed.",
  "entered_by": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Smith"
  },
  "entered_at": "2024-04-01T14:30:00Z",
  "updated_at": "2024-04-01T14:30:00Z"
}
```

**Error Responses:**

**403: TEACHER_NOT_ASSIGNED**
```json
{
  "error_code": "TEACHER_NOT_ASSIGNED",
  "message": "You are not assigned to teach this class or subject",
  "recovery": "Contact an administrator to get assigned to this class",
  "details": {
    "teacher_id": "880e8400-e29b-41d4-a716-446655440000",
    "class_id": "130e8400-e29b-41d4-a716-446655440000",
    "subject_id": "1a0e8400-e29b-41d4-a716-446655440000"
  }
}
```

**400: STUDENT_NOT_IN_CLASS**
```json
{
  "error_code": "STUDENT_NOT_IN_CLASS",
  "message": "Student is not currently assigned to any class",
  "recovery": "Assign student to a class before entering performance"
}
```

**400: SUBJECT_NOT_IN_CLASS**
```json
{
  "error_code": "SUBJECT_NOT_IN_CLASS",
  "message": "This subject does not belong to the student's current class",
  "recovery": "Select a subject from the student's class"
}
```

---

### 9.2 Get Student Performance

**GET** `/students/{student_id}/performance`

**Permission:** TEACHER (if assigned), SCHOOL_ADMIN, CAMPUS_ADMIN, PARENT (if own child)

**Query Parameters:**
* `term_id`: UUID (optional) - Filter by specific term
* `subject_id`: UUID (optional) - Filter by specific subject

**Success Response (200):**
```json
{
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "data": [
    {
      "subject": {
        "id": "1a0e8400-e29b-41d4-a716-446655440000",
        "name": "Mathematics"
      },
      "term": {
        "id": "170e8400-e29b-41d4-a716-446655440000",
        "name": "Term 1"
      },
      "grade": "B+",
      "subject_comment": "Shows good understanding. Needs to work on problem-solving speed.",
      "entered_by": {
        "first_name": "John",
        "last_name": "Smith"
      },
      "entered_at": "2024-04-01T14:30:00Z"
    },
    {
      "subject": {
        "id": "1b0e8400-e29b-41d4-a716-446655440000",
        "name": "English"
      },
      "term": {
        "id": "170e8400-e29b-41d4-a716-446655440000",
        "name": "Term 1"
      },
      "grade": "A",
      "subject_comment": "Excellent reading comprehension and writing skills.",
      "entered_by": {
        "first_name": "Sarah",
        "last_name": "Johnson"
      },
      "entered_at": "2024-04-02T10:15:00Z"
    }
  ]
}
```

---

### 9.3 Enter/Update Term Comment

**PUT** `/students/{student_id}/term-comment`

**Permission:** TEACHER (if assigned to class), SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Enter or update overall term comment for a student.

**Request:**
```json
{
  "term_id": "170e8400-e29b-41d4-a716-446655440000",
  "comment": "Jane has shown excellent progress this term. She participates actively in class and helps other students. Keep up the great work!"
}
```

**Validation:**
* term_id: Required
* comment: Required, 1-2000 chars

**Success Response (200):**
```json
{
  "id": "200e8400-e29b-41d4-a716-446655440000",
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "term": {
    "id": "170e8400-e29b-41d4-a716-446655440000",
    "name": "Term 1"
  },
  "comment": "Jane has shown excellent progress this term. She participates actively in class and helps other students. Keep up the great work!",
  "entered_by": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Smith"
  },
  "entered_at": "2024-04-05T15:00:00Z"
}
```

---

### 9.4 Get Term Comment

**GET** `/students/{student_id}/term-comment`

**Permission:** TEACHER (if assigned), SCHOOL_ADMIN, CAMPUS_ADMIN, PARENT (if own child)

**Query Parameters:**
* `term_id`: UUID (required)

**Success Response (200):**
```json
{
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "term": {
    "id": "170e8400-e29b-41d4-a716-446655440000",
    "name": "Term 1"
  },
  "comment": "Jane has shown excellent progress this term...",
  "entered_by": {
    "first_name": "John",
    "last_name": "Smith"
  },
  "entered_at": "2024-04-05T15:00:00Z"
}
```

**Error Responses:**

**404: TERM_COMMENT_NOT_FOUND**
```json
{
  "error_code": "TERM_COMMENT_NOT_FOUND",
  "message": "No term comment found for this student and term",
  "recovery": "Term comment has not been entered yet"
}
```

---

## 10. Document Vault

### 10.1 Upload Student Document

**POST** `/students/{student_id}/documents`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN, PARENT (if own child)

**Description:** Upload a document to student's vault.

**Request:** multipart/form-data
* `file`: File (required, max 10MB)
* `folder`: Enum (required) - PARENT, STUDENT, SCHOOL
* `document_type`: String (required) - e.g., "Birth Certificate", "Parent ID", "Report Card"

**Validation:**
* file: Required, max 10MB
* Allowed types: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG
* folder: Required, enum (PARENT, STUDENT, SCHOOL)
* document_type: Required, 1-200 chars

**Permission Logic - Upload Rights:**
* PARENT folder: Parent (own child) or Admin
* STUDENT folder: Parent (own child) or Admin
* SCHOOL folder: Admin only (parents cannot upload here)

**Business Logic:**
1. Validate file size and type
2. Scan file for viruses (using ClamAV or similar)
3. Generate unique filename: {student_id}/{folder}/{uuid}.{ext}
4. Upload to S3
5. Create document record in database
6. Return document details

**Success Response (201):**
```json
{
  "id": "210e8400-e29b-41d4-a716-446655440000",
  "student_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "folder": "PARENT",
  "document_type": "Father ID",
  "filename": "father_id_card.pdf",
  "file_size": 1048576,
  "mime_type": "application/pdf",
  "uploaded_by": {
    "id": "dd0e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Doe"
  },
  "uploaded_at": "2024-01-15T14:00:00Z"
}
```

**Error Responses:**

**400: FILE_TOO_LARGE**
```json
{
  "error_code": "FILE_TOO_LARGE",
  "message": "File size exceeds maximum of 10MB",
  "recovery": "Compress the file or upload a smaller file",
  "details": {
    "max_size_mb": 10,
    "file_size_mb": 15.5
  }
}
```

**400: INVALID_FILE_TYPE**
```json
{
  "error_code": "INVALID_FILE_TYPE",
  "message": "File type not allowed",
  "recovery": "Upload a file in one of the allowed formats",
  "details": {
    "received_type": "application/exe",
    "allowed_types": ["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.ms-excel"]
  }
}
```

**400: VIRUS_DETECTED**
```json
{
  "error_code": "VIRUS_DETECTED",
  "message": "File failed security scan",
  "recovery": "The file appears to be infected and cannot be uploaded"
}
```

**403: FORBIDDEN_ACTION**
```json
{
  "error_code": "FORBIDDEN_ACTION",
  "message": "Parents cannot upload to SCHOOL folder",
  "recovery": "You can upload to PARENT or STUDENT folders only"
}
```

---

### 10.2 List Student Documents

**GET** `/students/{student_id}/documents`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN, TEACHER (with restrictions), PARENT (if own child)

**Scope & Visibility:**
* PARENT folder: Parent (own child) + Admin
* STUDENT folder: Everyone with access (based on teacher assignment)
* SCHOOL folder: Everyone with access

**Query Parameters:**
* `folder`: Enum (optional) - Filter by folder
* `document_type`: String (optional) - Filter by type

**Success Response (200):**
```json
{
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "data": [
    {
      "id": "210e8400-e29b-41d4-a716-446655440000",
      "folder": "PARENT",
      "document_type": "Father ID",
      "filename": "father_id_card.pdf",
      "file_size": 1048576,
      "mime_type": "application/pdf",
      "uploaded_by": {
        "first_name": "John",
        "last_name": "Doe"
      },
      "uploaded_at": "2024-01-15T14:00:00Z"
    },
    {
      "id": "220e8400-e29b-41d4-a716-446655440000",
      "folder": "STUDENT",
      "document_type": "Birth Certificate",
      "filename": "birth_certificate.pdf",
      "file_size": 850000,
      "mime_type": "application/pdf",
      "uploaded_by": {
        "first_name": "Admin",
        "last_name": "User"
      },
      "uploaded_at": "2024-01-15T14:10:00Z"
    }
  ]
}
```

**Note:** Teachers can only see STUDENT and SCHOOL folders, not PARENT folder.

---

### 10.3 Get Document Download URL

**GET** `/documents/{document_id}/download`

**Permission:** Based on folder visibility rules

**Description:** Get a signed URL for downloading the document. URL expires in 1 hour.

**Success Response (200):**
```json
{
  "document_id": "210e8400-e29b-41d4-a716-446655440000",
  "download_url": "https://s3.amazonaws.com/school-docs/bb0e8400.../signed-url?expires=...",
  "expires_at": "2024-01-15T15:00:00Z",
  "expires_in_seconds": 3600
}
```

**Error Responses:**

**403: FORBIDDEN_ACTION**
```json
{
  "error_code": "FORBIDDEN_ACTION",
  "message": "You don't have permission to view documents in PARENT folder",
  "recovery": "Contact an administrator if you need access"
}
```

---

### 10.4 Delete Document

**DELETE** `/documents/{document_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Delete document from database and S3. Cannot be undone.

**Success Response (204):**
No content

---

## 11. Communication

### 11.1 Create Announcement

**POST** `/announcements`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Create an announcement. Triggers notifications to target audience.

**Request:**
```json
{
  "title": "Term Opening Announcement",
  "body": "School reopens on Monday, January 8th, 2024. All students should report by 8:00 AM.",
  "audience": "PARENTS",
  "attachment_ids": ["230e8400-e29b-41d4-a716-446655440000"]
}
```

**Validation:**
* title: Optional, max 500 chars
* body: Optional, max 5000 chars
* At least one of title or body MUST be provided
* audience: Required, enum (PARENTS, TEACHERS, BOTH)
* attachment_ids: Optional, array of document IDs (pre-uploaded via separate endpoint)

**Business Logic:**
1. Validate at least title or body exists
2. Create announcement record
3. Link attachments if provided
4. Queue notification jobs based on audience:
   * PARENTS: Send to all parents in school
   * TEACHERS: Send to all teachers in school
   * BOTH: Send to both groups
5. Insert message_log records

**Success Response (201):**
```json
{
  "id": "240e8400-e29b-41d4-a716-446655440000",
  "title": "Term Opening Announcement",
  "body": "School reopens on Monday, January 8th, 2024...",
  "audience": "PARENTS",
  "attachments": [
    {
      "id": "230e8400-e29b-41d4-a716-446655440000",
      "filename": "term_requirements.pdf"
    }
  ],
  "created_by": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Smith"
  },
  "created_at": "2024-01-05T10:00:00Z",
  "notification_stats": {
    "total_recipients": 520,
    "sent": 520,
    "delivered": 518,
    "failed": 2
  }
}
```

**Error Responses:**

**400: NO_CONTENT_PROVIDED**
```json
{
  "error_code": "NO_CONTENT_PROVIDED",
  "message": "At least one of 'title' or 'body' must be provided",
  "recovery": "Provide announcement content in title and/or body"
}
```

---

### 11.2 List Announcements

**GET** `/announcements`

**Permission:** All authenticated users (scope-filtered)

**Scope:**
* PARENTS: See announcements where audience = PARENTS or BOTH
* TEACHERS: See announcements where audience = TEACHERS or BOTH
* ADMIN: See all announcements

**Query Parameters:**
* `audience`: Enum (optional) - Filter by audience
* `from_date`: ISO date (optional) - Announcements created after this date
* `to_date`: ISO date (optional) - Announcements created before this date
* `page`: Integer (default: 1)
* `page_size`: Integer (default: 20, max: 100)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "240e8400-e29b-41d4-a716-446655440000",
      "title": "Term Opening Announcement",
      "body": "School reopens on Monday, January 8th, 2024...",
      "audience": "PARENTS",
      "attachment_count": 1,
      "created_by": {
        "first_name": "John",
        "last_name": "Smith"
      },
      "created_at": "2024-01-05T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 15,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false
  }
}
```

---

### 11.3 Get Announcement Details

**GET** `/announcements/{announcement_id}`

**Permission:** All authenticated users (if announcement targets their role)

**Success Response (200):**
```json
{
  "id": "240e8400-e29b-41d4-a716-446655440000",
  "title": "Term Opening Announcement",
  "body": "School reopens on Monday, January 8th, 2024. All students should report by 8:00 AM.\n\nPlease ensure your child has:\n- Full uniform\n- All required books\n- Lunch box",
  "audience": "PARENTS",
  "attachments": [
    {
      "id": "230e8400-e29b-41d4-a716-446655440000",
      "filename": "term_requirements.pdf",
      "file_size": 450000,
      "download_url": "https://s3.../signed-url"
    }
  ],
  "created_by": {
    "first_name": "John",
    "last_name": "Smith"
  },
  "created_at": "2024-01-05T10:00:00Z"
}
```

---

### 11.4 Delete Announcement

**DELETE** `/announcements/{announcement_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN (if they created it)

**Success Response (204):**
No content

---

### 11.5 Create Notice Board Item

**POST** `/notice-board`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Create a persistent notice board item. No automatic notifications.

**Request:**
```json
{
  "title": "School Rules and Regulations",
  "body": "1. Students must wear full uniform...\n2. Attendance is mandatory...",
  "audience": "BOTH",
  "attachment_ids": ["250e8400-e29b-41d4-a716-446655440000"]
}
```

**Validation:**
* title: Required, 1-500 chars
* body: Optional, max 10000 chars
* audience: Required, enum (PARENTS, TEACHERS, BOTH)
* attachment_ids: Optional, array of document IDs

**Success Response (201):**
```json
{
  "id": "260e8400-e29b-41d4-a716-446655440000",
  "title": "School Rules and Regulations",
  "body": "1. Students must wear full uniform...",
  "audience": "BOTH",
  "attachments": [
    {
      "id": "250e8400-e29b-41d4-a716-446655440000",
      "filename": "school_rules.pdf"
    }
  ],
  "created_by": {
    "first_name": "Jane",
    "last_name": "Admin"
  },
  "created_at": "2024-01-01T09:00:00Z"
}
```

---

### 11.6 List Notice Board Items

**GET** `/notice-board`

**Permission:** All authenticated users (scope-filtered by audience)

**Query Parameters:**
* `audience`: Enum (optional)
* `search`: String (optional) - Search in title and body
* `page`: Integer (default: 1)
* `page_size`: Integer (default: 20, max: 100)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "260e8400-e29b-41d4-a716-446655440000",
      "title": "School Rules and Regulations",
      "body": "1. Students must wear full uniform...",
      "audience": "BOTH",
      "attachment_count": 1,
      "created_at": "2024-01-01T09:00:00Z"
    },
    {
      "id": "270e8400-e29b-41d4-a716-446655440000",
      "title": "School Menu",
      "body": "Monday: Rice and beans...",
      "audience": "PARENTS",
      "attachment_count": 0,
      "created_at": "2024-01-02T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 5,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false
  }
}
```

---

### 11.7 Get Notice Board Item Details

**GET** `/notice-board/{item_id}`

**Permission:** All authenticated users (if item targets their role)

**Success Response (200):**
```json
{
  "id": "260e8400-e29b-41d4-a716-446655440000",
  "title": "School Rules and Regulations",
  "body": "1. Students must wear full uniform...\n2. Attendance is mandatory...\n3. Respect all staff and fellow students...",
  "audience": "BOTH",
  "attachments": [
    {
      "id": "250e8400-e29b-41d4-a716-446655440000",
      "filename": "school_rules.pdf",
      "download_url": "https://s3.../signed-url"
    }
  ],
  "created_by": {
    "first_name": "Jane",
    "last_name": "Admin"
  },
  "created_at": "2024-01-01T09:00:00Z",
  "updated_at": "2024-01-10T11:00:00Z"
}
```

---

### 11.8 Update Notice Board Item

**PUT** `/notice-board/{item_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Request:**
```json
{
  "title": "Updated School Rules and Regulations",
  "body": "1. Students must wear full uniform (updated)...",
  "audience": "BOTH"
}
```

**Success Response (200):**
```json
{
  "id": "260e8400-e29b-41d4-a716-446655440000",
  "title": "Updated School Rules and Regulations",
  "body": "1. Students must wear full uniform (updated)...",
  "audience": "BOTH",
  "updated_at": "2024-01-20T15:00:00Z"
}
```

---

### 11.9 Delete Notice Board Item

**DELETE** `/notice-board/{item_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Success Response (204):**
No content

---

## 12. Finance

### 12.1 Set Student Fee

**POST** `/students/{student_id}/fees`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Set expected fee for a student for a term. Creates per-student override.

**Request:**
```json
{
  "term_id": "170e8400-e29b-41d4-a716-446655440000",
  "expected_amount": 45000.00,
  "notes": "Standard fee for Grade 3"
}
```

**Validation:**
* term_id: Required, must exist
* expected_amount: Required, decimal, min 0, max 10000000
* notes: Optional, max 500 chars

**Success Response (201):**
```json
{
  "id": "280e8400-e29b-41d4-a716-446655440000",
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "term": {
    "id": "170e8400-e29b-41d4-a716-446655440000",
    "name": "Term 1"
  },
  "expected_amount": 45000.00,
  "paid_amount": 0.00,
  "pending_amount": 45000.00,
  "notes": "Standard fee for Grade 3",
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Error Responses:**

**409: FEE_ALREADY_EXISTS**
```json
{
  "error_code": "FEE_ALREADY_EXISTS",
  "message": "Fee record already exists for this student and term",
  "recovery": "Use PUT /fees/{fee_id} to update existing fee",
  "details": {
    "existing_fee_id": "280e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### 12.2 Record Payment

**POST** `/fees/{fee_id}/payments`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Record a payment toward a fee. Adds to existing paid_amount.

**Request:**
```json
{
  "amount": 15000.00,
  "payment_date": "2024-01-20",
  "payment_method": "Bank Transfer",
  "reference_number": "TXN123456"
}
```

**Validation:**
* amount: Required, decimal, min 0.01
* payment_date: Optional, defaults to today, ISO date
* payment_method: Optional, max 100 chars (e.g., "Cash", "M-Pesa", "Bank Transfer")
* reference_number: Optional, max 100 chars

**Business Logic:**
1. Add amount to existing paid_amount
2. Recalculate pending_amount = expected_amount - paid_amount
3. Log payment in payment_history table

**Success Response (200):**
```json
{
  "id": "280e8400-e29b-41d4-a716-446655440000",
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "term": {
    "id": "170e8400-e29b-41d4-a716-446655440000",
    "name": "Term 1"
  },
  "expected_amount": 45000.00,
  "paid_amount": 15000.00,
  "pending_amount": 30000.00,
  "last_payment": {
    "amount": 15000.00,
    "payment_date": "2024-01-20",
    "payment_method": "Bank Transfer",
    "reference_number": "TXN123456"
  },
  "updated_at": "2024-01-20T14:00:00Z"
}
```

**Error Responses:**

**400: PAYMENT_EXCEEDS_EXPECTED**
```json
{
  "error_code": "PAYMENT_EXCEEDS_EXPECTED",
  "message": "Payment amount would exceed expected fee",
  "recovery": "Reduce payment amount or adjust expected fee first",
  "details": {
    "expected_amount": 45000.00,
    "paid_amount": 40000.00,
    "payment_attempt": 10000.00,
    "excess": 5000.00
  }
}
```

---

### 12.3 Get Student Fee Status

**GET** `/students/{student_id}/fees`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN, TEACHER (read-only), PARENT (if own child)

**Query Parameters:**
* `term_id`: UUID (optional) - Filter by term
* `academic_year_id`: UUID (optional) - Filter by academic year

**Success Response (200):**
```json
{
  "student": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "data": [
    {
      "id": "280e8400-e29b-41d4-a716-446655440000",
      "term": {
        "id": "170e8400-e29b-41d4-a716-446655440000",
        "name": "Term 1",
        "academic_year": "2024"
      },
      "expected_amount": 45000.00,
      "paid_amount": 15000.00,
      "pending_amount": 30000.00,
      "payment_status": "PARTIAL"
    },
    {
      "id": "290e8400-e29b-41d4-a716-446655440000",
      "term": {
        "id": "180e8400-e29b-41d4-a716-446655440000",
        "name": "Term 2",
        "academic_year": "2024"
      },
      "expected_amount": 45000.00,
      "paid_amount": 0.00,
      "pending_amount": 45000.00,
      "payment_status": "UNPAID"
    }
  ],
  "summary": {
    "total_expected": 90000.00,
    "total_paid": 15000.00,
    "total_pending": 75000.00
  }
}
```

---

### 12.4 Update Expected Fee

**PUT** `/fees/{fee_id}`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Adjust expected fee amount (e.g., scholarship, discount).

**Request:**
```json
{
  "expected_amount": 40000.00,
  "notes": "10% scholarship applied"
}
```

**Success Response (200):**
```json
{
  "id": "280e8400-e29b-41d4-a716-446655440000",
  "expected_amount": 40000.00,
  "paid_amount": 15000.00,
  "pending_amount": 25000.00,
  "notes": "10% scholarship applied",
  "updated_at": "2024-01-20T15:00:00Z"
}
```

---

### 12.5 List All Fees (Admin View)

**GET** `/fees`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Scope:**
* SCHOOL_ADMIN: All fees in school
* CAMPUS_ADMIN: Fees for students in their campus

**Query Parameters:**
* `campus_id`: UUID (optional, SCHOOL_ADMIN only)
* `term_id`: UUID (optional)
* `payment_status`: Enum (optional) - PAID, PARTIAL, UNPAID
* `class_id`: UUID (optional)
* `page`: Integer (default: 1)
* `page_size`: Integer (default: 20, max: 100)

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "280e8400-e29b-41d4-a716-446655440000",
      "student": {
        "id": "bb0e8400-e29b-41d4-a716-446655440000",
        "first_name": "Jane",
        "last_name": "Doe",
        "class": "Grade 3A"
      },
      "term": {
        "id": "170e8400-e29b-41d4-a716-446655440000",
        "name": "Term 1"
      },
      "expected_amount": 45000.00,
      "paid_amount": 15000.00,
      "pending_amount": 30000.00,
      "payment_status": "PARTIAL"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 280,
    "total_pages": 14,
    "has_next": true,
    "has_previous": false
  },
  "summary": {
    "total_expected": 12600000.00,
    "total_paid": 8400000.00,
    "total_pending": 4200000.00,
    "students_paid_full": 150,
    "students_partial": 80,
    "students_unpaid": 50
  }
}
```

---

## 13. Bulk Operations

### 13.1 Download CSV Template

**GET** `/bulk/students/template`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Download CSV template for bulk student upload.

**Success Response (200):**
Content-Type: text/csv

**CSV Headers:**
```csv
student_first_name,student_middle_name,student_last_name,student_date_of_birth,class_name,campus_name,father_first_name,father_last_name,father_phone,father_email,father_id_number,mother_first_name,mother_last_name,mother_phone,mother_email,mother_id_number,guardian_first_name,guardian_last_name,guardian_phone,guardian_email,guardian_id_number
```

**Example CSV:**
```csv
student_first_name,student_middle_name,student_last_name,student_date_of_birth,class_name,campus_name,father_first_name,father_last_name,father_phone,father_email,father_id_number,mother_first_name,mother_last_name,mother_phone,mother_email,mother_id_number,guardian_first_name,guardian_last_name,guardian_phone,guardian_email,guardian_id_number
Jane,Ann,Doe,2016-03-12,Grade 3A,Main Campus,John,Doe,+254712345678,john@example.com,12345678,Mary,Doe,+254723456789,mary@example.com,23456789,,,,,
```

---

### 13.2 Upload CSV (Dry Run)

**POST** `/bulk/students?dry_run=true`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Validate CSV without creating records. Returns validation errors.

**Request:** multipart/form-data
* `file`: CSV file

**Success Response (200):**
```json
{
  "total_rows": 100,
  "valid_rows": 95,
  "invalid_rows": 5,
  "errors": [
    {
      "row": 12,
      "errors": [
        {
          "field": "father_phone",
          "error_code": "INVALID_PHONE_NUMBER",
          "message": "Phone must match pattern +254[17]xxxxxxxx",
          "value": "0712345678"
        }
      ]
    },
    {
      "row": 25,
      "errors": [
        {
          "field": "student_date_of_birth",
          "error_code": "INVALID_DATE_FORMAT",
          "message": "Date must be in format YYYY-MM-DD",
          "value": "12/03/2016"
        }
      ]
    },
    {
      "row": 48,
      "errors": [
        {
          "field": "mother_email",
          "error_code": "DUPLICATE_EMAIL",
          "message": "Email already exists in school",
          "value": "existing@example.com"
        }
      ]
    }
  ],
  "warnings": [
    {
      "row": 30,
      "warning": "Campus 'East Campus' not found, will be created"
    }
  ]
}
```

---

### 13.3 Upload CSV (Execute)

**POST** `/bulk/students?dry_run=false`

**Permission:** SCHOOL_ADMIN, CAMPUS_ADMIN

**Description:** Execute bulk student creation. Creates students and parent accounts with setup links.

**Request:** multipart/form-data
* `file`: CSV file

**Business Logic:**
1. Parse CSV
2. Validate all rows
3. If ANY row has errors, return 400 with errors (all-or-nothing)
4. Begin transaction
5. For each valid row:
   a. Find or create campus
   b. Find or create class
   c. Create student
   d. For each parent (father, mother, guardian):
      - Check if user exists by phone
      - Create parent if needed (password_hash = NULL, status = PENDING_SETUP)
      - Generate setup token
      - Link to student
      - Queue SMS with setup link if new user
6. Commit transaction
7. Return summary

**Success Response (200):**
```json
{
  "total_rows": 95,
  "students_created": 95,
  "parents_created": 142,
  "parents_linked": 190,
  "campuses_created": 0,
  "classes_created": 2,
  "processing_time_seconds": 12.5,
  "notifications": {
    "sms_queued": 142,
    "sms_sent": 140,
    "sms_failed": 2
  },
  "summary": [
    {
      "row": 1,
      "student_id": "bb0e8400-e29b-41d4-a716-446655440000",
      "student_name": "Jane Doe",
      "parents_created": ["father", "mother"],
      "setup_links_sent": 2
    }
  ]
}
```

**Error Responses:**

**400: VALIDATION_ERRORS**
```json
{
  "error_code": "VALIDATION_ERRORS",
  "message": "CSV contains validation errors. No records were created.",
  "recovery": "Fix the errors and try again. Use dry_run=true to validate first.",
  "details": {
    "total_rows": 100,
    "invalid_rows": 5,
    "errors": [ /* same format as dry run */ ]
  }
}
```

**400: INVALID_CSV_FORMAT**
```json
{
  "error_code": "INVALID_CSV_FORMAT",
  "message": "CSV file is malformed or has incorrect headers",
  "recovery": "Download the template and ensure your CSV matches the format",
  "details": {
    "expected_headers": ["student_first_name", "student_last_name", "..."],
    "found_headers": ["name", "lastname", "..."]
  }
}
```

---

## 14. Upload Endpoints (For Attachments)

### 14.1 Upload File (Generic)

**POST** `/uploads`

**Permission:** All authenticated users

**Description:** Upload a file for later attachment to announcements, notice board items, etc. Returns file ID.

**Request:** multipart/form-data
* `file`: File (max 10MB)
* `purpose`: Enum (required) - ANNOUNCEMENT, NOTICE_BOARD, DOCUMENT

**Success Response (201):**
```json
{
  "id": "2a0e8400-e29b-41d4-a716-446655440000",
  "filename": "term_requirements.pdf",
  "file_size": 450000,
  "mime_type": "application/pdf",
  "uploaded_at": "2024-01-05T09:30:00Z"
}
```

---

## 15. Error Code Reference

### Authentication Errors (401)
* `AUTH_TOKEN_MISSING` - Authorization header not provided
* `AUTH_TOKEN_INVALID` - Token is malformed or signature invalid
* `AUTH_TOKEN_EXPIRED` - Token has expired
* `AUTH_TOKEN_REVOKED` - Token has been revoked
* `INVALID_CREDENTIALS` - Email or password incorrect
* `ACCOUNT_PENDING_SETUP` - Account setup not completed (password not set)

### Authorization Errors (403)
* `FORBIDDEN_ACTION` - User role doesn't permit this action
* `SCOPE_VIOLATION` - Resource outside user's scope
* `TENANT_ISOLATION_VIOLATION` - Attempted cross-school access
* `ROLE_RESTRICTION` - Role cannot perform this specific action
* `ACCOUNT_INACTIVE` - User account is deactivated

### Validation Errors (400)
* `VALIDATION_ERROR` - General validation failure
* `INVALID_EMAIL` - Email format invalid
* `INVALID_PHONE_NUMBER` - Phone doesn't match required pattern (+254[17]xxxxxxxx)
* `INVALID_DATE_FORMAT` - Date not in ISO format
* `FUTURE_DATE_OF_BIRTH` - Birth date cannot be in future
* `MISSING_REQUIRED_FIELD` - Required field not provided
* `INVALID_FILE_TYPE` - File type not allowed
* `FILE_TOO_LARGE` - File exceeds 10MB limit
* `INVALID_ENUM_VALUE` - Value not in allowed set
* `NO_PARENT_PROVIDED` - At least one parent required
* `NO_CONTENT_PROVIDED` - Content required but not provided
* `INVALID_CSV_FORMAT` - CSV format incorrect
* `VIRUS_DETECTED` - File failed security scan
* `INVALID_TOKEN` - Setup or reset token invalid
* `TOKEN_EXPIRED` - Token has expired
* `TOKEN_ALREADY_USED` - Token has already been used
* `PASSWORDS_DO_NOT_MATCH` - Password confirmation doesn't match
* `INVALID_PASSWORD_FORMAT` - Password doesn't meet requirements
* `SAME_AS_OLD_PASSWORD` - New password same as current password

### Conflict Errors (409)
* `DUPLICATE_EMAIL` - Email already exists in school
* `DUPLICATE_PHONE_NUMBER` - Phone already exists in school
* `DUPLICATE_PARENT_ROLE` - Student already has this parent role
* `DUPLICATE_SCHOOL_NAME` - School name already exists
* `DUPLICATE_SUBDOMAIN` - Subdomain already taken
* `DUPLICATE_CAMPUS_NAME` - Campus name exists in school
* `DUPLICATE_CLASS_NAME` - Class name exists for campus/year
* `CLASS_ASSIGNMENT_CONFLICT` - Student has active class
* `TERM_OVERLAP` - Term dates overlap with existing term
* `ACADEMIC_YEAR_OVERLAP` - Academic year dates overlap
* `TEACHER_ALREADY_ASSIGNED` - Teacher assigned to class/subject
* `STUDENT_ALREADY_IN_CLASS` - Student already in this class
* `PARENT_ALREADY_LINKED` - Parent already linked to student
* `FEE_ALREADY_EXISTS` - Fee record exists for student/term
* `SUBJECT_HAS_PERFORMANCE_RECORDS` - Cannot delete subject with records
* `INVALID_STATE_TRANSITION` - Cannot transition from current state

### State Transition Errors (422)
* `TEACHER_NOT_ASSIGNED` - Teacher not assigned to class/subject
* `TERM_NOT_ACTIVE` - Cannot enter performance for non-active term
* `STUDENT_NOT_IN_CLASS` - Student not assigned to any class
* `SUBJECT_NOT_IN_CLASS` - Subject not in student's class
* `PAYMENT_EXCEEDS_EXPECTED` - Payment would exceed expected fee
* `CANNOT_REMOVE_LAST_PARENT` - Student must have at least one parent
* `CLASS_AT_CAPACITY` - Class has reached maximum capacity

### Resource Not Found (404)
* `RESOURCE_NOT_FOUND` - Generic not found
* `STUDENT_NOT_FOUND` - Student ID doesn't exist
* `PARENT_NOT_FOUND` - Parent ID doesn't exist
* `CLASS_NOT_FOUND` - Class ID doesn't exist
* `CAMPUS_NOT_FOUND` - Campus ID doesn't exist
* `SCHOOL_NOT_FOUND` - School ID doesn't exist
* `USER_NOT_FOUND` - User ID doesn't exist
* `TERM_COMMENT_NOT_FOUND` - Term comment doesn't exist

### Rate Limiting (429)
* `RATE_LIMIT_EXCEEDED` - Too many requests
* `TOO_MANY_RESET_REQUESTS` - Too many password reset requests

### Server Errors (500)
* `INTERNAL_ERROR` - Unexpected server error
* `DATABASE_ERROR` - Database operation failed
* `SMS_DELIVERY_FAILED` - SMS sending failed
* `EMAIL_DELIVERY_FAILED` - Email sending failed
* `FILE_UPLOAD_FAILED` - File upload to S3 failed

---

## END OF COMPLETE API SPECIFICATION (CORRECTED)