import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { termsApi, TermCreate, TermUpdate } from '../api/terms'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { useAuthStore } from '../store/authStore'

const TermFormPage = () => {
  const navigate = useNavigate()
  const { academicYearId, id } = useParams<{ academicYearId?: string; id?: string }>()
  const isEdit = !!id
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [loadingAcademicYear, setLoadingAcademicYear] = useState(false)
  const [loadingAcademicYears, setLoadingAcademicYears] = useState(false)
  const [error, setError] = useState('')
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [formData, setFormData] = useState({
    academic_year_id: '',
    name: '',
    start_date: '',
    end_date: '',
  })

  useEffect(() => {
    if (!isEdit) {
      loadAcademicYears()
    }
    if (academicYearId) {
      loadAcademicYear(academicYearId)
      setFormData(prev => ({ ...prev, academic_year_id: academicYearId }))
    }
    if (isEdit && id) {
      loadTerm()
    }
  }, [id, academicYearId, isEdit])

  useEffect(() => {
    if (formData.academic_year_id && !isEdit) {
      loadAcademicYear(formData.academic_year_id)
    }
  }, [formData.academic_year_id, isEdit])

  const loadAcademicYears = async () => {
    try {
      setLoadingAcademicYears(true)
      const response = await academicYearsApi.list({ page: 1, page_size: 100 })
      setAcademicYears(response.data)
    } catch (err: any) {
      console.error('Failed to load academic years:', err)
    } finally {
      setLoadingAcademicYears(false)
    }
  }

  const loadAcademicYear = async (yearId: string) => {
    try {
      setLoadingAcademicYear(true)
      const year = await academicYearsApi.get(yearId)
      setAcademicYear(year)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load academic year')
    } finally {
      setLoadingAcademicYear(false)
    }
  }

  const loadTerm = async () => {
    try {
      setLoading(true)
      const term = await termsApi.get(id!)
      setFormData({
        name: term.name,
        start_date: term.start_date,
        end_date: term.end_date,
      })
      if (term.academic_year_id) {
        const year = await academicYearsApi.get(term.academic_year_id)
        setAcademicYear(year)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load term')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validate academic year for new terms
    if (!isEdit) {
      const yearId = formData.academic_year_id || academicYearId
      if (!yearId) {
        setError('Academic year is required')
        return
      }
      if (!academicYear) {
        setError('Please select an academic year first')
        return
      }
    }
    
    setLoading(true)

    try {
      if (isEdit && id) {
        const data: TermUpdate = {
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date,
        }
        await termsApi.update(id, data)
        navigate('/terms')
      } else {
        const yearId = formData.academic_year_id || academicYearId
        if (!yearId) {
          setError('Academic year is required')
          return
        }
        const data: TermCreate = {
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date,
        }
        await termsApi.create(yearId, data)
        navigate('/terms')
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
        setError('Failed to save term. Please check all fields.')
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
            <p className="mt-4 text-gray-600">Loading term...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN'

  if (!isSchoolAdmin) {
    return (
      <AppLayout>
        <PageHeader title="Access Denied" subtitle="Only school administrators can manage terms" />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">You don't have permission to access this page.</p>
              <Link to="/academic-years" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
                ← Back to Academic Years
              </Link>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  const backUrl = '/terms'

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? 'Edit Term' : 'Add New Term'}
        subtitle={isEdit ? 'Update term information' : academicYear ? `Create term for ${academicYear.name}` : 'Create a new term'}
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Term Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {!isEdit && (
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
                      disabled={loadingAcademicYears || !!academicYearId}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                    >
                      <option value="">Select Academic Year</option>
                      {academicYears.map((year) => (
                        <option key={year.id} value={year.id}>
                          {year.name}
                        </option>
                      ))}
                    </select>
                    {academicYearId && (
                      <p className="mt-1 text-xs text-gray-500">Academic year is set from the URL</p>
                    )}
                  </div>
                )}
                
                {academicYear && (
                  <div className={isEdit ? 'md:col-span-3' : ''}>
                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                      <p className="text-sm text-primary-800">
                        <strong>Academic Year:</strong> {academicYear.name} ({academicYear.start_date} to {academicYear.end_date})
                      </p>
                      <p className="text-xs text-primary-700 mt-1">
                        Term dates must fall within this period
                      </p>
                    </div>
                  </div>
                )}
                <div className={isEdit && academicYear ? 'md:col-span-1' : ''}>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Term Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., Term 1"
                  />
                </div>

                <div className={isEdit && academicYear ? 'md:col-span-1' : ''}>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    required
                    disabled={!academicYear}
                    min={academicYear?.start_date}
                    max={academicYear?.end_date}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                  />
                  {!academicYear && !isEdit && (
                    <p className="mt-1 text-xs text-gray-500">Select an academic year first</p>
                  )}
                </div>

                <div className={isEdit && academicYear ? 'md:col-span-1' : ''}>
                  <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="end_date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    required
                    disabled={!academicYear}
                    min={academicYear?.start_date}
                    max={academicYear?.end_date}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be after start date</p>
                </div>
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
                disabled={loading || loadingAcademicYear || (!isEdit && !academicYear)}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Term' : 'Create Term'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default TermFormPage

