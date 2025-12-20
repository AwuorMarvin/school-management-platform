import apiClient from './client'

export interface User {
  id: string
  email: string
  phone_number: string
  first_name: string
  last_name: string
  role: string
  status: string
  campus_id?: string
  campus?: {
    id: string
    name: string
  }
}

export interface UserListResponse {
  data: User[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export const usersApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    role?: string
    status?: string
  }): Promise<UserListResponse> => {
    const response = await apiClient.get<UserListResponse>('/users', { params })
    return response.data
  },

  get: async (id: string): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${id}`)
    return response.data
  },
}

