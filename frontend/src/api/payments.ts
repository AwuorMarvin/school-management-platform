import apiClient from './client'

export interface PaymentRequest {
  amount: number
  payment_date?: string
  payment_method?: string
  reference_number?: string
}

export interface PaymentResponse {
  id: string
  student: {
    id: string
    first_name: string
    last_name: string
  }
  term: {
    id: string
    name: string
  }
  expected_amount: number
  paid_amount: number
  pending_amount: number
  last_payment?: {
    amount: number
    payment_date: string
    payment_method?: string
    reference_number?: string
  }
  updated_at: string
}

export const paymentsApi = {
  recordPayment: async (feeId: string, payment: PaymentRequest): Promise<PaymentResponse> => {
    const response = await apiClient.post<PaymentResponse>(
      `/fees/${feeId}/payments`,
      payment
    )
    return response.data
  },
  recordPaymentByStudent: async (studentId: string, termId: string, payment: PaymentRequest): Promise<PaymentResponse> => {
    const response = await apiClient.post<PaymentResponse>(
      `/students/${studentId}/payments`,
      {
        ...payment,
        term_id: termId,
      }
    )
    return response.data
  },
}

