import apiClient from './client'

export interface LoginRequest {
  email: string
  password: string
  remember_me?: boolean
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: {
    id: string
    email: string
    phone_number: string
    first_name: string
    last_name: string
    role: string
    status: string
    school_id: string
    campus_id: string | null
  }
}

export interface UserResponse {
  id: string
  email: string
  phone_number: string
  first_name: string
  last_name: string
  role: string
  status: string
  school_id: string
  campus_id: string | null
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
    return response.data
  },

  getMe: async (): Promise<UserResponse> => {
    const response = await apiClient.get<UserResponse>('/auth/me')
    return response.data
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post('/auth/logout', { refresh_token: refreshToken })
  },

  refreshToken: async (refreshToken: string): Promise<{ access_token: string; expires_in: number }> => {
    const response = await apiClient.post<{ access_token: string; expires_in: number }>('/auth/refresh', {
      refresh_token: refreshToken,
    })
    return response.data
  },
}

