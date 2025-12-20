import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { clubActivitiesApi, ClubActivity } from '../api/clubActivities'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { termsApi, Term } from '../api/terms'
import { useAuthStore } from '../store/authStore'

const ClubActivitiesPage = () => {
  const { user } = useAuthStore()
  const [activities, setActivities] = useState<ClubActivity[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    activity_type: '' as '' | 'CLUB' | 'EXTRA_CURRICULAR',
    academic_year_id: '',
    term_id: '',
    search: '',
  })
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  })

  useEffect(() => {
    loadData()
  }, [pagination.page, filters.activity_type, filters.academic_year_id, filters.term_id, filters.search])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [academicYearsResponse, activitiesResponse] = await Promise.all([
        academicYearsApi.list({ page: 1, page_size: 100 }),
        clubActivitiesApi.list({
          page: pagination.page,
          page_size: pagination.page_size,
          activity_type: filters.activity_type || undefined,
          academic_year_id: filters.academic_year_id || undefined,
          term_id: filters.term_id || undefined,
          search: filters.search || undefined,
        }),
      ])
      
      setAcademicYears(academicYearsResponse.data)
      setActivities(activitiesResponse.data)
      setPagination(activitiesResponse.pagination)
      
      // Load terms if academic year is selected
      if (filters.academic_year_id) {
        const termsResponse = await termsApi.list({ academic_year_id: filters.academic_year_id })
        setTerms(termsResponse.data)
      } else {
        setTerms([])
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load club activities')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev, [name]: value }
      // Reset term if academic year changes
      if (name === 'academic_year_id') {
        newFilters.term_id = ''
      }
      return newFilters
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this club/activity?')) return
    
    try {
      await clubActivitiesApi.delete(id)
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete club activity')
    }
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <AppLayout>
      <PageHeader
        title="Clubs & Extra Curricular"
        subtitle="Manage clubs and extra-curricular activities"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/dashboard" />
            {isAdmin && (
              <Link
                to="/club-activities/new"
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={filters.activity_type}
                onChange={(e) => handleFilterChange('activity_type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Types</option>
                <option value="CLUB">Club</option>
                <option value="EXTRA_CURRICULAR">Extra Curricular</option>
              </select>
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
                <option value="">All Years</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Term
              </label>
              <select
                value={filters.term_id}
                onChange={(e) => handleFilterChange('term_id', e.target.value)}
                disabled={!filters.academic_year_id}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">All Terms</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ activity_type: '', academic_year_id: '', term_id: '', search: '' })}
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
              <p className="mt-4 text-gray-600">Loading club activities...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No club activities found.</p>
              {isAdmin && (
                <Link
                  to="/club-activities/new"
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
                >
                  Create your first club/activity
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost per Term
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher/Instructor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Academic Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Term
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
                  {activities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{activity.service_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          activity.activity_type === 'CLUB' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {activity.activity_type === 'CLUB' ? 'Club' : 'Extra Curricular'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        KES {parseFloat(activity.cost_per_term).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {activity.teacher 
                          ? `${activity.teacher.first_name} ${activity.teacher.last_name}`
                          : 'Not assigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {activity.academic_year?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {activity.term?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {activity.classes && activity.classes.length > 0
                          ? activity.classes.map(c => c.name).join(', ')
                          : 'None'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {isAdmin && (
                          <>
                            <Link
                              to={`/club-activities/${activity.id}/edit`}
                              className="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(activity.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && activities.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.page_size) + 1} to{' '}
                {Math.min(pagination.page * pagination.page_size, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.total_pages}
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

export default ClubActivitiesPage

