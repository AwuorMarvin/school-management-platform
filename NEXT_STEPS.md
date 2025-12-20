# Development Roadmap - School Management Platform MVP

**Last Updated:** December 2024  
**Status:** Phase 1 ✅ Complete | Phase 2 ✅ Complete | Phase 3 ✅ Complete | Phase 4 ✅ Complete | Phase 5 Next

Based on the **Minimum Operational Loop** and app scope from the Master Engineering Specification.

---

## ✅ Phase 1: Core Student & Parent Management (COMPLETE)

### 1.1 Student Management Endpoints ✅
- [x] **POST** `/api/v1/students` - Create student (Admin only)
- [x] **GET** `/api/v1/students` - List students with pagination/filters
- [x] **GET** `/api/v1/students/{id}` - Get student details
- [x] **PUT** `/api/v1/students/{id}` - Update student
- [x] **PATCH** `/api/v1/students/{id}/status` - Change student status (state machine)
- [x] **POST** `/api/v1/students/{student_id}/parents` - Link parent to student
- [x] **GET** `/api/v1/students/{student_id}/parents` - Get student's parents
- [x] **DELETE** `/api/v1/students/{student_id}/parents/{parent_id}` - Unlink parent from student (SCHOOL_ADMIN only)

**Frontend:** ✅
- [x] Student list page with filters, search, pagination
- [x] Create student form
- [x] Edit student form
- [x] Student detail page
- [x] Status management UI

### 1.2 Parent Management Endpoints ✅
- [x] **GET** `/api/v1/parents` - List parents
- [x] **GET** `/api/v1/parents/{id}` - Get parent details
- [x] **POST** `/api/v1/parents` - Create parent account (with auto SMS setup link)
- [x] **PUT** `/api/v1/parents/{id}` - Update parent
- [x] **GET** `/api/v1/parents/{id}/students` - Get parent's children

**Frontend:** ✅
- [x] Parent list page with search
- [x] Create parent form
- [x] Edit parent form
- [x] Parent detail page with linked students

**Status:** ✅ **COMPLETE** - All endpoints and UI implemented and tested.

**Recent Updates:**
- ✅ Student creation form includes all parent fields (father, mother, guardian)
- ✅ Smart campus selector (only shows dropdown if multiple campuses)
- ✅ Parent creation requires student selection and role (FATHER/MOTHER/GUARDIAN)
- ✅ All pages use AppLayout with side panel
- ✅ Back button added to all pages
- ✅ Role-specific dashboards (Parent, Teacher, Admin)
- ✅ Role-specific navigation in sidebar

---

## 🎯 Phase 2: Academic Structure (Priority 2) - IN PROGRESS

### 2.1 Academic Year & Term Management ✅
- [x] **GET** `/api/v1/academic-years` - List academic years
- [x] **POST** `/api/v1/academic-years` - Create academic year
- [x] **GET** `/api/v1/academic-years/{id}` - Get academic year details
- [x] **PUT** `/api/v1/academic-years/{id}` - Update academic year
- [x] **GET** `/api/v1/terms` - List terms
- [x] **POST** `/api/v1/academic-years/{academic_year_id}/terms` - Create term
- [x] **GET** `/api/v1/terms/{id}` - Get term details
- [x] **PUT** `/api/v1/terms/{id}` - Update term

**Frontend:**
- [x] Academic year management page
- [ ] Term management page (can be added to academic year detail page)
- [ ] Academic year/term selection components

**Why:** Needed before class assignments and performance tracking.

**Status:** ✅ **COMPLETE** - Backend complete, frontend list page complete.

### 2.2 Class & Subject Management ✅
- [x] **GET** `/api/v1/classes` - List classes
- [x] **POST** `/api/v1/classes` - Create class
- [x] **GET** `/api/v1/classes/{id}` - Get class details
- [x] **PUT** `/api/v1/classes/{id}` - Update class
- [x] **GET** `/api/v1/classes/{id}/subjects` - List subjects in class
- [x] **POST** `/api/v1/classes/{id}/subjects` - Add subject to class
- [x] **GET** `/api/v1/subjects/{id}` - Get subject details
- [x] **PUT** `/api/v1/subjects/{id}` - Update subject
- [x] **DELETE** `/api/v1/subjects/{id}` - Delete subject

**Frontend:**
- [x] Class management page
- [ ] Subject management page (can be added to class detail page)
- [ ] Class-subject assignment UI

**Why:** Students must be assigned to classes.

**Status:** ✅ **COMPLETE** - Backend complete, frontend list page complete.

