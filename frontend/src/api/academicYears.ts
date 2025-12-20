import apiClient from './client'

export interface AcademicYear {
  id: string
  school_id: string
  name: string
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
  terms?: Term[]
  term_count?: number
  is_current?: boolean
}

export interface Term {
  id: string
  name: string
  start_date: string
  end_date: string
}

export interface AcademicYearListResponse {
  data: AcademicYear[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export interface AcademicYearCreate {
  name: string
  start_date: string
  end_date: string
}

export interface AcademicYearUpdate {
  name?: string
  start_date?: string
  end_date?: string
}

export const academicYearsApi = {
  list: async (params?: {
    page?: number
    page_size?: number
  }): Promise<AcademicYearListResponse> => {
    const response = await apiClient.get<AcademicYearListResponse>('/academic-years', { params })
    return response.data
  },

  get: async (id: string): Promise<AcademicYear> => {
    const response = await apiClient.get<AcademicYear>(`/academic-years/${id}`)
    return response.data
  },

  create: async (data: AcademicYearCreate): Promise<AcademicYear> => {
    const response = await apiClient.post<AcademicYear>('/academic-years', data)
    return response.data
  },

  update: async (id: string, data: AcademicYearUpdate): Promise<AcademicYear> => {
    const response = await apiClient.put<AcademicYear>(`/academic-years/${id}`, data)
    return response.data
  },
}

