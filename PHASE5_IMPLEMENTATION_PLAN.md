# Phase 5: Communication - Implementation Plan

**Status:** 🎯 Ready to Start  
**Priority:** High (Next in MVP Minimum Operational Loop)  
**Estimated Time:** 1-2 weeks

---

## 📋 Overview

Phase 5 implements the Communication module, enabling schools to:
- Send time-bound announcements to parents and/or teachers
- Maintain persistent notice board items (school rules, menus, etc.)
- Attach files to announcements and notice board items
- Filter content by audience (PARENTS, TEACHERS, BOTH)

**Note:** SMS notifications for announcements will be implemented in Phase 9 (SMS Integration). For now, announcements will be created and stored, but notifications will be queued for later implementation.

---

## ✅ Prerequisites

- [x] Phase 1-4 Complete (Student, Parent, Academic Structure, Performance)
- [x] Database models exist (`Announcement`, `NoticeBoardItem`, `AnnouncementAttachment`, `NoticeBoardAttachment`)
- [ ] AWS S3 setup (for file uploads - can use local storage for MVP)
- [ ] File upload service implementation

---

## 🎯 Implementation Tasks

### **Task 1: File Upload Service (Generic Upload Endpoint)**

**Priority:** High (Required for attachments)

#### Backend Implementation

1. **Create Upload Schema** (`backend/app/schemas/upload.py`)
   - `UploadPurpose` enum: `ANNOUNCEMENT`, `NOTICE_BOARD`, `DOCUMENT`
   - `UploadRequest` (multipart form validation)
   - `UploadResponse` (file metadata)

2. **Create Upload Endpoint** (`backend/app/api/v1/endpoints/uploads.py`)
   - `POST /api/v1/uploads`
   - Accept multipart/form-data
   - Validate file size (max 10MB)
   - Validate file type (PDF, images, documents)
   - Store file (S3 or local storage for MVP)
   - Return file metadata with ID

3. **File Storage Strategy (MVP)**
   - **Option A:** Local file storage (`backend/uploads/` directory)
   - **Option B:** AWS S3 (if credentials available)
   - Store file metadata in database (new `upload` table or reuse `student_document`)

4. **File Validation**
   - Max size: 10MB
   - Allowed types: PDF, images (PNG, JPG, JPEG), documents (DOC, DOCX)
   - Virus scanning (optional for MVP, can be added later)

#### Frontend Implementation

1. **Create Upload API Client** (`frontend/src/api/uploads.ts`)
   - `uploadFile(file: File, purpose: UploadPurpose): Promise<UploadResponse>`

2. **Create File Upload Component** (`frontend/src/components/FileUpload.tsx`)
   - Drag-and-drop file upload
   - File preview
   - Progress indicator
   - Error handling

**Files to Create:**
- `backend/app/schemas/upload.py`
- `backend/app/api/v1/endpoints/uploads.py`
- `frontend/src/api/uploads.ts`
- `frontend/src/components/FileUpload.tsx`

**Files to Update:**
- `backend/app/api/v1/router.py` (add uploads router)

---

### **Task 2: Announcements Backend**

**Priority:** High

#### 2.1 Create Announcement Schemas (`backend/app/schemas/announcement.py`)

```python
# Required schemas:
- AnnouncementCreate (title, body, audience, attachment_ids)
- AnnouncementUpdate (optional fields)
- AnnouncementResponse (full details with attachments)
- AnnouncementListResponse (paginated list)
- AttachmentResponse (nested in announcement)
```

**Validation Rules:**
- At least one of `title` or `body` must be provided
- `title`: Optional, max 500 chars
- `body`: Optional, max 5000 chars
- `audience`: Required, enum (PARENTS, TEACHERS, BOTH)
- `attachment_ids`: Optional array of UUIDs

#### 2.2 Create Announcement Endpoints (`backend/app/api/v1/endpoints/announcements.py`)

**Endpoints to Implement:**

1. **POST `/api/v1/announcements`**
   - Permission: `SCHOOL_ADMIN`, `CAMPUS_ADMIN`
   - Create announcement
   - Link attachments
   - Set `created_by_user_id` from current user
   - **Note:** SMS notifications will be queued (implement in Phase 9)