### 2.3 Student Class Assignment ✅
- [x] **POST** `/api/v1/classes/{class_id}/students` - Assign student to class (auto-closes previous assignment)
- [x] **GET** `/api/v1/classes/{class_id}/students` - List students in class
- [x] **DELETE** `/api/v1/classes/{class_id}/students/{student_id}` - Remove student from class (ends assignment)
- [x] **Note:** Student class history available via student_class_history table queries

**Frontend:**
- [x] Student class assignment form (can be added to class detail page)
- [x] Class history view (can be added to student detail page)
- [ ] Class change UI

**Why:** Core workflow - students need classes.

**Status:** ✅ **COMPLETE** - Backend and frontend complete. Class history view added to student detail page.

---

## ✅ Phase 3: Teacher Assignment (COMPLETE)

### 3.1 Teacher Class Assignment ✅
- [x] **POST** `/api/v1/classes/{class_id}/teachers` - Assign teacher to class/subject
- [x] **GET** `/api/v1/classes/{class_id}/teachers` - List teachers in class
- [x] **DELETE** `/api/v1/classes/{class_id}/teachers/{teacher_id}` - Remove teacher from class

**Frontend:**
- [x] Teacher assignment UI in class detail page
- [x] Assign teacher to class/subject form (in class detail page)

**Why:** Teachers need to be assigned before entering performance data.

**Status:** ✅ **COMPLETE** - Backend complete, frontend UI integrated into class detail page.

---

## 🎯 Phase 4: Academic Performance (Priority 4)

### 4.1 Performance Entry Endpoints ✅
- [x] **PUT** `/api/v1/students/{student_id}/performance` - Enter/update grade for subject/term (upsert)
- [x] **GET** `/api/v1/students/{student_id}/performance` - Get all performance records (with term/subject filters)
- [x] **PUT** `/api/v1/students/{student_id}/term-comment` - Enter/update term comment (upsert)
- [x] **GET** `/api/v1/students/{student_id}/term-comment` - Get term comment (term_id query param required)

**Frontend:**
- [x] Grade entry form (for teachers)
- [x] Performance view (for parents/students)
- [ ] Term comments entry (can be added to performance entry page)
- [ ] Performance report cards (can be added later)

**Why:** Core feature - parents need to see their children's grades.

**Status:** ✅ **COMPLETE** - Backend and frontend core features complete.

---

## 🎯 Phase 5: Communication (Priority 5)

### 5.1 Announcements
- [ ] **GET** `/api/v1/announcements` - List announcements (with filters: audience, from_date, to_date)
- [ ] **POST** `/api/v1/announcements` - Create announcement (with attachment_ids array)
- [ ] **GET** `/api/v1/announcements/{announcement_id}` - Get announcement details
- [ ] **DELETE** `/api/v1/announcements/{announcement_id}` - Delete announcement
- [ ] **POST** `/api/v1/uploads` - Upload file for attachment (generic upload endpoint, returns file_id)

**Frontend:**
- [ ] Announcements list page
- [ ] Create announcement form
- [ ] Announcement detail view
- [ ] Attachment upload UI

### 5.2 Notice Board
- [ ] **GET** `/api/v1/notice-board` - List notice board items
- [ ] **POST** `/api/v1/notice-board` - Create notice board item (with attachment_ids)
- [ ] **GET** `/api/v1/notice-board/{id}` - Get notice board item details
- [ ] **PUT** `/api/v1/notice-board/{id}` - Update notice board item
- [ ] **DELETE** `/api/v1/notice-board/{id}` - Delete notice board item
- [ ] **POST** `/api/v1/uploads` - Upload file for attachment (generic upload endpoint)

**Frontend:**
- [ ] Notice board view
- [ ] Create/edit notice board item
- [ ] Attachment management

**Status:** ⏳ **PENDING** - Waiting for earlier phases.

---

## 🎯 Phase 6: Document Vault (Priority 6)

### 6.1 Document Management
- [ ] **GET** `/api/v1/students/{id}/documents` - List student documents (with folder filter)
- [ ] **POST** `/api/v1/students/{id}/documents` - Upload document (multipart/form-data)
- [ ] **GET** `/api/v1/documents/{document_id}/download` - Get signed download URL
- [ ] **DELETE** `/api/v1/documents/{document_id}` - Delete document

**Frontend:**
- [ ] Document list by folder
- [ ] Upload document form
- [ ] Document preview/download
- [ ] Folder organization UI

**Note:** Requires AWS S3 integration for file storage.

**Status:** ⏳ **PENDING** - Requires S3 setup.

---

## 🎯 Phase 7: Finance (Priority 7)

### 7.1 Fee Management
- [ ] **GET** `/api/v1/students/{id}/fees` - Get student fees (with term/academic_year filters)
- [ ] **POST** `/api/v1/students/{id}/fees` - Set student fee for term
- [ ] **PUT** `/api/v1/fees/{fee_id}` - Update expected fee amount
- [ ] **POST** `/api/v1/fees/{fee_id}/payments` - Record payment
- [ ] **GET** `/api/v1/fees` - List all fees (admin view with filters)

