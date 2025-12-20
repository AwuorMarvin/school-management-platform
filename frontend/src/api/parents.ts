import apiClient from './client'

export interface Parent {
  id: string
  user_id: string
  school_id: string
  email: string
  phone_number: string
  first_name: string
  last_name: string
  id_number: string
  status: string
  created_at: string
  updated_at: string
  students?: ParentStudent[]
}

export interface ParentStudent {
  student_id: string
  student_name: string
  role: string
  student_status: string
}

export interface ParentCreate {
  email: string
  phone_number: string
  first_name: string
  last_name: string
  id_number: string
  student_id: string
  role: 'FATHER' | 'MOTHER' | 'GUARDIAN'
  campus_id?: string
}

export interface ParentUpdate {
  first_name?: string
  last_name?: string
  phone_number?: string
  id_number?: string
}

export interface ParentListResponse {
  data: Parent[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export const parentsApi = {
  list: async (params?: {
    skip?: number
    limit?: number
    search?: string
  }): Promise<ParentListResponse> => {
    const response = await apiClient.get<ParentListResponse>('/parents', { params })
    return response.data
  },

  get: async (parentId: string): Promise<Parent> => {
    const response = await apiClient.get<Parent>(`/parents/${parentId}`)
    return response.data
  },

  create: async (data: ParentCreate): Promise<Parent & { setup_token?: string }> => {
    const response = await apiClient.post<Parent & { setup_token?: string }>('/parents', data)
    return response.data
  },

  update: async (parentId: string, data: ParentUpdate): Promise<Parent> => {
    const response = await apiClient.put<Parent>(`/parents/${parentId}`, data)
    return response.data
  },

  getStudents: async (parentId: string): Promise<ParentStudent[]> => {
    const response = await apiClient.get<ParentStudent[]>(`/parents/${parentId}/students`)
    return response.data
  },
}

