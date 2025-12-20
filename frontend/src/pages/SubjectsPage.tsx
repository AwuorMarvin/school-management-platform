import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { subjectsApi, Subject } from '../api/subjects'
import { useAuthStore } from '../store/authStore'

const SubjectsPage = () => {
  const { user } = useAuthStore()
  const [subjects, setSubjects] = useState<Subject[]>([])
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

  useEffect(() => {
    loadSubjects()
  }, [pagination.page, search])

  const loadSubjects = async () => {
    try {
      setLoading(true)
      const response = await subjectsApi.list({
        page: pagination.page,
        page_size: pagination.page_size,
        search: search || undefined,
      })
      setSubjects(response.data)
      setPagination(response.pagination)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <AppLayout>
      <PageHeader
        title="Subjects/Units"
        subtitle="Manage subjects and units across all classes"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/dashboard" />
            {isAdmin && (
              <Link
                to="/subjects/new"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Add New
              </Link>
            )}
          </div>
        }
      />

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm">
            {error}
          </div>
        )}

        {/* Search */}
        <ContentCard className="mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                placeholder="Search by name or code..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </ContentCard>

        <ContentCard>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading subjects...</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No subjects found.</p>
              {isAdmin && (
                <Link
                  to="/subjects/new"
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
                >
                  Create your first subject
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Classes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {subject.code || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {subject.classes && subject.classes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {subject.classes.map((cls, idx) => (
                              <span key={cls.id} className="px-2 py-1 bg-primary-50 text-primary-700 rounded text-xs">
                                {cls.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">No classes assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/subjects/${subject.id}`}
                          className="text-primary-600 hover:text-primary-900 mr-4"
                        >
                          View
                        </Link>
                        {isAdmin && (
                          <Link
                            to={`/subjects/${subject.id}/edit`}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            Edit
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && subjects.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.page_size) + 1} to{' '}
                {Math.min(pagination.page * pagination.page_size, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={!pagination.has_previous}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={!pagination.has_next}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default SubjectsPage