2. **GET `/api/v1/announcements`**
   - Permission: All authenticated users (scope-filtered)
   - Filter by audience based on user role:
     - PARENTS: See `audience = PARENTS` or `BOTH`
     - TEACHERS: See `audience = TEACHERS` or `BOTH`
     - ADMIN: See all
   - Query params: `audience`, `from_date`, `to_date`, `page`, `page_size`
   - Return paginated list

3. **GET `/api/v1/announcements/{announcement_id}`**
   - Permission: All authenticated users (if targets their role)
   - Return full details with attachments
   - Include download URLs for attachments

4. **DELETE `/api/v1/announcements/{announcement_id}`**
   - Permission: `SCHOOL_ADMIN`, `CAMPUS_ADMIN` (if they created it)
   - Soft delete (if implemented) or hard delete

**Business Logic:**
- Tenant isolation (filter by `school_id`)
- Role-based audience filtering
- Attachment validation (must exist and belong to school)
- Date filtering (ISO format)

**Files to Create:**
- `backend/app/schemas/announcement.py`
- `backend/app/api/v1/endpoints/announcements.py`

**Files to Update:**
- `backend/app/api/v1/router.py` (add announcements router)

---

### **Task 3: Notice Board Backend**

**Priority:** High

#### 3.1 Create Notice Board Schemas (`backend/app/schemas/notice_board.py`)

```python
# Required schemas:
- NoticeBoardItemCreate (title, body, audience, attachment_ids)
- NoticeBoardItemUpdate (title, body, audience, attachment_ids)
- NoticeBoardItemResponse (full details with attachments)
- NoticeBoardListResponse (paginated list)
```

**Validation Rules:**
- `title`: Required, 1-500 chars
- `body`: Optional, max 10000 chars
- `audience`: Required, enum (PARENTS, TEACHERS, BOTH)
- `attachment_ids`: Optional array of UUIDs

#### 3.2 Create Notice Board Endpoints (`backend/app/api/v1/endpoints/notice_board.py`)

**Endpoints to Implement:**

1. **POST `/api/v1/notice-board`**
   - Permission: `SCHOOL_ADMIN`, `CAMPUS_ADMIN`
   - Create notice board item
   - Link attachments
   - Set `created_by_user_id` from current user
   - **Note:** No automatic notifications (unlike announcements)

2. **GET `/api/v1/notice-board`**
   - Permission: All authenticated users (scope-filtered by audience)
   - Query params: `audience`, `search` (title/body), `page`, `page_size`
   - Return paginated list

3. **GET `/api/v1/notice-board/{item_id}`**
   - Permission: All authenticated users (if targets their role)
   - Return full details with attachments

4. **PUT `/api/v1/notice-board/{item_id}`**
   - Permission: `SCHOOL_ADMIN`, `CAMPUS_ADMIN`
   - Update notice board item
   - Update attachments if provided

5. **DELETE `/api/v1/notice-board/{item_id}`**
   - Permission: `SCHOOL_ADMIN`, `CAMPUS_ADMIN`
   - Delete notice board item

**Business Logic:**
- Tenant isolation (filter by `school_id`)
- Role-based audience filtering
- Search functionality (title and body)
- Attachment management

**Files to Create:**
- `backend/app/schemas/notice_board.py`
- `backend/app/api/v1/endpoints/notice_board.py`

**Files to Update:**
- `backend/app/api/v1/router.py` (add notice_board router)

---

### **Task 4: Announcements Frontend**

**Priority:** High

#### 4.1 Create Announcements API Client (`frontend/src/api/announcements.ts`)

```typescript
// Required functions:
- list(params): Promise<AnnouncementListResponse>
- get(id): Promise<Announcement>
- create(data): Promise<Announcement>
- delete(id): Promise<void>
```

#### 4.2 Create Announcements Pages

1. **Announcements List Page** (`frontend/src/pages/AnnouncementsPage.tsx`)
   - Display paginated list of announcements
   - Filters: Audience, Date range
   - Search functionality
   - Show: Title, body preview, audience badge, created date, attachment count
   - Actions: View details, Delete (admin only)

