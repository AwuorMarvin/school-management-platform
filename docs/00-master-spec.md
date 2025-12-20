# School Management Platform

## Unified Master Engineering Specification (MVP)

---

## 0. Document Authority & Scope

**Status:** Authoritative

This document is the **single source of truth** for the School Management Platform MVP. It consolidates:

* Product & system vision
* Data model & constraints
* State machines
* API specifications
* Error handling standards
* Non-functional requirements

All engineering decisions, implementations, and LLM-assisted development **MUST derive strictly from this document**. No external assumptions are permitted.

---

## 1. System Overview & Vision

The platform is a **multi-tenant SaaS School Management System** designed for sale to multiple schools.

### Core Principles

* Strict tenant isolation (per school)
* Modular architecture
* Admin-led workflows
* Mobile-first communication (SMS)
* **Standard email + password authentication**

### Minimum Operational Loop (MVP)

1. Admin admits a student (immediate)
2. Parent account is created and notified via SMS
3. Parent sets up account with password via secure link
4. Student is assigned to a class
5. Teacher manages academic performance
6. Parent views all child-related data
7. School communicates via announcements and notice board
8. School tracks basic fees

---

## 2. Tenant, Campus & Role Model

### 2.1 School (Tenant)

* Primary isolation boundary
* All data scoped by `school_id`

### 2.2 Campus

* Every school MUST have at least one campus
* Students belong to exactly one campus

### 2.3 Single-Campus Rule

If a school has only one campus:

* School Admin and Campus Admin experiences are identical

### 2.4 Roles

| Role         | Scope            |
| ------------ | ---------------- |
| Super Admin  | Platform-wide    |
| School Admin | All campuses     |
| Campus Admin | Single campus    |
| Teacher      | Assigned classes |
| Parent       | Linked children  |

---

## 3. User Identity & Authentication

### 3.1 User Requirements

All human users (Admins, Teachers, Parents) MUST have:

* Email (required, primary identifier)
* Phone number (required, for SMS notifications)
* Password (required, hashed with bcrypt)

### 3.2 Email Rules

* MUST be valid RFC 5322 format
* MUST be unique per school
* Serves as primary login identifier

```text
UNIQUE (school_id, email)
```

### 3.3 Phone Number Rules

* MUST start with `+254`
* MUST follow E.164 format
* MUST be unique per school
* Used for SMS notifications (NOT authentication)

```text
UNIQUE (school_id, phone_number)
```

### 3.4 Authentication Model (Email + Password)

**Login Flow:**
1. User enters email and password
2. System validates credentials
3. System issues JWT access token and refresh token
4. User is authenticated for 24 hours (or 30 days with "remember me")

**Password Requirements:**
* Minimum 8 characters
* Must contain at least 1 uppercase letter
* Must contain at least 1 number
* Must contain at least 1 special character (@$!%*?&)
* Hashed with bcrypt (cost factor: 12)

**Session Management:**
* Access token expires after 24 hours
* Refresh token expires after 30 days
* "Remember me" extends refresh token to 30 days
* Tokens revoked on password change or logout

---

### 3.5 Account Setup Flow (First-Time Users)

**For Parents (Created by Admin):**

1. **Admin Creates Student + Parent**
   - Admin enters parent details (email, phone, name)
   - System generates secure setup token (valid 7 days)
   - System sends SMS with setup link

2. **Parent Receives SMS:**
   ```
   Welcome to [School Name]!
   
   Your child [Student Name] has been enrolled in [Class].
   
   Set up your parent account:
   https://portal.[school].com/setup?token=abc123xyz
   
   This link expires in 7 days.
   ```

3. **Parent Clicks Link:**
   - Lands on account setup page
   - Sees pre-filled email
   - Enters desired password
   - Confirms password
   - Clicks "Create Account"

4. **Account Created:**
   - Password hashed and stored
   - Setup token marked as used
   - Parent automatically logged in
   - Redirected to dashboard

**For Admins/Teachers (Created by Super Admin/School Admin):**

Same flow as parents - receive SMS with setup link, create password, login.

---

### 3.6 Password Reset Flow

**Forgot Password:**

1. User clicks "Forgot Password?"
2. Enters email address
3. System sends password reset link via **email**
4. Link valid for 1 hour
5. User clicks link → enters new password → password updated
6. User can login with new password

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

