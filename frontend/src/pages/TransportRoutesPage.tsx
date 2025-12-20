import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { transportRoutesApi, TransportRoute } from '../api/transportRoutes'
import { useAuthStore } from '../store/authStore'

const TransportRoutesPage = () => {
  const { user } = useAuthStore()
  const [routes, setRoutes] = useState<TransportRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
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
  }, [pagination.page, filters.search])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const response = await transportRoutesApi.list({
        page: pagination.page,
        page_size: pagination.page_size,
        search: filters.search || undefined,
      })
      
      setRoutes(response.data)
      setPagination(response.pagination)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load transport routes')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transport route?')) return
    
    try {
      await transportRoutesApi.delete(id)
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete transport route')
    }
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <AppLayout>
      <PageHeader
        title="Transport Routes"
        subtitle="Manage school transport routes and zones"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/dashboard" />
            {isAdmin && (
              <Link
                to="/transport-routes/new"
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
                placeholder="Search by zone or description..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ search: '' })}
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
              <p className="mt-4 text-gray-600">Loading transport routes...</p>
            </div>
          ) : routes.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No transport routes found.</p>
              {isAdmin && (
                <Link
                  to="/transport-routes/new"
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
                >
                  Create your first transport route
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      One Way (Term)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Two Way (Term)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {routes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{route.zone}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {route.description || 'No description'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        KES {parseFloat(route.one_way_cost_per_term).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        KES {parseFloat(route.two_way_cost_per_term).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {isAdmin && (
                          <>
                            <Link
                              to={`/transport-routes/${route.id}/edit`}
                              className="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(route.id)}
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
          {!loading && routes.length > 0 && (
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

export default TransportRoutesPage

