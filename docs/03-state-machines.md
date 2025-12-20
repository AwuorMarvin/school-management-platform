# School Management Platform

## State Machine Specifications

---

## 1. Student Lifecycle State Machine

### States
- **INACTIVE** - Student created but not yet active
- **ACTIVE** - Currently enrolled student
- **COMPLETED** - Graduated/completed studies
- **TRANSFERRED_OUT** - Left school (transferred elsewhere)

### State Diagram
```text
INACTIVE → ACTIVE → COMPLETED
              ↓
        TRANSFERRED_OUT
```

### Allowed Transitions

| From | To | Trigger | Permission |
|------|----|---------|-----------| 
| INACTIVE | ACTIVE | Student enrollment | SCHOOL_ADMIN, CAMPUS_ADMIN |
| ACTIVE | COMPLETED | Graduation | SCHOOL_ADMIN |
| ACTIVE | TRANSFERRED_OUT | Transfer to another school | SCHOOL_ADMIN |
| ACTIVE | INACTIVE | Suspension/temporary leave | SCHOOL_ADMIN |
| INACTIVE | ACTIVE | Reinstatement after suspension | SCHOOL_ADMIN |

### Terminal States
- **COMPLETED** - Cannot transition to any other state
- **TRANSFERRED_OUT** - Cannot transition to any other state

### Forbidden Transitions
- COMPLETED → any state (terminal)
- TRANSFERRED_OUT → any state (terminal)
- Any state → INACTIVE (except from ACTIVE)

### Business Rules
1. Students are NEVER deleted from the system
2. All status changes MUST be logged with timestamp and user who made the change
3. Status transitions MUST follow the allowed paths above
4. Attempting a forbidden transition returns HTTP 409 with error code `INVALID_STATE_TRANSITION`

---

## 2. Class Assignment State Machine

### States
- **UNASSIGNED** - Student not assigned to any class
- **ASSIGNED** - Student has active class assignment
- **CHANGED** - Student moved to different class (previous assignment closed)

### State Diagram
```text
UNASSIGNED → ASSIGNED → CHANGED
                ↓          ↓
              ASSIGNED ← ASSIGNED
```

### Transitions

| From | To | Trigger | Action |
|------|----|---------|---------| 
| UNASSIGNED | ASSIGNED | First class assignment | Create record with end_date = NULL |
| ASSIGNED | CHANGED | Move to different class | Set end_date on current, create new record |
| CHANGED | ASSIGNED | (implicit, same as ASSIGNED) | Student has new active assignment |

### Business Rules
1. A student can have only ONE active class assignment at any time
2. Active assignment is defined by `end_date IS NULL`
3. When assigning to new class:
   - Close current assignment: `SET end_date = new_start_date - 1 day`
   - Create new assignment: `INSERT with start_date = today, end_date = NULL`
4. All historical assignments MUST be preserved in `student_class_history` table
5. Cannot delete class assignments - only close them

### Database Constraint
```sql
-- Only one active assignment per student
CREATE UNIQUE INDEX idx_student_class_active 
ON student_class_history(student_id) 
WHERE end_date IS NULL;
```

---

## 3. Teacher Assignment State Machine

### States
- **UNASSIGNED** - Teacher not assigned to any class
- **ASSIGNED** - Teacher actively teaching a class/subject
- **UPDATED** - Assignment modified (e.g., subject changed)

### State Diagram
```text
UNASSIGNED → ASSIGNED → UPDATED
                ↓          ↓
           ASSIGNED ← ASSIGNED
```

### Transitions

| From | To | Trigger | Action |
|------|----|---------|---------| 
| UNASSIGNED | ASSIGNED | Initial assignment | Create assignment with end_date = NULL |
| ASSIGNED | UNASSIGNED | End assignment | Set end_date = today |
| ASSIGNED | UPDATED | Modify assignment | Close old, create new |

### Business Rules
1. A teacher can be assigned to multiple classes simultaneously
2. A teacher can teach multiple subjects in the same class
3. Assignment must specify:
   - Class (required)
   - Subject (optional - if not specified, teacher is class teacher)
4. Time-bound: assignments have start_date and end_date
5. Active assignment: `end_date IS NULL`
6. To end an assignment: `SET end_date = today`
7. Historical assignments preserved forever

