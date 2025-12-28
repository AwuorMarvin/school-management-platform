import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { transportRoutesApi, TransportRouteCreate, TransportRouteUpdate, TransportRoute as _TransportRoute } from '../api/transportRoutes'
import { useAuthStore } from '../store/authStore'

const TransportRouteFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    zone: '',
    description: '',
    one_way_cost_per_term: '0.00',
    two_way_cost_per_term: '0.00',
  })

  useEffect(() => {
    if (isEdit && id) {
      loadRoute()
    }
  }, [id, isEdit])

  const loadRoute = async () => {
    try {
      setLoading(true)
      const route = await transportRoutesApi.get(id!)
      setFormData({
        zone: route.zone,
        description: route.description || '',
        one_way_cost_per_term: route.one_way_cost_per_term,
        two_way_cost_per_term: route.two_way_cost_per_term,
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load transport route')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isEdit && id) {
        const data: TransportRouteUpdate = {
          zone: formData.zone,
          description: formData.description || null,
          one_way_cost_per_term: formData.one_way_cost_per_term,
          two_way_cost_per_term: formData.two_way_cost_per_term,
        }
        await transportRoutesApi.update(id, data)
        navigate('/transport-routes')
      } else {
        const data: TransportRouteCreate = {
          zone: formData.zone,
          description: formData.description || null,
          one_way_cost_per_term: formData.one_way_cost_per_term,
          two_way_cost_per_term: formData.two_way_cost_per_term,
        }
        await transportRoutesApi.create(data)
        navigate('/transport-routes')
      }
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail
      if (typeof errorDetail === 'string') {
        setError(errorDetail)
      } else if (errorDetail?.message) {
        setError(errorDetail.message)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to save transport route. Please check all fields.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  if (loading && isEdit) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading transport route...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'
  const backUrl = '/transport-routes'

  if (!isAdmin) {
    return (
      <AppLayout>
        <PageHeader title="Access Denied" subtitle="Only administrators can manage transport routes" />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">You don't have permission to access this page.</p>
              <Link to={backUrl} className="mt-4 inline-block text-primary-600 hover:text-primary-700">
                ← Back
              </Link>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? 'Edit Transport Route' : 'Add New Transport Route'}
        subtitle={isEdit ? 'Update transport route information' : 'Create a new transport route/zone'}
        action={
          <div className="flex items-center gap-2">
            <BackButton to={backUrl} />
            <Link
              to={backUrl}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            >
              Cancel
            </Link>
          </div>
        }
      />

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm">
            {error}
          </div>
        )}
        <ContentCard>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Route Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="zone" className="block text-sm font-medium text-gray-700 mb-2">
                    Zone <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="zone"
                    name="zone"
                    value={formData.zone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., Zone A, Westlands"
                  />
                </div>

                <div>
                  <label htmlFor="one_way_cost_per_term" className="block text-sm font-medium text-gray-700 mb-2">
                    One Way Cost per Term (KES) <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="one_way_cost_per_term"
                    name="one_way_cost_per_term"
                    value={formData.one_way_cost_per_term}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor="two_way_cost_per_term" className="block text-sm font-medium text-gray-700 mb-2">
                    Two Way Cost per Term (KES) <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="two_way_cost_per_term"
                    name="two_way_cost_per_term"
                    value={formData.two_way_cost_per_term}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Description of the transport route/zone..."
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                to={backUrl}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Route' : 'Create Route'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default TransportRouteFormPage

