import { useState, useEffect } from 'react'
import { paymentsApi, PaymentRequest } from '../api/payments'
import { useToastStore } from '../store/toastStore'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  studentId: string
  studentName: string
  termId: string
  expectedFee: number
  paidAmount: number
  pendingAmount: number
  onPaymentSuccess?: () => void
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  termId,
  expectedFee,
  paidAmount,
  pendingAmount,
  onPaymentSuccess,
}) => {
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const errorToast = useToastStore((state) => state.error)

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setAmount('')
      setPaymentDate(new Date().toISOString().split('T')[0])
      setPaymentMethod('Cash')
      setReferenceNumber('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      errorToast('Please enter a valid payment amount')
      return
    }

    if (paymentAmount > pendingAmount) {
      errorToast(`Payment amount cannot exceed pending amount of ${formatCurrency(pendingAmount)}`)
      return
    }

    setLoading(true)
    try {
      const paymentData: PaymentRequest = {
        amount: paymentAmount,
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        payment_method: paymentMethod || undefined,
        reference_number: referenceNumber || undefined,
      }

      await paymentsApi.recordPaymentByStudent(studentId, termId, paymentData)
      onPaymentSuccess?.()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to record payment'
      errorToast(errorMsg)
    } finally {
      setLoading(false)
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Record Payment</h2>
          <p className="text-sm text-gray-600 mt-1">{studentName}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            {/* Fee Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Expected Fee:</span>
                <span className="font-medium text-gray-900">{formatCurrency(expectedFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Paid Amount:</span>
                <span className="font-medium text-green-600">{formatCurrency(paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pending Amount:</span>
                <span className="font-medium text-amber-600">{formatCurrency(pendingAmount)}</span>
              </div>
            </div>

            {/* Payment Amount */}
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
                max={pendingAmount}
                step="0.01"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter payment amount"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {formatCurrency(pendingAmount)}
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
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
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
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PaymentModal

