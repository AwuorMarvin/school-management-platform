# School Management Platform

## Data Model Specification (Complete Schema)

---

## 1. Scope & Authority

This document defines the **complete MVP database schema**, relationships, constraints, and invariants.
It is fully aligned with the **Master Engineering Specification (MVP)**.

**Authentication Model:** Email + Password (bcrypt hashed)

---

## 2. Core Multi-Tenant Entities

### 2.1 school

```sql
CREATE TABLE school (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  subdomain VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name),
  UNIQUE(subdomain)
);
```

**Indexes:**
* PRIMARY KEY on id
* UNIQUE on name
* UNIQUE on subdomain

---

### 2.2 campus

```sql
CREATE TABLE campus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, name)
);

CREATE INDEX idx_campus_school ON campus(school_id);
```

**Constraints:**
* UNIQUE(school_id, name)

**Indexes:**
* PRIMARY KEY on id
* INDEX on school_id

---

## 3. Users & Identity

### 3.1 user

```sql
CREATE TABLE "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL CHECK (phone_number LIKE '+254%'),
  password_hash TEXT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'CAMPUS_ADMIN', 'TEACHER', 'PARENT')),
  campus_id UUID REFERENCES campus(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  last_login_at TIMESTAMP,
  UNIQUE(school_id, email),
  UNIQUE(school_id, phone_number)
);

CREATE INDEX idx_user_school ON "user"(school_id);
CREATE INDEX idx_user_role ON "user"(role);
CREATE INDEX idx_user_email ON "user"(email);
```

**Constraints:**
* UNIQUE(school_id, email)
* UNIQUE(school_id, phone_number)
* phone_number CHECK: must start with '+254'
* password_hash: NULL until account setup complete

**Indexes:**
* PRIMARY KEY on id
* INDEX on school_id
* INDEX on role
* INDEX on email

**Notes:**
* password_hash is bcrypt hashed (cost factor: 12)
* password_hash is NULL for newly created users until they complete account setup
* email is unique per school (not globally unique)
* phone_number is unique per school (not globally unique)

---

### 3.2 account_setup_token

```sql
CREATE TABLE account_setup_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_hash)
);

CREATE INDEX idx_account_setup_token_user ON account_setup_token(user_id);
CREATE INDEX idx_account_setup_token_expires ON account_setup_token(expires_at);
```

**Purpose:** One-time tokens for first-time password setup

**Constraints:**
* token_hash stored as bcrypt hash (not plain text)
* expires_at: 7 days from creation
* used_at: NULL until used, then timestamp of use
* Token can only be used once

**Business Rules:**
1. Generated when admin creates new user
2. Sent to user via SMS
3. Valid for 7 days
4. Single use (marked with used_at after successful setup)
5. Cannot be reused even if within expiry period

---

### 3.3 password_reset_token

```sql
CREATE TABLE password_reset_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_hash)
);

CREATE INDEX idx_password_reset_token_user ON password_reset_token(user_id);
CREATE INDEX idx_password_reset_token_expires ON password_reset_token(expires_at);
```

**Purpose:** One-time tokens for password reset

**Constraints:**
* token_hash stored as bcrypt hash
* expires_at: 1 hour from creation
* used_at: NULL until used
* Token can only be used once

**Business Rules:**
1. Generated when user requests password reset
2. Sent to user via email
3. Valid for 1 hour
4. Single use
5. All existing tokens for user invalidated after successful password change

---

### 3.4 refresh_token

```sql
CREATE TABLE refresh_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_hash)
);

CREATE INDEX idx_refresh_token_user ON refresh_token(user_id);
CREATE INDEX idx_refresh_token_expires ON refresh_token(expires_at);
```

**Purpose:** Long-lived tokens for session refresh

**Constraints:**
* token_hash stored as bcrypt hash
* expires_at: 30 days from creation (with "remember me")
* expires_at: 24 hours from creation (without "remember me")
* revoked_at: NULL if active, timestamp if revoked

**Business Rules:**
1. Generated on successful login
2. Used to obtain new access tokens
3. Can be revoked (logout, password change)
4. Expired tokens cleaned up periodically

---

## 4. Student & Parent Model

### 4.1 student

```sql
CREATE TABLE student (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  campus_id UUID NOT NULL REFERENCES campus(id),
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('INACTIVE', 'ACTIVE', 'COMPLETED', 'TRANSFERRED_OUT')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_student_school ON student(school_id);
CREATE INDEX idx_student_campus ON student(campus_id);
CREATE INDEX idx_student_status ON student(status);
```

**Indexes:**
* PRIMARY KEY on id
* INDEX on school_id
* INDEX on campus_id
* INDEX on status

