import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { termsApi, Term } from '../api/terms'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { useAuthStore } from '../store/authStore'

const TermsPage = () => {
  const { user } = useAuthStore()
  const [terms, setTerms] = useState<Term[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    academic_year_id: '',
    search: '',
  })
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false,
  })

  useEffect(() => {
    loadAcademicYears()
    loadTerms()
  }, [pagination.page, filters.academic_year_id, filters.search])

  const loadAcademicYears = async () => {
    try {
      const response = await academicYearsApi.list({ page: 1, page_size: 100 })
      setAcademicYears(response.data)
    } catch (err: any) {
      console.error('Failed to load academic years:', err)
    }
  }

  const loadTerms = async () => {
    try {
      setLoading(true)
      const response = await termsApi.list({
        page: pagination.page,
        page_size: pagination.page_size,
        academic_year_id: filters.academic_year_id || undefined,
      })
      
      // Filter by search if provided
      let filteredTerms = response.data
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filteredTerms = response.data.filter(term => 
          term.name.toLowerCase().includes(searchLower) ||
          term.academic_year?.name.toLowerCase().includes(searchLower)
        )
      }
      
      setTerms(filteredTerms)
      setPagination(response.pagination)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load terms')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <AppLayout>
      <PageHeader
        title="Terms"
        subtitle="Manage terms within academic years"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/dashboard" />
            {isAdmin && (
              <Link
                to="/terms/new"
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

        {/* Filters */}
        <ContentCard className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by name or academic year..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Academic Year
              </label>
              <select
                value={filters.academic_year_id}
                onChange={(e) => handleFilterChange('academic_year_id', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Academic Years</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ academic_year_id: '', search: '' })}
                className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </ContentCard>

        <ContentCard>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading terms...</p>
            </div>
          ) : terms.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No terms found.</p>
              {isAdmin && (
                <Link
                  to="/terms/new"
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
                >
                  Create your first term
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Term Name
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {terms.map((term) => {
                    const today = new Date()
                    const startDate = new Date(term.start_date)
                    const endDate = new Date(term.end_date)
                    const isCurrent = startDate <= today && today <= endDate
                    const status = isCurrent ? 'ACTIVE' : (today > endDate ? 'ARCHIVED' : 'UPCOMING')
                    
                    return (
                      <tr key={term.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{term.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {term.academic_year?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(term.start_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(term.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            status === 'ACTIVE' 
                              ? 'bg-success-100 text-success-700' 
                              : status === 'ARCHIVED'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-primary-100 text-primary-700'
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            to={`/terms/${term.id}/edit`}
                            className="text-primary-600 hover:text-primary-900 mr-4"
                          >
                            Edit
                          </Link>
                          <Link
                            to={`/academic-years/${term.academic_year_id}`}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            View Academic Year
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && terms.length > 0 && (
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

export default TermsPage

