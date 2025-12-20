import apiClient from './client'

export interface GlobalDiscountCampus {
  id: string
  campus_id: string
  campus?: {
    id: string
    name: string
  } | null
}

export interface GlobalDiscountClass {
  id: string
  class_id: string
  class_?: {
    id: string
    name: string
  } | null
}

export interface GlobalDiscount {
  id: string
  school_id: string
  discount_name: string
  discount_type: 'FIXED_AMOUNT' | 'PERCENTAGE'
  discount_value: string
  term_id: string
  applies_to: 'ALL_STUDENTS' | 'SELECTED_CAMPUSES' | 'SELECTED_CLASSES'
  condition_type?: string | null
  condition_value?: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
  term?: {
    id: string
    name: string
  } | null
  campus_discounts?: GlobalDiscountCampus[]
  class_discounts?: GlobalDiscountClass[]
}

export interface GlobalDiscountListResponse {
  data: GlobalDiscount[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export interface GlobalDiscountCreate {
  discount_name: string
  discount_type: 'FIXED_AMOUNT' | 'PERCENTAGE'
  discount_value: string
  term_id: string
  applies_to: 'ALL_STUDENTS' | 'SELECTED_CAMPUSES' | 'SELECTED_CLASSES'
  campus_ids?: string[]
  class_ids?: string[]
  condition_type?: string | null
  condition_value?: string | null
  is_active?: boolean
}

export interface GlobalDiscountUpdate {
  discount_name?: string
  discount_type?: 'FIXED_AMOUNT' | 'PERCENTAGE'
  discount_value?: string
  applies_to?: 'ALL_STUDENTS' | 'SELECTED_CAMPUSES' | 'SELECTED_CLASSES'
  campus_ids?: string[]
  class_ids?: string[]
  condition_type?: string | null
  condition_value?: string | null
  is_active?: boolean
}

export const globalDiscountsApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    term_id?: string
    is_active?: boolean
  }): Promise<GlobalDiscountListResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('skip', String((params.page - 1) * (params.page_size || 100)))
    if (params?.page_size) queryParams.append('limit', String(params.page_size))
    if (params?.term_id) queryParams.append('term_id', params.term_id)
    if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active))

    const response = await apiClient.get<GlobalDiscountListResponse>(
      `/global-discounts?${queryParams.toString()}`
    )
    return response.data
  },

  get: async (id: string): Promise<GlobalDiscount> => {
    const response = await apiClient.get<GlobalDiscount>(`/global-discounts/${id}`)
    return response.data
  },

  create: async (data: GlobalDiscountCreate): Promise<GlobalDiscount> => {
    const response = await apiClient.post<GlobalDiscount>('/global-discounts', data)
    return response.data
  },

  update: async (id: string, data: GlobalDiscountUpdate): Promise<GlobalDiscount> => {
    const response = await apiClient.put<GlobalDiscount>(`/global-discounts/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/global-discounts/${id}`)
  },
}

