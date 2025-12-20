import apiClient from './client'

export interface ClubActivity {
  id: string
  school_id: string
  service_name: string
  activity_type: 'CLUB' | 'EXTRA_CURRICULAR'
  cost_per_term: string
  teacher_id: string | null
  academic_year_id: string
  term_id: string
  description: string | null
  created_at: string
  updated_at: string
  teacher?: {
    id: string
    first_name: string
    last_name: string
  } | null
  academic_year?: {
    id: string
    name: string
  } | null
  term?: {
    id: string
    name: string
  } | null
  classes?: Array<{
    id: string
    name: string
  }>
}

export interface ClubActivityListResponse {
  data: ClubActivity[]
  pagination: {
    total: number
    page: number
    page_size: number
    total_pages: number
  }
}

export interface ClubActivityCreate {
  service_name: string
  activity_type: 'CLUB' | 'EXTRA_CURRICULAR'
  cost_per_term: string
  teacher_id?: string | null
  academic_year_id: string
  term_id: string
  class_ids?: string[]
  description?: string | null
}

export interface ClubActivityUpdate {
  service_name?: string
  activity_type?: 'CLUB' | 'EXTRA_CURRICULAR'
  cost_per_term?: string
  teacher_id?: string | null
  academic_year_id?: string
  term_id?: string
  class_ids?: string[]
  description?: string | null
}

export const clubActivitiesApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    activity_type?: 'CLUB' | 'EXTRA_CURRICULAR'
    academic_year_id?: string
    term_id?: string
    search?: string
  }): Promise<ClubActivityListResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('skip', String((params.page - 1) * (params.page_size || 100)))
    if (params?.page_size) queryParams.append('limit', String(params.page_size))
    if (params?.activity_type) queryParams.append('activity_type', params.activity_type)
    if (params?.academic_year_id) queryParams.append('academic_year_id', params.academic_year_id)
    if (params?.term_id) queryParams.append('term_id', params.term_id)
    if (params?.search) queryParams.append('search', params.search)

    const response = await apiClient.get<ClubActivityListResponse>(
      `/club-activities?${queryParams.toString()}`
    )
    return response.data
  },

  get: async (id: string): Promise<ClubActivity> => {
    const response = await apiClient.get<ClubActivity>(`/club-activities/${id}`)
    return response.data
  },

  create: async (data: ClubActivityCreate): Promise<ClubActivity> => {
    const response = await apiClient.post<ClubActivity>('/club-activities', data)
    return response.data
  },

  update: async (id: string, data: ClubActivityUpdate): Promise<ClubActivity> => {
    const response = await apiClient.put<ClubActivity>(`/club-activities/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/club-activities/${id}`)
  },
}