---

### 4.2 parent

```sql
CREATE TABLE parent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id_number VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_parent_user ON parent(user_id);
```

**Constraints:**
* UNIQUE on user_id (one-to-one relationship with user)

**Notes:**
* id_number is National ID or Passport number
* Parent record created automatically when user with role=PARENT is created

---

### 4.3 student_parent

```sql
CREATE TABLE student_parent (
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parent(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('FATHER', 'MOTHER', 'GUARDIAN')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(student_id, role)
);

CREATE INDEX idx_student_parent_student ON student_parent(student_id);
CREATE INDEX idx_student_parent_parent ON student_parent(parent_id);
```

**Constraints:**
* PRIMARY KEY(student_id, role) - ensures one parent per role per student
* A parent can be linked to multiple students
* A student can have max 3 parents (one of each role)

---

## 5. Academic Structure

### 5.1 academic_year

```sql
CREATE TABLE academic_year (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (start_date < end_date),
  UNIQUE(school_id, name)
);

CREATE INDEX idx_academic_year_school ON academic_year(school_id);
```

---

### 5.2 term

```sql
CREATE TABLE term (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_year(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (start_date < end_date)
);

CREATE INDEX idx_term_academic_year ON term(academic_year_id);
```

**Business Rule:**
* Terms within same academic year MUST NOT overlap

---

### 5.3 class

```sql
CREATE TABLE class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES campus(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_year(id),
  name VARCHAR(100) NOT NULL,
  capacity INTEGER CHECK (capacity > 0 AND capacity <= 100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campus_id, academic_year_id, name)
);

CREATE INDEX idx_class_campus ON class(campus_id);
CREATE INDEX idx_class_academic_year ON class(academic_year_id);
```

---

### 5.4 subject

```sql
CREATE TABLE subject (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES class(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(20),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subject_class ON subject(class_id);
```

---

## 6. Class & Teacher Assignment

### 6.1 student_class_history

```sql
CREATE TABLE student_class_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES class(id),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_student_class_history_student ON student_class_history(student_id);
CREATE INDEX idx_student_class_history_class ON student_class_history(class_id);
CREATE UNIQUE INDEX idx_student_class_history_active ON student_class_history(student_id) WHERE end_date IS NULL;
```

**Business Rule:**
* Only one active assignment per student (end_date IS NULL)
* Enforced by unique index

---

### 6.2 teacher_class_assignment

```sql
CREATE TABLE teacher_class_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES class(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subject(id),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teacher_class_assignment_teacher ON teacher_class_assignment(teacher_id);
CREATE INDEX idx_teacher_class_assignment_class ON teacher_class_assignment(class_id);
CREATE INDEX idx_teacher_class_assignment_active ON teacher_class_assignment(teacher_id, class_id) WHERE end_date IS NULL;
```

---

## 7. Academic Performance

### 7.1 student_performance

```sql
CREATE TABLE student_performance (
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subject(id),
  term_id UUID NOT NULL REFERENCES term(id),
  grade VARCHAR(10),
  subject_comment TEXT,
  entered_by_user_id UUID NOT NULL REFERENCES "user"(id),
  entered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  PRIMARY KEY(student_id, subject_id, term_id)
);

CREATE INDEX idx_student_performance_student ON student_performance(student_id);
CREATE INDEX idx_student_performance_subject ON student_performance(subject_id);
CREATE INDEX idx_student_performance_term ON student_performance(term_id);
```

**Constraints:**
* PRIMARY KEY(student_id, subject_id, term_id) - one grade per student per subject per term

---

### 7.2 student_term_comment

```sql
CREATE TABLE student_term_comment (
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES term(id),
  comment TEXT NOT NULL,
  entered_by_user_id UUID NOT NULL REFERENCES "user"(id),
  entered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  PRIMARY KEY(student_id, term_id)
);

CREATE INDEX idx_student_term_comment_student ON student_term_comment(student_id);
CREATE INDEX idx_student_term_comment_term ON student_term_comment(term_id);
```

---

## 8. Documents

### 8.1 student_document

```sql
CREATE TABLE student_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  folder VARCHAR(20) NOT NULL CHECK (folder IN ('PARENT', 'STUDENT', 'SCHOOL')),
  document_type VARCHAR(200) NOT NULL,
  filename VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by_user_id UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_student_document_student ON student_document(student_id);
CREATE INDEX idx_student_document_folder ON student_document(student_id, folder);
```

---

## 9. Communication

### 9.1 announcement

