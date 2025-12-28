import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { classesApi, ClassCreate, ClassUpdate } from '../api/classes'
import { campusesApi, Campus } from '../api/campuses'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { subjectsApi, Subject } from '../api/subjects'
import { useAuthStore } from '../store/authStore'

const ClassFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [error, setError] = useState('')
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [formData, setFormData] = useState({
    campus_id: '',
    academic_year_id: '',
    name: '',
    capacity: '',
    subject_ids: [] as string[],
  })

  useEffect(() => {
    loadInitialData()
    if (isEdit && id) {
      loadClass()
    }
  }, [id, isEdit])

  // Auto-set campus for CAMPUS_ADMIN after campuses load
  useEffect(() => {
    if (!isEdit && user?.campus_id && user.role === 'CAMPUS_ADMIN' && campuses.length > 0) {
      setFormData(prev => ({ ...prev, campus_id: user.campus_id! }))
    }
  }, [user?.campus_id, user?.role, campuses.length, isEdit])

  useEffect(() => {
    if (!isEdit) {
      loadSubjects()
    }
  }, [isEdit])

  const loadInitialData = async () => {
    try {
      setLoadingData(true)
      setError('')
      const [campusesResponse, academicYearsResponse, subjectsResponse] = await Promise.all([
        campusesApi.list(),
        academicYearsApi.list({ page: 1, page_size: 100 }),
        // Backend enforces page_size <= 100
        subjectsApi.list({ page: 1, page_size: 100 }),
      ])
      
      // Debug logging
      console.log('Campuses response:', campusesResponse)
      console.log('Academic years response:', academicYearsResponse)
      console.log('Subjects response:', subjectsResponse)
      
      setCampuses(campusesResponse.data || [])
      setAcademicYears(academicYearsResponse.data || [])
      setSubjects(subjectsResponse.data || [])
      
      // Log what was set
      console.log('Campuses set:', campusesResponse.data || [])
      console.log('Academic years set:', academicYearsResponse.data || [])
    } catch (err: any) {
      console.error('Failed to load data:', err)
      const errorMessage = err.response?.data?.message || err.response?.data?.detail?.message || err.message || 'Failed to load form data. Please refresh the page.'
      setError(errorMessage)
    } finally {
      setLoadingData(false)
    }
  }

  const loadSubjects = async () => {
    try {
      setLoadingSubjects(true)
      // Backend enforces page_size <= 100
      const response = await subjectsApi.list({ page: 1, page_size: 100 })
      setSubjects(response.data)
    } catch (err: any) {
      console.error('Failed to load subjects:', err)
    } finally {
      setLoadingSubjects(false)
    }
  }

  const loadClass = async () => {
    try {
      setLoading(true)
      const [cls, subjectsResponse] = await Promise.all([
        classesApi.get(id!),
        subjectsApi.listForClass(id!),
      ])
      setFormData({
        campus_id: cls.campus_id,
        academic_year_id: cls.academic_year_id,
        name: cls.name,
        capacity: cls.capacity?.toString() || '',
        subject_ids: subjectsResponse.data.map(s => s.id),
      })
      // Also load all subjects for the dropdown
      await loadSubjects()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load class')
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
        const data: ClassUpdate = {
          name: formData.name,
          capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
          subject_ids: formData.subject_ids.length > 0 ? formData.subject_ids : undefined,
        }
        await classesApi.update(id, data)
      } else {
        const data: ClassCreate = {
          campus_id: formData.campus_id,
          academic_year_id: formData.academic_year_id,
          name: formData.name,
          capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
          subject_ids: formData.subject_ids.length > 0 ? formData.subject_ids : undefined,
        }
        await classesApi.create(data)
      }

      navigate('/classes')
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail
      if (typeof errorDetail === 'string') {
        setError(errorDetail)
      } else if (errorDetail?.message) {
        setError(errorDetail.message)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to save class. Please check all fields.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubjectToggle = (subjectId: string) => {
    setFormData((prev) => {
      const currentIds = prev.subject_ids
      if (currentIds.includes(subjectId)) {
        return { ...prev, subject_ids: currentIds.filter(id => id !== subjectId) }
      } else {
        return { ...prev, subject_ids: [...currentIds, subjectId] }
      }
    })
  }

  if (loading && isEdit) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading class...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'
  // Show campus selector if: multiple campuses OR (SCHOOL_ADMIN with at least one campus)
  // For CAMPUS_ADMIN with only one campus, still show selector but pre-select it
  const showCampusSelector = campuses.length > 0 && (campuses.length > 1 || user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN')
  const selectedCampus = campuses.find(c => c.id === formData.campus_id)

  if (!isAdmin) {
    return (
      <AppLayout>
        <PageHeader title="Access Denied" subtitle="Only administrators can manage classes" />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">You don't have permission to access this page.</p>
              <Link to="/classes" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
                ← Back to Classes
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
        title={isEdit ? 'Edit Class' : 'Add New Class'}
        subtitle={isEdit ? 'Update class information' : 'Create a new class'}
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/classes" />
            <Link
              to="/classes"
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!isEdit && (
                  <>
                    {showCampusSelector ? (
                      <div>
                        <label htmlFor="campus_id" className="block text-sm font-medium text-gray-700 mb-2">
                          Campus <span className="text-error-500">*</span>
                        </label>
                        <select
                          id="campus_id"
                          name="campus_id"
                          value={formData.campus_id}
                          onChange={handleChange}
                          required
                          disabled={loadingData || !!(user?.role === 'CAMPUS_ADMIN' && user.campus_id)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                        >
                          <option value="">Select Campus</option>
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
                        disabled={loadingData}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                      >
                        <option value="">Select Academic Year</option>
                        {academicYears.map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Class Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., Grade 3A"
                  />
                </div>

                <div>
                  <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-2">
                    Capacity (Optional)
                  </label>
                  <input
                    type="number"
                    id="capacity"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleChange}
                    min="1"
                    max="100"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Max number of students"
                  />
                  <p className="mt-1 text-xs text-gray-500">Maximum number of students (1-100)</p>
                </div>
              </div>
            </div>

            {/* Subjects Selection */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subjects/Units (Optional)</h2>
              <p className="text-sm text-gray-600 mb-4">Select subjects/units to assign to this class. You can select multiple subjects.</p>
              {loadingSubjects ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading subjects...</p>
                </div>
              ) : subjects.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No subjects available. <Link to="/subjects/new" className="text-primary-600 hover:text-primary-700">Create a subject</Link> first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {subjects.map((subject) => (
                    <label
                      key={subject.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.subject_ids.includes(subject.id)}
                        onChange={() => handleSubjectToggle(subject.id)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">
                        {subject.name}
                        {subject.code && <span className="text-gray-500 ml-1">({subject.code})</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {formData.subject_ids.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {formData.subject_ids.length} subject{formData.subject_ids.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                to="/classes"
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || loadingData}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Class' : 'Create Class'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default ClassFormPage

