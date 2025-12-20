import { useState, useEffect } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { teachersApi, TeacherCreate, TeacherUpdate, Teacher } from '../api/teachers'
import { campusesApi, Campus } from '../api/campuses'
import { useAuthStore } from '../store/authStore'

const TeacherFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const isEditMode = !!id
  
  const [loading, setLoading] = useState(false)
  const [loadingCampuses, setLoadingCampuses] = useState(false)
  const [loadingTeacher, setLoadingTeacher] = useState(false)
  const [error, setError] = useState('')
  const [campuses, setCampuses] = useState<Campus[]>([])
  
  const [formData, setFormData] = useState({
    salutation: 'Mr' as 'Mr' | 'Mrs' | 'Miss' | 'Dr' | 'Prof',
    first_name: '',
    middle_name: '',
    last_name: '',
    phone_number: '',
    email: '',
    national_id: '',
    tsc_number: '',
    date_of_birth: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    campus_id: '',
  })

  useEffect(() => {
    loadCampuses()
    if (isEditMode && id) {
      loadTeacher()
    } else {
      // Auto-set campus if user has only one campus
      if (user?.campus_id && user.role === 'CAMPUS_ADMIN') {
        setFormData(prev => ({ ...prev, campus_id: user.campus_id! }))
      }
    }
  }, [user, id, isEditMode])

  const loadCampuses = async () => {
    try {
      setLoadingCampuses(true)
      const response = await campusesApi.list()
      setCampuses(response.data)
      
      // Auto-select campus if only one (create mode only)
      if (!isEditMode) {
        if (response.data.length === 1) {
          setFormData(prev => ({ ...prev, campus_id: response.data[0].id }))
        } else if (user?.campus_id && user.role === 'CAMPUS_ADMIN') {
          setFormData(prev => ({ ...prev, campus_id: user.campus_id! }))
        }
      }
    } catch (err: any) {
      console.error('Failed to load campuses:', err)
    } finally {
      setLoadingCampuses(false)
    }
  }

  const loadTeacher = async () => {
    if (!id) return
    
    try {
      setLoadingTeacher(true)
      const teacher = await teachersApi.get(id)
      
      setFormData({
        salutation: teacher.salutation as 'Mr' | 'Mrs' | 'Miss' | 'Dr' | 'Prof',
        first_name: teacher.first_name,
        middle_name: teacher.middle_name || '',
        last_name: teacher.last_name,
        phone_number: teacher.phone_number,
        email: teacher.email || '',
        national_id: teacher.national_id,
        tsc_number: teacher.tsc_number || '',
        date_of_birth: teacher.date_of_birth,
        gender: teacher.gender as 'MALE' | 'FEMALE' | 'OTHER',
        campus_id: teacher.campus.id,
      })
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to load teacher')
    } finally {
      setLoadingTeacher(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validate required fields
    if (!formData.first_name || !formData.last_name || !formData.phone_number || !formData.national_id || !formData.date_of_birth || !formData.campus_id) {
      setError('All required fields must be filled')
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
      if (isEditMode && id) {
        // Update mode
        const updateData: TeacherUpdate = {
          salutation: formData.salutation,
          first_name: formData.first_name,
          middle_name: formData.middle_name || undefined,
          last_name: formData.last_name,
          phone_number: formData.phone_number,
          email: formData.email || undefined,
          tsc_number: formData.tsc_number || undefined,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender,
        }
        await teachersApi.update(id, updateData)
        navigate(`/teachers/${id}`)
      } else {
        // Create mode
        const createData: TeacherCreate = {
          salutation: formData.salutation,
          first_name: formData.first_name,
          middle_name: formData.middle_name || undefined,
          last_name: formData.last_name,
          phone_number: formData.phone_number,
          email: formData.email || undefined,
          national_id: formData.national_id,
          tsc_number: formData.tsc_number || undefined,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender,
          campus_id: formData.campus_id,
        }
        await teachersApi.create(createData)
        navigate('/teachers')
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
        setError(isEditMode ? 'Failed to update teacher' : 'Failed to create teacher. Please check all required fields.')
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

  if (isEditMode && loadingTeacher) {
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

  return (
    <AppLayout>
      <PageHeader
        title={isEditMode ? 'Edit Teacher' : 'Add New Teacher'}
        subtitle={isEditMode ? 'Update teacher information' : 'Create a new teacher account. They will receive a setup link via SMS.'}
        action={
          <div className="flex items-center gap-2">
            <BackButton to={isEditMode ? `/teachers/${id}` : '/teachers'} />
            <Link
              to={isEditMode ? `/teachers/${id}` : '/teachers'}
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
                  <label htmlFor="salutation" className="block text-sm font-medium text-gray-700 mb-2">
                    Salutation <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="salutation"
                    name="salutation"
                    value={formData.salutation}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Dr">Dr</option>
                    <option value="Prof">Prof</option>
                  </select>
                </div>

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
                  <label htmlFor="middle_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    id="middle_name"
                    name="middle_name"
                    value={formData.middle_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter middle name (optional)"
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

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter email address (optional)"
                  />
                </div>

                <div>
                  <label htmlFor="national_id" className="block text-sm font-medium text-gray-700 mb-2">
                    National ID <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="national_id"
                    name="national_id"
                    value={formData.national_id}
                    onChange={handleChange}
                    required
                    disabled={isEditMode}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="Enter national ID"
                  />
                  {isEditMode && (
                    <p className="mt-1 text-xs text-gray-500">National ID cannot be changed</p>
                  )}
                </div>

                <div>
                  <label htmlFor="tsc_number" className="block text-sm font-medium text-gray-700 mb-2">
                    TSC Number
                  </label>
                  <input
                    type="text"
                    id="tsc_number"
                    name="tsc_number"
                    value={formData.tsc_number}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter TSC number (optional)"
                  />
                </div>

                <div>
                  <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="date_of_birth"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                    Gender <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
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
                      required={user?.role === 'CAMPUS_ADMIN' || !isEditMode}
                      disabled={loadingCampuses || isEditMode}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">Select Campus</option>
                      {campuses.map((campus) => (
                        <option key={campus.id} value={campus.id}>
                          {campus.name}
                        </option>
                      ))}
                    </select>
                    {isEditMode && (
                      <p className="mt-1 text-xs text-gray-500">Campus cannot be changed</p>
                    )}
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
                to={isEditMode ? `/teachers/${id}` : '/teachers'}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Teacher' : 'Create Teacher')}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default TeacherFormPage
