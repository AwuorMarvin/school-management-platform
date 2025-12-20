import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { feeStructuresApi, FeeStructureTermlyCreate, FeeLineItemCreate } from '../api/feeStructures'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { termsApi, Term } from '../api/terms'
import { classesApi, Class } from '../api/classes'
import { campusesApi, Campus } from '../api/campuses'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { 
  Calendar, 
  Building2, 
  Users, 
  DollarSign, 
  Plus, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  FileText,
  CalendarDays
} from 'lucide-react'

interface LineItem {
  item_name: string
  amount: string
  display_order: number
  is_annual: boolean
  is_one_off: boolean
}

const FeeStructureTermlyFormPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { showToast } = useToastStore()
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  
  const [formData, setFormData] = useState({
    structure_name: '',
    campus_id: '',
    academic_year_id: '',
    term_id: '',
    line_items: [] as LineItem[],
  })

  const isCampusAdmin = user?.role === 'CAMPUS_ADMIN'

  useEffect(() => {
    loadInitialData()
    // Add initial line item
    setFormData(prev => ({
      ...prev,
      line_items: [{ item_name: '', amount: '0.00', display_order: 0, is_annual: false, is_one_off: false }],
      campus_id: isCampusAdmin && user?.campus_id ? user.campus_id : '',
    }))
  }, [isCampusAdmin, user?.campus_id])

  useEffect(() => {
    if (formData.academic_year_id) {
      loadTerms()
    } else {
      setTerms([])
    }
  }, [formData.academic_year_id])

  useEffect(() => {
    if (formData.campus_id && formData.academic_year_id) {
      loadClasses()
    } else {
      setClasses([])
      setSelectedClassIds([])
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
      showToast('Failed to load initial data', 'error')
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
        campus_id: formData.campus_id,
        academic_year_id: formData.academic_year_id,
        page: 1,
        page_size: 100,
      })
      setClasses(response.data)
    } catch (err: any) {
      console.error('Failed to load classes:', err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleClassToggle = (classId: string) => {
    setSelectedClassIds(prev => {
      if (prev.includes(classId)) {
        return prev.filter(id => id !== classId)
      } else {
        if (prev.length >= 10) {
          showToast('Maximum 10 classes allowed', 'error')
          return prev
        }
        return [...prev, classId]
      }
    })
  }

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number | boolean) => {
    setFormData(prev => {
      const newLineItems = [...prev.line_items]
      newLineItems[index] = { ...newLineItems[index], [field]: value }
      // Ensure is_annual and is_one_off are mutually exclusive
      if (field === 'is_annual' && value === true) {
        newLineItems[index].is_one_off = false
      }
      if (field === 'is_one_off' && value === true) {
        newLineItems[index].is_annual = false
      }
      return { ...prev, line_items: newLineItems }
    })
  }

  const addLineItem = () => {
    if (formData.line_items.length >= 10) {
      showToast('Maximum 10 line items allowed', 'error')
      return
    }
    setFormData(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        {
          item_name: '',
          amount: '0.00',
          display_order: prev.line_items.length,
          is_annual: false,
          is_one_off: false,
        },
      ],
    }))
  }

  const removeLineItem = (index: number) => {
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

  const renderLineItemsTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                Item Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                Amount (KES)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                Annual
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                One-Off
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/10">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {formData.line_items.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={item.item_name}
                    onChange={(e) => handleLineItemChange(index, 'item_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Tuition Fee"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.amount}
                    onChange={(e) => handleLineItemChange(index, 'amount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <label className="flex items-center justify-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.is_annual}
                      onChange={(e) => handleLineItemChange(index, 'is_annual', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </label>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <label className="flex items-center justify-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.is_one_off}
                      onChange={(e) => handleLineItemChange(index, 'is_one_off', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </label>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                  {formData.line_items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      className="text-red-600 hover:text-red-800 flex items-center gap-1"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {formData.line_items.length < 10 && (
              <tr>
                <td colSpan={5} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Line Item
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.structure_name.trim()) {
      setError('Structure name is required')
      return
    }
    if (!formData.campus_id) {
      setError('Campus is required')
      return
    }
    if (!formData.academic_year_id) {
      setError('Academic year is required')
      return
    }
    if (!formData.term_id) {
      setError('Term is required')
      return
    }
    if (selectedClassIds.length === 0) {
      setError('At least one class must be selected')
      return
    }
    if (formData.line_items.length === 0) {
      setError('At least one line item is required')
      return
    }

    // Validate line items
    for (const item of formData.line_items) {
      if (!item.item_name.trim()) {
        setError('All line items must have a name')
        return
      }
      const amount = parseFloat(item.amount)
      if (isNaN(amount) || amount < 0) {
        setError('All line items must have a valid amount >= 0')
        return
      }
    }

    try {
      setLoading(true)
      const payload: FeeStructureTermlyCreate = {
        structure_name: formData.structure_name,
        campus_id: formData.campus_id,
        academic_year_id: formData.academic_year_id,
        term_id: formData.term_id,
        class_ids: selectedClassIds,
        line_items: formData.line_items.map((item, index) => ({
          item_name: item.item_name,
          amount: item.amount,
          display_order: index,
          is_annual: item.is_annual,
          is_one_off: item.is_one_off,
        })),
      }

      await feeStructuresApi.createTermly(payload)
      showToast('Fee structure created successfully', 'success')
      navigate('/fee-structures')
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to create fee structure'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title="Create Termly Fee Structure"
        subtitle="Define fees for a specific term"
        action={<BackButton to="/fee-structures" />}
      />

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Context Section - Compact Grid */}
          <ContentCard className="mb-6">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Structure Name *
                </label>
                <input
                  type="text"
                  name="structure_name"
                  value={formData.structure_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Term 1 Fees 2024"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Campus *
                </label>
                <select
                  name="campus_id"
                  value={formData.campus_id}
                  onChange={handleChange}
                  required
                  disabled={isCampusAdmin}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Campus</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Academic Year *
                </label>
                <select
                  name="academic_year_id"
                  value={formData.academic_year_id}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Term *
                </label>
                <select
                  name="term_id"
                  value={formData.term_id}
                  onChange={handleChange}
                  required
                  disabled={!formData.academic_year_id}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Term</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ContentCard>

          {/* Classes Selection - Compact */}
          <ContentCard className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">Classes</h3>
                <span className="text-xs text-gray-500">(Select 1-10 classes)</span>
              </div>
              {selectedClassIds.length > 0 && (
                <span className="text-xs font-medium text-primary-600">
                  {selectedClassIds.length} selected
                </span>
              )}
            </div>
            {classes.length === 0 ? (
              <p className="text-xs text-gray-500">
                Select a campus and academic year to see available classes.
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                {classes.map(cls => (
                  <label key={cls.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(cls.id)}
                      onChange={() => handleClassToggle(cls.id)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-xs text-gray-700">{cls.name}</span>
                  </label>
                ))}
              </div>
            )}
          </ContentCard>

          {/* Fee Line Items - Table */}
          <ContentCard className="mb-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Fee Line Items
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Total:</span>
                <span className="text-sm font-bold text-gray-900">
                  KES {calculateTotal().toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Annual:</strong> Fees charged once per academic year (in first term). <strong>One-Off:</strong> Fees charged only to new students (e.g., admission fee).
              </p>
            </div>
            {renderLineItemsTable()}
          </ContentCard>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/fee-structures')}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingData}
              className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>Creating...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Create Fee Structure
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}

export default FeeStructureTermlyFormPage

