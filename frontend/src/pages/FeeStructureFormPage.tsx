import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { feeStructuresApi, FeeStructureCreate, FeeStructureUpdate, FeeStructure as _FeeStructure, FeeLineItemCreate } from '../api/feeStructures'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { termsApi, Term } from '../api/terms'
import { classesApi, Class } from '../api/classes'
import { campusesApi, Campus } from '../api/campuses'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'

interface LineItem {
  item_name: string
  amount: string
  display_order: number
  is_annual: boolean
}

const FeeStructureFormPage = () => {
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
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [formData, setFormData] = useState({
    structure_name: '',
    campus_id: '',
    academic_year_id: '',
    class_id: '',
    term_id: '',
    status: 'INACTIVE' as 'ACTIVE' | 'INACTIVE',
    line_items: [] as LineItem[],
  })
  const [blockedYearlyClassIds, setBlockedYearlyClassIds] = useState<Set<string>>(new Set())

  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN'
  const isCampusAdmin = user?.role === 'CAMPUS_ADMIN'

  useEffect(() => {
    loadInitialData()
    if (isEdit && id) {
      loadFeeStructure()
    } else {
      // Add initial line item for new structure
      setFormData(prev => ({
        ...prev,
        line_items: [{ item_name: '', amount: '0.00', display_order: 0, is_annual: false }],
        // Pre-select campus for Campus Admin
        campus_id: isCampusAdmin && user?.campus_id ? user.campus_id : '',
      }))
    }
  }, [id, isEdit, isCampusAdmin, user?.campus_id])

  useEffect(() => {
    if (formData.academic_year_id) {
      loadTerms()
      loadBlockedYearlyClasses()
    } else {
      setTerms([])
      setBlockedYearlyClassIds(new Set())
    }
  }, [formData.academic_year_id])

  useEffect(() => {
    if (formData.campus_id && formData.academic_year_id) {
      loadClasses()
    } else {
      setClasses([])
    }
  }, [formData.campus_id, formData.academic_year_id])

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

  const loadBlockedYearlyClasses = async () => {
    try {
      if (!formData.academic_year_id) {
        setBlockedYearlyClassIds(new Set())
        return
      }

      const termsResponse = await termsApi.list({ academic_year_id: formData.academic_year_id })
      const termIds = termsResponse.data.map(t => t.id)
      const blocked = new Set<string>()

      for (const termId of termIds) {
        try {
          const res = await feeStructuresApi.list({
            term_id: termId,
            page: 1,
            page_size: 1000,
          })
          res.data.forEach(fs => {
            if (fs.structure_scope === 'YEAR' && fs.class_id) {
              blocked.add(fs.class_id)
            } else if (fs.structure_scope === 'YEAR' && fs.class_ids && fs.class_ids.length > 0) {
              fs.class_ids.forEach(id => blocked.add(id))
            }
          })
        } catch (err) {
          console.error('Failed to load fee structures for term when blocking yearly classes', err)
        }
      }

      setBlockedYearlyClassIds(blocked)
    } catch (err) {
      console.error('Failed to compute blocked yearly classes:', err)
      setBlockedYearlyClassIds(new Set())
    }
  }

  const loadClasses = async () => {
    try {
      const response = await classesApi.list({
        campus_id: formData.campus_id,
        academic_year_id: formData.academic_year_id,
        page: 1,
        // Backend enforces page_size <= 100
        page_size: 100,
      })
      setClasses(response.data)
    } catch (err: any) {
      console.error('Failed to load classes:', err)
    }
  }

  const loadFeeStructure = async () => {
    try {
      setLoading(true)
      const structure = await feeStructuresApi.get(id!)
      // Load class to get campus and academic year
      const classId = structure.class_id || structure.class_ids?.[0]
      if (!classId) {
        setError('Fee structure has no class assigned')
        return
      }
      const classObj = await classesApi.get(classId)
      
      setFormData({
        structure_name: structure.structure_name,
        campus_id: classObj.campus_id || '',
        academic_year_id: classObj.academic_year_id || '',
        class_id: classId,
        term_id: structure.term_id || '',
        status: structure.status as 'ACTIVE' | 'INACTIVE',
        line_items: structure.line_items.map((item) => ({
          item_name: item.item_name,
          amount: item.amount,
          display_order: item.display_order,
          is_annual: item.is_annual ?? false,
        })),
      })
      
      // Load terms for the selected academic year
      if (classObj.academic_year_id) {
        await loadTerms()
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load fee structure')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number | boolean) => {
    setFormData(prev => {
      const newLineItems = [...prev.line_items]
      newLineItems[index] = { ...newLineItems[index], [field]: value }
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
      line_items: prev.line_items.filter((_, i) => i !== index).map((item, i) => ({
        ...item,
        display_order: i,
      })),
    }))
  }

  const calculateTotal = () => {
    return formData.line_items.reduce((sum, item) => {
      return sum + parseFloat(item.amount || '0')
    }, 0)
  }

  const generateStructureName = () => {
    const classObj = classes.find(c => c.id === formData.class_id)
    const termObj = terms.find(t => t.id === formData.term_id)
    if (classObj && termObj) {
      return `${termObj.name}-${classObj.name}`
    }
    return ''
  }

  useEffect(() => {
    if (!isEdit && formData.class_id && formData.term_id && !formData.structure_name) {
      const autoName = generateStructureName()
      if (autoName) {
        setFormData(prev => ({ ...prev, structure_name: autoName }))
      }
    }
  }, [formData.class_id, formData.term_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (formData.line_items.length === 0) {
      setError('At least one line item is required')
      return
    }

    if (formData.line_items.length > 10) {
      setError('Maximum 10 line items allowed')
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

      if (isEdit && id) {
        const data: FeeStructureUpdate = {
          structure_name: formData.structure_name,
          status: formData.status,
          // Only allow updating line items if status is INACTIVE
          line_items: formData.status === 'INACTIVE' ? lineItems : undefined,
        }
        await feeStructuresApi.update(id, data)
        const successToast = useToastStore.getState().success
        successToast('Fee structure updated successfully')
        setTimeout(() => {
          navigate('/fees')
        }, 500) // Small delay to show toast
      } else {
        const data: FeeStructureCreate = {
          structure_name: formData.structure_name || generateStructureName(),
          class_id: formData.class_id,
          term_id: formData.term_id,
          line_items: lineItems,
          status: formData.status,
        }
        await feeStructuresApi.create(data)
        const successToast = useToastStore.getState().success
        successToast('Fee structure created successfully')
        setTimeout(() => {
          navigate('/fees')
        }, 500) // Small delay to show toast
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
        setError('Failed to save fee structure. Please check all fields.')
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
        title={isEdit ? 'Edit Fee Structure' : 'Create Fee Structure'}
        subtitle={isEdit ? 'Update fee structure details' : 'Create a new fee structure for a class and term'}
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
                {!isEdit && (
                  <>
                    {isSchoolAdmin && (
                      <div>
                        <label htmlFor="campus_id" className="block text-sm font-medium text-gray-700 mb-2">
                          Campus <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="campus_id"
                          name="campus_id"
                          value={formData.campus_id}
                          onChange={handleChange}
                          required
                          disabled={loadingData || isCampusAdmin}
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
                    )}

                    {isSchoolAdmin && (
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
                        disabled={!formData.academic_year_id || loadingData}
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
                      <label htmlFor="class_id" className="block text-sm font-medium text-gray-700 mb-2">
                        Class <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="class_id"
                        name="class_id"
                        value={formData.class_id}
                        onChange={handleChange}
                        required
                        disabled={!formData.campus_id || !formData.academic_year_id || loadingData}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                      >
                        <option value="">{formData.campus_id && formData.academic_year_id ? 'Select Class' : 'Select Campus and Academic Year first'}</option>
                        {classes
                          .filter((cls) => !blockedYearlyClassIds.has(cls.id))
                          .map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="structure_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Fee Structure Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="structure_name"
                    name="structure_name"
                    value={formData.structure_name}
                    onChange={handleChange}
                    required
                    maxLength={200}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., 2025-Term1-Class3A"
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-generated if left empty (Term-Class format)</p>
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
                    Only one ACTIVE structure per class per term. Activating this will deactivate others.
                  </p>
                </div>
              </div>
            </div>

            {/* Fee Line Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Fee Line Items</h2>
                {!isEdit || formData.status === 'INACTIVE' ? (
                  <button
                    type="button"
                    onClick={addLineItem}
                    disabled={formData.line_items.length >= 10}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    Add Line Item
                  </button>
                ) : null}
              </div>

              {isEdit && formData.status === 'ACTIVE' && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                  <strong>Note:</strong> Line items cannot be modified for ACTIVE fee structures. 
                  Create a new structure or set this to INACTIVE to edit.
                </div>
              )}

              {formData.line_items.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No line items. Click "Add Line Item" to add one.</p>
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
                            Amount (KES)
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Annual?
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order
                          </th>
                          {(!isEdit || formData.status === 'INACTIVE') && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {formData.line_items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3">
                              {(!isEdit || formData.status === 'INACTIVE') ? (
                                <input
                                  type="text"
                                  value={item.item_name}
                                  onChange={(e) => handleLineItemChange(index, 'item_name', e.target.value)}
                                  required
                                  maxLength={200}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                  placeholder="e.g., Tuition Fee"
                                />
                              ) : (
                                <span className="text-sm text-gray-900">{item.item_name}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {(!isEdit || formData.status === 'INACTIVE') ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.amount}
                                  onChange={(e) => handleLineItemChange(index, 'amount', e.target.value)}
                                  required
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                  placeholder="0.00"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-gray-900">{formatCurrency(parseFloat(item.amount))}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {(!isEdit || formData.status === 'INACTIVE') ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={item.is_annual}
                                    onChange={(e) =>
                                      handleLineItemChange(index, 'is_annual', e.target.checked)
                                    }
                                    className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                                  />
                                  <span className="text-sm text-gray-700">Annual (one-off)</span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-700">
                                  {item.is_annual ? 'Annual (one-off)' : 'Termly'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-500">{index + 1}</span>
                            </td>
                            {(!isEdit || formData.status === 'INACTIVE') && (
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
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900">Total Expected Fee:</span>
                      <span className="text-2xl font-bold text-primary-600">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                  </div>
                </div>
              )}
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
                {loading ? 'Saving...' : isEdit ? 'Update Fee Structure' : 'Create Fee Structure'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default FeeStructureFormPage

