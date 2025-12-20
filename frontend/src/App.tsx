import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import StudentsPage from './pages/StudentsPage'
import StudentFormPage from './pages/StudentFormPage'
import StudentDetailPage from './pages/StudentDetailPage'
import ParentsPage from './pages/ParentsPage'
import ParentFormPage from './pages/ParentFormPage'
import ParentDetailPage from './pages/ParentDetailPage'
import AcademicYearsPage from './pages/AcademicYearsPage'
import AcademicYearFormPage from './pages/AcademicYearFormPage'
import AcademicYearDetailPage from './pages/AcademicYearDetailPage'
import TermFormPage from './pages/TermFormPage'
import ClassesPage from './pages/ClassesPage'
import ClassFormPage from './pages/ClassFormPage'
import ClassDetailPage from './pages/ClassDetailPage'
import SubjectFormPage from './pages/SubjectFormPage'
import PerformanceEntryPage from './pages/PerformanceEntryPage'
import PerformanceViewPage from './pages/PerformanceViewPage'
import TeacherFormPage from './pages/TeacherFormPage'
import SubjectsPage from './pages/SubjectsPage'
import TermsPage from './pages/TermsPage'
import ClubActivitiesPage from './pages/ClubActivitiesPage'
import ClubActivityFormPage from './pages/ClubActivityFormPage'
import TransportRoutesPage from './pages/TransportRoutesPage'
import TransportRouteFormPage from './pages/TransportRouteFormPage'
import FeesOverviewPage from './pages/FeesOverviewPage'
import FeeStructuresPage from './pages/FeeStructuresPage'
import FeeStructureFormPage from './pages/FeeStructureFormPage'
import FeeAdjustmentFormPage from './pages/FeeAdjustmentFormPage'
import GlobalDiscountFormPage from './pages/GlobalDiscountFormPage'
import ProtectedRoute from './components/ProtectedRoute'
import FeeStructureYearlyFormPage from './pages/FeeStructureYearlyFormPage'
import FeeStructureTermlyFormPage from './pages/FeeStructureTermlyFormPage'
import FeeStructureAnnualFormPage from './pages/FeeStructureAnnualFormPage'
import FeeStructureEditRedirect from './pages/FeeStructureEditRedirect'
import FeeStatusPage from './pages/FeeStatusPage'
import ToastContainer from './components/ToastContainer'

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students"
          element={
            <ProtectedRoute>
              <StudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/new"
          element={
            <ProtectedRoute>
              <StudentFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/:id"
          element={
            <ProtectedRoute>
              <StudentDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/:id/edit"
          element={
            <ProtectedRoute>
              <StudentFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parents"
          element={
            <ProtectedRoute>
              <ParentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parents/new"
          element={
            <ProtectedRoute>
              <ParentFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parents/:id"
          element={
            <ProtectedRoute>
              <ParentDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parents/:id/edit"
          element={
            <ProtectedRoute>
              <ParentFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/academic-years"
          element={
            <ProtectedRoute>
              <AcademicYearsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/academic-years/new"
          element={
            <ProtectedRoute>
              <AcademicYearFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/academic-years/:id"
          element={
            <ProtectedRoute>
              <AcademicYearDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/academic-years/:id/edit"
          element={
            <ProtectedRoute>
              <AcademicYearFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/terms"
          element={
            <ProtectedRoute>
              <TermsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/terms/new"
          element={
            <ProtectedRoute>
              <TermFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/academic-years/:academicYearId/terms/new"
          element={
            <ProtectedRoute>
              <TermFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/terms/:id/edit"
          element={
            <ProtectedRoute>
              <TermFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes"
          element={
            <ProtectedRoute>
              <ClassesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/new"
          element={
            <ProtectedRoute>
              <ClassFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/:id"
          element={
            <ProtectedRoute>
              <ClassDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/:id/edit"
          element={
            <ProtectedRoute>
              <ClassFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/:classId/subjects/new"
          element={
            <ProtectedRoute>
              <SubjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects/:id/edit"
          element={
            <ProtectedRoute>
              <SubjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/:studentId/performance"
          element={
            <ProtectedRoute>
              <PerformanceViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/:studentId/performance/enter"
          element={
            <ProtectedRoute>
              <PerformanceEntryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teachers/new"
          element={
            <ProtectedRoute>
              <TeacherFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects"
          element={
            <ProtectedRoute>
              <SubjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects/new"
          element={
            <ProtectedRoute>
              <SubjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects/:id"
          element={
            <ProtectedRoute>
              <SubjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects/:id/edit"
          element={
            <ProtectedRoute>
              <SubjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/club-activities"
          element={
            <ProtectedRoute>
              <ClubActivitiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/club-activities/new"
          element={
            <ProtectedRoute>
              <ClubActivityFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/club-activities/:id/edit"
          element={
            <ProtectedRoute>
              <ClubActivityFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transport-routes"
          element={
            <ProtectedRoute>
              <TransportRoutesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transport-routes/new"
          element={
            <ProtectedRoute>
              <TransportRouteFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transport-routes/:id/edit"
          element={
            <ProtectedRoute>
              <TransportRouteFormPage />
            </ProtectedRoute>
          }
        />
        {/* Fees */}
        <Route
          path="/fee-status"
          element={
            <ProtectedRoute>
              <FeeStatusPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures"
          element={
            <ProtectedRoute>
              <FeeStructuresPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures/new"
          element={
            <ProtectedRoute>
              <FeeStructureFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures/new-termly"
          element={
            <ProtectedRoute>
              <FeeStructureTermlyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures/new-annual"
          element={
            <ProtectedRoute>
              <FeeStructureAnnualFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures/new-yearly"
          element={
            <ProtectedRoute>
              <FeeStructureYearlyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures/:id/edit"
          element={
            <ProtectedRoute>
              <FeeStructureEditRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures/:id/edit-termly"
          element={
            <ProtectedRoute>
              <FeeStructureTermlyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures/:id/edit-annual"
          element={
            <ProtectedRoute>
              <FeeStructureAnnualFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-status/students/:studentId/adjust"
          element={
            <ProtectedRoute>
              <FeeAdjustmentFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-status/adjustments/:id/edit"
          element={
            <ProtectedRoute>
              <FeeAdjustmentFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures/global-discounts/new"
          element={
            <ProtectedRoute>
              <GlobalDiscountFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fee-structures/global-discounts/:id/edit"
          element={
            <ProtectedRoute>
              <GlobalDiscountFormPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

