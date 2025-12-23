import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { parentsApi, Parent } from '../api/parents'
import { studentsApi } from '../api/students'
import { classesApi, TeacherInClass } from '../api/classes'
import { feeSummaryApi, StudentFeeSummaryResponse } from '../api/feeSummary'

const ParentDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  
  const [parent, setParent] = useState<Parent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentDetails, setStudentDetails] = useState<
    Record<
      string,
      {
        className?: string
        teachers: string[]
        subjects: string[]
        feeSummary?: StudentFeeSummaryResponse
      }
    >
  >({})

  useEffect(() => {
    if (id) {
      void loadParent()
    }
  }, [id])

  const loadParent = async () => {
    try {
      setLoading(true)
      const data = await parentsApi.get(id!)
      setParent(data)

      if (data.students && data.students.length > 0) {
        await loadStudentDetails(data)
      } else {
        setStudentDetails({})
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load parent')
    } finally {
      setLoading(false)
    }
  }

  const loadStudentDetails = async (parentData: Parent) => {
    const detailsMap: Record<
      string,
      {
        className?: string
        teachers: string[]
        subjects: string[]
        feeSummary?: StudentFeeSummaryResponse
      }
    > = {}

    const uniqueStudentIds = Array.from(
      new Set((parentData.students || []).map((s) => s.student_id))
    )

    await Promise.all(
      uniqueStudentIds.map(async (studentId) => {
        try {
          const student = await studentsApi.get(studentId)

          const classId = student.current_class?.id
          let className: string | undefined
          const teachers = new Set<string>()
          const subjects = new Set<string>()

          if (classId) {
            className = student.current_class?.name
            try {
              const teacherResponse = await classesApi.listTeachers(classId)
              const teachersInClass: TeacherInClass[] = teacherResponse.data

              teachersInClass.forEach((assignment) => {
                if (assignment.teacher) {
                  teachers.add(
                    `${assignment.teacher.first_name} ${assignment.teacher.last_name}`
                  )
                }

                if (assignment.subject) {
                  subjects.add(assignment.subject.name)
                }
              })
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('Failed to load teachers for class', classId, err)
            }
          }

          let feeSummary: StudentFeeSummaryResponse | undefined
          try {
            feeSummary = await feeSummaryApi.getStudentSummary(studentId)
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to load fee summary for student', studentId, err)
          }

          detailsMap[studentId] = {
            className,
            teachers: Array.from(teachers),
            subjects: Array.from(subjects),
            feeSummary,
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to load student details', studentId, err)
        }
      })
    )

    setStudentDetails(detailsMap)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading parent...</p>
        </div>
      </div>
    )
  }

  if (error || !parent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-error-600 mb-4">{error || 'Parent not found'}</p>
          <Link
            to="/parents"
            className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to Parents
          </Link>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-success-100 text-success-800 border-success-200'
      case 'PENDING_SETUP':
        return 'bg-warning-100 text-warning-800 border-warning-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getParentTypes = () => {
    if (!parent.students || parent.students.length === 0) {
      return '—'
    }

    const labelMap: Record<string, string> = {
      FATHER: 'Father',
      MOTHER: 'Mother',
      GUARDIAN: 'Guardian',
    }

    const roles = Array.from(
      new Set(parent.students.map((s) => s.role).filter(Boolean))
    )

    if (roles.length === 0) {
      return '—'
    }

    return roles
      .map((role) => labelMap[role] || role)
      .join(', ')
  }

  const getPlatformAge = () => {
    const created = new Date(parent.created_at)
    const now = new Date()

    let years = now.getFullYear() - created.getFullYear()
    let months = now.getMonth() - created.getMonth()
    let days = now.getDate() - created.getDate()

    if (days < 0) {
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      days += prevMonth.getDate()
      months -= 1
    }

    if (months < 0) {
      months += 12
      years -= 1
    }

    if (years < 0) {
      years = 0
      months = 0
      days = 0
    }

    return { years, months, days }
  }

  const platformAge = getPlatformAge()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {parent.first_name} {parent.last_name}
              </h1>
              <p className="text-sm text-gray-600 mt-1">Parent Details</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/parents"
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Back
              </Link>
              <Link
                to={`/parents/${id}/edit`}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors font-medium text-sm"
              >
                Edit Parent
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">{parent.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
                  <dd className="mt-1 text-sm text-gray-900">{parent.phone_number}</dd>
                </div>
              </dl>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">First Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{parent.first_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{parent.last_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">ID Number</dt>
                  <dd className="mt-1 text-sm text-gray-900">{parent.id_number}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                        parent.status
                      )}`}
                    >
                      {parent.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Parent Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{getParentTypes()}</dd>
                </div>
              </dl>
            </div>

            {/* Linked Students */}
            {parent.students && parent.students.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Linked Students</h2>
                <div className="space-y-4">
                  {parent.students.map((student) => {
                    const details = studentDetails[student.student_id]
                    const teachers = details?.teachers || []
                    const subjects = details?.subjects || []
                    const fee = details?.feeSummary

                    return (
                      <div
                        key={student.student_id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <Link
                                to={`/students/${student.student_id}`}
                                className="font-medium text-primary-600 hover:text-primary-700"
                              >
                                {student.student_name}
                              </Link>
                              <p className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">
                                  {student.role === 'FATHER' && 'Father'}
                                  {student.role === 'MOTHER' && 'Mother'}
                                  {student.role === 'GUARDIAN' && 'Guardian'}
                                  {!['FATHER', 'MOTHER', 'GUARDIAN'].includes(student.role) && student.role}
                                </span>
                                {student.student_status && (
                                  <span className="text-gray-500">
                                    {' '}
                                    • Status: {student.student_status}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <dt className="text-gray-500">Class</dt>
                              <dd className="mt-1 text-gray-900">
                                {details?.className || 'N/A'}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Teachers</dt>
                              <dd className="mt-1 text-gray-900">
                                {teachers.length > 0 ? teachers.join(', ') : '—'}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Subjects</dt>
                              <dd className="mt-1 text-gray-900">
                                {subjects.length > 0 ? subjects.join(', ') : '—'}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Fee Balance</dt>
                              <dd className="mt-1 text-gray-900">
                                {fee
                                  ? `Pending: ${fee.pending_amount.toLocaleString('en-KE', {
                                      style: 'currency',
                                      currency: 'KES',
                                    })} (Paid: ${fee.paid_amount.toLocaleString('en-KE', {
                                      style: 'currency',
                                      currency: 'KES',
                                    })}, Expected: ${fee.expected_fee.toLocaleString('en-KE', {
                                      style: 'currency',
                                      currency: 'KES',
                                    })})`
                                  : '—'}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {(!parent.students || parent.students.length === 0) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Linked Students</h2>
                <p className="text-gray-600 text-sm">No students linked to this parent yet.</p>
                <p className="text-gray-500 text-sm mt-2">
                  Link this parent to a student from the student's detail page.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Parent ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{parent.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">User ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{parent.user_id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">School ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{parent.school_id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(parent.created_at).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(parent.updated_at).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Platform Age</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {platformAge.years} years, {platformAge.months} months, {platformAge.days} days
                  </dd>
                </div>
              </dl>
            </div>

            {/* Account Status Info */}
            {parent.status === 'PENDING_SETUP' && (
              <div className="bg-warning-50 border border-warning-200 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-warning-900 mb-2">Account Setup Pending</h3>
                <p className="text-sm text-warning-800">
                  This parent account is waiting for the user to complete setup. An SMS with a setup link has been sent to {parent.phone_number}.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default ParentDetailPage

