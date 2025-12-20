import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { 
  feeStructuresApi, 
  FeeStructureAnnualCreate, 
  FeeStructure,
  FeeLineItemCreate,
  FeeStructureConflictResponse 
} from '../api/feeStructures'
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
  X, 
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight
} from 'lucide-react'

interface LineItem {
  item_name: string
  amount: string
  display_order: number
  is_annual: boolean
  is_one_off: boolean
}

const FeeStructureAnnualFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const { user } = useAuthStore()
  const successToast = useToastStore((state) => state.success)
  const errorToast = useToastStore((state) => state.error)
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [loadingStructure, setLoadingStructure] = useState(false)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [error, setError] = useState('')
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [conflictData, setConflictData] = useState<FeeStructureConflictResponse | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [mergeStrategy, setMergeStrategy] = useState<'MERGE' | 'OVERRIDE' | null>(null)
  const [originalStructure, setOriginalStructure] = useState<FeeStructure | null>(null)
  
  const [formData, setFormData] = useState({
    structure_name: '',
    campus_id: '',
    academic_year_id: '',
    term_1_items: [] as LineItem[],
    term_2_items: [] as LineItem[],
    term_3_items: [] as LineItem[],
    annual_items: [] as LineItem[],
    one_off_items: [] as LineItem[],
  })

  const [activeTab, setActiveTab] = useState<'term1' | 'term2' | 'term3' | 'annual' | 'oneoff'>('term1')

  const isCampusAdmin = user?.role === 'CAMPUS_ADMIN'

  useEffect(() => {
    let isMounted = true
    
    const initialize = async () => {
      if (isEdit && id) {
        await loadFeeStructure()
      } else {
        // Add initial line items for new structure
        setFormData(prev => ({
          ...prev,
          term_1_items: [{ item_name: '', amount: '0.00', display_order: 0, is_annual: false, is_one_off: false }],
          term_2_items: [{ item_name: '', amount: '0.00', display_order: 0, is_annual: false, is_one_off: false }],
          term_3_items: [{ item_name: '', amount: '0.00', display_order: 0, is_annual: false, is_one_off: false }],
          annual_items: [{ item_name: '', amount: '0.00', display_order: 0, is_annual: true, is_one_off: false }],
          one_off_items: [{ item_name: '', amount: '0.00', display_order: 0, is_annual: false, is_one_off: true }],
          campus_id: isCampusAdmin && user?.campus_id ? user.campus_id : '',
        }))
      }
      
      // Load data only if component is still mounted
      if (isMounted) {
        await loadInitialData()
      }
    }
    
    initialize()
    
    return () => {
      isMounted = false
    }
  }, [isEdit, id, isCampusAdmin, user?.campus_id])

  useEffect(() => {
    if (formData.academic_year_id) {
      loadTerms()
    } else {
      setTerms([])
      // Reset to term1 tab if no academic year
      setActiveTab('term1')
    }
  }, [formData.academic_year_id])

  // Auto-switch tab if current tab becomes invalid
  useEffect(() => {
    if (activeTab === 'term2' && terms.length < 2) {
      setActiveTab('term1')
    }
    if (activeTab === 'term3' && terms.length < 3) {
      setActiveTab('term1')
    }
  }, [terms.length, activeTab])

  useEffect(() => {
    if (formData.campus_id && formData.academic_year_id) {
      loadClasses()
    } else {
      setClasses([])
      setSelectedClassIds([])
    }
  }, [formData.campus_id, formData.academic_year_id])

  const loadInitialData = async () => {
    console.log('loadInitialData called')
    setLoadingData(true)
    setError('')
    
    try {
      console.log('Loading initial data...')
      
      // Use Promise.all for parallel requests (like ClassFormPage)
      const [campusesResponse, academicYearsResponse] = await Promise.all([
        campusesApi.list(),
        academicYearsApi.list({ page: 1, page_size: 100 }),
      ])
      
      console.log('Campuses response:', campusesResponse)
      console.log('Academic years response:', academicYearsResponse)
      
      // Extract data arrays
      const campusesData = campusesResponse?.data || []
      const academicYearsData = academicYearsResponse?.data || []
      
      console.log('Campuses data:', campusesData)
      console.log('Academic years data:', academicYearsData)
      console.log('Campuses count:', campusesData.length)
      console.log('Academic years count:', academicYearsData.length)
      
      setCampuses(campusesData)
      setAcademicYears(academicYearsData)
      
      if (academicYearsData.length === 0) {
        console.warn('No academic years found')
        setError('No academic years found. Please create an academic year first.')
      }
      if (campusesData.length === 0) {
        console.warn('No campuses found')
        setError('No campuses found. Please create a campus first.')
      }
    } catch (err: any) {
      console.error('Failed to load initial data:', err)
      console.error('Error details:', err.response?.data || err.message)
      
      // Check if it's a timeout error
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        const errorMessage = 'Request timed out. Please check if the backend server is running.'
        setError(errorMessage)
        errorToast(errorMessage)
      } else {
        const errorMessage = err.response?.data?.message || err.response?.data?.detail?.message || err.message || 'Failed to load initial data'
        setError(errorMessage)
        errorToast(errorMessage)
      }

      // Set empty arrays to prevent stuck loading state
      setAcademicYears([])
      setCampuses([])
    } finally {
      console.log('Setting loadingData to false')
      setLoadingData(false)
    }
  }

  const loadTerms = async () => {
    try {
      const response = await termsApi.list({ academic_year_id: formData.academic_year_id })
      const sorted = response.data.sort((a, b) => 
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      )
      setTerms(sorted)
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

  const loadFeeStructure = async () => {
    if (!id) return
    
    try {
      setLoadingStructure(true)
      const structure = await feeStructuresApi.get(id)
      
      // Get all related structures (same campus, academic year, and classes)
      // This is needed because annual fee structures create multiple structures (one per term + one for annual/one-off)
      const allStructures = await feeStructuresApi.list({
        campus_id: structure.campus_id,
        academic_year_id: structure.academic_year_id,
        page_size: 100 // Get all related structures
      })
      
      // Filter to structures with the same classes
      const structureClassIds = structure.class_ids || (structure.class_id ? [structure.class_id] : [])
      const relatedStructures = allStructures.data.filter(s => {
        const sClassIds = s.class_ids || (s.class_id ? [s.class_id] : [])
        return sClassIds.length === structureClassIds.length && 
               sClassIds.every(id => structureClassIds.includes(id))
      })
      
      // Use the first structure for basic info (campus, academic year, classes)
      const primaryStructure = structure
      
      setOriginalStructure(primaryStructure)
      
      // Prepopulate form data
      setFormData(prev => ({
        ...prev,
        structure_name: primaryStructure.structure_name || '',
        campus_id: primaryStructure.campus_id,
        academic_year_id: primaryStructure.academic_year_id,
      }))
      
      // Set selected class IDs
      if (primaryStructure.class_ids && primaryStructure.class_ids.length > 0) {
        setSelectedClassIds(primaryStructure.class_ids)
      } else if (primaryStructure.class_id) {
        // Legacy support
        setSelectedClassIds([primaryStructure.class_id])
      }
      
      // Organize line items by category
      const term1Items: LineItem[] = []
      const term2Items: LineItem[] = []
      const term3Items: LineItem[] = []
      const annualItems: LineItem[] = []
      const oneOffItems: LineItem[] = []
      
      // Load terms to identify term order
      if (primaryStructure.academic_year_id) {
        const termsResponse = await termsApi.list({ academic_year_id: primaryStructure.academic_year_id })
        const sortedTerms = termsResponse.data.sort((a, b) => 
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        )
        setTerms(sortedTerms)
        
        const term1Id = sortedTerms[0]?.id
        const term2Id = sortedTerms[1]?.id
        const term3Id = sortedTerms[2]?.id
        
        // Process all related structures
        relatedStructures.forEach(s => {
          s.line_items?.forEach(item => {
            const lineItem: LineItem = {
              item_name: item.item_name,
              amount: String(item.amount),
              display_order: item.display_order,
              is_annual: item.is_annual || false,
              is_one_off: item.is_one_off || false,
            }
            
            if (item.is_one_off) {
              oneOffItems.push(lineItem)
            } else if (item.is_annual) {
              annualItems.push(lineItem)
            } else {
              // Regular term items - organize by term_id
              if (s.term_id === term1Id) {
                term1Items.push(lineItem)
              } else if (s.term_id === term2Id) {
                term2Items.push(lineItem)
              } else if (s.term_id === term3Id) {
                term3Items.push(lineItem)
              } else if (!s.term_id && s.structure_scope === 'YEAR') {
                // YEAR-scoped structure without term_id - these should only have annual/one-off
                // But if there are regular items, put them in term 1 as fallback
                term1Items.push(lineItem)
              }
            }
          })
        })
      } else {
        // Fallback: organize by flags only
        relatedStructures.forEach(s => {
          s.line_items?.forEach(item => {
            const lineItem: LineItem = {
              item_name: item.item_name,
              amount: String(item.amount),
              display_order: item.display_order,
              is_annual: item.is_annual || false,
              is_one_off: item.is_one_off || false,
            }
            
            if (item.is_one_off) {
              oneOffItems.push(lineItem)
            } else if (item.is_annual) {
              annualItems.push(lineItem)
            } else {
              term1Items.push(lineItem)
            }
          })
        })
      }
      
      // Ensure at least one item in each array (for UI)
      if (term1Items.length === 0) term1Items.push({ item_name: '', amount: '0.00', display_order: 0, is_annual: false, is_one_off: false })
      if (term2Items.length === 0) term2Items.push({ item_name: '', amount: '0.00', display_order: 0, is_annual: false, is_one_off: false })
      if (term3Items.length === 0) term3Items.push({ item_name: '', amount: '0.00', display_order: 0, is_annual: false, is_one_off: false })
      if (annualItems.length === 0) annualItems.push({ item_name: '', amount: '0.00', display_order: 0, is_annual: true, is_one_off: false })
      if (oneOffItems.length === 0) oneOffItems.push({ item_name: '', amount: '0.00', display_order: 0, is_annual: false, is_one_off: true })
      
      setFormData(prev => ({
        ...prev,
        term_1_items: term1Items,
        term_2_items: term2Items,
        term_3_items: term3Items,
        annual_items: annualItems,
        one_off_items: oneOffItems,
      }))
      
      // Load classes for the campus and academic year
      if (primaryStructure.campus_id && primaryStructure.academic_year_id) {
        await loadClasses()
      }
    } catch (err: any) {
      console.error('Failed to load fee structure:', err)
      setError(err.response?.data?.message || 'Failed to load fee structure')
      errorToast('Failed to load fee structure')
    } finally {
      setLoadingStructure(false)
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
          errorToast('Maximum 10 classes allowed')
          return prev
        }
        return [...prev, classId]
      }
    })
  }

  const handleLineItemChange = (
    section: 'term_1_items' | 'term_2_items' | 'term_3_items' | 'annual_items' | 'one_off_items',
    index: number,
    field: keyof LineItem,
    value: string | number | boolean
  ) => {
    setFormData(prev => {
      const newItems = [...prev[section]]
      newItems[index] = { ...newItems[index], [field]: value }
      // Ensure is_annual and is_one_off are mutually exclusive
      if (field === 'is_annual' && value === true) {
        newItems[index].is_one_off = false
      }
      if (field === 'is_one_off' && value === true) {
        newItems[index].is_annual = false
      }
      return { ...prev, [section]: newItems }
    })
  }

  const addLineItem = (section: 'term_1_items' | 'term_2_items' | 'term_3_items' | 'annual_items' | 'one_off_items') => {
    if (formData[section].length >= 10) {
      errorToast('Maximum 10 line items per section')
      return
    }
    setFormData(prev => ({
      ...prev,
      [section]: [
        ...prev[section],
        {
          item_name: '',
          amount: '0.00',
          display_order: prev[section].length,
          is_annual: section === 'annual_items',
          is_one_off: section === 'one_off_items',
        },
      ],
    }))
  }

  const removeLineItem = (
    section: 'term_1_items' | 'term_2_items' | 'term_3_items' | 'annual_items' | 'one_off_items',
    index: number
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index).map((item, i) => ({
        ...item,
        display_order: i,
      })),
    }))
  }

  const checkConflicts = async () => {
    // Skip conflict checking in edit mode - we're creating a new version
    if (isEdit) {
      handleCreate(false)
      return
    }

    // Call create directly - it will return conflict info if conflicts exist
    handleCreate(false)
  }

  const handleCreate = async (overrideConflicts: boolean = false) => {
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
    if (selectedClassIds.length === 0) {
      setError('At least one class must be selected')
      return
    }

    // Validate at least one section has items
    const totalItems = 
      formData.term_1_items.length +
      formData.term_2_items.length +
      formData.term_3_items.length +
      formData.annual_items.length +
      formData.one_off_items.length

    if (totalItems === 0) {
      setError('At least one line item is required')
      return
    }

    // Validate line items
    const allItems = [
      ...formData.term_1_items,
      ...formData.term_2_items,
      ...formData.term_3_items,
      ...formData.annual_items,
      ...formData.one_off_items,
    ]

    for (const item of allItems) {
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
      
      // Prepare line items for each term/section (filter out empty items)
      const prepareLineItems = (items: LineItem[], displayOrderStart: number = 0) => {
        return items
          .filter(item => {
            // Filter out items with empty names or invalid amounts
            if (!item.item_name.trim()) return false
            const amount = parseFloat(item.amount)
            if (isNaN(amount) || amount < 0) return false
            return true
          })
          .map((item, idx) => {
            // Convert amount to number (Pydantic will convert to Decimal)
            const amount = parseFloat(item.amount) || 0
            return {
              item_name: item.item_name.trim(),
              amount: amount, // Send as number, Pydantic will convert to Decimal
              display_order: displayOrderStart + idx,
              is_annual: item.is_annual || false,
              is_one_off: item.is_one_off || false,
            }
          })
      }

      let displayOrder = 0
      const term1Items = prepareLineItems(formData.term_1_items, displayOrder)
      displayOrder += term1Items.length
      
      const term2Items = prepareLineItems(formData.term_2_items, displayOrder)
      displayOrder += term2Items.length
      
      const term3Items = prepareLineItems(formData.term_3_items, displayOrder)
      displayOrder += term3Items.length
      
      const annualItems = prepareLineItems(formData.annual_items, displayOrder)
      displayOrder += annualItems.length
      
      const oneOffItems = prepareLineItems(formData.one_off_items, displayOrder)

      // Validate that at least one section has items after filtering
      const totalItems = term1Items.length + term2Items.length + term3Items.length + annualItems.length + oneOffItems.length
      if (totalItems === 0) {
        setError('At least one valid line item is required (with name and amount)')
        return
      }

      const payload: FeeStructureAnnualCreate = {
        campus_id: formData.campus_id,
        academic_year_id: formData.academic_year_id,
        class_ids: selectedClassIds,
        override_conflicts: overrideConflicts,
        term_1_items: term1Items.length > 0 ? term1Items : undefined,
        term_2_items: term2Items.length > 0 ? term2Items : undefined,
        term_3_items: term3Items.length > 0 ? term3Items : undefined,
        annual_items: annualItems.length > 0 ? annualItems : undefined,
        one_off_items: oneOffItems.length > 0 ? oneOffItems : undefined,
      }

      // Debug: Log payload before sending
      console.log('Sending payload:', JSON.stringify(payload, null, 2))

      if (isEdit) {
        // Create a new version - the backend should handle versioning
        await feeStructuresApi.createAnnual(payload)
        successToast('New version of annual fee structure created successfully')
      } else {
        await feeStructuresApi.createAnnual(payload)
        successToast('Annual fee structure created successfully')
      }
      navigate('/fee-structures')
    } catch (err: any) {
      // Handle conflict response (409)
      if (err.response?.status === 409 && err.response?.data?.detail) {
        const errorDetail = err.response.data.detail
        if (errorDetail.has_conflicts || errorDetail.error_code === 'FEE_STRUCTURE_CONFLICT') {
          // Set conflict data and show modal
          setConflictData({
            has_conflicts: true,
            conflicts: errorDetail.conflicts || [],
            message: errorDetail.message || 'Conflicts found',
            conflicting_structure_ids: errorDetail.conflicting_structure_ids || []
          })
          setShowConflictModal(true)
          return
        }
      }
      // Better error handling to show validation errors
      let message = 'Failed to create annual fee structure'
      if (err.response?.data) {
        const errorData = err.response.data
        if (errorData.detail) {
          // Handle Pydantic validation errors
          if (Array.isArray(errorData.detail)) {
            const validationErrors = errorData.detail.map((e: any) => {
              const field = e.loc?.join('.') || 'field'
              return `${field}: ${e.msg}`
            }).join(', ')
            message = `Validation error: ${validationErrors}`
          } else if (typeof errorData.detail === 'string') {
            message = errorData.detail
          } else if (errorData.detail.message) {
            message = errorData.detail.message
            // Include details if available (for development mode)
            if (errorData.detail.details) {
              message += `\nDetails: ${JSON.stringify(errorData.detail.details, null, 2)}`
            }
          } else if (errorData.detail.error_code) {
            message = errorData.detail.message || errorData.detail.error_code
            // Include details if available (for development mode)
            if (errorData.detail.details) {
              message += `\nDetails: ${JSON.stringify(errorData.detail.details, null, 2)}`
            }
          }
        } else if (errorData.message) {
          message = errorData.message
          // Include details if available (for development mode)
          if (errorData.details) {
            message += `\nDetails: ${JSON.stringify(errorData.details, null, 2)}`
          }
        }
      }
      setError(message)
      errorToast(message)
      console.error('Error creating annual fee structure:', err.response?.data || err)
      // Log full error details for debugging
      if (err.response?.data) {
        console.error('Full error response:', JSON.stringify(err.response.data, null, 2))
        // Also log details if available
        if (err.response.data.details || err.response.data.detail?.details) {
          console.error('Error details:', err.response.data.details || err.response.data.detail?.details)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const calculateTotal = () => {
    const allItems = [
      ...formData.term_1_items,
      ...formData.term_2_items,
      ...formData.term_3_items,
      ...formData.annual_items,
      ...formData.one_off_items,
    ]
    return allItems.reduce((sum, item) => {
      return sum + parseFloat(item.amount || '0')
    }, 0)
  }

  const renderLineItemsTable = (
    section: 'term_1_items' | 'term_2_items' | 'term_3_items' | 'annual_items' | 'one_off_items'
  ) => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                Item Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                Amount (KES)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {formData[section].map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={item.item_name}
                    onChange={(e) => handleLineItemChange(section, index, 'item_name', e.target.value)}
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
                    onChange={(e) => handleLineItemChange(section, index, 'amount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                  {formData[section].length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(section, index)}
                      className="text-red-600 hover:text-red-800 flex items-center gap-1"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {formData[section].length < 10 && (
              <tr>
                <td colSpan={3} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => addLineItem(section)}
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

  const tabs = [
    { id: 'term1' as const, label: `Term 1${terms[0] ? `: ${terms[0].name}` : ''}`, section: 'term_1_items' as const },
    { id: 'term2' as const, label: `Term 2${terms[1] ? `: ${terms[1].name}` : ''}`, section: 'term_2_items' as const },
    { id: 'term3' as const, label: `Term 3${terms[2] ? `: ${terms[2].name}` : ''}`, section: 'term_3_items' as const },
    { id: 'annual' as const, label: 'Annual Fees', section: 'annual_items' as const },
    { id: 'oneoff' as const, label: 'One-Off Fees', section: 'one_off_items' as const },
  ]

  const getCurrentSection = () => {
    const tab = tabs.find(t => t.id === activeTab)
    return tab ? tab.section : 'term_1_items'
  }

  const getSectionTotal = (section: typeof tabs[number]['section']) => {
    return formData[section].reduce((sum, item) => {
      return sum + parseFloat(item.amount || '0')
    }, 0)
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? 'Edit Annual Fee Structure' : 'Create Annual Fee Structure'}
        subtitle={isEdit ? 'Create a new version of this annual fee structure' : 'Define fees for all terms in an academic year'}
        action={<BackButton to="/fee-structures" />}
      />

      <div className="p-8">
        {loadingStructure && (
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
            <p className="text-sm text-blue-800">Loading fee structure...</p>
          </div>
        )}
        
        {isEdit && originalStructure && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
            <p className="text-sm font-medium text-yellow-800">Creating New Version</p>
            <p className="text-sm text-yellow-700 mt-1">
              You are creating a new version of this annual fee structure. Context fields (Campus, Academic Year, Classes) cannot be changed.
              {originalStructure.status === 'ACTIVE' && ' The original structure will remain active until you activate this new version.'}
            </p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Conflict Modal */}
        {showConflictModal && conflictData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Conflict Detection</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConflictModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-gray-700 mb-4">{conflictData.message}</p>
                <div className="space-y-3 mb-6">
                  {conflictData.conflicts.map((conflict, idx) => (
                    <div key={idx} className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">{conflict.class_name}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Existing term structures: {conflict.existing_term_names.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConflictModal(false)
                    navigate('/fee-structures')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConflictModal(false)
                    handleCreate(true) // Override conflicts
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                  Override
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); checkConflicts(); }}>
          {/* Context Section - Compact Grid */}
          <ContentCard className="mb-6">
            <div className="grid grid-cols-3 gap-4">
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
                  placeholder="e.g., Annual Fees 2024"
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
                  disabled={isCampusAdmin || loadingData || isEdit}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{loadingData ? 'Loading...' : 'Select Campus'}</option>
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
                  disabled={loadingData || isEdit}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{loadingData ? 'Loading...' : 'Select Academic Year'}</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>
                      {year.name}
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
                  <label key={cls.id} className={`flex items-center gap-2 ${isEdit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-white'} p-1.5 rounded`}>
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(cls.id)}
                      onChange={() => handleClassToggle(cls.id)}
                      disabled={isEdit}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs text-gray-700">{cls.name}</span>
                  </label>
                ))}
              </div>
            )}
          </ContentCard>

          {/* Tabbed Fee Sections */}
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

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              {tabs.map((tab) => {
                // Hide term tabs if terms aren't loaded or don't exist
                if (tab.id === 'term2' && terms.length < 2) {
                  return null
                }
                if (tab.id === 'term3' && terms.length < 3) {
                  return null
                }
                const sectionTotal = getSectionTotal(tab.section)
                const itemCount = formData[tab.section].filter(item => item.item_name.trim()).length
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors relative ${
                      activeTab === tab.id
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{tab.label}</span>
                      {itemCount > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          activeTab === tab.id 
                            ? 'bg-primary-100 text-primary-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {itemCount}
                        </span>
                      )}
                    </div>
                    {sectionTotal > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        KES {sectionTotal.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Active Tab Content */}
            <div>
              {activeTab === 'term1' && terms.length > 0 && renderLineItemsTable('term_1_items')}
              {activeTab === 'term2' && terms.length > 1 && renderLineItemsTable('term_2_items')}
              {activeTab === 'term3' && terms.length > 2 && renderLineItemsTable('term_3_items')}
              {activeTab === 'annual' && renderLineItemsTable('annual_items')}
              {activeTab === 'oneoff' && renderLineItemsTable('one_off_items')}
            </div>
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
              disabled={loading || loadingData || checkingConflicts || loadingStructure}
              className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {checkingConflicts ? (
                <>Checking Conflicts...</>
              ) : loading ? (
                <>{isEdit ? 'Creating New Version...' : 'Creating...'}</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isEdit ? 'Create New Version' : 'Create Annual Fee Structure'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}

export default FeeStructureAnnualFormPage

