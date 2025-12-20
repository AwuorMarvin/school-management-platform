import apiClient from './client'

export interface TransportRoute {
  id: string
  school_id: string
  zone: string
  description: string | null
  cost_per_term: string
  one_way_cost_per_term: string
  two_way_cost_per_term: string
  created_at: string
  updated_at: string
}

export interface TransportRouteListResponse {
  data: TransportRoute[]
  pagination: {
    total: number
    page: number
    page_size: number
    total_pages: number
  }
}

export interface TransportRouteCreate {
  zone: string
  description?: string | null
  one_way_cost_per_term: string
  two_way_cost_per_term: string
}

export interface TransportRouteUpdate {
  zone?: string
  description?: string | null
  one_way_cost_per_term?: string
  two_way_cost_per_term?: string
}

export const transportRoutesApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    search?: string
  }): Promise<TransportRouteListResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('skip', String((params.page - 1) * (params.page_size || 100)))
    if (params?.page_size) queryParams.append('limit', String(params.page_size))
    if (params?.search) queryParams.append('search', params.search)

    const response = await apiClient.get<TransportRouteListResponse>(
      `/transport-routes?${queryParams.toString()}`
    )
    return response.data
  },

  get: async (id: string): Promise<TransportRoute> => {
    const response = await apiClient.get<TransportRoute>(`/transport-routes/${id}`)
    return response.data
  },

  create: async (data: TransportRouteCreate): Promise<TransportRoute> => {
    const response = await apiClient.post<TransportRoute>('/transport-routes', data)
    return response.data
  },

  update: async (id: string, data: TransportRouteUpdate): Promise<TransportRoute> => {
    const response = await apiClient.put<TransportRoute>(`/transport-routes/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/transport-routes/${id}`)
  },
}

