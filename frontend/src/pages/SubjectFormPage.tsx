import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { subjectsApi, SubjectCreate, SubjectUpdate, Subject } from '../api/subjects'
import { classesApi, Class } from '../api/classes'
import { useAuthStore } from '../store/authStore'

const SubjectFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [error, setError] = useState('')
  const [classes, setClasses] = useState<Class[]>([])
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    class_ids: [] as string[],
  })

  useEffect(() => {
    loadClasses()
    if (isEdit && id) {
      loadSubject()
    }
  }, [id, isEdit])

  const loadClasses = async () => {
    try {
      setLoadingClasses(true)
      // Backend enforces page_size <= 100
      const response = await classesApi.list({ page: 1, page_size: 100 })
      setClasses(response.data)
    } catch (err: any) {
      console.error('Failed to load classes:', err)
      // Keep this section optional; don't block the page, but log for debugging
    } finally {
      setLoadingClasses(false)
    }
  }

  const loadSubject = async () => {
    try {
      setLoading(true)
      const subject = await subjectsApi.get(id!)
      setFormData({
        name: subject.name,
        code: subject.code || '',
        class_ids: subject.classes?.map(c => c.id) || [],
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load subject')
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
        const data: SubjectUpdate = {
          name: formData.name,
          code: formData.code || undefined,
          class_ids: formData.class_ids.length > 0 ? formData.class_ids : undefined,
        }
        await subjectsApi.update(id, data)
        navigate('/subjects')
      } else {
        const data: SubjectCreate = {
          name: formData.name,
          code: formData.code || undefined,
          class_ids: formData.class_ids.length > 0 ? formData.class_ids : undefined,
        }
        await subjectsApi.create(data)
        navigate('/subjects')
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
        setError('Failed to save subject. Please check all fields.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            <p className="mt-4 text-gray-600">Loading subject...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'
  const backUrl = '/subjects'

  if (!isAdmin) {
    return (
      <AppLayout>
        <PageHeader title="Access Denied" subtitle="Only administrators can manage subjects" />
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
        title={isEdit ? 'Edit Subject/Unit' : 'Add New Subject/Unit'}
        subtitle={isEdit ? 'Update subject information and class assignments' : 'Create a new subject/unit and assign it to classes'}
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subject/Unit Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., Mathematics"
                  />
                </div>

                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Code (Optional)
                  </label>
                  <input
                    type="text"
                    id="code"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    maxLength={20}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., MATH301"
                  />
                  <p className="mt-1 text-xs text-gray-500">Unique code within the school (max 20 characters)</p>
                </div>
              </div>
            </div>

            {/* Classes Selection */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Assign to Classes (Optional)</h2>
              <p className="text-sm text-gray-600 mb-4">Select classes to assign this subject/unit to. A subject can be shared across multiple classes.</p>
              {loadingClasses ? (
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
                disabled={loading || loadingClasses}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Subject' : 'Create Subject'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default SubjectFormPage
