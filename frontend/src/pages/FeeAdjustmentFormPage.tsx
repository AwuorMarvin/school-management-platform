import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { feeAdjustmentsApi, FeeAdjustmentCreate, FeeAdjustmentUpdate, FeeAdjustment } from '../api/feeAdjustments'
import { studentsApi, Student } from '../api/students'
import { termsApi, Term } from '../api/terms'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { feeSummaryApi } from '../api/feeSummary'
import { useAuthStore } from '../store/authStore'

const FeeAdjustmentFormPage = () => {
  const navigate = useNavigate()
  const { id, studentId } = useParams<{ id?: string; studentId?: string }>()
  const isEdit = !!id
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [baseExpectedFee, setBaseExpectedFee] = useState<number>(0)
  const [formData, setFormData] = useState({
    student_id: studentId || '',
    academic_year_id: '',
    term_id: '',
    adjustment_type: 'FIXED_AMOUNT' as 'FIXED_AMOUNT' | 'PERCENTAGE',
    adjustment_value: '0.00',
    reason: '',
  })

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (!isAdmin) {
      navigate('/fees')
      return
    }
    loadInitialData()
    if (isEdit && id) {
      loadAdjustment()
    } else if (studentId) {
      loadStudent()
    }
  }, [id, isEdit, studentId, isAdmin, navigate])

  useEffect(() => {
    if (formData.academic_year_id) {
      loadTerms()
    } else {
      setTerms([])
    }
  }, [formData.academic_year_id])

  useEffect(() => {
    if (formData.student_id && formData.term_id) {
      loadStudentFee()
    }
  }, [formData.student_id, formData.term_id])

  const loadInitialData = async () => {
    try {
      setLoadingData(true)
      const [academicYearsResponse, studentsResponse] = await Promise.all([
        academicYearsApi.list({ page: 1, page_size: 100 }),
        studentsApi.list({ limit: 1000 }),
      ])
      setAcademicYears(academicYearsResponse.data)
      setStudents(studentsResponse.data)
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

  const loadStudent = async () => {
    try {
      const student = await studentsApi.get(studentId!)
      setSelectedStudent(student)
      setFormData(prev => ({ ...prev, student_id: student.id }))
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load student')
    }
  }

  const loadStudentFee = async () => {
    try {
      const summary = await feeSummaryApi.getStudentSummary(formData.student_id, {
        term_id: formData.term_id,
      })
      setBaseExpectedFee(summary.expected_fee)
    } catch (err: any) {
      console.error('Failed to load student fee:', err)
      setBaseExpectedFee(0)
    }
  }

  const loadAdjustment = async () => {
    try {
      setLoading(true)
      const adjustment = await feeAdjustmentsApi.get(id!)
      setFormData({
        student_id: adjustment.student_id,
        term_id: adjustment.term_id,
        adjustment_type: adjustment.adjustment_type as 'FIXED_AMOUNT' | 'PERCENTAGE',
        adjustment_value: adjustment.adjustment_value,
        reason: adjustment.reason,
      })
      // Load student
      const student = await studentsApi.get(adjustment.student_id)
      setSelectedStudent(student)
      // Load academic year from term
      const term = await termsApi.get(adjustment.term_id)
      if (term.academic_year_id) {
        setFormData(prev => ({ ...prev, academic_year_id: term.academic_year_id }))
        await loadTerms()
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load fee adjustment')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleStudentChange = async (studentId: string) => {
    setFormData(prev => ({ ...prev, student_id: studentId }))
    const student = students.find(s => s.id === studentId)
    setSelectedStudent(student || null)
  }

  const calculateAdjustedFee = () => {
    if (!baseExpectedFee || !formData.adjustment_value) return baseExpectedFee

    const adjustmentValue = parseFloat(formData.adjustment_value)
    if (isNaN(adjustmentValue)) return baseExpectedFee

    if (formData.adjustment_type === 'FIXED_AMOUNT') {
      return Math.max(0, baseExpectedFee - adjustmentValue)
    } else {
      // PERCENTAGE
      const discount = baseExpectedFee * (adjustmentValue / 100)
      return Math.max(0, baseExpectedFee - discount)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.student_id) {
      setError('Student is required')
      return
    }

    if (!formData.term_id) {
      setError('Term is required')
      return
    }

    if (!formData.reason.trim()) {
      setError('Reason is required')
      return
    }

    const adjustmentValue = parseFloat(formData.adjustment_value)
    if (isNaN(adjustmentValue) || adjustmentValue < 0) {
      setError('Adjustment value must be a valid number greater than or equal to 0')
      return
    }

    if (formData.adjustment_type === 'PERCENTAGE' && adjustmentValue > 100) {
      setError('Percentage adjustment cannot exceed 100%')
      return
    }

    setLoading(true)

    try {
      if (isEdit && id) {
        const data: FeeAdjustmentUpdate = {
          adjustment_type: formData.adjustment_type,
          adjustment_value: formData.adjustment_value,
          reason: formData.reason,
        }
        await feeAdjustmentsApi.update(id, data)
        navigate('/fees')
      } else {
        const data: FeeAdjustmentCreate = {
          student_id: formData.student_id,
          term_id: formData.term_id,
          adjustment_type: formData.adjustment_type,
          adjustment_value: formData.adjustment_value,
          reason: formData.reason,
        }
        await feeAdjustmentsApi.create(data)
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
        setError('Failed to save fee adjustment. Please check all fields.')
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

  if (!isAdmin) {
    return null
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? 'Edit Fee Adjustment' : 'Adjust Student Fee'}
        subtitle={isEdit ? 'Update fee adjustment details' : 'Apply a discount or addition to a student\'s fee'}
        action={<BackButton to="/fee-status" />}
      />

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <ContentCard>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Student Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!isEdit && !studentId && (
                  <div>
                    <label htmlFor="student_id" className="block text-sm font-medium text-gray-700 mb-2">
                      Student <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="student_id"
                      name="student_id"
                      value={formData.student_id}
                      onChange={(e) => handleStudentChange(e.target.value)}
                      required
                      disabled={loadingData}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                    >
                      <option value="">Select Student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.first_name} {student.middle_name || ''} {student.last_name} ({student.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedStudent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Student Name
                    </label>
                    <input
                      type="text"
                      value={`${selectedStudent.first_name} ${selectedStudent.middle_name || ''} ${selectedStudent.last_name}`}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                    />
                  </div>
                )}

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
              </div>
            </div>

            {/* Fee Information */}
            {formData.student_id && formData.term_id && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Fee Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base Expected Fee
                    </label>
                    <input
                      type="text"
                      value={formatCurrency(baseExpectedFee)}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Adjusted Expected Fee
                    </label>
                    <input
                      type="text"
                      value={formatCurrency(calculateAdjustedFee())}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-primary-600 font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Adjustment Details */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Adjustment Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="adjustment_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Adjustment Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="adjustment_type"
                    name="adjustment_type"
                    value={formData.adjustment_type}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="FIXED_AMOUNT">Fixed Discount (KES)</option>
                    <option value="PERCENTAGE">Percentage Discount (%)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.adjustment_type === 'FIXED_AMOUNT'
                      ? 'Enter the fixed amount to discount in KES'
                      : 'Enter the percentage to discount (0-100%)'}
                  </p>
                </div>

                <div>
                  <label htmlFor="adjustment_value" className="block text-sm font-medium text-gray-700 mb-2">
                    Adjustment Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="adjustment_value"
                    name="adjustment_value"
                    value={formData.adjustment_value}
                    onChange={handleChange}
                    required
                    min="0"
                    max={formData.adjustment_type === 'PERCENTAGE' ? '100' : undefined}
                    step={formData.adjustment_type === 'FIXED_AMOUNT' ? '0.01' : '0.1'}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder={formData.adjustment_type === 'FIXED_AMOUNT' ? '0.00' : '0.0'}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.adjustment_type === 'FIXED_AMOUNT'
                      ? `Maximum: ${formatCurrency(baseExpectedFee)}`
                      : 'Maximum: 100%'}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="reason"
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    required
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter the reason for this adjustment (required for audit purposes)"
                  />
                  <p className="mt-1 text-xs text-gray-500">This reason will be recorded for audit purposes</p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                to="/fee-status"
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || loadingData}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Adjustment' : 'Create Adjustment'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default FeeAdjustmentFormPage

