import apiClient from './client'

export interface Term {
  id: string
  academic_year_id: string
  name: string
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
  academic_year?: {
    id: string
    name: string
  }
  is_current?: boolean
}

export interface TermListResponse {
  data: Term[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export interface TermCreate {
  name: string
  start_date: string
  end_date: string
}

export interface TermUpdate {
  name?: string
  start_date?: string
  end_date?: string
}

export const termsApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    academic_year_id?: string
  }): Promise<TermListResponse> => {
    const response = await apiClient.get<TermListResponse>('/terms', { params })
    return response.data
  },

  get: async (id: string): Promise<Term> => {
    const response = await apiClient.get<Term>(`/terms/${id}`)
    return response.data
  },

  create: async (academicYearId: string, data: TermCreate): Promise<Term> => {
    const response = await apiClient.post<Term>(`/academic-years/${academicYearId}/terms`, data)
    return response.data
  },

  update: async (id: string, data: TermUpdate): Promise<Term> => {
    const response = await apiClient.put<Term>(`/terms/${id}`, data)
    return response.data
  },
}

