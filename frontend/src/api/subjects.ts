import apiClient from './client'

export interface Subject {
  id: string
  school_id: string
  name: string
  code: string | null
  created_at: string
  updated_at: string
  classes?: Array<{
    id: string
    name: string
  }>
}

export interface SubjectListResponse {
  data: Subject[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export interface SubjectCreate {
  name: string
  code?: string
  class_ids?: string[]
}

export interface SubjectUpdate {
  name?: string
  code?: string
  class_ids?: string[]
}

export const subjectsApi = {
  // List all subjects
  list: async (params?: {
    page?: number
    page_size?: number
    search?: string
  }): Promise<SubjectListResponse> => {
    const response = await apiClient.get<SubjectListResponse>('/subjects', { params })
    return response.data
  },

  // List subjects for a class
  listForClass: async (classId: string): Promise<{ data: Subject[] }> => {
    const response = await apiClient.get<{ data: Subject[] }>(`/classes/${classId}/subjects`)
    return response.data
  },

  get: async (id: string): Promise<Subject> => {
    const response = await apiClient.get<Subject>(`/subjects/${id}`)
    return response.data
  },

  create: async (data: SubjectCreate): Promise<Subject> => {
    const response = await apiClient.post<Subject>('/subjects', data)
    return response.data
  },

  update: async (id: string, data: SubjectUpdate): Promise<Subject> => {
    const response = await apiClient.put<Subject>(`/subjects/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/subjects/${id}`)
  },
}
