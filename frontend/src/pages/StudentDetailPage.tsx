import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { studentsApi, Student } from '../api/students'
import { useAuthStore } from '../store/authStore'
import { subjectsApi, Subject } from '../api/subjects'
import { classesApi, TeacherInClass } from '../api/classes'
import { feeSummaryApi, StudentFeeSummaryResponse } from '../api/feeSummary'
import { termsApi, Term } from '../api/terms'
import { performanceApi, PerformanceReportCreatePayload, PerformanceReportListItem } from '../api/performance'
import { academicYearsApi } from '../api/academicYears'
import { useToastStore } from '../store/toastStore'

const StudentDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [changingStatus, setChangingStatus] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<TeacherInClass[]>([])
  const [currentTerm, setCurrentTerm] = useState<Term | null>(null)
  const [feeSummary, setFeeSummary] = useState<StudentFeeSummaryResponse | null>(null)
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false)
  const [performanceFormSubmitting, setPerformanceFormSubmitting] = useState(false)
  const [performanceFormError, setPerformanceFormError] = useState('')
  const [performanceSubjectId, setPerformanceSubjectId] = useState('')
  const [performanceLineItems, setPerformanceLineItems] = useState<Array<{
    area_label: string
    numeric_score?: string
    descriptive_score?: string
    comment?: string
  }>>([{ area_label: '', numeric_score: '', descriptive_score: '', comment: '' }])
  const [existingPerformanceReport, setExistingPerformanceReport] = useState<{
    id: string
    line_items: Array<{
      area_label: string
      numeric_score?: number | null
      descriptive_score?: string | null
      comment?: string | null
    }>
  } | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingReportId, setEditingReportId] = useState<string | null>(null)
  const [isViewPerformanceModalOpen, setIsViewPerformanceModalOpen] = useState(false)
  const [performanceReports, setPerformanceReports] = useState<any[]>([])
  const [loadingPerformanceReports, setLoadingPerformanceReports] = useState(false)
  const [performanceFilters, setPerformanceFilters] = useState({
    academic_year_id: '',
    term_id: '',
  })
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string }>>([])
  const [allTerms, setAllTerms] = useState<Array<{ id: string; name: string; academic_year_id: string }>>([])
  const { success: showSuccessToast } = useToastStore()

  useEffect(() => {
    if (id) {
      loadStudent()
    }
  }, [id])

  const loadPerformanceReports = async () => {
    if (!student || !isViewPerformanceModalOpen) return

    try {
      setLoadingPerformanceReports(true)
      const response = await performanceApi.listReports({
        student_id: student.id,
        academic_year_id: performanceFilters.academic_year_id || undefined,
        term_id: performanceFilters.term_id || undefined,
        page: 1,
        page_size: 1000, // Get all records
      })

      // Fetch full details for each report to get line items
      const reportsWithDetails = await Promise.all(
        response.data.map(async (report) => {
          try {
            const fullReport = await performanceApi.getReport(report.id)
            return {
              ...report,
              line_items: fullReport.line_items,
            }
          } catch (err) {
            console.error(`Failed to load details for report ${report.id}:`, err)
            return {
              ...report,
              line_items: [],
            }
          }
        }),
      )

      setPerformanceReports(reportsWithDetails)
    } catch (err: any) {
      console.error('Failed to load performance reports:', err)
      setPerformanceReports([])
    } finally {
      setLoadingPerformanceReports(false)
    }
  }

  useEffect(() => {
    if (isViewPerformanceModalOpen && student) {
      const fetchReports = async () => {
        try {
          setLoadingPerformanceReports(true)
          
          // Fetch all reports with pagination (max page_size is 100)
          let allReports: any[] = []
          let page = 1
          let hasMore = true
          
          while (hasMore) {
            const response = await performanceApi.listReports({
              student_id: student.id,
              academic_year_id: performanceFilters.academic_year_id || undefined,
              term_id: performanceFilters.term_id || undefined,
              page,
              page_size: 100,
            })
            
            allReports = [...allReports, ...response.data]
            
            // Check if there are more pages
            const totalPages = Math.ceil(response.total / 100)
            hasMore = page < totalPages && response.data.length === 100
            page++
          }

          // Fetch full details for each report to get line items
          const reportsWithDetails = await Promise.all(
            allReports.map(async (report) => {
              try {
                const fullReport = await performanceApi.getReport(report.id)
                return {
                  ...report,
                  line_items: fullReport.line_items,
                }
              } catch (err) {
                console.error(`Failed to load details for report ${report.id}:`, err)
                return {
                  ...report,
                  line_items: [],
                }
              }
            }),
          )

          setPerformanceReports(reportsWithDetails)
        } catch (err: any) {
          console.error('Failed to load performance reports:', err)
          setPerformanceReports([])
        } finally {
          setLoadingPerformanceReports(false)
        }
      }
      
      fetchReports()
    }
  }, [performanceFilters.academic_year_id, performanceFilters.term_id, isViewPerformanceModalOpen, student?.id])

  const calculateAge = (dateOfBirth: string): { years: number; months: number; days: number } => {
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    
    let years = today.getFullYear() - birthDate.getFullYear()
    let months = today.getMonth() - birthDate.getMonth()
    let days = today.getDate() - birthDate.getDate()
    
    if (days < 0) {
      months--
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      days += lastMonth.getDate()
    }
    
    if (months < 0) {
      years--
      months += 12
    }
    
    return { years, months, days }
  }

  const loadStudent = async () => {
    try {
      setLoading(true)
      const data = await studentsApi.get(id!)
      setStudent(data)
      
      // Load additional data if student has a current class
      if (data.current_class?.id) {
        const classId = data.current_class.id
        
        // Load class data to get academic_year_id, then load all related data
        try {
          const classData = await classesApi.get(classId)
          
          // Load subjects, teachers, fee summary, and terms in parallel
          const [subjectsResponse, teachersResponse, feeSummaryResponse, termsResponse] = await Promise.all([
            subjectsApi.listForClass(classId).catch(() => ({ data: [] })),
            classesApi.listTeachers(classId).catch(() => ({ data: [] })),
            feeSummaryApi.getStudentSummary(id!).catch(() => null),
            classData.academic_year_id
              ? termsApi.list({ academic_year_id: classData.academic_year_id }).catch(() => ({ data: [] }))
              : Promise.resolve({ data: [] }),
          ])
          
          setSubjects(subjectsResponse.data)
          setTeachers(teachersResponse.data)
          setFeeSummary(feeSummaryResponse)
          
          // Find active term
          const today = new Date()
          const activeTerm = termsResponse.data.find((term) => {
            const start = new Date(term.start_date)
            const end = new Date(term.end_date)
            return today >= start && today <= end
          })
          setCurrentTerm(activeTerm || null)
        } catch (err) {
          console.error('Failed to load class data:', err)
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load student')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) {
      return
    }

    try {
      setChangingStatus(true)
      await studentsApi.changeStatus(id!, newStatus)
      await loadStudent()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to change status')
    } finally {
      setChangingStatus(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-success-100 text-success-800 border-success-200'
      case 'COMPLETED':
        return 'bg-primary-100 text-primary-800 border-primary-200'
      case 'TRANSFERRED_OUT':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-warning-100 text-warning-800 border-warning-200'
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading student...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !student) {
    return (
      <AppLayout>
        <PageHeader title="Error" subtitle={error || 'Student not found'} />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">{error || 'Student not found'}</p>
              <Link to="/students" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
                ← Back to Students
              </Link>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <AppLayout>
      <PageHeader
        title={`${student.first_name} ${student.middle_name || ''} ${student.last_name}`}
        subtitle="Student Details"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/students" />
            {isAdmin && (
              <Link
                to={`/students/${id}/edit`}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Edit Student
              </Link>
            )}
          </div>
        }
      />

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Cards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <ContentCard>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Names</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {student.first_name} {student.middle_name || ''} {student.last_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(student.date_of_birth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}{' '}
                    ({(() => {
                      const age = calculateAge(student.date_of_birth)
                      return `${age.years} Years, ${age.months} Months, ${age.days} Days`
                    })()})
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                        student.status
                      )}`}
                    >
                      {student.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Class</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {student.current_class?.name || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Academic Year</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {student.current_class?.academic_year || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Term</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {currentTerm?.name || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Subjects</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {subjects.length > 0 ? subjects.map((s) => s.name).join(', ') : 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Teachers</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {teachers.length > 0
                      ? teachers
                          .map((t) => `${t.teacher.first_name} ${t.teacher.last_name}`)
                          .filter((name, index, arr) => arr.indexOf(name) === index)
                          .join(', ')
                      : 'N/A'}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Current Fees</dt>
                  <dd className="mt-1">
                    {feeSummary ? (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Expected:</span>{' '}
                          <span className="font-medium text-gray-900">
                            KES {parseFloat(feeSummary.expected_fee.toString()).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Paid:</span>{' '}
                          <span className="font-medium text-gray-900">
                            KES {parseFloat(feeSummary.paid_amount.toString()).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Balance:</span>{' '}
                          <span className="font-medium text-gray-900">
                            KES {parseFloat(feeSummary.pending_amount.toString()).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">N/A</span>
                    )}
                  </dd>
                </div>
              </dl>
            </ContentCard>

            {/* Class History */}
            {student.class_history && student.class_history.length > 0 && (
              <ContentCard>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Class History</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Class
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Academic Year
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Start Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          End Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {student.class_history.map((history) => (
                        <tr key={history.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              to={`/classes/${history.class_id}`}
                              className="text-sm font-medium text-primary-600 hover:text-primary-900"
                            >
                              {history.class_name}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {history.academic_year || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(history.start_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {history.end_date
                              ? new Date(history.end_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {history.is_active ? (
                              <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-100 text-success-800 border border-success-200">
                                Active
                              </span>
                            ) : (
                              <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                                Ended
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ContentCard>
            )}

            {/* Parents */}
            {student.parents && student.parents.length > 0 && (
              <ContentCard>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Parents/Guardians</h2>
                <div className="space-y-4">
                  {student.parents.map((parent) => (
                    <div
                      key={parent.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {parent.first_name} {parent.last_name}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">{parent.role}</span>
                          </p>
                          <p className="text-sm text-gray-600">{parent.email}</p>
                          <p className="text-sm text-gray-600">{parent.phone_number}</p>
                        </div>
                        <Link
                          to={`/parents/${parent.id}`}
                          className="text-primary-600 hover:text-primary-700 text-sm"
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </ContentCard>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Transport Info */}
            {student.transport_route && (
              <ContentCard>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Transport</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Zone</dt>
                    <dd className="mt-1 text-sm text-gray-900">{student.transport_route.zone}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {student.transport_type === 'ONE_WAY'
                        ? 'One way'
                        : student.transport_type === 'TWO_WAY'
                        ? 'Two way'
                        : 'Two way (default)'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">One Way Cost (Term)</dt>
                    <dd className="mt1 text-sm text-gray-900">
                      KES {parseFloat(student.transport_route.one_way_cost_per_term).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Two Way Cost (Term)</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      KES {parseFloat(student.transport_route.two_way_cost_per_term).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </ContentCard>
            )}

            {/* Status Management */}
            <ContentCard>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Management</h3>
              <div className="space-y-2">
                {/* Academic Performance Buttons */}
                <button
                  onClick={async () => {
                    setIsViewPerformanceModalOpen(true)
                    setPerformanceFilters({ academic_year_id: '', term_id: '' })
                    setPerformanceReports([])
                    
                    // Load academic years and terms
                    try {
                      const [yearsRes, termsRes] = await Promise.all([
                        academicYearsApi.list({ page: 1, page_size: 100 }),
                        termsApi.list({ page: 1, page_size: 100 }),
                      ])
                      setAcademicYears(yearsRes.data.map((y) => ({ id: y.id, name: y.name })))
                      setAllTerms(
                        termsRes.data.map((t) => ({
                          id: t.id,
                          name: t.name,
                          academic_year_id: t.academic_year_id,
                        })),
                      )
                    } catch (err) {
                      console.error('Failed to load filters:', err)
                    }
                    // Performance reports will be loaded by the useEffect
                  }}
                  className="block w-full px-4 py-2 text-center text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  View Performance Records
                </button>
                {(isAdmin || user?.role === 'TEACHER') && (
                  <button
                    onClick={() => {
                      setPerformanceSubjectId('')
                      setPerformanceLineItems([{ area_label: '', numeric_score: '', descriptive_score: '', comment: '' }])
                      setPerformanceFormError('')
                      setIsPerformanceModalOpen(true)
                    }}
                    disabled={!student.current_class || !currentTerm}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    Enter Performance
                  </button>
                )}
                
                {/* Status Change Buttons */}
                {user?.role === 'SCHOOL_ADMIN' && (
                  <>
                    {student.status !== 'ACTIVE' && (
                      <button
                        onClick={() => handleStatusChange('ACTIVE')}
                        disabled={changingStatus}
                        className="w-full px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 transition-colors text-sm font-medium"
                      >
                        {changingStatus ? 'Changing...' : 'Activate Student'}
                      </button>
                    )}
                    {student.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => handleStatusChange('COMPLETED')}
                          disabled={changingStatus}
                          className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm font-medium"
                        >
                          {changingStatus ? 'Changing...' : 'Mark as Completed'}
                        </button>
                        <button
                          onClick={() => handleStatusChange('TRANSFERRED_OUT')}
                          disabled={changingStatus}
                          className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm font-medium"
                        >
                          {changingStatus ? 'Changing...' : 'Mark as Transferred'}
                        </button>
                        <button
                          onClick={() => handleStatusChange('INACTIVE')}
                          disabled={changingStatus}
                          className="w-full px-4 py-2 bg-warning-600 text-white rounded-lg hover:bg-warning-700 disabled:opacity-50 transition-colors text-sm font-medium"
                        >
                          {changingStatus ? 'Changing...' : 'Deactivate'}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </ContentCard>

            {/* Quick Info */}
            <ContentCard>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Student ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{student.id}</dd>
                </div>
                {student.campus && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Campus</dt>
                    <dd className="mt-1 text-sm text-gray-900">{student.campus.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(student.created_at).toLocaleDateString()}
                  </dd>
                </div>
                {student.updated_at && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(student.updated_at).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
            </ContentCard>
          </div>
        </div>
      </div>

      {/* Performance Entry Modal */}
      {isPerformanceModalOpen && student.current_class && currentTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <ContentCard title="Enter Performance">
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setPerformanceFormError('')

                  if (!performanceSubjectId) {
                    setPerformanceFormError('Please select a subject.')
                    return
                  }

                  const validLineItems = performanceLineItems.filter(
                    (item) =>
                      item.area_label.trim().length > 0 &&
                      (item.numeric_score?.trim() || item.descriptive_score?.trim()),
                  )

                  if (validLineItems.length === 0) {
                    setPerformanceFormError(
                      'Enter at least one performance area with either a numeric or descriptive score.',
                    )
                    return
                  }

                  if (validLineItems.length > 5) {
                    setPerformanceFormError('You can only enter a maximum of 5 performance areas.')
                    return
                  }

                  try {
                    setPerformanceFormSubmitting(true)

                    // Get class details to get academic_year_id
                    const classData = await classesApi.get(student.current_class.id)

                    // Check for existing performance report
                    const existingReports = await performanceApi.listReports({
                      student_id: student.id,
                      subject_id: performanceSubjectId,
                      academic_year_id: classData.academic_year_id,
                      term_id: currentTerm.id,
                      page: 1,
                      page_size: 1,
                    })

                    if (existingReports.data.length > 0) {
                      // Existing report found - show conflict modal
                      const existingReport = await performanceApi.getReport(existingReports.data[0].id)
                      setExistingPerformanceReport({
                        id: existingReport.id,
                        line_items: existingReport.line_items,
                      })
                      setShowConflictModal(true)
                      setPerformanceFormSubmitting(false)
                      return
                    }

                    // No existing report - proceed with creation
                    const payload: PerformanceReportCreatePayload = {
                      student_id: student.id,
                      academic_year_id: classData.academic_year_id,
                      term_id: currentTerm.id,
                      class_id: student.current_class.id,
                      subject_id: performanceSubjectId,
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

                    await performanceApi.createReport(payload)
                    showSuccessToast('Performance report saved successfully.')
                    setIsPerformanceModalOpen(false)
                    setPerformanceSubjectId('')
                    setPerformanceLineItems([{ area_label: '', numeric_score: '', descriptive_score: '', comment: '' }])
                  } catch (err: any) {
                    const detail = err.response?.data?.detail
                    if (typeof detail === 'string') {
                      setPerformanceFormError(detail)
                    } else if (detail?.message) {
                      setPerformanceFormError(detail.message)
                    } else if (err.response?.data?.message) {
                      setPerformanceFormError(err.response.data.message)
                    } else {
                      setPerformanceFormError('Failed to save performance report. Please try again.')
                    }
                  } finally {
                    setPerformanceFormSubmitting(false)
                  }
                }}
                className="space-y-6"
              >
                {performanceFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {performanceFormError}
                  </div>
                )}

                {/* Pre-selected fields (disabled) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Student
                    </label>
                    <input
                      type="text"
                      value={`${student.first_name} ${student.last_name}`}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      value={student.current_class.academic_year || 'N/A'}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Term
                    </label>
                    <input
                      type="text"
                      value={currentTerm.name}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Class
                    </label>
                    <input
                      type="text"
                      value={student.current_class.name}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Subject selection (editable) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={performanceSubjectId}
                    onChange={(e) => setPerformanceSubjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Performance Areas */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Performance Areas <span className="text-red-500">*</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        if (performanceLineItems.length < 5) {
                          setPerformanceLineItems([
                            ...performanceLineItems,
                            { area_label: '', numeric_score: '', descriptive_score: '', comment: '' },
                          ])
                        }
                      }}
                      disabled={performanceLineItems.length >= 5}
                      className="px-3 py-1 text-sm bg-primary-50 text-primary-700 border border-primary-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Area
                    </button>
                  </div>

                  <div className="space-y-3">
                    {performanceLineItems.map((item, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500 uppercase">
                            Area {index + 1}
                          </span>
                          {performanceLineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPerformanceLineItems(performanceLineItems.filter((_, i) => i !== index))
                              }}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Performance Area <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={item.area_label}
                              onChange={(e) => {
                                const updated = [...performanceLineItems]
                                updated[index].area_label = e.target.value
                                setPerformanceLineItems(updated)
                              }}
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
                                onChange={(e) => {
                                  const updated = [...performanceLineItems]
                                  updated[index].numeric_score = e.target.value
                                  setPerformanceLineItems(updated)
                                }}
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
                                onChange={(e) => {
                                  const updated = [...performanceLineItems]
                                  updated[index].descriptive_score = e.target.value
                                  setPerformanceLineItems(updated)
                                }}
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
                            onChange={(e) => {
                              const updated = [...performanceLineItems]
                              updated[index].comment = e.target.value
                              setPerformanceLineItems(updated)
                            }}
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
                    onClick={() => {
                      setIsPerformanceModalOpen(false)
                      setPerformanceSubjectId('')
                      setPerformanceLineItems([{ area_label: '', numeric_score: '', descriptive_score: '', comment: '' }])
                      setPerformanceFormError('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={performanceFormSubmitting}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {performanceFormSubmitting ? 'Saving...' : 'Save Performance'}
                  </button>
                </div>
              </form>
            </ContentCard>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {showConflictModal && existingPerformanceReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg mx-4">
            <ContentCard title="Performance Already Exists">
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  A performance record already exists for this student, subject, academic year, and term.
                </p>
                <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 text-sm text-warning-900">
                  <p className="font-medium mb-1">Existing Performance Areas:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {existingPerformanceReport.line_items.map((item, idx) => (
                      <li key={idx}>{item.area_label}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm text-gray-600">
                  You can either add these new performance areas to the existing record, or edit the existing record.
                </p>
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConflictModal(false)
                      setExistingPerformanceReport(null)
                      setPerformanceFormSubmitting(false)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      // Open edit modal with existing report
                      try {
                        const report = await performanceApi.getReport(existingPerformanceReport.id)
                        setEditingReportId(report.id)
                        setPerformanceSubjectId(report.subject_id)
                        setPerformanceLineItems(
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
                        setShowConflictModal(false)
                        setIsPerformanceModalOpen(false)
                        setIsEditModalOpen(true)
                        setPerformanceFormError('')
                      } catch (err: any) {
                        setPerformanceFormError('Failed to load existing performance report.')
                      }
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                  >
                    Edit Existing Records
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      // Merge new line items with existing ones
                      try {
                        setPerformanceFormSubmitting(true)
                        setShowConflictModal(false)

                        const classData = await classesApi.get(student.current_class!.id)

                        // Merge existing line items with new ones
                        const existingItems = existingPerformanceReport.line_items.map((item) => ({
                          area_label: item.area_label,
                          numeric_score: item.numeric_score ?? undefined,
                          descriptive_score: item.descriptive_score ?? undefined,
                          comment: item.comment ?? undefined,
                          position: existingPerformanceReport.line_items.indexOf(item) + 1,
                        }))

                        const newItems = validLineItems.map((item, index) => ({
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
                          position: existingItems.length + index + 1,
                        }))

                        // Update existing report with merged line items
                        await performanceApi.updateReport(existingPerformanceReport.id, {
                          line_items: [...existingItems, ...newItems],
                        })

                        showSuccessToast('Performance areas added to existing record successfully.')
                        setIsPerformanceModalOpen(false)
                        setPerformanceSubjectId('')
                        setPerformanceLineItems([{ area_label: '', numeric_score: '', descriptive_score: '', comment: '' }])
                        setExistingPerformanceReport(null)
                      } catch (err: any) {
                        const detail = err.response?.data?.detail
                        if (typeof detail === 'string') {
                          setPerformanceFormError(detail)
                        } else if (detail?.message) {
                          setPerformanceFormError(detail.message)
                        } else if (err.response?.data?.message) {
                          setPerformanceFormError(err.response.data.message)
                        } else {
                          setPerformanceFormError('Failed to update performance report. Please try again.')
                        }
                        setShowConflictModal(true)
                      } finally {
                        setPerformanceFormSubmitting(false)
                      }
                    }}
                    className="px-4 py-2 bg-success-600 text-white rounded-lg text-sm font-medium hover:bg-success-700"
                  >
                    Save (Add to Existing)
                  </button>
                </div>
              </div>
            </ContentCard>
          </div>
        </div>
      )}

      {/* Edit Performance Modal */}
      {isEditModalOpen && student.current_class && currentTerm && editingReportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <ContentCard title="Edit Performance">
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setPerformanceFormError('')

                  if (!performanceSubjectId) {
                    setPerformanceFormError('Please select a subject.')
                    return
                  }

                  const validLineItems = performanceLineItems.filter(
                    (item) =>
                      item.area_label.trim().length > 0 &&
                      (item.numeric_score?.trim() || item.descriptive_score?.trim()),
                  )

                  if (validLineItems.length === 0) {
                    setPerformanceFormError(
                      'Enter at least one performance area with either a numeric or descriptive score.',
                    )
                    return
                  }

                  if (validLineItems.length > 5) {
                    setPerformanceFormError('You can only enter a maximum of 5 performance areas.')
                    return
                  }

                  try {
                    setPerformanceFormSubmitting(true)

                    await performanceApi.updateReport(editingReportId, {
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
                    })

                    showSuccessToast('Performance report updated successfully.')
                    setIsEditModalOpen(false)
                    setEditingReportId(null)
                    setPerformanceSubjectId('')
                    setPerformanceLineItems([{ area_label: '', numeric_score: '', descriptive_score: '', comment: '' }])
                  } catch (err: any) {
                    const detail = err.response?.data?.detail
                    if (typeof detail === 'string') {
                      setPerformanceFormError(detail)
                    } else if (detail?.message) {
                      setPerformanceFormError(detail.message)
                    } else if (err.response?.data?.message) {
                      setPerformanceFormError(err.response.data.message)
                    } else {
                      setPerformanceFormError('Failed to update performance report. Please try again.')
                    }
                  } finally {
                    setPerformanceFormSubmitting(false)
                  }
                }}
                className="space-y-6"
              >
                {performanceFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {performanceFormError}
                  </div>
                )}

                {/* Pre-selected fields (disabled) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Student
                    </label>
                    <input
                      type="text"
                      value={`${student.first_name} ${student.last_name}`}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      value={student.current_class.academic_year || 'N/A'}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Term
                    </label>
                    <input
                      type="text"
                      value={currentTerm.name}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Class
                    </label>
                    <input
                      type="text"
                      value={student.current_class.name}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Subject selection (disabled in edit mode) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subjects.find((s) => s.id === performanceSubjectId)?.name || 'N/A'}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>

                {/* Performance Areas */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Performance Areas <span className="text-red-500">*</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        if (performanceLineItems.length < 5) {
                          setPerformanceLineItems([
                            ...performanceLineItems,
                            { area_label: '', numeric_score: '', descriptive_score: '', comment: '' },
                          ])
                        }
                      }}
                      disabled={performanceLineItems.length >= 5}
                      className="px-3 py-1 text-sm bg-primary-50 text-primary-700 border border-primary-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Area
                    </button>
                  </div>

                  <div className="space-y-3">
                    {performanceLineItems.map((item, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500 uppercase">
                            Area {index + 1}
                          </span>
                          {performanceLineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPerformanceLineItems(performanceLineItems.filter((_, i) => i !== index))
                              }}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Performance Area <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={item.area_label}
                              onChange={(e) => {
                                const updated = [...performanceLineItems]
                                updated[index].area_label = e.target.value
                                setPerformanceLineItems(updated)
                              }}
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
                                onChange={(e) => {
                                  const updated = [...performanceLineItems]
                                  updated[index].numeric_score = e.target.value
                                  setPerformanceLineItems(updated)
                                }}
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
                                onChange={(e) => {
                                  const updated = [...performanceLineItems]
                                  updated[index].descriptive_score = e.target.value
                                  setPerformanceLineItems(updated)
                                }}
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
                            onChange={(e) => {
                              const updated = [...performanceLineItems]
                              updated[index].comment = e.target.value
                              setPerformanceLineItems(updated)
                            }}
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
                    onClick={() => {
                      setIsEditModalOpen(false)
                      setEditingReportId(null)
                      setPerformanceSubjectId('')
                      setPerformanceLineItems([{ area_label: '', numeric_score: '', descriptive_score: '', comment: '' }])
                      setPerformanceFormError('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={performanceFormSubmitting}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {performanceFormSubmitting ? 'Saving...' : 'Update Performance'}
                  </button>
                </div>
              </form>
            </ContentCard>
          </div>
        </div>
      )}

      {/* View Performance Records Modal */}
      {isViewPerformanceModalOpen && student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-7xl mx-4 max-h-[90vh] overflow-y-auto">
            <ContentCard title="Performance Records">
              <div className="space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Academic Year
                    </label>
                    <select
                      value={performanceFilters.academic_year_id}
                      onChange={(e) => {
                        setPerformanceFilters({
                          ...performanceFilters,
                          academic_year_id: e.target.value,
                          term_id: '', // Reset term when academic year changes
                        })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">All Academic Years</option>
                      {academicYears.map((ay) => (
                        <option key={ay.id} value={ay.id}>
                          {ay.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Term
                    </label>
                    <select
                      value={performanceFilters.term_id}
                      onChange={(e) => {
                        setPerformanceFilters({
                          ...performanceFilters,
                          term_id: e.target.value,
                        })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      disabled={!performanceFilters.academic_year_id}
                    >
                      <option value="">All Terms</option>
                      {allTerms
                        .filter(
                          (t) =>
                            !performanceFilters.academic_year_id ||
                            t.academic_year_id === performanceFilters.academic_year_id,
                        )
                        .map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Performance Records Table */}
                {loadingPerformanceReports ? (
                  <div className="py-8 text-center text-gray-600 text-sm">Loading performance records...</div>
                ) : performanceReports.length === 0 ? (
                  <div className="py-8 text-center text-gray-600 text-sm">No performance records found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Academic Year
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Term
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Class
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subject
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Teacher
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Performance Area
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Numeric Score
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Descriptive Score
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Comment
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {performanceReports.flatMap((report: any) =>
                          (report.line_items || []).map((lineItem: any, itemIndex: number) => (
                            <tr key={`${report.id}-${itemIndex}`} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {report.academic_year?.name || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{report.term?.name || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{report.cls?.name || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{report.subject?.name || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {report.teacher
                                  ? `${report.teacher.first_name} ${report.teacher.last_name}`
                                  : 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{lineItem.area_label || '—'}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {lineItem.numeric_score !== null && lineItem.numeric_score !== undefined
                                  ? lineItem.numeric_score
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {lineItem.descriptive_score || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 max-w-md whitespace-normal break-words">
                                {lineItem.comment || '—'}
                              </td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Close Button */}
                <div className="flex items-center justify-end pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsViewPerformanceModalOpen(false)
                      setPerformanceReports([])
                      setPerformanceFilters({ academic_year_id: '', term_id: '' })
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </ContentCard>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default StudentDetailPage