### Teacher Access Rule
Teachers can ONLY access students in classes where they have an **active** assignment:
```sql
-- Teacher can access student if:
SELECT s.* FROM student s
JOIN student_class_history sch ON s.id = sch.student_id
JOIN teacher_class_assignment tca ON sch.class_id = tca.class_id
WHERE tca.teacher_id = :teacher_id
  AND sch.end_date IS NULL  -- Student actively in class
  AND tca.end_date IS NULL  -- Teacher actively assigned
```

---

## 4. Academic Performance Entry State Machine

### States
- **NOT_ENTERED** - No performance record exists
- **ENTERED** - Grade/comment entered for first time
- **UPDATED** - Performance record modified

### State Diagram
```text
NOT_ENTERED → ENTERED → UPDATED
                 ↓          ↓
             ENTERED ← UPDATED
```

### Transitions

| From | To | Trigger | Action |
|------|----|---------|---------| 
| NOT_ENTERED | ENTERED | Teacher enters grade | INSERT performance record |
| ENTERED | UPDATED | Teacher modifies grade | UPDATE performance record |
| UPDATED | UPDATED | Further modifications | UPDATE performance record |

### Business Rules

#### Entry Permissions
1. Only TEACHERS assigned to the class/subject can enter performance
2. SCHOOL_ADMIN and CAMPUS_ADMIN can also enter/modify any performance

#### Validation Rules
1. Student MUST be actively assigned to a class
2. Subject MUST belong to the student's current class
3. Term MUST be valid (exist in system)
4. Teacher MUST be assigned to:
   - The class (if teaching all subjects), OR
   - The specific subject in the class

#### Data Integrity
1. Performance is keyed on: `(student_id, subject_id, term_id)`
2. Composite primary key ensures ONE grade per student per subject per term
3. Updates preserve history via `updated_at` timestamp
4. Original entry is tracked via `entered_by_user_id` and `entered_at`

#### Access Rules

| Role | Can Enter | Can View | Can Update |
|------|-----------|----------|------------|
| Teacher (assigned) | ✅ | ✅ | ✅ |
| Teacher (not assigned) | ❌ | ❌ | ❌ |
| School Admin | ✅ | ✅ | ✅ |
| Campus Admin | ✅ | ✅ | ✅ |
| Parent | ❌ | ✅ (own child only) | ❌ |

### Error Cases

**TEACHER_NOT_ASSIGNED (403)**
```json
{
  "error_code": "TEACHER_NOT_ASSIGNED",
  "message": "You are not assigned to teach this class or subject",
  "details": {
    "teacher_id": "uuid",
    "class_id": "uuid",
    "subject_id": "uuid"
  }
}
```

**STUDENT_NOT_IN_CLASS (400)**
```json
{
  "error_code": "STUDENT_NOT_IN_CLASS",
  "message": "Student is not currently assigned to any class"
}
```

**SUBJECT_NOT_IN_CLASS (400)**
```json
{
  "error_code": "SUBJECT_NOT_IN_CLASS",
  "message": "This subject does not belong to the student's current class"
}
```

---

## 5. User Account State Machine

### States
- **PENDING_SETUP** - Account created, password not yet set
- **ACTIVE** - User can log in and use system
- **INACTIVE** - User cannot log in (account disabled)

### State Diagram
```text
[Creation] → PENDING_SETUP → ACTIVE ⇄ INACTIVE
```

### Transitions

| From | To | Trigger | Permission |
|------|----|---------|-----------| 
| [New] | PENDING_SETUP | Account creation by admin | System |
| PENDING_SETUP | ACTIVE | User completes password setup | System (via setup token) |
| ACTIVE | INACTIVE | Deactivation | SCHOOL_ADMIN |
| INACTIVE | ACTIVE | Reactivation | SCHOOL_ADMIN |

### Business Rules
1. New users created with `password_hash = NULL` (PENDING_SETUP)
2. Setup token generated and sent via SMS
3. User clicks link, sets password → becomes ACTIVE
4. INACTIVE users:
   - Cannot log in (401 error with ACCOUNT_INACTIVE)
   - Existing sessions/tokens are invalidated
   - Data remains visible to admins
5. Reactivation:
   - User can log in immediately with existing password
   - No data is lost

### Setup Token Flow
```text
Admin creates user
    ↓
Generate setup_token (expires 7 days)
    ↓
Send SMS with link
    ↓
User clicks link → enters password
    ↓
Mark token as used (used_at = NOW)
    ↓
Set password_hash
    ↓
User status → ACTIVE
```

---

## 6. Account Setup Token State Machine

### States
- **GENERATED** - Token created, not yet sent
- **SENT** - SMS delivered to user
- **USED** - User completed password setup
- **EXPIRED** - Token validity period passed

