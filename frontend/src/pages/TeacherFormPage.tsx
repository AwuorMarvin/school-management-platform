import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { teachersApi, TeacherCreate } from '../api/teachers'
import { campusesApi, Campus } from '../api/campuses'
import { useAuthStore } from '../store/authStore'

const TeacherFormPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [loadingCampuses, setLoadingCampuses] = useState(false)
  const [error, setError] = useState('')
  const [campuses, setCampuses] = useState<Campus[]>([])
  
  const [formData, setFormData] = useState({
    email: '',
    phone_number: '',
    first_name: '',
    last_name: '',
    campus_id: '',
  })

  useEffect(() => {
    loadCampuses()
    // Auto-set campus if user has only one campus
    if (user?.campus_id && user.role === 'CAMPUS_ADMIN') {
      setFormData(prev => ({ ...prev, campus_id: user.campus_id! }))
    }
  }, [user])

  const loadCampuses = async () => {
    try {
      setLoadingCampuses(true)
      const response = await campusesApi.list()
      setCampuses(response.data)
      
      // Auto-select campus if only one
      if (response.data.length === 1) {
        setFormData(prev => ({ ...prev, campus_id: response.data[0].id }))
      } else if (user?.campus_id && user.role === 'CAMPUS_ADMIN') {
        // CAMPUS_ADMIN with single campus
        setFormData(prev => ({ ...prev, campus_id: user.campus_id! }))
      }
    } catch (err: any) {
      console.error('Failed to load campuses:', err)
    } finally {
      setLoadingCampuses(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validate required fields
    if (!formData.email || !formData.phone_number || !formData.first_name || !formData.last_name) {
      setError('All fields are required')
      return
    }

    // Validate phone number format
    if (!formData.phone_number.startsWith('+254')) {
      setError('Phone number must start with +254 (Kenya format)')
      return
    }

    // CAMPUS_ADMIN must provide campus_id
    if (user?.role === 'CAMPUS_ADMIN' && !formData.campus_id) {
      setError('Campus is required')
      return
    }
    
    setLoading(true)

    try {
      const data: TeacherCreate = {
        email: formData.email,
        phone_number: formData.phone_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        campus_id: formData.campus_id || undefined,
      }
      await teachersApi.create(data)
      navigate('/users?role=TEACHER')
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail
      if (typeof errorDetail === 'string') {
        setError(errorDetail)
      } else if (errorDetail?.message) {
        setError(errorDetail.message)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to create teacher. Please check all required fields.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const showCampusSelector = campuses.length > 1 || (user?.role === 'SCHOOL_ADMIN' && campuses.length > 0)
  const selectedCampus = campuses.find(c => c.id === formData.campus_id)

  return (
    <AppLayout>
      <PageHeader
        title="Add New Teacher"
        subtitle="Create a new teacher account. They will receive a setup link via SMS."
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/users?role=TEACHER" />
            <Link
              to="/users?role=TEACHER"
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
            {/* Teacher Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Teacher Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter last name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone_number"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="+254712345678"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must start with +254 (Kenya format)</p>
                </div>

                {/* Campus Selector */}
                {showCampusSelector ? (
                  <div>
                    <label htmlFor="campus_id" className="block text-sm font-medium text-gray-700 mb-2">
                      Campus {user?.role === 'CAMPUS_ADMIN' && <span className="text-error-500">*</span>}
                    </label>
                    <select
                      id="campus_id"
                      name="campus_id"
                      value={formData.campus_id}
                      onChange={handleChange}
                      required={user?.role === 'CAMPUS_ADMIN'}
                      disabled={loadingCampuses}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                    >
                      <option value="">Select Campus (Optional)</option>
                      {campuses.map((campus) => (
                        <option key={campus.id} value={campus.id}>
                          {campus.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campus
                    </label>
                    <input
                      type="text"
                      value={selectedCampus?.name || 'Loading...'}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                    />
                    <input
                      type="hidden"
                      name="campus_id"
                      value={formData.campus_id}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                to="/users?role=TEACHER"
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Creating...' : 'Create Teacher'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default TeacherFormPage

