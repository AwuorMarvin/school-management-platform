import apiClient from './client'

export interface Student {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  date_of_birth: string
  status: string
  campus_id: string
  created_at: string
  updated_at?: string
  parents?: ParentLink[]
  transport_route?: {
    id: string
    zone: string
    one_way_cost_per_term: string
    two_way_cost_per_term: string
  } | null
  transport_type?: 'ONE_WAY' | 'TWO_WAY' | null
  current_class?: {
    id: string
    name: string
    academic_year?: string
  } | null
  class_history?: ClassHistoryEntry[]
  fee_balance?: {
    expected_amount: string
    paid_amount: string
    pending_amount: string
  } | null
}

export interface ClassHistoryEntry {
  id: string
  class_id: string
  class_name: string
  academic_year?: string
  start_date: string
  end_date: string | null
  is_active: boolean
}

export interface ParentLink {
  id: string
  user_id: string
  role: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
}

export interface ParentInfo {
  first_name: string
  last_name: string
  phone_number: string
  email: string
  id_number: string
}

export interface StudentCreate {
  campus_id: string
  class_id: string
  academic_year_id: string
  term_id: string
  first_name: string
  middle_name?: string
  last_name: string
  date_of_birth: string
  status?: string
  father?: ParentInfo
  mother?: ParentInfo
  guardian?: ParentInfo
}

export interface StudentUpdate {
  first_name?: string
  middle_name?: string
  last_name?: string
  date_of_birth?: string
  campus_id?: string
}

export interface StudentListResponse {
  data: Student[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export const studentsApi = {
  list: async (params?: {
    skip?: number
    limit?: number
    campus_id?: string
    status?: string
    search?: string
  }): Promise<StudentListResponse> => {
    const response = await apiClient.get<StudentListResponse>('/students', { params })
    return response.data
  },

  get: async (studentId: string): Promise<Student> => {
    const response = await apiClient.get<Student>(`/students/${studentId}`)
    return response.data
  },

  create: async (data: StudentCreate): Promise<Student> => {
    const response = await apiClient.post<Student>('/students', data)
    return response.data
  },

  update: async (studentId: string, data: StudentUpdate): Promise<Student> => {
    const response = await apiClient.put<Student>(`/students/${studentId}`, data)
    return response.data
  },

  changeStatus: async (studentId: string, status: string): Promise<Student> => {
    const response = await apiClient.patch<Student>(`/students/${studentId}/status`, { status })
    return response.data
  },

  linkParent: async (studentId: string, parentId: string, role: string): Promise<void> => {
    await apiClient.post(`/students/${studentId}/parents`, { parent_id: parentId, role })
  },

  getParents: async (studentId: string): Promise<ParentLink[]> => {
    const response = await apiClient.get<ParentLink[]>(`/students/${studentId}/parents`)
    return response.data
  },
}
