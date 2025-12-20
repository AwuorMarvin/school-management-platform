import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { clubActivitiesApi, ClubActivityCreate, ClubActivityUpdate, ClubActivity } from '../api/clubActivities'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { termsApi, Term } from '../api/terms'
import { classesApi, Class } from '../api/classes'
import { teachersApi, Teacher } from '../api/teachers'
import { useAuthStore } from '../store/authStore'

const ClubActivityFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [formData, setFormData] = useState({
    service_name: '',
    activity_type: 'CLUB' as 'CLUB' | 'EXTRA_CURRICULAR',
    cost_per_term: '0.00',
    teacher_id: '',
    academic_year_id: '',
    term_id: '',
    class_ids: [] as string[],
    description: '',
  })

  useEffect(() => {
    loadInitialData()
    if (isEdit && id) {
      loadActivity()
    }
  }, [id, isEdit])

  useEffect(() => {
    if (formData.academic_year_id) {
      loadTerms()
    } else {
      setTerms([])
    }
  }, [formData.academic_year_id])

  const loadInitialData = async () => {
    try {
      setLoadingData(true)
      setError('')
      const [academicYearsResponse, classesResponse] = await Promise.all([
        academicYearsApi.list({ page: 1, page_size: 100 }),
        // Backend enforces page_size <= 100
        classesApi.list({ page: 1, page_size: 100 }),
      ])

      setAcademicYears(academicYearsResponse.data || [])
      setClasses(classesResponse.data || [])
      // TODO: Load teachers when API is available
    } catch (err: any) {
      console.error('Failed to load initial data for club activities:', err)
      const message =
        err.response?.data?.message ||
        err.response?.data?.detail?.message ||
        err.message ||
        'Failed to load academic years and classes. Please refresh the page.'
      setError(message)
    } finally {
      setLoadingData(false)
    }
  }

  const loadTerms = async () => {
    try {
      const response = await termsApi.list({ academic_year_id: formData.academic_year_id })
      setTerms(response.data)
    } catch (err: any) {
      console.error('Failed to load terms:', err)
    }
  }

  const loadActivity = async () => {
    try {
      setLoading(true)
      const activity = await clubActivitiesApi.get(id!)
      setFormData({
        service_name: activity.service_name,
        activity_type: activity.activity_type,
        cost_per_term: activity.cost_per_term,
        teacher_id: activity.teacher_id || '',
        academic_year_id: activity.academic_year_id,
        term_id: activity.term_id,
        class_ids: activity.classes?.map(c => c.id) || [],
        description: activity.description || '',
      })
      // Load terms for the selected academic year
      if (activity.academic_year_id) {
        await loadTerms()
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load club activity')
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
        const data: ClubActivityUpdate = {
          service_name: formData.service_name,
          activity_type: formData.activity_type,
          cost_per_term: formData.cost_per_term,
          teacher_id: formData.teacher_id || null,
          academic_year_id: formData.academic_year_id,
          term_id: formData.term_id,
          class_ids: formData.class_ids.length > 0 ? formData.class_ids : undefined,
          description: formData.description || null,
        }
        await clubActivitiesApi.update(id, data)
        navigate('/club-activities')
      } else {
        const data: ClubActivityCreate = {
          service_name: formData.service_name,
          activity_type: formData.activity_type,
          cost_per_term: formData.cost_per_term,
          teacher_id: formData.teacher_id || null,
          academic_year_id: formData.academic_year_id,
          term_id: formData.term_id,
          class_ids: formData.class_ids.length > 0 ? formData.class_ids : undefined,
          description: formData.description || null,
        }
        await clubActivitiesApi.create(data)
        navigate('/club-activities')
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
        setError('Failed to save club activity. Please check all fields.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleClassToggle = (classId: string) => {
    setFormData((prev) => {
      const currentIds = prev.class_ids
      if (currentIds.includes(classId)) {
        return { ...prev, class_ids: currentIds.filter(id => id !== classId) }
      } else {
        return { ...prev, class_ids: [...currentIds, classId] }
      }
    })
  }

  if (loading && isEdit) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading club activity...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'
  const backUrl = '/club-activities'

  if (!isAdmin) {
    return (
      <AppLayout>
        <PageHeader title="Access Denied" subtitle="Only administrators can manage club activities" />
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
        title={isEdit ? 'Edit Club/Activity' : 'Add New Club/Activity'}
        subtitle={isEdit ? 'Update club or extra-curricular activity information' : 'Create a new club or extra-curricular activity'}
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="service_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Service Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="service_name"
                    name="service_name"
                    value={formData.service_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., Debating Club"
                  />
                </div>

                <div>
                  <label htmlFor="activity_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Type <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="activity_type"
                    name="activity_type"
                    value={formData.activity_type}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="CLUB">Club</option>
                    <option value="EXTRA_CURRICULAR">Extra Curricular</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="cost_per_term" className="block text-sm font-medium text-gray-700 mb-2">
                    Cost per Term (KES) <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="cost_per_term"
                    name="cost_per_term"
                    value={formData.cost_per_term}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor="teacher_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Teacher/Instructor (Optional)
                  </label>
                  <select
                    id="teacher_id"
                    name="teacher_id"
                    value={formData.teacher_id}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="">Not assigned</option>
                    {/* TODO: Add teachers when API is available */}
                  </select>
                </div>

                <div>
                  <label htmlFor="academic_year_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Academic Year <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="academic_year_id"
                    name="academic_year_id"
                    value={formData.academic_year_id}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="">Select Academic Year</option>
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="term_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Term <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="term_id"
                    name="term_id"
                    value={formData.term_id}
                    onChange={handleChange}
                    required
                    disabled={!formData.academic_year_id}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Term</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
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
                  placeholder="Description of the club/activity..."
                />
              </div>
            </div>

            {/* Classes Selection */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Classes Offered To (Optional)</h2>
              <p className="text-sm text-gray-600 mb-4">Select classes this activity is offered to.</p>
              {loadingData ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading classes...</p>
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No classes available. <Link to="/classes/new" className="text-primary-600 hover:text-primary-700">Create a class</Link> first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {classes.map((cls) => (
                    <label
                      key={cls.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.class_ids.includes(cls.id)}
                        onChange={() => handleClassToggle(cls.id)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">
                        {cls.name}
                        {cls.campus && <span className="text-gray-500 ml-1">({cls.campus.name})</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {formData.class_ids.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {formData.class_ids.length} class{formData.class_ids.length !== 1 ? 'es' : ''} selected
                </p>
              )}
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
                disabled={loading || loadingData}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Activity' : 'Create Activity'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default ClubActivityFormPage

