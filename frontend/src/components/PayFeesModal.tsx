import { useState, useEffect } from 'react'
import { paymentsApi, PaymentRequest } from '../api/payments'
import { studentsApi, Student } from '../api/students'
import { feeSummaryApi, StudentFeeSummaryResponse } from '../api/feeSummary'
import { termsApi, Term } from '../api/terms'
import { useToastStore } from '../store/toastStore'

interface PayFeesModalProps {
  isOpen: boolean
  onClose: () => void
  onPaymentSuccess?: () => void
}

const PayFeesModal: React.FC<PayFeesModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  const [studentSearch, setStudentSearch] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [studentSummary, setStudentSummary] = useState<StudentFeeSummaryResponse | null>(null)
  const [currentTerm, setCurrentTerm] = useState<Term | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('MPESA')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const successToast = useToastStore((state) => state.success)
  const errorToast = useToastStore((state) => state.error)

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setStudentSearch('')
      setStudents([])
      setSelectedStudent(null)
      setStudentSummary(null)
      setAmount('')
      setPaymentDate(new Date().toISOString().split('T')[0])
      setPaymentMethod('MPESA')
      setReferenceNumber('')
      loadCurrentTerm()
    }
  }, [isOpen])

  useEffect(() => {
    if (studentSearch.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchStudents()
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setStudents([])
    }
  }, [studentSearch])

  useEffect(() => {
    if (selectedStudent && currentTerm) {
      loadStudentSummary()
    }
  }, [selectedStudent, currentTerm])

  const loadCurrentTerm = async () => {
    try {
      const termsResponse = await termsApi.list({ page: 1, page_size: 100 })
      const current = termsResponse.data.find((t) => t.is_current)
      setCurrentTerm(current || termsResponse.data[0] || null)
    } catch (err) {
      console.error('Failed to load current term:', err)
    }
  }

  const searchStudents = async () => {
    try {
      setLoadingStudents(true)
      const response = await studentsApi.list({
        search: studentSearch,
        limit: 50,
        status: 'ACTIVE',
      })
      setStudents(response.data)
    } catch (err: any) {
      errorToast(err.response?.data?.message || 'Failed to search students')
    } finally {
      setLoadingStudents(false)
    }
  }

  const loadStudentSummary = async () => {
    if (!selectedStudent || !currentTerm) return

    try {
      setLoadingSummary(true)
      const summary = await feeSummaryApi.getStudentSummary(selectedStudent.id, {
        term_id: currentTerm.id,
      })
      setStudentSummary(summary)
    } catch (err: any) {
      errorToast(err.response?.data?.message || 'Failed to load student fee summary')
      setStudentSummary(null)
    } finally {
      setLoadingSummary(false)
    }
  }

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student)
    setStudentSearch(`${student.first_name} ${student.middle_name || ''} ${student.last_name}`.trim())
    setStudents([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedStudent || !currentTerm) {
      errorToast('Please select a student')
      return
    }

    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      errorToast('Please enter a valid payment amount')
      return
    }

    if (studentSummary && paymentAmount > studentSummary.pending_amount) {
      errorToast(`Payment amount cannot exceed pending amount of ${formatCurrency(studentSummary.pending_amount)}`)
      return
    }

    setSubmitting(true)
    try {
      const paymentData: PaymentRequest = {
        amount: paymentAmount,
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        payment_method: paymentMethod || undefined,
        reference_number: referenceNumber || undefined,
      }

      await paymentsApi.recordPaymentByStudent(selectedStudent.id, currentTerm.id, paymentData)
      successToast('Payment recorded successfully')
      onPaymentSuccess?.()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to record payment'
      errorToast(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Pay Fees</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-6">
            {/* Student Selection */}
            <div>
              <label htmlFor="student" className="block text-sm font-medium text-gray-700 mb-2">
                Student <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="student"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search for student by name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoComplete="off"
                />
                {students.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {students.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleStudentSelect(student)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                      >
                        <div className="text-sm text-gray-900">
                          {student.first_name} {student.middle_name || ''} {student.last_name}
                        </div>
                        {student.current_class && (
                          <div className="text-xs text-gray-500">
                            {student.current_class.name}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {loadingStudents && (
                  <div className="absolute right-3 top-2.5">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                  </div>
                )}
              </div>
              {selectedStudent && (
                <p className="mt-1 text-sm text-gray-600">
                  Selected: <span className="font-medium">{studentSearch}</span>
                </p>
              )}
            </div>

            {/* Student Fee Details */}
            {selectedStudent && (
              <>
                {loadingSummary ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-sm text-gray-600">Loading student details...</span>
                  </div>
                ) : studentSummary ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Student Fee Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-600">Class:</span>
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {studentSummary.class || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Academic Year:</span>
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {studentSummary.academic_year || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Term:</span>
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {studentSummary.term || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Payment Rate:</span>
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {studentSummary.payment_rate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-gray-200 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Expected Fee:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(studentSummary.expected_fee)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Paid Amount:</span>
                        <span className="font-medium text-green-600">{formatCurrency(studentSummary.paid_amount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Pending Amount:</span>
                        <span className="font-medium text-amber-600">{formatCurrency(studentSummary.pending_amount)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      No fee information available for this student in the current term.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Payment Amount */}
            {selectedStudent && studentSummary && (
              <>
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0.01"
                    max={studentSummary.pending_amount}
                    step="0.01"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter payment amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: {formatCurrency(studentSummary.pending_amount)}
                  </p>
                </div>

                {/* Payment Date */}
                <div>
                  <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    id="paymentDate"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="MPESA">MPESA</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Reference Number */}
                <div>
                  <label htmlFor="referenceNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    id="referenceNumber"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Transaction reference (optional)"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedStudent || !studentSummary || !amount || parseFloat(amount) <= 0}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PayFeesModal