```sql
CREATE TABLE announcement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  title VARCHAR(500),
  body TEXT,
  audience VARCHAR(20) NOT NULL CHECK (audience IN ('PARENTS', 'TEACHERS', 'BOTH')),
  created_by_user_id UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_announcement_school ON announcement(school_id);
CREATE INDEX idx_announcement_audience ON announcement(school_id, audience);
CREATE INDEX idx_announcement_created_at ON announcement(created_at DESC);
```

---

### 9.2 announcement_attachment

```sql
CREATE TABLE announcement_attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcement(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_announcement_attachment_announcement ON announcement_attachment(announcement_id);
```

---

### 9.3 notice_board_item

```sql
CREATE TABLE notice_board_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  body TEXT,
  audience VARCHAR(20) NOT NULL CHECK (audience IN ('PARENTS', 'TEACHERS', 'BOTH')),
  created_by_user_id UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_notice_board_item_school ON notice_board_item(school_id);
CREATE INDEX idx_notice_board_item_audience ON notice_board_item(school_id, audience);
```

---

### 9.4 notice_board_attachment

```sql
CREATE TABLE notice_board_attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_board_item_id UUID NOT NULL REFERENCES notice_board_item(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notice_board_attachment_item ON notice_board_attachment(notice_board_item_id);
```

---

## 10. Finance

### 10.1 fee

```sql
CREATE TABLE fee (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES term(id),
  expected_amount DECIMAL(10,2) NOT NULL CHECK (expected_amount >= 0),
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(student_id, term_id)
);

CREATE INDEX idx_fee_student ON fee(student_id);
CREATE INDEX idx_fee_term ON fee(term_id);
```

---

### 10.2 payment_history

```sql
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id UUID NOT NULL REFERENCES fee(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  payment_method VARCHAR(100),
  reference_number VARCHAR(100),
  recorded_by_user_id UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_history_fee ON payment_history(fee_id);
CREATE INDEX idx_payment_history_date ON payment_history(payment_date DESC);
```

---

## 11. Messaging Log

### 11.1 message_log

```sql
CREATE TABLE message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('SMS', 'EMAIL', 'IN_APP')),
  message_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED')),
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  error_message TEXT
);

CREATE INDEX idx_message_log_school ON message_log(school_id);
CREATE INDEX idx_message_log_user ON message_log(user_id);
CREATE INDEX idx_message_log_sent_at ON message_log(sent_at DESC);
CREATE INDEX idx_message_log_type ON message_log(message_type);
```

**Message Types:**
* ACCOUNT_SETUP - Initial account creation
* PASSWORD_RESET - Password reset request
* ANNOUNCEMENT - School announcement
* FEE_REMINDER - Fee payment reminder
* EMERGENCY - Emergency alert

---

## 12. Summary: All Tables

1. **school** - School tenants
2. **campus** - School campuses
3. **user** - All users (admins, teachers, parents)
4. **account_setup_token** - First-time password setup tokens
5. **password_reset_token** - Password reset tokens
6. **refresh_token** - Session refresh tokens
7. **student** - Student records
8. **parent** - Parent records (extends user)
9. **student_parent** - Parent-student relationships
10. **academic_year** - Academic years
11. **term** - Academic terms
12. **class** - Classes
13. **subject** - Subjects per class
14. **student_class_history** - Student class assignments
15. **teacher_class_assignment** - Teacher assignments
16. **student_performance** - Student grades
17. **student_term_comment** - Overall term comments
18. **student_document** - Document vault
19. **announcement** - Time-bound announcements
20. **announcement_attachment** - Announcement files
21. **notice_board_item** - Persistent notices
22. **notice_board_attachment** - Notice files
23. **fee** - Fee tracking
24. **payment_history** - Payment records
25. **message_log** - All sent messages

**Total: 25 tables**

---

## 13. Key Relationships Summary

```
school (1) ──→ (N) campus
school (1) ──→ (N) user
campus (1) ──→ (N) student
campus (1) ──→ (N) class

user (1) ──→ (1) parent
student (N) ←→ (N) parent (via student_parent)

academic_year (1) ──→ (N) term
academic_year (1) ──→ (N) class
class (1) ──→ (N) subject

student (1) ──→ (N) student_class_history
class (1) ──→ (N) student_class_history

teacher (user) (1) ──→ (N) teacher_class_assignment
class (1) ──→ (N) teacher_class_assignment

student (1) ──→ (N) student_performance
subject (1) ──→ (N) student_performance
term (1) ──→ (N) student_performance

student (1) ──→ (N) student_document
student (1) ──→ (N) fee
term (1) ──→ (N) fee

school (1) ──→ (N) announcement
school (1) ──→ (N) notice_board_item
school (1) ──→ (N) message_log
```

---

END OF DATA MODEL SPECIFICATION