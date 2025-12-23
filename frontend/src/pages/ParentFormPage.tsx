import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { parentsApi, ParentCreate, ParentUpdate } from '../api/parents'
import { studentsApi, Student } from '../api/students'
import { useToastStore } from '../store/toastStore'

const ParentFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  
  const [loading, setLoading] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [error, setError] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [showRoleConflictModal, setShowRoleConflictModal] = useState(false)
  const [conflictMessage, setConflictMessage] = useState('')
  const errorToast = useToastStore((state) => state.error)
  
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
      const primaryRole =
        parent.students && parent.students.length > 0 ? parent.students[0].role : 'FATHER'
      setFormData({
        email: parent.email,
        phone_number: parent.phone_number,
        first_name: parent.first_name,
        last_name: parent.last_name,
        id_number: parent.id_number,
        student_id: parent.students && parent.students.length > 0 ? parent.students[0].student_id : '',
        role: primaryRole,
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
      const baseData = {
        email: formData.email,
        phone_number: formData.phone_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        id_number: formData.id_number,
        role: formData.role,
      }

      const data: ParentCreate | ParentUpdate = isEdit
        ? (baseData as ParentUpdate)
        : ({
            ...baseData,
            student_id: formData.student_id,
            campus_id: formData.campus_id || undefined,
          } as ParentCreate)

      if (isEdit && id) {
        await parentsApi.update(id, data as ParentUpdate)
        const successToast = useToastStore.getState().success
        successToast('Parent updated successfully')
        setTimeout(() => navigate('/parents'), 400)
      } else {
        const result = await parentsApi.create(data as ParentCreate)
        if (result.setup_token) {
          alert(`Parent created! Setup token: ${result.setup_token}\n\nThis will be sent via SMS in production.`)
        }
        const successToast = useToastStore.getState().success
        successToast('Parent created successfully')
        setTimeout(() => navigate('/parents'), 400)
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.detail?.error_code || err.response?.data?.error_code

      if (errorCode === 'DUPLICATE_PARENT_ROLE') {
        const role = (err.response?.data?.detail?.details?.role ||
          err.response?.data?.details?.role ||
          formData.role) as string
        const roleLabel =
          role === 'FATHER' ? 'father' : role === 'MOTHER' ? 'mother' : role === 'GUARDIAN' ? 'guardian' : 'parent'

        if (!isEdit) {
          setConflictMessage(
            `This student already has a ${roleLabel} assigned. You can override to replace the existing ${roleLabel} with these new details, or cancel to keep the existing ${roleLabel}.`
          )
          setShowRoleConflictModal(true)
        } else {
          const conflictMsg = `This student already has a ${roleLabel} assigned. You cannot change this parent to that role.`
          setError(conflictMsg)
          errorToast(conflictMsg)
        }
      } else {
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
          errorToast(`Validation errors: ${fieldErrors}`)
        } else {
          setError(errorMessage)
          errorToast(errorMessage)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOverrideParentRole = async () => {
    if (!formData.student_id) {
      setShowRoleConflictModal(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      // Find existing parent for this student+role
      const student = await studentsApi.get(formData.student_id)
      const existingLink = (student.parents || []).find((p) => p.role === formData.role)

      if (!existingLink) {
        setShowRoleConflictModal(false)
        setLoading(false)
        return
      }

      await parentsApi.update(existingLink.id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
        id_number: formData.id_number,
        email: formData.email,
      })

      setShowRoleConflictModal(false)
      navigate('/parents')
    } catch (err: any) {
      const errorMessage = 
        err.response?.data?.detail?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to override existing parent'
      setError(errorMessage)
      errorToast(errorMessage)
      setShowRoleConflictModal(false)
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
            {/* Student & Parent Role */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Student & Parent Role</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!isEdit && (
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
                      disabled={loadingStudents || isEdit}
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
                )}

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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500.transition-colors"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="parent@example.com"
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

        {/* Duplicate parent role conflict modal */}
        {showRoleConflictModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-25">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-lg w-full p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Parent Role Conflict</h2>
              <p className="text-sm text-gray-700 mb-4">{conflictMessage}</p>
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 mb-4 text-sm text-warning-900">
                Each student can only have one parent for each role (Father, Mother, Guardian). Overriding will
                update the existing parent record with the new details you entered.
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowRoleConflictModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOverrideParentRole}
                  className="px-4 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Override
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default ParentFormPage
