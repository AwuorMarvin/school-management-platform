import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { studentsApi, Student } from '../api/students'

const StudentsPage = () => {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false,
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    loadStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, statusFilter])

  const loadStudents = async () => {
    try {
      setLoading(true)
      setError('')
      const skip = (pagination.page - 1) * pagination.page_size
      const response = await studentsApi.list({
        skip,
        limit: pagination.page_size,
        status: statusFilter || undefined,
        search: search || undefined,
      })
      setStudents(response.data)
      setPagination(response.pagination)
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setTimeout(() => {
      loadStudents()
    }, 100)
  }

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Students"
        subtitle="Manage student records"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/dashboard" />
            <Link
              to="/students/new"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Add Student
            </Link>
          </div>
        }
      />

      <div className="p-8">
        {/* Filters */}
        <ContentCard>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Search
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="COMPLETED">Completed</option>
                <option value="TRANSFERRED_OUT">Transferred Out</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch('')
                  setStatusFilter('')
                  setPagination((prev) => ({ ...prev, page: 1 }))
                  loadStudents()
                }}
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </ContentCard>

        {/* Students Table */}
        <ContentCard
          title={`Students (${pagination.total})`}
          className="mt-6"
        >
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading students...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-error-600">{error}</p>
              <button
                onClick={loadStudents}
                className="mt-4 px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No students found.</p>
              <Link
                to="/students/new"
                className="mt-4 inline-block px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                Add First Student
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fee Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {student.first_name} {student.middle_name || ''} {student.last_name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            DOB: {new Date(student.date_of_birth).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {student.current_class?.name || 'N/A'}
                          </div>
                          {student.current_class?.academic_year && (
                            <div className="text-xs text-gray-500 mt-1">
                              {student.current_class.academic_year}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {student.fee_balance
                              ? formatCurrency(parseFloat(student.fee_balance.pending_amount))
                              : formatCurrency(0)}
                          </div>
                          {student.fee_balance && parseFloat(student.fee_balance.pending_amount) > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              Expected: {formatCurrency(parseFloat(student.fee_balance.expected_amount))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                              student.status === 'ACTIVE'
                                ? 'bg-success-100 text-success-800 border-success-200'
                                : student.status === 'COMPLETED'
                                ? 'bg-primary-100 text-primary-800 border-primary-200'
                                : student.status === 'TRANSFERRED_OUT'
                                ? 'bg-gray-100 text-gray-800 border-gray-200'
                                : 'bg-warning-100 text-warning-800 border-warning-200'
                            }`}
                          >
                            {student.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/students/${student.id}`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              View
                            </Link>
                            <Link
                              to={`/students/${student.id}/edit`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => {
                                // TODO: Implement quick actions (e.g., change status, view fees, etc.)
                                console.log('Quick action for student:', student.id)
                              }}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              Actions
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.total_pages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-700">
                    Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
                    {Math.min(pagination.page * pagination.page_size, pagination.total)} of{' '}
                    {pagination.total} results
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={!pagination.has_previous}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={!pagination.has_next}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default StudentsPage
