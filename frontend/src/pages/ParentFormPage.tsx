import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { parentsApi, ParentCreate, ParentUpdate } from '../api/parents'
import { studentsApi, Student } from '../api/students'

const ParentFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  
  const [loading, setLoading] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [error, setError] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  
  const [formData, setFormData] = useState({
    email: '',
    phone_number: '',
    first_name: '',
    last_name: '',
    id_number: '',
    student_id: '',
    role: 'FATHER',
    campus_id: '',
  })

  useEffect(() => {
    if (!isEdit) {
      loadStudents()
    } else if (id) {
      loadParent()
    }
  }, [id, isEdit])

  const loadStudents = async () => {
    try {
      setLoadingStudents(true)
      const response = await studentsApi.list({ skip: 0, limit: 1000 })
      setStudents(response.data)
    } catch (err: any) {
      console.error('Failed to load students:', err)
    } finally {
      setLoadingStudents(false)
    }
  }

  const loadParent = async () => {
    try {
      setLoading(true)
      const parent = await parentsApi.get(id!)
      setFormData({
        email: parent.email,
        phone_number: parent.phone_number,
        first_name: parent.first_name,
        last_name: parent.last_name,
        id_number: parent.id_number,
        student_id: '', // Not editable in edit mode
        role: 'FATHER', // Not editable in edit mode
        campus_id: '',
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load parent')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validate student selection for new parents
    if (!isEdit && !formData.student_id) {
      setError('Please select a student to link this parent to')
      return
    }
    
    setLoading(true)

    try {
      const data: ParentCreate | ParentUpdate = {
        email: formData.email,
        phone_number: formData.phone_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        id_number: formData.id_number,
        ...(isEdit ? {} : { 
          student_id: formData.student_id,
          role: formData.role,
          campus_id: formData.campus_id || undefined 
        }),
      }

      if (isEdit && id) {
        await parentsApi.update(id, data as ParentUpdate)
      } else {
        const result = await parentsApi.create(data as ParentCreate)
        if (result.setup_token) {
          alert(`Parent created! Setup token: ${result.setup_token}\n\nThis will be sent via SMS in production.`)
        }
      }

      navigate('/parents')
    } catch (err: any) {
      const errorMessage = 
        err.response?.data?.detail?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to save parent'
      
      // Handle validation errors
      if (err.response?.data?.detail?.fields) {
        const fieldErrors = err.response.data.detail.fields
          .map((f: any) => `${f.field}: ${f.message}`)
          .join(', ')
        setError(`Validation errors: ${fieldErrors}`)
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  if (loading && isEdit) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading parent...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? 'Edit Parent' : 'Add New Parent'}
        subtitle={isEdit ? 'Update parent information' : 'Create a new parent account and link to student'}
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/parents" />
            <Link
              to="/parents"
              className="px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
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
            {/* Student Selection - Only for new parents */}
            {!isEdit && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="student_id" className="block text-sm font-medium text-gray-700 mb-2">
                      Student <span className="text-error-500">*</span>
                    </label>
                    <select
                      id="student_id"
                      name="student_id"
                      value={formData.student_id}
                      onChange={handleChange}
                      required
                      disabled={loadingStudents}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                    >
                      <option value="">Select Student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.first_name} {student.middle_name || ''} {student.last_name} ({student.status})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Select the student this parent is associated with
                    </p>
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                      Parent Role <span className="text-error-500">*</span>
                    </label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    >
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="GUARDIAN">Guardian</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Specify the relationship to the student
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isEdit}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="parent@example.com"
                  />
                  {isEdit && (
                    <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                  )}
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
                    pattern="\+254[0-9]{9}"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="+254712345678"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must start with +254 (Kenya format)</p>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
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
                  <label htmlFor="id_number" className="block text-sm font-medium text-gray-700 mb-2">
                    ID Number <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="id_number"
                    name="id_number"
                    value={formData.id_number}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter national ID or passport"
                  />
                </div>
              </div>
            </div>

            {/* Info Box */}
            {!isEdit && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <p className="text-sm text-primary-800">
                  <strong>Note:</strong> After creating the parent account, an SMS with an account setup link will be sent to the provided phone number. The parent will use this link to set their password and complete account setup.
                </p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                to="/parents"
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Parent' : 'Create Parent'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default ParentFormPage
