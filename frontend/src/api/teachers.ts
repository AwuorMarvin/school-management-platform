import apiClient from './client'

export interface CampusMinimal {
  id: string
  name: string
}

export interface SubjectMinimal {
  id: string
  name: string
}

export interface ClassMinimal {
  id: string
  name: string
}

export interface TeacherAssignment {
  id: string
  class: ClassMinimal
  subjects: SubjectMinimal[]
  students_in_class: number
  start_date: string
  end_date: string | null
}

export interface TeacherAssignmentHistory {
  id: string
  class: ClassMinimal
  subjects: SubjectMinimal[]
  start_date: string
  end_date: string
  duration_days: number
}

export interface Teacher {
  id: string
  user_id: string
  salutation: string
  first_name: string
  middle_name: string | null
  last_name: string
  phone_number: string
  email: string | null
  national_id: string
  tsc_number: string | null
  date_of_birth: string
  gender: string
  campus: CampusMinimal
  status: string
  status_reason: string | null
  current_assignments: TeacherAssignment[]
  assignment_history: TeacherAssignmentHistory[]
  created_at: string
  updated_at: string | null
}

export interface TeacherListItem {
  id: string
  name: string
  phone_number: string
  campus: CampusMinimal
  status: string
  subjects_taught: number
  classes_taught: number
  total_students: number
  subject_ratio: number | null
}

export interface TeacherCreate {
  salutation: 'Mr' | 'Mrs' | 'Miss' | 'Dr' | 'Prof'
  first_name: string
  middle_name?: string
  last_name: string
  phone_number: string
  email?: string
  national_id: string
  tsc_number?: string
  date_of_birth: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  campus_id: string
}

export interface TeacherUpdate {
  salutation?: 'Mr' | 'Mrs' | 'Miss' | 'Dr' | 'Prof'
  first_name?: string
  middle_name?: string
  last_name?: string
  phone_number?: string
  email?: string
  tsc_number?: string
  date_of_birth?: string
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
}

export interface TeacherListResponse {
  data: TeacherListItem[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export interface TeacherAssignmentCreate {
  class_id: string
  subject_ids: string[]
  start_date?: string
}

export interface TeacherAssignmentBulkCreate {
  assignments: TeacherAssignmentCreate[]
  start_date?: string
}

export interface AssignmentCreateResponse {
  assignments: TeacherAssignment[]
  teacher_status: string
}

export interface AssignmentBulkCreateResponse {
  created_count: number
  assignments: TeacherAssignment[]
  teacher_status: string
}

export interface AssignmentRemoveResponse {
  id: string
  end_date: string
  teacher_status: string
}

export const teachersApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    campus_id?: string
    status?: 'ACTIVE' | 'INACTIVE'
    search?: string
  }): Promise<TeacherListResponse> => {
    const response = await apiClient.get<TeacherListResponse>('/teachers', { params })
    return response.data
  },

  get: async (id: string): Promise<Teacher> => {
    const response = await apiClient.get<Teacher>(`/teachers/${id}`)
    return response.data
  },

  create: async (data: TeacherCreate): Promise<Teacher & { setup_token?: string }> => {
    const response = await apiClient.post<Teacher & { setup_token?: string }>('/teachers', data)
    return response.data
  },

  update: async (id: string, data: TeacherUpdate): Promise<Teacher> => {
    const response = await apiClient.put<Teacher>(`/teachers/${id}`, data)
    return response.data
  },

  createAssignment: async (teacherId: string, data: TeacherAssignmentCreate): Promise<AssignmentCreateResponse> => {
    const response = await apiClient.post<AssignmentCreateResponse>(`/teachers/${teacherId}/assignments`, data)
    return response.data
  },

  createBulkAssignments: async (teacherId: string, data: TeacherAssignmentBulkCreate): Promise<AssignmentBulkCreateResponse> => {
    const response = await apiClient.post<AssignmentBulkCreateResponse>(`/teachers/${teacherId}/assignments/bulk`, data)
    return response.data
  },

  removeAssignment: async (teacherId: string, assignmentId: string): Promise<AssignmentRemoveResponse> => {
    const response = await apiClient.delete<AssignmentRemoveResponse>(`/teachers/${teacherId}/assignments/${assignmentId}`)
    return response.data
  },
}
