import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { parentsApi, Parent } from '../api/parents'

const ParentDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  
  const [parent, setParent] = useState<Parent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      loadParent()
    }
  }, [id])

  const loadParent = async () => {
    try {
      setLoading(true)
      const data = await parentsApi.get(id!)
      setParent(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load parent')
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/parents"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {parent.first_name} {parent.last_name}
                </h1>
                <p className="text-sm text-gray-600 mt-1">Parent Details</p>
              </div>
            </div>
            <Link
              to={`/parents/${id}/edit`}
              className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors font-medium"
            >
              Edit Parent
            </Link>
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
              </dl>
            </div>

            {/* Linked Students */}
            {parent.students && parent.students.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Linked Students</h2>
                <div className="space-y-4">
                  {parent.students.map((student) => (
                    <div
                      key={student.student_id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <Link
                            to={`/students/${student.student_id}`}
                            className="font-medium text-primary-600 hover:text-primary-700"
                          >
                            {student.student_name}
                          </Link>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">{student.role}</span>
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Status: {student.student_status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
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