2. **Create Announcement Page** (`frontend/src/pages/AnnouncementFormPage.tsx`)
   - Form fields: Title, Body, Audience (radio/select), Attachments
   - File upload component for attachments
   - Validation (at least title or body)
   - Submit button

3. **Announcement Detail Page** (`frontend/src/pages/AnnouncementDetailPage.tsx`)
   - Display full announcement
   - Show attachments with download links
   - Show created by, created date
   - Delete button (admin only, if they created it)

**UI Requirements:**
- Use existing `AppLayout`, `PageHeader`, `ContentCard` components
- Follow design system (semantic colors, spacing)
- Responsive design
- Loading states and error handling

**Files to Create:**
- `frontend/src/api/announcements.ts`
- `frontend/src/pages/AnnouncementsPage.tsx`
- `frontend/src/pages/AnnouncementFormPage.tsx`
- `frontend/src/pages/AnnouncementDetailPage.tsx`

**Files to Update:**
- `frontend/src/App.tsx` (add routes)
- `frontend/src/components/AppLayout.tsx` (add navigation link)

---

### **Task 5: Notice Board Frontend**

**Priority:** High

#### 5.1 Create Notice Board API Client (`frontend/src/api/noticeBoard.ts`)

```typescript
// Required functions:
- list(params): Promise<NoticeBoardListResponse>
- get(id): Promise<NoticeBoardItem>
- create(data): Promise<NoticeBoardItem>
- update(id, data): Promise<NoticeBoardItem>
- delete(id): Promise<void>
```

#### 5.2 Create Notice Board Pages

1. **Notice Board List Page** (`frontend/src/pages/NoticeBoardPage.tsx`)
   - Display paginated list of notice board items
   - Filters: Audience, Search
   - Show: Title, body preview, audience badge, created/updated date
   - Actions: View details, Edit (admin), Delete (admin)

2. **Create/Edit Notice Board Page** (`frontend/src/pages/NoticeBoardFormPage.tsx`)
   - Form fields: Title (required), Body, Audience, Attachments
   - File upload component
   - Support both create and edit modes
   - Validation

3. **Notice Board Detail Page** (`frontend/src/pages/NoticeBoardDetailPage.tsx`)
   - Display full notice board item
   - Show attachments with download links
   - Show created by, created/updated dates
   - Edit button (admin only)
   - Delete button (admin only)

**UI Requirements:**
- Same as announcements (consistent design)
- Use existing components
- Responsive design

**Files to Create:**
- `frontend/src/api/noticeBoard.ts`
- `frontend/src/pages/NoticeBoardPage.tsx`
- `frontend/src/pages/NoticeBoardFormPage.tsx`
- `frontend/src/pages/NoticeBoardDetailPage.tsx`

**Files to Update:**
- `frontend/src/App.tsx` (add routes)
- `frontend/src/components/AppLayout.tsx` (add navigation link)

---

## 📝 Implementation Checklist

### Backend
- [ ] **Task 1:** File upload service
  - [ ] Create upload schema
  - [ ] Create upload endpoint
  - [ ] Implement file storage (local or S3)
  - [ ] Add file validation

- [ ] **Task 2:** Announcements backend
  - [ ] Create announcement schemas
  - [ ] Implement POST `/announcements`
  - [ ] Implement GET `/announcements` (list with filters)
  - [ ] Implement GET `/announcements/{id}`
  - [ ] Implement DELETE `/announcements/{id}`
  - [ ] Add tenant isolation
  - [ ] Add role-based audience filtering

- [ ] **Task 3:** Notice Board backend
  - [ ] Create notice board schemas
  - [ ] Implement POST `/notice-board`
  - [ ] Implement GET `/notice-board` (list with search)
  - [ ] Implement GET `/notice-board/{id}`
  - [ ] Implement PUT `/notice-board/{id}`
  - [ ] Implement DELETE `/notice-board/{id}`
  - [ ] Add tenant isolation
  - [ ] Add role-based audience filtering

### Frontend
- [ ] **Task 4:** Announcements frontend
  - [ ] Create announcements API client
  - [ ] Create announcements list page
  - [ ] Create announcement form page
  - [ ] Create announcement detail page
  - [ ] Add routes
  - [ ] Add navigation links