### State Diagram
```text
GENERATED → SENT → USED
              ↓
          EXPIRED
```

### Transitions

| From | To | Trigger | Action |
|------|----|---------|---------| 
| GENERATED | SENT | SMS delivery successful | Update status |
| SENT | USED | User sets password | Set used_at timestamp |
| SENT | EXPIRED | 7 days pass | Automatic expiry check |
| GENERATED | EXPIRED | 7 days pass | Automatic expiry check |

### Business Rules
1. Token valid for **7 days** from creation
2. Token is **single-use** (cannot be reused after used_at is set)
3. Token stored as **bcrypt hash** in database
4. Expired tokens cannot be used (even if not used_at)
5. Multiple tokens can exist for same user (e.g., admin resends)
6. Only latest unexpired, unused token is valid

### Validation Logic
```python
def validate_setup_token(token_string, user_id):
    # Find token
    token = find_token_by_hash(hash(token_string))
    
    # Check exists
    if not token:
        raise INVALID_TOKEN
    
    # Check belongs to user
    if token.user_id != user_id:
        raise INVALID_TOKEN
    
    # Check not used
    if token.used_at is not None:
        raise TOKEN_ALREADY_USED
    
    # Check not expired (< 7 days old)
    if now() > token.expires_at:
        raise TOKEN_EXPIRED
    
    return True
```

---

## 7. Password Reset Token State Machine

### States
- **GENERATED** - Token created
- **SENT** - Email delivered to user
- **USED** - User completed password reset
- **EXPIRED** - Token validity period passed

### State Diagram
```text
GENERATED → SENT → USED
              ↓
          EXPIRED
```

### Transitions

| From | To | Trigger | Action |
|------|----|---------|---------| 
| GENERATED | SENT | Email delivery successful | Update status |
| SENT | USED | User resets password | Set used_at timestamp |
| SENT | EXPIRED | 1 hour passes | Automatic expiry check |
| GENERATED | EXPIRED | 1 hour passes | Automatic expiry check |

### Business Rules
1. Token valid for **1 hour** from creation
2. Token is **single-use**
3. Token stored as **bcrypt hash**
4. When password reset successful:
   - Mark token as used
   - Invalidate all other reset tokens for this user
   - Revoke all refresh tokens (force re-login everywhere)
5. Rate limiting: Max 3 reset requests per hour per email

### Validation Logic
```python
def validate_reset_token(token_string):
    # Find token
    token = find_token_by_hash(hash(token_string))
    
    # Check exists
    if not token:
        raise INVALID_TOKEN
    
    # Check not used
    if token.used_at is not None:
        raise TOKEN_ALREADY_USED
    
    # Check not expired (< 1 hour old)
    if now() > token.expires_at:
        raise TOKEN_EXPIRED
    
    return token
```

---

## 8. Refresh Token State Machine

### States
- **ACTIVE** - Token valid and can be used
- **EXPIRED** - Token validity period passed
- **REVOKED** - Token manually revoked (logout, password change)

### State Diagram
```text
GENERATED → ACTIVE → EXPIRED
              ↓
          REVOKED
```

### Transitions

| From | To | Trigger | Action |
|------|----|---------|---------| 
| [New] | ACTIVE | User login successful | Create token |
| ACTIVE | EXPIRED | Time passes | Automatic (30 days) |
| ACTIVE | REVOKED | User logout | Set revoked_at |
| ACTIVE | REVOKED | Password change | Set revoked_at on all user tokens |

### Business Rules
1. Generated on successful login
2. Expires after:
   - **30 days** if "remember me" = true
   - **24 hours** if "remember me" = false
3. Can be revoked:
   - Explicitly (logout)
   - Implicitly (password change revokes ALL user tokens)
4. Used to obtain new access tokens (JWT)
5. One user can have multiple active refresh tokens (different devices)

### Token Refresh Flow
```text
User presents refresh_token
    ↓
Validate not expired (expires_at > now)
    ↓
Validate not revoked (revoked_at IS NULL)
    ↓
Generate new access_token (JWT, 24h expiry)
    ↓
Return new access_token
    ↓
Refresh token remains valid (can be reused until expiry/revoked)
```

---

## 9. Authentication Flow State Machine

### Complete Login Flow

```text
[User Action] → [System State] → [Result]

1. User enters email + password
   ↓
2. Validate credentials
   ↓
3a. Valid → Generate access_token + refresh_token → AUTHENTICATED
3b. Invalid → Increment failed_attempts → UNAUTHENTICATED
   ↓
4. Failed attempts >= 5 → RATE_LIMITED (15 min cooldown)
```

