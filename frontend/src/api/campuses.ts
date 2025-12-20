import apiClient from './client'

export interface Campus {
  id: string
  name: string
  address: string | null
  school_id: string
}

export interface CampusListResponse {
  data: Campus[]
}

export const campusesApi = {
  list: async (): Promise<CampusListResponse> => {
    const response = await apiClient.get<CampusListResponse>('/campuses')
    return response.data
  },
}