- [ ] **Task 5:** Notice Board frontend
  - [ ] Create notice board API client
  - [ ] Create notice board list page
  - [ ] Create notice board form page
  - [ ] Create notice board detail page
  - [ ] Add routes
  - [ ] Add navigation links

- [ ] **Task 1 (Frontend):** File upload component
  - [ ] Create file upload component
  - [ ] Integrate with announcements form
  - [ ] Integrate with notice board form

### Testing
- [ ] Test file upload (various file types, sizes)
- [ ] Test announcement creation (with/without attachments)
- [ ] Test announcement filtering by audience
- [ ] Test notice board CRUD operations
- [ ] Test role-based access control
- [ ] Test tenant isolation

---

## 🔍 Key Implementation Details

### File Storage (MVP)

For MVP, use **local file storage**:

```python
# backend/app/core/storage.py
import os
from pathlib import Path

UPLOAD_DIR = Path("backend/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

def save_file(file_content: bytes, filename: str) -> str:
    """Save file locally and return file path."""
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(file_content)
    return str(file_path)
```

**Note:** For production, migrate to S3 in Phase 6 (Document Vault).

### Audience Filtering Logic

```python
# In list endpoints:
if current_user.role == "PARENT":
    query = query.where(
        or_(
            Announcement.audience == "PARENTS",
            Announcement.audience == "BOTH"
        )
    )
elif current_user.role == "TEACHER":
    query = query.where(
        or_(
            Announcement.audience == "TEACHERS",
            Announcement.audience == "BOTH"
        )
    )
# ADMIN sees all (no filter)
```

### Attachment Handling

1. Files are uploaded first via `/uploads` endpoint
2. Upload returns file ID
3. File IDs are passed in `attachment_ids` array when creating announcement/notice board item
4. Backend validates file IDs exist and belong to school
5. Create `AnnouncementAttachment` or `NoticeBoardAttachment` records

### SMS Notifications (Deferred)

For Phase 5, announcements will:
- Create announcement record ✅
- Link attachments ✅
- **Skip SMS notifications** (queue for Phase 9)
- Log message in `message_log` table (optional for MVP)

---

## 🚨 Important Notes

1. **SMS Integration:** Announcement notifications will be implemented in Phase 9. For now, announcements are created and stored, but SMS sending is deferred.

2. **File Storage:** Use local storage for MVP. S3 integration will be added in Phase 6 (Document Vault).

3. **Virus Scanning:** Optional for MVP. Can be added later.

4. **Soft Delete:** Consider implementing soft delete for announcements (add `deleted_at` column) to preserve history.

5. **Audience Filtering:** Critical for security - ensure users only see announcements/notice board items intended for their role.

---

## 📚 Reference Documents

- **API Spec:** `docs/01-api-spec.md` (Section 11: Communication, Section 14: Upload Endpoints)
- **Data Model:** `docs/02-data-model.md` (Announcement, NoticeBoardItem tables)
- **Existing Models:** 
  - `backend/app/models/announcement.py`
  - `backend/app/models/notice_board_item.py`
  - `backend/app/models/announcement_attachment.py`
  - `backend/app/models/notice_board_attachment.py`

---

## ✅ Definition of Done

Phase 5 is complete when:

1. ✅ Admins can create announcements with attachments
2. ✅ Admins can create/update/delete notice board items
3. ✅ All users can view announcements/notice board items (filtered by audience)
4. ✅ File upload works for attachments
5. ✅ All endpoints enforce tenant isolation
6. ✅ All endpoints enforce role-based access control
7. ✅ Frontend pages follow design system
8. ✅ All error cases from API spec are handled
9. ✅ Basic testing completed

---

## 🎯 Next Steps After Phase 5

- **Phase 6:** Document Vault (S3 integration, student document management)
- **Phase 7:** Finance (Fee management, payment tracking)
- **Phase 9:** SMS Integration (announcement notifications)

---

**Ready to start? Begin with Task 1 (File Upload Service) as it's required for attachments in announcements and notice board items.**
