import apiClient from './client'

export interface FeeAdjustment {
  id: string
  school_id: string
  student_id: string
  term_id: string
  adjustment_type: 'FIXED_AMOUNT' | 'PERCENTAGE'
  adjustment_value: string
  reason: string
  created_by_user_id: string
  created_at: string
  updated_at: string | null
  student?: {
    id: string
    first_name: string
    last_name: string
  } | null
  term?: {
    id: string
    name: string
  } | null
  created_by?: {
    id: string
    first_name: string
    last_name: string
  } | null
}

export interface FeeAdjustmentListResponse {
  data: FeeAdjustment[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export interface FeeAdjustmentCreate {
  student_id: string
  term_id: string
  adjustment_type: 'FIXED_AMOUNT' | 'PERCENTAGE'
  adjustment_value: string
  reason: string
}

export interface FeeAdjustmentUpdate {
  adjustment_type?: 'FIXED_AMOUNT' | 'PERCENTAGE'
  adjustment_value?: string
  reason?: string
}

export const feeAdjustmentsApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    student_id?: string
    term_id?: string
  }): Promise<FeeAdjustmentListResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('skip', String((params.page - 1) * (params.page_size || 100)))
    if (params?.page_size) queryParams.append('limit', String(params.page_size))
    if (params?.student_id) queryParams.append('student_id', params.student_id)
    if (params?.term_id) queryParams.append('term_id', params.term_id)

    const response = await apiClient.get<FeeAdjustmentListResponse>(
      `/fee-adjustments?${queryParams.toString()}`
    )
    return response.data
  },

  get: async (id: string): Promise<FeeAdjustment> => {
    const response = await apiClient.get<FeeAdjustment>(`/fee-adjustments/${id}`)
    return response.data
  },

  create: async (data: FeeAdjustmentCreate): Promise<FeeAdjustment> => {
    const response = await apiClient.post<FeeAdjustment>('/fee-adjustments', data)
    return response.data
  },

  update: async (id: string, data: FeeAdjustmentUpdate): Promise<FeeAdjustment> => {
    const response = await apiClient.put<FeeAdjustment>(`/fee-adjustments/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/fee-adjustments/${id}`)
  },
}