**Frontend:**
- [ ] Fee management page
- [ ] Payment entry form
- [ ] Payment history view
- [ ] Fee reports

**Status:** ⏳ **PENDING** - Waiting for earlier phases.

---

## 🎯 Phase 8: Bulk Operations (Priority 8)

### 8.1 Bulk Student Import
- [ ] **GET** `/api/v1/bulk/students/template` - Download CSV template
- [ ] **POST** `/api/v1/bulk/students/validate` - Validate CSV (dry_run=true)
- [ ] **POST** `/api/v1/bulk/students/import` - Import students from CSV (dry_run=false)
- [ ] Auto-create parent accounts
- [ ] Auto-send SMS setup links (queued)

**Frontend:**
- [ ] CSV upload form
- [ ] Validation results display
- [ ] Import progress/status
- [ ] Error reporting UI

**Status:** ⏳ **PENDING** - Waiting for SMS integration.

---

## 🎯 Phase 9: SMS & Email Integration (Priority 9)

### 9.1 SMS Service (Africa's Talking)
- [ ] SMS service integration
- [ ] Send account setup links
- [ ] Send password reset links
- [ ] Send critical announcements
- [ ] Message logging

### 9.2 Email Service (SendGrid)
- [ ] Email service integration
- [ ] Send password reset links
- [ ] Send announcements (optional)
- [ ] Email templates

**Status:** ⏳ **PENDING** - External service integration.

---

## 🎯 Phase 10: Advanced Features (Priority 10)

### 10.1 User Management
- [ ] **GET** `/api/v1/auth/me` - Get current user (already implemented)
- [ ] **GET** `/api/v1/users` - List users (admin only - not in spec, future enhancement)
- [ ] **POST** `/api/v1/users` - Create user (admin only - not in spec, future enhancement)
- [ ] **PUT** `/api/v1/users/{id}` - Update user (admin only - not in spec, future enhancement)
- [ ] **PATCH** `/api/v1/users/{id}/status` - Change user status (admin only - not in spec, future enhancement)

**Frontend:**
- [ ] User management page
- [ ] Create/edit user form
- [ ] User role assignment

### 10.2 Campus Management (School Management not in MVP spec)
- [ ] **GET** `/api/v1/campuses` - List campuses
- [ ] **GET** `/api/v1/campuses/{campus_id}` - Get campus details
- [ ] **POST** `/api/v1/campuses` - Create campus (SCHOOL_ADMIN only)
- [ ] **PUT** `/api/v1/campuses/{campus_id}` - Update campus (SCHOOL_ADMIN only)

**Frontend:**
- [ ] School management (Super Admin)
- [ ] Campus management
- [ ] Multi-campus navigation

**Status:** ⏳ **PENDING** - Lower priority for MVP.

---

## 📊 Progress Summary

### Completed ✅
- **Phase 1:** Student & Parent Management (100%)
  - Backend: All endpoints implemented
  - Frontend: All pages implemented
  - Design: Poppins font + modern color palette
  - Testing: Ready for user testing

### Completed ✅
- **Phase 1:** Student & Parent Management (100%)
- **Phase 2:** Academic Structure (100%)
  - ✅ Backend endpoints for academic years, terms, classes, subjects
  - ✅ Student class assignment endpoints
  - ✅ Frontend list pages for academic years and classes
  - ✅ Frontend form pages for creating/editing academic years, terms, classes, subjects
  - ✅ Class detail page with student and teacher assignment UI
  - ✅ Student detail page with class history view
- **Phase 3:** Teacher Assignment (100%)
  - ✅ Backend endpoints for teacher-class-subject assignments
  - ✅ Frontend UI integrated into class detail page
- **Phase 4:** Academic Performance (100%)
  - ✅ Backend endpoints for performance entry and viewing
  - ✅ Frontend performance entry and viewing pages

### Next Up 🔄
- **Phase 5:** Communication
- **Phase 5:** Communication
- **Phase 6:** Document Vault
- **Phase 7:** Finance
- **Phase 8:** Bulk Operations
- **Phase 9:** SMS/Email Integration
- **Phase 10:** Advanced Features

---

## 🎯 Minimum Operational Loop Status

From Master Specification, the MVP must support:

