import apiClient from './client'

export interface Teacher {
  id: string
  email: string
  phone_number: string
  first_name: string
  last_name: string
  status: string
  campus_id: string | null
  created_at: string
}

export interface TeacherCreate {
  email: string
  phone_number: string
  first_name: string
  last_name: string
  campus_id?: string
}

export interface TeacherListResponse {
  data: Teacher[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export const teachersApi = {
  create: async (data: TeacherCreate): Promise<Teacher> => {
    const response = await apiClient.post<Teacher>('/teachers', data)
    return response.data
  },
}