### States
- **UNAUTHENTICATED** - No valid session
- **AUTHENTICATED** - Valid access token
- **TOKEN_EXPIRED** - Access token expired, refresh needed
- **RATE_LIMITED** - Too many failed attempts

### Business Rules

#### Rate Limiting
- **Failed logins:** 5 attempts per 15 minutes per email
- **Password resets:** 3 requests per hour per email
- **Account setup:** No rate limit (one-time use token)

#### Session Duration
- **Access token (JWT):** 24 hours
- **Refresh token:** 24 hours OR 30 days (with "remember me")

#### Token Invalidation
All tokens invalidated when:
1. User explicitly logs out
2. User changes password
3. Admin deactivates account
4. Token naturally expires

---

## 10. Fee Payment State Machine

### States
- **UNPAID** - paid_amount = 0
- **PARTIAL** - 0 < paid_amount < expected_amount
- **PAID** - paid_amount = expected_amount
- **OVERPAID** - paid_amount > expected_amount

### State Diagram
```text
UNPAID → PARTIAL → PAID
           ↓          ↓
      OVERPAID ← OVERPAID
```

### Transitions

| From | To | Trigger | Action |
|------|----|---------|---------| 
| UNPAID | PARTIAL | First payment | Add to paid_amount |
| UNPAID | PAID | Full payment | Set paid_amount = expected_amount |
| PARTIAL | PAID | Remaining payment | Add to paid_amount until = expected_amount |
| PARTIAL | OVERPAID | Payment exceeds | paid_amount > expected_amount |
| PAID | OVERPAID | Additional payment | (generally prevented) |

### Business Rules
1. Payment status is **computed**, not stored:
   ```sql
   CASE 
     WHEN paid_amount = 0 THEN 'UNPAID'
     WHEN paid_amount < expected_amount THEN 'PARTIAL'
     WHEN paid_amount = expected_amount THEN 'PAID'
     WHEN paid_amount > expected_amount THEN 'OVERPAID'
   END AS payment_status
   ```

2. Overpayment prevention:
   - System should warn before accepting payment that would exceed expected
   - Returns HTTP 400 with error code `PAYMENT_EXCEEDS_EXPECTED`

3. Payment history:
   - All payments logged in `payment_history` table
   - Each payment records: amount, date, method, reference number
   - Cannot delete payments (audit trail)

---

## 11. Announcement State Machine

### States
- **PUBLISHED** - Active announcement visible to audience
- **DELETED** - Soft deleted (archived)

### State Diagram (MVP)
```text
[Creation] → PUBLISHED → DELETED
```

### Business Rules
1. Announcements are immediately **PUBLISHED** upon creation
2. Trigger notifications (in-app + SMS for critical)
3. Once published, cannot be unpublished (can only be deleted)
4. Deletion is soft delete (retained in database)
5. Audience targeting is immutable after creation

---

## 12. Notice Board Item State Machine

### States
- **ACTIVE** - Visible to users
- **DELETED** - Soft deleted (archived)

### State Diagram (MVP)
```text
[Creation] → ACTIVE → DELETED
             ↓
         ACTIVE (after update)
```

### Business Rules
1. Notice items are **ACTIVE** upon creation
2. Do NOT trigger notifications
3. Can be updated multiple times (persistent content)
4. Deletion is soft delete
5. No automatic expiry (unlike announcements)

---

## Summary: State Machine Enforcement

All state machines MUST be enforced:
1. **In database** - via constraints where possible
2. **In application** - via validation logic
3. **In API** - proper error codes for invalid transitions

### Error Response for Invalid State Transitions
```json
{
  "error_code": "INVALID_STATE_TRANSITION",
  "message": "Cannot transition from {current_state} to {requested_state}",
  "recovery": "Valid transitions from {current_state} are: {allowed_states}",
  "details": {
    "current_state": "COMPLETED",
    "requested_state": "ACTIVE",
    "allowed_transitions": []
  }
}
```

### Error Response for Token Issues
```json
{
  "error_code": "TOKEN_EXPIRED",
  "message": "This setup link has expired",
  "recovery": "Contact your school administrator to receive a new setup link",
  "details": {
    "token_type": "account_setup",
    "expired_at": "2024-01-22T10:30:00Z"
  }
}
```

---

END OF STATE MACHINE SPECIFICATIONS