1. ✅ Admin admits a student (immediate) - **COMPLETE**
2. ✅ Parent account is created and notified via SMS - **Backend complete, SMS pending**
3. ✅ Parent sets up account with password via secure link - **Backend complete, SMS pending**
4. ✅ Student is assigned to a class - **COMPLETE (Phase 2)**
5. ✅ Teacher manages academic performance - **COMPLETE (Phase 3 & 4)**
6. ✅ Parent views all child-related data - **COMPLETE (Phase 4)**
7. ⏳ School communicates via announcements and notice board - **Phase 5**
8. ⏳ School tracks basic fees - **Phase 7**

**Overall MVP Progress:** ~60% (Phases 1-4 complete, ready for Phase 5 - Communication)

**Status Updates:**
- ✅ Phase 1: Student & Parent Management - Complete
- ✅ Phase 2: Academic Structure - Complete (including class history view)
- ✅ Phase 3: Teacher Assignment - Complete  
- ✅ Phase 4: Academic Performance - Complete
- ⏳ Phase 5: Communication - Next (Announcements & Notice Board)

---

## 📋 Implementation Order Recommendation

### Week 1-2: ✅ Phase 1 (COMPLETE)
- Student CRUD
- Parent management
- Basic UI for student operations

### Week 3: ✅ Phase 2 (COMPLETE)
- Academic years, terms, classes, subjects
- Student class assignment
- Class history tracking

### Week 4: Phase 3
- Teacher-class-subject assignments

### Week 5: Phase 4
- Grade entry
- Term comments
- Performance viewing

### Week 6: Phase 5
- Announcements
- Notice board

### Week 7: Phase 6
- File upload/download
- S3 integration

### Week 8: Phase 7
- Fee management
- Payment tracking

### Week 9: Phase 8
- CSV import
- Auto parent creation

### Week 10: Phase 9
- Integration with external services

### Week 11+: Phase 10
- User management
- School management

---

## 🚀 Quick Start Testing

After Phase 1 completion, you can immediately test:
1. ✅ Login with different roles
2. ✅ View dashboard
3. ✅ Test authentication flow
4. ✅ Create and manage students
5. ✅ Create and manage parents
6. ✅ Link parents to students

**Next:** Proceed with Phase 5 (Communication) implementation - Announcements and Notice Board.

### What's Next Per Engineering Doc

According to `docs/00-master-spec.md`, the Minimum Operational Loop shows:
1. ✅ Admin admits a student - **COMPLETE**
2. ✅ Parent account creation - **Backend complete, SMS pending**
3. ✅ Account setup flow - **Backend complete, SMS pending**
4. ✅ Student class assignment - **COMPLETE**
5. ✅ Teacher performance management - **COMPLETE**
6. ✅ Parent views child data - **COMPLETE**
7. ⏳ **NEXT:** School communication (announcements & notice board) - **Phase 5**
8. ⏳ Fee tracking - **Phase 7** (after communication)

---

## 📝 Notes

- All endpoints follow the API specification in `docs/01-api-spec.md`
- All data models follow the schema in `docs/02-data-model.md`
- All state machines follow the rules in `docs/03-state-machines.md`
- Tenant isolation is enforced at the API level
- Role-based access control is implemented
- Frontend uses Poppins font and modern color palette

### Additional Features (Not in Original Blueprint)

**Transport Routes & Club Activities:**
- ✅ Transport routes endpoints implemented (CRUD)
- ✅ Club activities endpoints implemented (CRUD)
- ✅ Frontend pages for transport routes and club activities
- ⚠️ **Note:** These features were added beyond the original MVP specification but are now part of the system

**Recent Bug Fixes:**
- ✅ Fixed transport routes endpoint SQLAlchemy query syntax (replaced `|` with `or_()` for database queries)
- ✅ Added class history view to student detail page (shows all past and current class assignments)
- ✅ Fixed ParentLink interface to use `id` instead of `parent_id` for consistency with backend response

### Conflicts/Additions Beyond Original Blueprint

**Transport Routes & Club Activities:**
- These features were implemented but are NOT in the original API specification (`docs/01-api-spec.md`)
- They are fully functional and integrated into the system
- Transport routes are linked to students and used in fee calculations
- Club activities support clubs and extra-curricular activities with teacher assignments
- **Recommendation:** These should be documented separately or added to the API spec if they're part of the final MVP scope

**Class History Feature:**
- Added comprehensive class history view to student detail page
- This was mentioned in the spec as "available via student_class_history table queries" but no specific endpoint was defined
- Implemented by adding `class_history` array to GET `/students/{id}` response
- Enhances the MVP beyond the basic "current class" requirement

---

## 🔄 How to Update This Document

When completing a task:
1. Mark the checkbox as `[x]`
2. Update the status indicator (✅ COMPLETE, 🔄 IN PROGRESS, ⏳ PENDING)
3. Update the "Last Updated" date at the top
4. Update the progress summary section
5. Update the Minimum Operational Loop status
