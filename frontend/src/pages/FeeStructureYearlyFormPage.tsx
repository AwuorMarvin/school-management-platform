import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { feeStructuresApi, FeeLineItemCreate } from '../api/feeStructures'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { classesApi, Class } from '../api/classes'
import { termsApi, Term } from '../api/terms'
import { useAuthStore } from '../store/authStore'

interface LineItem {
  item_name: string
  amount: string
  display_order: number
  is_annual: boolean
}

const FeeStructureYearlyFormPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [blockedClassIds, setBlockedClassIds] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    academic_year_id: '',
    class_id: '',
    status: 'INACTIVE' as 'ACTIVE' | 'INACTIVE',
    line_items: [] as LineItem[],
  })

  const isAdmin =
    user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (!isAdmin) {
      navigate('/fee-structures')
      return
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    if (formData.academic_year_id) {
      loadClasses()
      loadBlockedClassesForYear()
    } else {
      setClasses([])
      setBlockedClassIds(new Set())
    }
  }, [formData.academic_year_id])

  const loadInitialData = async () => {
    try {
      setLoadingData(true)
      const yearsResponse = await academicYearsApi.list({ page: 1, page_size: 100 })
      setAcademicYears(yearsResponse.data)

      // Seed one line item
      setFormData(prev => ({
        ...prev,
        line_items: [{ item_name: '', amount: '0.00', display_order: 0, is_annual: false }],
      }))
    } catch (err: any) {
      console.error('Failed to load academic years:', err)
      setError(err.response?.data?.message || 'Failed to load academic years')
    } finally {
      setLoadingData(false)
    }
  }

  const loadClasses = async () => {
    try {
      setLoadingData(true)
      const response = await classesApi.list({
        academic_year_id: formData.academic_year_id,
        page: 1,
        page_size: 100,
      })
      setClasses(response.data)
    } catch (err: any) {
      console.error('Failed to load classes:', err)
      setError(err.response?.data?.message || 'Failed to load classes for this academic year')
    } finally {
      setLoadingData(false)
    }
  }

  const loadBlockedClassesForYear = async () => {
    try {
      if (!formData.academic_year_id) {
        setBlockedClassIds(new Set())
        return
      }

      const termsResponse = await termsApi.list({ academic_year_id: formData.academic_year_id })
      const termIds = termsResponse.data.map((t: Term) => t.id)
      const blocked = new Set<string>()

      for (const termId of termIds) {
        try {
          const res = await feeStructuresApi.list({
            term_id: termId,
            page: 1,
            page_size: 1000,
          })
          res.data.forEach(fs => {
            // For yearly creation, block if ANY structure exists (TERM or YEAR)
            if (fs.class_id) {
              blocked.add(fs.class_id)
            } else if (fs.class_ids && fs.class_ids.length > 0) {
              fs.class_ids.forEach(id => blocked.add(id))
            }
          })
        } catch (err) {
          console.error('Failed to load fee structures for term when blocking yearly classes', err)
        }
      }

      setBlockedClassIds(blocked)
    } catch (err) {
      console.error('Failed to compute blocked classes for yearly structure:', err)
      setBlockedClassIds(new Set())
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const target = e.target as HTMLInputElement
    setFormData(prev => ({
      ...prev,
      [name]: target.type === 'checkbox' ? target.checked : value,
    }))
  }

  const handleLineItemChange = (
    index: number,
    field: keyof LineItem,
    value: string | number | boolean
  ) => {
    setFormData(prev => {
      const newLineItems = [...prev.line_items]
      newLineItems[index] = { ...newLineItems[index], [field]: value } as LineItem
      return { ...prev, line_items: newLineItems }
    })
  }

  const addLineItem = () => {
    if (formData.line_items.length >= 10) {
      setError('Maximum 10 line items allowed')
      return
    }
    setFormData(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        { item_name: '', amount: '0.00', display_order: prev.line_items.length, is_annual: false },
      ],
    }))
  }

  const removeLineItem = (index: number) => {
    if (formData.line_items.length <= 1) {
      setError('At least one line item is required')
      return
    }
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, display_order: i })),
    }))
  }

  const calculateTotalPerTerm = () => {
    return formData.line_items.reduce((sum, item) => {
      return sum + parseFloat(item.amount || '0')
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.academic_year_id || !formData.class_id) {
      setError('Academic year and class are required')
      return
    }

    if (formData.line_items.length === 0) {
      setError('At least one line item is required')
      return
    }

    for (let i = 0; i < formData.line_items.length; i++) {
      const item = formData.line_items[i]
      if (!item.item_name.trim()) {
        setError(`Line item ${i + 1}: Item name is required`)
        return
      }
      if (parseFloat(item.amount) < 0) {
        setError(`Line item ${i + 1}: Amount must be greater than or equal to 0`)
        return
      }
    }

    setLoading(true)

    try {
      const lineItems: FeeLineItemCreate[] = formData.line_items.map((item, index) => ({
        item_name: item.item_name.trim(),
        amount: item.amount,
        display_order: index,
        is_annual: item.is_annual,
      }))

      await feeStructuresApi.createYearly({
        class_id: formData.class_id,
        academic_year_id: formData.academic_year_id,
        line_items: lineItems,
        status: formData.status,
      })

      navigate('/fee-structures')
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail
      if (typeof errorDetail === 'string') {
        setError(errorDetail)
      } else if (errorDetail?.message) {
        setError(errorDetail.message)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to save yearly fee structure.')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Create Yearly Fee Structure"
        subtitle="Define a yearly fee for a class across all terms in the academic year"
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
                  <label
                    htmlFor="academic_year_id"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
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
                    {academicYears.map(year => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="class_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Class <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="class_id"
                    name="class_id"
                    value={formData.class_id}
                    onChange={handleChange}
                    required
                    disabled={!formData.academic_year_id || loadingData}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                  >
                    <option value="">
                      {formData.academic_year_id
                        ? 'Select Class'
                        : 'Select Academic Year first'}
                    </option>
                    {classes
                      .filter(cls => !blockedClassIds.has(cls.id))
                      .map(cls => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Classes that already have fee structures in this academic year are not listed.
                  </p>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ACTIVE">ACTIVE</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Creating a yearly structure will create one term-level structure per term in the
                    year.
                  </p>
                </div>
              </div>
            </div>

            {/* Fee Line Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Fee Line Items (per term)</h2>
                <button
                  type="button"
                  onClick={addLineItem}
                  disabled={formData.line_items.length >= 10}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Add Line Item
                </button>
              </div>

              {formData.line_items.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  No line items. Click &quot;Add Line Item&quot; to add one.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount per Term (KES)
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Annual?
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {formData.line_items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.item_name}
                                onChange={e =>
                                  handleLineItemChange(index, 'item_name', e.target.value)
                                }
                                required
                                maxLength={200}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                placeholder="e.g., Tuition Fee"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.amount}
                                onChange={e =>
                                  handleLineItemChange(index, 'amount', e.target.value)
                                }
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={item.is_annual}
                                  onChange={e =>
                                    handleLineItemChange(index, 'is_annual', e.target.checked)
                                  }
                                  className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">Annual (one-off)</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-500">{index + 1}</span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => removeLineItem(index)}
                                disabled={formData.line_items.length <= 1}
                                className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total per term (excluding annual) */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900">
                        Total Expected Fee per Term (excluding annual):
                      </span>
                      <span className="text-2xl font-bold text-primary-600">
                        {formatCurrency(calculateTotalPerTerm())}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/fee-structures')}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || loadingData}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Saving...' : 'Create Yearly Fee Structure'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default FeeStructureYearlyFormPage