### 3.7 Messaging Rules

* All messages are tenant-scoped
* SMS is used for:
  - Initial account setup (one-time)
  - Critical announcements
  - Fee payment reminders
  - Emergency alerts
* Email is used for:
  - Password reset
  - Non-critical notifications
  - Announcements (secondary channel)
* All messages MUST be logged in message_log table

---

## 4. Student & Parent Model

### 4.1 Parent–Child Relationship Rules

* A parent MAY be linked to multiple children
* A child MAY be linked to parents ONLY as:

  * Father (max 1)
  * Mother (max 1)
  * Guardian (max 1)

These constraints MUST be enforced at database and API level.

---

### 4.2 Admission Model (Immediate Admission)

* There is NO application workflow
* Student creation = immediate admission
* Student status is set to `ACTIVE`
* Parent account created with setup token
* Parent notified via SMS with setup link

---

### 4.3 Student Status Lifecycle

```text
INACTIVE → ACTIVE → COMPLETED
              ↓
        TRANSFERRED_OUT
```

* Students are never deleted

---

## 5. Academic Structure

### 5.1 Academic Calendar

* Academic years defined per school
* Terms have start and end dates
* Terms MUST NOT overlap

### 5.2 Classes & Subjects

* Classes belong to a campus and academic year
* Subjects belong to classes

---

## 6. Teacher Assignment Model

### Canonical Rule

```text
Teacher → Class → Student
```

Teachers are NEVER assigned directly to students.

### Teacher–Class Assignment

```text
teacher_class_assignment
(teacher_id, class_id, subject_id?, start_date, end_date)
```

Assignments are time-bound.

---

## 7. Academic Performance (Mandatory)

### Model

```text
Student × Subject × Term
```

Teachers MAY enter:

* Grade
* Subject-level comments
* Overall student-level comments per term

Rules:

* Manual entry only
* No GPA or calculations
* History preserved

Parents have read-only access.

---

## 8. Communication

### 8.1 Announcements (Event-Based)

* Typed and/or document-based
* Trigger notifications (in-app + SMS for critical)
* Time-bound

### 8.2 Notice Board (Persistent)

* Long-lived reference information
* Typed content and/or documents
* No automatic notifications

Examples:

* School rules
* School menu

---

## 9. Student Document Vault

### Folder Model

```
📁 Parent Folder
📁 Student Folder
📁 School Folder
```

### File Rules (Global)

* Max size: 10 MB
* Types: PDF, DOC/DOCX, XLS/XLSX, JPG/JPEG, PNG
* Virus scanning required
* Access via signed URLs

---

## 10. Finance (Basic MVP)

* Expected fee per class or per student
* Per-student overrides allowed
* Manual payment entry
* Pending balance calculated

Only Admins may edit finance data.

---

## 11. Bulk Operations

* CSV template download
* Validation-only (dry-run) support
* Row-level error reporting
* Automatic parent account creation
* SMS notification with setup links for all new parents

---

## 12. Data Model (Schema Summary)

Key tables include:

* school, campus, user
* student, parent, student_parent
* class, subject
* student_class_history
* teacher_class_assignment
* student_performance, student_term_comment
* student_document
* announcement, notice_board_item
* fee, payment_history
* message_log
* **account_setup_token** (for first-time password setup)
* **password_reset_token** (for password reset)

All constraints defined in the Data Model Specification apply.

---

## 13. State Machines

### Student Lifecycle

```text
INACTIVE → ACTIVE → COMPLETED
              ↓
        TRANSFERRED_OUT
```

### Class Assignment

```text
UNASSIGNED → ASSIGNED → CHANGED
```

### Teacher Assignment

```text
UNASSIGNED → ASSIGNED → UPDATED
```

### Performance Entry

```text
NOT_ENTERED → ENTERED → UPDATED
```

### Account Setup Token Lifecycle (New)

```text
GENERATED → SENT → USED
              ↓
          EXPIRED
```

### Password Reset Token Lifecycle (New)

```text
GENERATED → SENT → USED
              ↓
          EXPIRED
```

---

## 14. API Specification (Summary)

* Base path: `/api/v1`
* RESTful, JSON only
* Token-based authentication (JWT)

Key endpoint groups:

* Authentication (email + password)
* Users & identity
* Students & parents
* Classes & assignments
* Academic performance
* Documents
* Announcements & notice board
* Finance
* Bulk operations

