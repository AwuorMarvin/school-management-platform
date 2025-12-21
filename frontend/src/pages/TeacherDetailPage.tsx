import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import StatusBadge from '../components/StatusBadge'
import TeacherAssignmentModal from '../components/TeacherAssignmentModal'
import { teachersApi, Teacher, TeacherAssignment } from '../api/teachers'
import { useAuthStore } from '../store/authStore'
import { Phone, Mail, Calendar, User, MapPin, Hash, GraduationCap } from 'lucide-react'

const TeacherDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [removingAssignment, setRemovingAssignment] = useState<string | null>(null)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustingAssignment, setAdjustingAssignment] = useState<TeacherAssignment | null>(null)

  useEffect(() => {
    if (id) {
      loadTeacher()
    }
  }, [id])

  const loadTeacher = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await teachersApi.get(id!)
      setTeacher(data)
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to load teacher')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to end this assignment? This will set the end date to today.')) {
      return
    }

    try {
      setRemovingAssignment(assignmentId)
      await teachersApi.removeAssignment(id!, assignmentId)
      await loadTeacher() // Reload to get updated status
    } catch (err: any) {
      alert(err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to remove assignment')
    } finally {
      setRemovingAssignment(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatPhoneNumber = (phone: string) => {
    // Format +254712345678 as +254 712 345 678
    return phone.replace(/(\+254)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading teacher...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !teacher) {
    return (
      <AppLayout>
        <PageHeader title="Error" subtitle={error || 'Teacher not found'} />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">{error || 'Teacher not found'}</p>
              <Link to="/teachers" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
                ← Back to Teachers
              </Link>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'
  const teacherName = `${teacher.salutation} ${teacher.first_name} ${teacher.middle_name || ''} ${teacher.last_name}`.trim()

  return (
    <AppLayout>
      <PageHeader
        title={teacherName}
        subtitle="Teacher Profile"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/teachers" />
            {isAdmin && (
              <Link
                to={`/teachers/${id}/edit`}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Edit Profile
              </Link>
            )}
          </div>
        }
      />

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section A: Teacher Profile */}
            <ContentCard>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Teacher Profile</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">{teacherName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a
                      href={`tel:${teacher.phone_number}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      {formatPhoneNumber(teacher.phone_number)}
                    </a>
                  </dd>
                </div>
                {teacher.email && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <a
                        href={`mailto:${teacher.email}`}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        {teacher.email}
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    National ID
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">{teacher.national_id}</dd>
                </div>
                {teacher.tsc_number && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      TSC Number
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">{teacher.tsc_number}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date of Birth
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(teacher.date_of_birth)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Gender</dt>
                  <dd className="mt-1 text-sm text-gray-900">{teacher.gender}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Campus
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">{teacher.campus.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <StatusBadge
                      status={teacher.status}
                      variant={teacher.status === 'ACTIVE' ? 'success' : 'default'}
                    />
                  </dd>
                </div>
                {teacher.status_reason && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Status Reason</dt>
                    <dd className="mt-1 text-sm text-gray-600">{teacher.status_reason}</dd>
                  </div>
                )}
              </dl>
            </ContentCard>

            {/* Section B: Current Assignments */}
            <ContentCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Current Assignments</h2>
                {isAdmin && (
                  <button
                    onClick={() => setAssignmentModalOpen(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                  >
                    Add Assignment
                  </button>
                )}
              </div>
              {teacher.current_assignments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No active assignments</p>
                  {isAdmin && (
                    <button
                      onClick={() => setAssignmentModalOpen(true)}
                      className="mt-4 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                      Add First Assignment
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Class Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subject(s)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Students in Class
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Start Date
                        </th>
                        {isAdmin && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {teacher.current_assignments.map((assignment) => (
                        <tr key={assignment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.class.name}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {assignment.subjects.map(s => s.name).join(', ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {assignment.students_in_class}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatDate(assignment.start_date)}
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => {
                                    setAdjustingAssignment(assignment)
                                    setAdjustModalOpen(true)
                                  }}
                                  className="text-primary-600 hover:text-primary-900"
                                >
                                  Adjust
                                </button>
                                <button
                                  onClick={() => handleRemoveAssignment(assignment.id)}
                                  disabled={removingAssignment === assignment.id}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                >
                                  {removingAssignment === assignment.id ? 'Removing...' : 'Remove'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ContentCard>

            {/* Section C: Assignment History (Collapsible) */}
            {teacher.assignment_history.length > 0 && (
              <ContentCard>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <h2 className="text-lg font-semibold text-gray-900">Assignment History</h2>
                  <span className="text-sm text-gray-500">
                    {showHistory ? 'Hide' : 'Show'} ({teacher.assignment_history.length})
                  </span>
                </button>
                {showHistory && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Class Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subject(s)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Start Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            End Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Duration
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {teacher.assignment_history.map((history) => (
                          <tr key={history.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {history.class.name}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {history.subjects.map(s => s.name).join(', ')}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDate(history.start_date)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDate(history.end_date)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {history.duration_days} days
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ContentCard>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ContentCard>
              <h3 className="text-sm font-medium text-gray-500 mb-4">Quick Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(teacher.created_at)}</dd>
                </div>
                {teacher.updated_at && (
                  <div>
                    <dt className="text-xs text-gray-500">Last Updated</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(teacher.updated_at)}</dd>
                  </div>
                )}
              </dl>
            </ContentCard>
          </div>
        </div>
      </div>

      {/* Add Assignment Modal */}
      {teacher && (
        <TeacherAssignmentModal
          isOpen={assignmentModalOpen}
          onClose={() => setAssignmentModalOpen(false)}
          teacherId={teacher.id}
          teacherName={`${teacher.salutation} ${teacher.first_name} ${teacher.middle_name || ''} ${teacher.last_name}`.trim()}
          teacherCampusId={teacher.campus.id}
          onAssignmentSuccess={() => {
            loadTeacher()
            setAssignmentModalOpen(false)
          }}
        />
      )}

      {/* Adjust Assignment Modal */}
      {teacher && adjustingAssignment && (
        <TeacherAssignmentModal
          isOpen={adjustModalOpen}
          onClose={() => {
            setAdjustModalOpen(false)
            setAdjustingAssignment(null)
          }}
          teacherId={teacher.id}
          teacherName={`${teacher.salutation} ${teacher.first_name} ${teacher.middle_name || ''} ${teacher.last_name}`.trim()}
          teacherCampusId={teacher.campus.id}
          mode="adjust"
          assignment={adjustingAssignment}
          onAssignmentSuccess={() => {
            loadTeacher()
            setAdjustModalOpen(false)
            setAdjustingAssignment(null)
          }}
        />
      )}
    </AppLayout>
  )
}

export default TeacherDetailPage

