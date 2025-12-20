import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import BackButton from '../components/BackButton'
import { teachersApi, TeacherListItem } from '../api/teachers'
import { campusesApi, Campus } from '../api/campuses'
import { useAuthStore } from '../store/authStore'
import { Users, UserCheck, UserX } from 'lucide-react'

const TeachersPage = () => {
  const { user } = useAuthStore()
  const [teachers, setTeachers] = useState<TeacherListItem[]>([])
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
  const [campusFilter, setCampusFilter] = useState<string>('')
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  })

  useEffect(() => {
    loadCampuses()
    loadTeachers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, statusFilter, campusFilter])

  const loadCampuses = async () => {
    try {
      const response = await campusesApi.list()
      setCampuses(response.data)
    } catch (err) {
      console.error('Failed to load campuses:', err)
    }
  }

  const loadTeachers = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await teachersApi.list({
        page: pagination.page,
        page_size: pagination.page_size,
        status: statusFilter ? (statusFilter as 'ACTIVE' | 'INACTIVE') : undefined,
        campus_id: campusFilter || undefined,
        search: search || undefined,
      })
      setTeachers(response.data)
      setPagination(response.pagination)
      
      // Calculate stats
      const active = response.data.filter(t => t.status === 'ACTIVE').length
      const inactive = response.data.filter(t => t.status === 'INACTIVE').length
      setStats({
        total: response.pagination.total,
        active: active,
        inactive: inactive,
      })
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to load teachers')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setTimeout(() => {
      loadTeachers()
    }, 100)
  }

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleCampusChange = (campusId: string) => {
    setCampusFilter(campusId)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const formatSubjectRatio = (ratio: number | null): string => {
    if (ratio === null) return '–'
    return `${ratio.toFixed(1)} students/subject`
  }

  const showCampusFilter = user?.role === 'SCHOOL_ADMIN' && campuses.length > 1

  return (
    <AppLayout>
      <PageHeader
        title="Teachers"
        subtitle="Manage teacher records and assignments"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/dashboard" />
            <Link
              to="/teachers/new"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Add Teacher
            </Link>
          </div>
        }
      />

      <div className="p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard
            title="Total Teachers"
            value={stats.total}
            subtitle="All teachers in school"
            icon={<Users className="h-8 w-8" />}
            borderColor="blue"
          />
          <StatCard
            title="Active Teachers"
            value={stats.active}
            subtitle="Currently assigned to classes"
            icon={<UserCheck className="h-8 w-8" />}
            borderColor="green"
          />
          <StatCard
            title="Inactive Teachers"
            value={stats.inactive}
            subtitle="Not currently assigned"
            icon={<UserX className="h-8 w-8" />}
            borderColor="red"
          />
        </div>

        {/* Filters */}
        <ContentCard>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name, phone, ID..."
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
            {showCampusFilter && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Campus</label>
                <select
                  value={campusFilter}
                  onChange={(e) => handleCampusChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                >
                  <option value="">All Campuses</option>
                  {campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch('')
                  setStatusFilter('')
                  setCampusFilter('')
                  setPagination((prev) => ({ ...prev, page: 1 }))
                  loadTeachers()
                }}
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </ContentCard>

        {/* Teachers Table */}
        <ContentCard
          title={`Teachers (${pagination.total})`}
          className="mt-6"
        >
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading teachers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-error-600">{error}</p>
              <button
                onClick={loadTeachers}
                className="mt-4 px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No teachers found.</p>
              <Link
                to="/teachers/new"
                className="mt-4 inline-block px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                Add First Teacher
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Teacher Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subjects Taught
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Classes Taught
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Students
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject Ratio
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
                    {teachers.map((teacher) => (
                      <tr key={teacher.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {teacher.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {teacher.phone_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {teacher.campus.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {teacher.subjects_taught}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {teacher.classes_taught}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {teacher.total_students}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatSubjectRatio(teacher.subject_ratio)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge
                            status={teacher.status}
                            variant={teacher.status === 'ACTIVE' ? 'success' : 'default'}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/teachers/${teacher.id}`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              View
                            </Link>
                            <Link
                              to={`/teachers/${teacher.id}/edit`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              Edit
                            </Link>
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

export default TeachersPage