All APIs MUST enforce:

* Tenant isolation
* Role-based access
* State validation

---

## 15. Authentication Endpoints

### 15.1 Login

**POST** `/auth/login`

Request:
```json
{
  "email": "john.doe@example.com",
  "password": "MySecurePass123!",
  "remember_me": false
}
```

Response (200):
```json
{
  "access_token": "jwt_token",
  "refresh_token": "refresh_jwt_token",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "email": "john.doe@example.com",
    "phone_number": "+254712345678",
    "school_id": "uuid",
    "role": "PARENT",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Business Logic:**
1. Validate email format
2. Check rate limit (5 attempts per 15 minutes per email)
3. Find user by email in school context
4. Verify password hash with bcrypt
5. Generate JWT access token (24h expiry)
6. Generate refresh token (30d expiry if remember_me, else 24h)
7. Log successful login
8. Return tokens and user details

---

### 15.2 Setup Account (First Time)

**POST** `/auth/setup-account`

Request:
```json
{
  "token": "setup_token_from_sms",
  "password": "MySecurePass123!",
  "password_confirmation": "MySecurePass123!"
}
```

Response (200):
```json
{
  "access_token": "jwt_token",
  "refresh_token": "refresh_jwt_token",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "email": "john.doe@example.com",
    "phone_number": "+254712345678",
    "school_id": "uuid",
    "role": "PARENT",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Business Logic:**
1. Validate token exists and not expired (< 7 days old)
2. Validate token not already used
3. Validate password meets requirements
4. Validate passwords match
5. Hash password with bcrypt (cost: 12)
6. Update user password_hash
7. Mark token as used
8. Generate JWT tokens
9. Auto-login user

---

### 15.3 Request Password Reset

**POST** `/auth/request-password-reset`

Request:
```json
{
  "email": "john.doe@example.com"
}
```

Response (200):
```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Business Logic:**
1. Validate email format
2. Check rate limit (3 requests per hour per email)
3. Find user by email (silent fail if not found - security)
4. Generate secure reset token (valid 1 hour)
5. Send email with reset link
6. Log in message_log
7. Always return success (prevent email enumeration)

---

### 15.4 Reset Password

**POST** `/auth/reset-password`

Request:
```json
{
  "token": "reset_token_from_email",
  "password": "MyNewSecurePass123!",
  "password_confirmation": "MyNewSecurePass123!"
}
```

Response (200):
```json
{
  "message": "Password reset successfully. You can now login with your new password."
}
```

**Business Logic:**
1. Validate token exists and not expired (< 1 hour old)
2. Validate token not already used
3. Validate password meets requirements
4. Validate passwords match
5. Hash new password with bcrypt
6. Update user password_hash
7. Mark token as used
8. Revoke all existing refresh tokens (force re-login everywhere)
9. Log password change event

---

### 15.5 Refresh Token

**POST** `/auth/refresh`

Request:
```json
{
  "refresh_token": "refresh_jwt_token"
}
```

Response (200):
```json
{
  "access_token": "new_jwt_token",
  "expires_in": 86400
}
```

---

### 15.6 Logout

**POST** `/auth/logout`

Request:
```json
{
  "refresh_token": "refresh_jwt_token"
}
```

Response (200):
```json
{
  "message": "Logged out successfully"
}
```

**Business Logic:**
1. Revoke refresh token (add to blacklist or mark as revoked)
2. Access token will naturally expire

---

### 15.7 Change Password (Authenticated)

**POST** `/auth/change-password`

Request:
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewSecurePass123!",
  "new_password_confirmation": "NewSecurePass123!"
}
```

Response (200):
```json
{
  "message": "Password changed successfully. Please login again."
}
```

**Business Logic:**
1. Verify current_password is correct
2. Validate new password meets requirements
3. Validate new password != old password
4. Hash new password
5. Update password_hash
6. Revoke all refresh tokens (force re-login everywhere)
7. Log password change

---

## 16. Error Handling (Authoritative)

### Error Response Format

```json
{
  "error_code": "ERROR_CODE",
  "message": "Human-readable explanation",
  "recovery": "Suggested corrective action"
}
```

### Error Categories

#### Authentication Errors (401)

* INVALID_CREDENTIALS - Wrong email or password
* AUTH_TOKEN_EXPIRED - JWT token expired
* AUTH_TOKEN_INVALID - JWT token malformed or invalid signature
* AUTH_TOKEN_REVOKED - Token has been revoked
* ACCOUNT_INACTIVE - User account is deactivated

#### Setup/Reset Token Errors (400)

* INVALID_TOKEN - Token not found or malformed
* TOKEN_EXPIRED - Setup/reset token expired
* TOKEN_ALREADY_USED - Token has already been used
* PASSWORDS_DO_NOT_MATCH - Password confirmation doesn't match

#### Password Validation Errors (400)

* INVALID_PASSWORD_FORMAT - Password doesn't meet requirements
* PASSWORD_TOO_WEAK - Password is common or easily guessed

#### Rate Limiting Errors (429)

* RATE_LIMIT_EXCEEDED - Too many login attempts
* TOO_MANY_RESET_REQUESTS - Too many password reset requests

#### Validation Errors (400)

* INVALID_EMAIL - Email format invalid
* INVALID_PHONE_NUMBER - Phone number format invalid
* DUPLICATE_PARENT_ROLE - Student already has this parent role
* INVALID_FILE_TYPE - File type not allowed
* FILE_TOO_LARGE - File exceeds size limit

#### Authorization Errors (403)

* FORBIDDEN_ACTION - User doesn't have permission

#### State Errors (409)

* INVALID_STATE_TRANSITION - Cannot transition to requested state
* DUPLICATE_EMAIL - Email already exists in school
* DUPLICATE_PHONE_NUMBER - Phone already exists in school

#### System Errors (500)

* INTERNAL_ERROR - Unexpected server error
* SMS_DELIVERY_FAILED - SMS failed to send
* EMAIL_DELIVERY_FAILED - Email failed to send

---

## 17. Non-Functional Requirements

* **Performance:** < 500ms (95th percentile)
* **Availability:** 99.5% uptime SLA
* **Scalability:** 100 schools, up to 50,000 students per school
* **Security:** 
  - Encryption at rest and in transit
  - Passwords hashed with bcrypt (cost factor 12)
  - JWT tokens signed with strong secret key (256-bit)
  - HTTPS only in production
* **SMS Delivery:** < 30 seconds for critical messages
* **Email Delivery:** < 2 minutes for transactional emails

---

## 18. Explicit Non-Goals (MVP)

* Parent self-application
* Transport management
* Payroll
* Full accounting
* Exams & automated grading
* Chat systems
* Payment gateways
* Social login (Google, Facebook, etc.)
* Two-factor authentication (2FA)
* Biometric authentication
* Magic link authentication

---

## 19. Security Considerations

### Password Security

* Passwords hashed with bcrypt (cost factor: 12)
* Minimum password requirements enforced
* Cannot reuse last 3 passwords (future enhancement)
* Password reset tokens expire after 1 hour
* Account setup tokens expire after 7 days

### Session Security

* JWT tokens signed with HS256 algorithm
* Access tokens expire after 24 hours
* Refresh tokens can be revoked immediately
* Tokens include: user_id, school_id, role, expiry
* Tokens validated on every API request

### Rate Limiting

* Login attempts: 5 per 15 minutes per email
* Password reset: 3 per hour per email
* Account setup: Token is single-use
* Failed attempts logged for monitoring

### Token Management

* Setup tokens: One-time use, 7-day expiry
* Reset tokens: One-time use, 1-hour expiry
* Tokens stored hashed in database
* Used tokens marked and cannot be reused

---

## 20. Email & SMS Strategy

### SMS Usage (Selective)

SMS is used ONLY for:
1. **Account setup** (one-time per user)
2. **Critical announcements** (emergency, school closure)
3. **Fee payment reminders** (approaching deadline)
4. **Emergency alerts** (pick up child early, etc.)

### Email Usage (Primary)

Email is used for:
1. **Password reset** (free, reliable)
2. **Regular announcements** (term opening, events)
3. **Performance reports** (end of term)
4. **General notifications** (non-urgent)

### Cost Optimization

* SMS budget: ~5 SMS per parent per month
* Estimated cost: 50,000 parents × 5 SMS × $0.02 = **$5,000/month**
* Email: Unlimited (using SendGrid/AWS SES free tier)

---

END OF UNIFIED MASTER ENGINEERING SPECIFICATION