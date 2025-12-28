import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { globalDiscountsApi, GlobalDiscountCreate, GlobalDiscountUpdate, GlobalDiscount as _GlobalDiscount } from '../api/globalDiscounts'
import { termsApi, Term } from '../api/terms'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { campusesApi, Campus } from '../api/campuses'
import { classesApi, Class } from '../api/classes'
import { useAuthStore } from '../store/authStore'

const GlobalDiscountFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [formData, setFormData] = useState({
    discount_name: '',
    discount_type: 'FIXED_AMOUNT' as 'FIXED_AMOUNT' | 'PERCENTAGE',
    discount_value: '0.00',
    academic_year_id: '',
    term_id: '',
    applies_to: 'ALL_STUDENTS' as 'ALL_STUDENTS' | 'SELECTED_CAMPUSES' | 'SELECTED_CLASSES',
    campus_ids: [] as string[],
    class_ids: [] as string[],
    condition_type: 'NONE' as 'NONE' | 'PAYMENT_BEFORE_DATE',
    condition_value: '',
    is_active: true,
  })

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'
  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN'
  const isCampusAdmin = user?.role === 'CAMPUS_ADMIN'

  useEffect(() => {
    if (!isAdmin) {
      navigate('/fees')
      return
    }
    loadInitialData()
    if (isEdit && id) {
      loadDiscount()
    } else {
      // Pre-select campus for Campus Admin
      if (isCampusAdmin && user?.campus_id) {
        setFormData(prev => ({ ...prev, campus_ids: [user.campus_id!] }))
      }
    }
  }, [id, isEdit, isAdmin, isCampusAdmin, user?.campus_id, navigate])

  useEffect(() => {
    if (formData.academic_year_id) {
      loadTerms()
    } else {
      setTerms([])
    }
  }, [formData.academic_year_id])

  useEffect(() => {
    if (formData.academic_year_id) {
      loadClasses()
    } else {
      setClasses([])
    }
  }, [formData.academic_year_id])

  const loadInitialData = async () => {
    try {
      setLoadingData(true)
      const [academicYearsResponse, campusesResponse] = await Promise.all([
        academicYearsApi.list({ page: 1, page_size: 100 }),
        campusesApi.list(),
      ])
      setAcademicYears(academicYearsResponse.data)
      setCampuses(campusesResponse.data)
    } catch (err: any) {
      console.error('Failed to load initial data:', err)
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

  const loadClasses = async () => {
    try {
      const response = await classesApi.list({
        academic_year_id: formData.academic_year_id,
        page: 1,
        page_size: 1000,
      })
      // Filter by campus if Campus Admin
      let filteredClasses = response.data
      if (isCampusAdmin && user?.campus_id) {
        filteredClasses = filteredClasses.filter(c => c.campus_id === user.campus_id)
      }
      setClasses(filteredClasses)
    } catch (err: any) {
      console.error('Failed to load classes:', err)
    }
  }

  const loadDiscount = async () => {
    try {
      setLoading(true)
      const discount = await globalDiscountsApi.get(id!)
      // Load academic year from term
      const term = await termsApi.get(discount.term_id)
      setFormData({
        discount_name: discount.discount_name,
        discount_type: discount.discount_type as 'FIXED_AMOUNT' | 'PERCENTAGE',
        discount_value: discount.discount_value,
        academic_year_id: term.academic_year_id || '',
        term_id: discount.term_id,
        applies_to: discount.applies_to as 'ALL_STUDENTS' | 'SELECTED_CAMPUSES' | 'SELECTED_CLASSES',
        campus_ids: discount.campus_discounts?.map(cd => cd.campus_id) || [],
        class_ids: discount.class_discounts?.map(cd => cd.class_id) || [],
        condition_type: (discount.condition_type || 'NONE') as 'NONE' | 'PAYMENT_BEFORE_DATE',
        condition_value: discount.condition_value || '',
        is_active: discount.is_active,
      })
      if (term.academic_year_id) {
        await loadTerms()
        await loadClasses()
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load global discount')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleMultiSelect = (name: 'campus_ids' | 'class_ids', value: string) => {
    setFormData(prev => {
      const currentIds = prev[name]
      const newIds = currentIds.includes(value)
        ? currentIds.filter(id => id !== value)
        : [...currentIds, value]
      return { ...prev, [name]: newIds }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.discount_name.trim()) {
      setError('Discount name is required')
      return
    }

    if (!formData.term_id) {
      setError('Term is required')
      return
    }

    const discountValue = parseFloat(formData.discount_value)
    if (isNaN(discountValue) || discountValue < 0) {
      setError('Discount value must be a valid number greater than or equal to 0')
      return
    }

    if (formData.discount_type === 'PERCENTAGE' && discountValue > 100) {
      setError('Percentage discount cannot exceed 100%')
      return
    }

    if (formData.applies_to === 'SELECTED_CAMPUSES' && formData.campus_ids.length === 0) {
      setError('At least one campus must be selected when applies to SELECTED_CAMPUSES')
      return
    }

    if (formData.applies_to === 'SELECTED_CLASSES' && formData.class_ids.length === 0) {
      setError('At least one class must be selected when applies to SELECTED_CLASSES')
      return
    }

    if (formData.condition_type === 'PAYMENT_BEFORE_DATE' && !formData.condition_value) {
      setError('Condition value (date) is required when condition type is PAYMENT_BEFORE_DATE')
      return
    }

    setLoading(true)

    try {
      if (isEdit && id) {
        const data: GlobalDiscountUpdate = {
          discount_name: formData.discount_name,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          applies_to: formData.applies_to,
          campus_ids: formData.applies_to === 'SELECTED_CAMPUSES' ? formData.campus_ids : undefined,
          class_ids: formData.applies_to === 'SELECTED_CLASSES' ? formData.class_ids : undefined,
          condition_type: formData.condition_type,
          condition_value: formData.condition_type === 'PAYMENT_BEFORE_DATE' ? formData.condition_value : null,
          is_active: formData.is_active,
        }
        await globalDiscountsApi.update(id, data)
        navigate('/fees')
      } else {
        const data: GlobalDiscountCreate = {
          discount_name: formData.discount_name,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          term_id: formData.term_id,
          applies_to: formData.applies_to,
          campus_ids: formData.applies_to === 'SELECTED_CAMPUSES' ? formData.campus_ids : undefined,
          class_ids: formData.applies_to === 'SELECTED_CLASSES' ? formData.class_ids : undefined,
          condition_type: formData.condition_type,
          condition_value: formData.condition_type === 'PAYMENT_BEFORE_DATE' ? formData.condition_value : null,
          is_active: formData.is_active,
        }
        await globalDiscountsApi.create(data)
        navigate('/fees')
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
        setError('Failed to save global discount. Please check all fields.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return null
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? 'Edit Global Discount' : 'Create Global Discount'}
        subtitle={isEdit ? 'Update global discount details' : 'Create a school-wide discount for a term'}
        action={<BackButton to="/fee-structures" />}
      />

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <ContentCard>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="discount_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="discount_name"
                    name="discount_name"
                    value={formData.discount_name}
                    onChange={handleChange}
                    required
                    maxLength={200}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., Early Payment Discount"
                  />
                </div>

                {!isEdit && (
                  <div>
                    <label htmlFor="academic_year_id" className="block text-sm font-medium text-gray-700 mb-2">
                      Academic Year <span className="text-red-500">*</span>
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
                )}

                <div>
                  <label htmlFor="term_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Term <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="term_id"
                    name="term_id"
                    value={formData.term_id}
                    onChange={handleChange}
                    required
                    disabled={!formData.academic_year_id || loadingData || isEdit}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                  >
                    <option value="">{formData.academic_year_id ? 'Select Term' : 'Select Academic Year first'}</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="discount_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="discount_type"
                    name="discount_type"
                    value={formData.discount_type}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="FIXED_AMOUNT">Fixed Amount (KES)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="discount_value" className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="discount_value"
                    name="discount_value"
                    value={formData.discount_value}
                    onChange={handleChange}
                    required
                    min="0"
                    max={formData.discount_type === 'PERCENTAGE' ? '100' : undefined}
                    step={formData.discount_type === 'FIXED_AMOUNT' ? '0.01' : '0.1'}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder={formData.discount_type === 'FIXED_AMOUNT' ? '0.00' : '0.0'}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.discount_type === 'FIXED_AMOUNT'
                      ? 'Enter the fixed discount amount in KES'
                      : 'Enter the percentage discount (0-100%)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Applies To */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Applies To</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="applies_to" className="block text-sm font-medium text-gray-700 mb-2">
                    Applies To <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="applies_to"
                    name="applies_to"
                    value={formData.applies_to}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="ALL_STUDENTS">All Students</option>
                    {isSchoolAdmin && <option value="SELECTED_CAMPUSES">Selected Campuses</option>}
                    <option value="SELECTED_CLASSES">Selected Classes</option>
                  </select>
                </div>

                {formData.applies_to === 'SELECTED_CAMPUSES' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Campuses <span className="text-red-500">*</span>
                    </label>
                    <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                      {campuses.map((campus) => (
                        <label key={campus.id} className="flex items-center gap-2 py-2">
                          <input
                            type="checkbox"
                            checked={formData.campus_ids.includes(campus.id)}
                            onChange={() => handleMultiSelect('campus_ids', campus.id)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-900">{campus.name}</span>
                        </label>
                      ))}
                    </div>
                    {formData.campus_ids.length === 0 && (
                      <p className="mt-1 text-xs text-red-500">At least one campus must be selected</p>
                    )}
                  </div>
                )}

                {formData.applies_to === 'SELECTED_CLASSES' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Classes <span className="text-red-500">*</span>
                    </label>
                    {!formData.academic_year_id ? (
                      <p className="text-sm text-gray-500">Select Academic Year first</p>
                    ) : (
                      <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                        {classes.length === 0 ? (
                          <p className="text-sm text-gray-500">No classes available</p>
                        ) : (
                          classes.map((cls) => (
                            <label key={cls.id} className="flex items-center gap-2 py-2">
                              <input
                                type="checkbox"
                                checked={formData.class_ids.includes(cls.id)}
                                onChange={() => handleMultiSelect('class_ids', cls.id)}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-sm text-gray-900">{cls.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                    {formData.class_ids.length === 0 && formData.academic_year_id && (
                      <p className="mt-1 text-xs text-red-500">At least one class must be selected</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Conditions */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Conditions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="condition_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Condition Type
                  </label>
                  <select
                    id="condition_type"
                    name="condition_type"
                    value={formData.condition_type}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="NONE">None</option>
                    <option value="PAYMENT_BEFORE_DATE">Payment Before Date</option>
                  </select>
                </div>

                {formData.condition_type === 'PAYMENT_BEFORE_DATE' && (
                  <div>
                    <label htmlFor="condition_value" className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Before Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      id="condition_value"
                      name="condition_value"
                      value={formData.condition_value}
                      onChange={handleChange}
                      required={formData.condition_type === 'PAYMENT_BEFORE_DATE'}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    />
                    <p className="mt-1 text-xs text-gray-500">Discount applies only if payment is made before this date</p>
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">Only one active global discount per term</p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                to="/fee-structures"
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || loadingData}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Global Discount' : 'Create Global Discount'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default GlobalDiscountFormPage

