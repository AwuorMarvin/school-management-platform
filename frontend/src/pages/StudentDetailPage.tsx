import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { studentsApi, Student } from '../api/students'
import { useAuthStore } from '../store/authStore'

const StudentDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [changingStatus, setChangingStatus] = useState(false)

  useEffect(() => {
    if (id) {
      loadStudent()
    }
  }, [id])

  const loadStudent = async () => {
    try {
      setLoading(true)
      const data = await studentsApi.get(id!)
      setStudent(data)
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
                  <dt className="text-sm font-medium text-gray-500">First Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{student.first_name}</dd>
                </div>
                {student.middle_name && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Middle Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{student.middle_name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{student.last_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(student.date_of_birth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Age</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {Math.floor(
                      (new Date().getTime() - new Date(student.date_of_birth).getTime()) /
                        (365.25 * 24 * 60 * 60 * 1000)
                    )}{' '}
                    years
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
              </dl>
            </ContentCard>

            {/* Current Class */}
            {student.current_class && (
              <ContentCard>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Class</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Class Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <Link
                        to={`/classes/${student.current_class.id}`}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {student.current_class.name}
                      </Link>
                    </dd>
                  </div>
                  {student.current_class.academic_year && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Academic Year</dt>
                      <dd className="mt-1 text-sm text-gray-900">{student.current_class.academic_year}</dd>
                    </div>
                  )}
                </dl>
              </ContentCard>
            )}

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

            {/* Academic Performance */}
            <ContentCard>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Academic Performance</h2>
              <div className="space-y-2">
                <Link
                  to={`/students/${student.id}/performance`}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  View Performance Records
                </Link>
                {(isAdmin || user?.role === 'TEACHER') && (
                  <Link
                    to={`/students/${student.id}/performance/enter`}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Enter Performance
                  </Link>
                )}
              </div>
            </ContentCard>

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

            {/* Status Actions */}
            {user?.role === 'SCHOOL_ADMIN' && (
              <ContentCard>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Management</h3>
                <div className="space-y-2">
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
                </div>
              </ContentCard>
            )}

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
    </AppLayout>
  )
}

export default StudentDetailPage
