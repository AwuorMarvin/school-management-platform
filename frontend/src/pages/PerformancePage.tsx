import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import {
  performanceApi,
  PerformanceReportListItem,
  PerformanceReportCreatePayload,
  PerformanceReport,
  PerformanceReportUpdatePayload,
} from '../api/performance'
import { academicYearsApi } from '../api/academicYears'
import { termsApi } from '../api/terms'
import { classesApi } from '../api/classes'
import { subjectsApi } from '../api/subjects'
import { studentsApi } from '../api/students'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'

interface SelectOption {
  id: string
  name: string
}

interface PerformanceFormLineItem {
  area_label: string
  numeric_score?: string
  descriptive_score?: string
  comment?: string
}

const emptyLineItem: PerformanceFormLineItem = {
  area_label: '',
  numeric_score: '',
  descriptive_score: '',
  comment: '',
}

const PerformancePage = () => {
  const { user } = useAuthStore()
  const { success: showSuccessToast } = useToastStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [reports, setReports] = useState<PerformanceReportListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const [academicYears, setAcademicYears] = useState<SelectOption[]>([])
  const [terms, setTerms] = useState<SelectOption[]>([])
  const [classes, setClasses] = useState<SelectOption[]>([])
  const [subjects, setSubjects] = useState<SelectOption[]>([])
  const [students, setStudents] = useState<SelectOption[]>([])
  const [_teachers] = useState<SelectOption[]>([])

  const [filters, setFilters] = useState({
    academic_year_id: '',
    term_id: '',
    class_id: '',
    subject_id: '',
    student_id: '',
  })

  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formContext, setFormContext] = useState({
    student_id: '',
    academic_year_id: '',
    term_id: '',
    class_id: '',
    subject_id: '',
  })
  const [lineItems, setLineItems] = useState<PerformanceFormLineItem[]>([emptyLineItem])
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingReportId, setEditingReportId] = useState<string | null>(null)
  const [viewReport, setViewReport] = useState<PerformanceReport | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)

  const isTeacher = user?.role === 'TEACHER'
  const isAdmin =
    user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  const canRegister = isTeacher || isAdmin

  useEffect(() => {
    void loadFilters()
  }, [])

  useEffect(() => {
    void loadReports()
  }, [filters, page])

  const loadFilters = async () => {
    try {
      setLoading(true)
      setError('')

      const [yearsRes, termsRes, classesRes, subjectsRes] = await Promise.all([
        academicYearsApi.list({ page: 1, page_size: 100 }),
        termsApi.list({ page: 1, page_size: 100 }),
        classesApi.list({ page: 1, page_size: 100 }),
        subjectsApi.list({ page: 1, page_size: 100 }),
      ])

      setAcademicYears(yearsRes.data.map((y) => ({ id: y.id, name: y.name })))
      setTerms(termsRes.data.map((t) => ({ id: t.id, name: t.name })))
      setClasses(classesRes.data.map((c) => ({ id: c.id, name: c.name })))
      setSubjects(subjectsRes.data.map((s) => ({ id: s.id, name: s.name })))

      const studentsRes = await studentsApi.list({ limit: 100 })
      setStudents(
        studentsRes.data.map((s) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
        })),
      )
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load filters')
    } finally {
      setLoading(false)
    }
  }

  const loadReports = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await performanceApi.listReports({
        academic_year_id: filters.academic_year_id || undefined,
        term_id: filters.term_id || undefined,
        subject_id: filters.subject_id || undefined,
        student_id: filters.student_id || undefined,
        class_id: filters.class_id || undefined,
        page,
        page_size: pageSize,
      })

      setReports(response.data)
      setTotal(response.total)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load performance reports')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }))
    setPage(1)
  }

  const openRegisterForm = () => {
    setFormError('')
    setIsEditMode(false)
    setEditingReportId(null)
    setFormContext({
      student_id: '',
      academic_year_id: '',
      term_id: '',
      class_id: '',
      subject_id: '',
    })
    setLineItems([emptyLineItem])
    setIsRegisterOpen(true)
  }

  const openEditForm = async (reportId: string) => {
    try {
      setFormError('')
      setLoading(true)
      const report = await performanceApi.getReport(reportId)

      setIsEditMode(true)
      setEditingReportId(reportId)
      setFormContext({
        student_id: report.student_id,
        academic_year_id: report.academic_year_id,
        term_id: report.term_id,
        class_id: report.class_id,
        subject_id: report.subject_id,
      })

      setLineItems(
        report.line_items
          .sort((a, b) => a.position - b.position)
          .map((item) => ({
            area_label: item.area_label,
            numeric_score:
              item.numeric_score !== null && item.numeric_score !== undefined
                ? String(item.numeric_score)
                : '',
            descriptive_score: item.descriptive_score || '',
            comment: item.comment || '',
          })),
      )

      setIsRegisterOpen(true)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (detail?.message) {
        setError(detail.message)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to load performance report for editing.')
      }
    } finally {
      setLoading(false)
    }
  }

  const openViewReport = async (reportId: string) => {
    try {
      setLoading(true)
      const report = await performanceApi.getReport(reportId)
      setViewReport(report)
      setIsViewOpen(true)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (detail?.message) {
        setError(detail.message)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to load performance report details.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleStudentChange = async (studentId: string) => {
    setFormContext((prev) => ({
      ...prev,
      student_id: studentId,
      class_id: '',
      subject_id: '',
      term_id: '',
      academic_year_id: '',
    }))

    if (!studentId) {
      return
    }

    try {
      setLoading(true)
      const student = await studentsApi.get(studentId)
      const currentClass = student.current_class

      if (currentClass?.id) {
        // Set class to student's current class
        setFormContext((prev) => ({
          ...prev,
          class_id: currentClass.id,
        }))

        // Load subjects for that class
        try {
          const classSubjects = await subjectsApi.listForClass(currentClass.id)
          setSubjects(classSubjects.data.map((s) => ({ id: s.id, name: s.name })))
        } catch {
          // If this fails, keep existing subjects as fallback
        }

        // Load academic year + terms for that class
        try {
          const classDetails = await classesApi.get(currentClass.id)
          if (classDetails.academic_year_id) {
            setFormContext((prev) => ({
              ...prev,
              academic_year_id: classDetails.academic_year_id,
            }))

            const classTerms = await termsApi.list({
              academic_year_id: classDetails.academic_year_id,
              page: 1,
              page_size: 100,
            })
            setTerms(classTerms.data.map((t) => ({ id: t.id, name: t.name })))
          }
        } catch {
          // If this fails, keep existing academic year/terms options
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const addLineItem = () => {
    if (lineItems.length >= 5) return
    setLineItems((prev) => [...prev, emptyLineItem])
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLineItem = (
    index: number,
    field: keyof PerformanceFormLineItem,
    value: string,
  ) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!formContext.student_id || !formContext.academic_year_id || !formContext.term_id || !formContext.subject_id) {
      setFormError('Please fill all required fields (student, academic year, term, subject).')
      return
    }

    const validLineItems = lineItems.filter(
      (item) =>
        item.area_label.trim().length > 0 &&
        (item.numeric_score?.trim() || item.descriptive_score?.trim()),
    )

    if (validLineItems.length === 0) {
      setFormError(
        'Enter at least one performance area with either a numeric or descriptive score.',
      )
      return
    }

    if (validLineItems.length > 5) {
      setFormError('You can only enter a maximum of 5 performance areas.')
      return
    }

    const createPayload: PerformanceReportCreatePayload = {
      student_id: formContext.student_id,
      academic_year_id: formContext.academic_year_id,
      term_id: formContext.term_id,
      class_id: formContext.class_id,
      subject_id: formContext.subject_id,
      line_items: validLineItems.map((item, index) => ({
        area_label: item.area_label.trim(),
        numeric_score:
          item.numeric_score && item.numeric_score.trim().length > 0
            ? Number(item.numeric_score)
            : undefined,
        descriptive_score:
          item.descriptive_score && item.descriptive_score.trim().length > 0
            ? item.descriptive_score.trim()
            : undefined,
        comment: item.comment?.trim() || undefined,
        position: index + 1,
      })),
    }

    const updatePayload: PerformanceReportUpdatePayload = {
      line_items: createPayload.line_items,
    }

    try {
      setFormSubmitting(true)
      if (isEditMode && editingReportId) {
        await performanceApi.updateReport(editingReportId, updatePayload)
        showSuccessToast('Performance report updated successfully.')
      } else {
        await performanceApi.createReport(createPayload)
        showSuccessToast('Performance report saved successfully.')
      }
      setIsRegisterOpen(false)
      setIsEditMode(false)
      setEditingReportId(null)
      void loadReports()
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setFormError(detail)
      } else if (detail?.message) {
        setFormError(detail.message)
      } else if (err.response?.data?.message) {
        setFormError(err.response.data.message)
      } else {
        setFormError('Failed to save performance report. Please try again.')
      }
    } finally {
      setFormSubmitting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Restrict form dropdown options based on selected student/context
  const formAcademicYearOptions =
    formContext.student_id && formContext.academic_year_id
      ? academicYears.filter((ay) => ay.id === formContext.academic_year_id)
      : academicYears

  const formClassOptions =
    formContext.student_id && formContext.class_id
      ? classes.filter((cls) => cls.id === formContext.class_id)
      : classes

  const formTermOptions =
    formContext.student_id && formContext.term_id
      ? terms.filter((t) => t.id === formContext.term_id)
      : terms

  const formSubjectOptions = subjects

  return (
    <AppLayout>
      <PageHeader
        title="Performance"
        subtitle="View and manage student performance by subject and term."
        action={
          canRegister ? (
            <button
              type="button"
              onClick={openRegisterForm}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Register Performance
            </button>
          ) : null
        }
      />

      <div className="p-8 space-y-6">
        {error && (
          <ContentCard>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          </ContentCard>
        )}

        <ContentCard title="Filters">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Academic Year
              </label>
              <select
                name="academic_year_id"
                value={filters.academic_year_id}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All</option>
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
              <select
                name="term_id"
                value={filters.term_id}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
              <select
                name="class_id"
                value={filters.class_id}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <select
                name="subject_id"
                value={filters.subject_id}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All</option>
                {subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
              <select
                name="student_id"
                value={filters.student_id}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All</option>
                {students.map((stu) => (
                  <option key={stu.id} value={stu.id}>
                    {stu.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </ContentCard>

        <ContentCard title="Performance Reports">
          {loading ? (
            <div className="py-8 text-center text-gray-600 text-sm">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-gray-600 text-sm">
              No performance reports found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Academic Year / Term
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numeric Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descriptive Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {report.student.first_name} {report.student.last_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{report.cls.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{report.subject.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {report.academic_year.name} / {report.term.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {report.teacher.first_name} {report.teacher.last_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {report.line_items_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {report.first_numeric_score !== null &&
                        report.first_numeric_score !== undefined
                          ? report.first_numeric_score
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {report.first_descriptive_score || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(report.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => void openViewReport(report.id)}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => void openEditForm(report.id)}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </ContentCard>

        {isRegisterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-4xl mx-4">
              <ContentCard title={isEditMode ? 'Edit Performance' : 'Register Performance'}>
                <form onSubmit={handleRegisterSubmit} className="space-y-6">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Student<span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formContext.student_id}
                    onChange={(e) => void handleStudentChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select student</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Academic Year<span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formContext.academic_year_id}
                    onChange={(e) =>
                      setFormContext((prev) => ({ ...prev, academic_year_id: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select academic year</option>
                    {formAcademicYearOptions.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Term<span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formContext.term_id}
                    onChange={(e) =>
                      setFormContext((prev) => ({ ...prev, term_id: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select term</option>
                    {formTermOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class<span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formContext.class_id}
                    onChange={(e) =>
                      setFormContext((prev) => ({ ...prev, class_id: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select class</option>
                    {formClassOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject<span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formContext.subject_id}
                    onChange={(e) =>
                      setFormContext((prev) => ({ ...prev, subject_id: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select subject</option>
                    {formSubjectOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Teacher selection is not required here; backend ties reports to the correct teacher based on assignments. */}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Performance Areas<span className="text-red-500">*</span>
                  </h3>
                  <button
                    type="button"
                    onClick={addLineItem}
                    disabled={lineItems.length >= 5}
                    className="px-3 py-1 text-sm bg-primary-50 text-primary-700 border border-primary-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Area
                  </button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          Area {index + 1}
                        </span>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Performance Area<span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={item.area_label}
                            onChange={(e) =>
                              updateLineItem(index, 'area_label', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., Algebra"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Numeric Score
                            </label>
                            <input
                              type="number"
                              value={item.numeric_score}
                              onChange={(e) =>
                                updateLineItem(index, 'numeric_score', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              placeholder="Optional"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Descriptive Score
                            </label>
                            <input
                              type="text"
                              value={item.descriptive_score}
                              onChange={(e) =>
                                updateLineItem(index, 'descriptive_score', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              placeholder="e.g., ME"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Comment
                        </label>
                        <textarea
                          value={item.comment}
                          onChange={(e) => updateLineItem(index, 'comment', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Optional detailed comment..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formSubmitting ? 'Saving...' : 'Save Performance'}
                </button>
              </div>
                </form>
              </ContentCard>
            </div>
          </div>
        )}

        {isViewOpen && viewReport && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-3xl mx-4">
              <ContentCard
                title="Performance Details"
                subtitle="Detailed performance by area"
                headerAction={
                  <button
                    type="button"
                    onClick={() => {
                      setIsViewOpen(false)
                      setViewReport(null)
                    }}
                    className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                }
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                    <div>
                      <div className="font-medium text-gray-900">Student</div>
                      <div>
                        {
                          reports.find((r) => r.id === viewReport.id)?.student
                            .first_name
                        }{' '}
                        {reports.find((r) => r.id === viewReport.id)?.student.last_name}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Class / Subject</div>
                      <div>
                        {reports.find((r) => r.id === viewReport.id)?.cls.name} /{' '}
                        {reports.find((r) => r.id === viewReport.id)?.subject.name}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Academic Year / Term</div>
                      <div>
                        {
                          reports.find((r) => r.id === viewReport.id)?.academic_year
                            .name
                        }{' '}
                        / {reports.find((r) => r.id === viewReport.id)?.term.name}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Teacher</div>
                      <div>
                        {
                          reports.find((r) => r.id === viewReport.id)?.teacher
                            .first_name
                        }{' '}
                        {
                          reports.find((r) => r.id === viewReport.id)?.teacher
                            .last_name
                        }
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Performance Area
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Numeric Score
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Descriptive Score
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Comment
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {viewReport.line_items
                          .sort((a, b) => a.position - b.position)
                          .map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {item.area_label}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {item.numeric_score !== null &&
                                item.numeric_score !== undefined
                                  ? item.numeric_score
                                  : '—'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {item.descriptive_score || '—'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {item.comment || '—'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ContentCard>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default PerformancePage


