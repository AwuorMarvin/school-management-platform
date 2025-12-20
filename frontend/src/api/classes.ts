import apiClient from './client'

export interface Class {
  id: string
  campus_id: string
  academic_year_id: string
  name: string
  capacity: number | null
  created_at: string
  updated_at: string
  campus?: {
    id: string
    name: string
  }
  academic_year?: {
    id: string
    name: string
  }
  student_count?: number
}

export interface ClassListResponse {
  data: Class[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export interface ClassCreate {
  campus_id: string
  academic_year_id: string
  name: string
  capacity?: number
  subject_ids?: string[]
}

export interface ClassUpdate {
  name?: string
  capacity?: number
  subject_ids?: string[]
}

export interface AssignStudentToClass {
  student_id: string
  start_date?: string
}

export interface StudentInClass {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  status: string
  assignment: {
    id: string
    start_date: string
    end_date: string | null
  } | null
}

export interface StudentsInClassResponse {
  data: StudentInClass[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export const classesApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    campus_id?: string
    academic_year_id?: string
    search?: string
  }): Promise<ClassListResponse> => {
    const response = await apiClient.get<ClassListResponse>('/classes', { params })
    return response.data
  },

  get: async (id: string): Promise<Class> => {
    const response = await apiClient.get<Class>(`/classes/${id}`)
    return response.data
  },

  create: async (data: ClassCreate): Promise<Class> => {
    const response = await apiClient.post<Class>('/classes', data)
    return response.data
  },

  update: async (id: string, data: ClassUpdate): Promise<Class> => {
    const response = await apiClient.put<Class>(`/classes/${id}`, data)
    return response.data
  },

  assignStudent: async (classId: string, data: AssignStudentToClass): Promise<any> => {
    const response = await apiClient.post(`/classes/${classId}/students`, data)
    return response.data
  },

  listStudents: async (classId: string, params?: {
    page?: number
    page_size?: number
    status?: string
  }): Promise<StudentsInClassResponse> => {
    const response = await apiClient.get<StudentsInClassResponse>(`/classes/${classId}/students`, { params })
    return response.data
  },

  removeStudent: async (classId: string, studentId: string): Promise<void> => {
    await apiClient.delete(`/classes/${classId}/students/${studentId}`)
  },

  assignTeacher: async (classId: string, data: AssignTeacherToClass): Promise<any> => {
    const response = await apiClient.post(`/classes/${classId}/teachers`, data)
    return response.data
  },

  listTeachers: async (classId: string): Promise<TeachersInClassResponse> => {
    const response = await apiClient.get<TeachersInClassResponse>(`/classes/${classId}/teachers`)
    return response.data
  },

  removeTeacher: async (classId: string, teacherId: string, subjectId?: string): Promise<void> => {
    const params = subjectId ? { subject_id: subjectId } : {}
    await apiClient.delete(`/classes/${classId}/teachers/${teacherId}`, { params })
  },
}

export interface AssignTeacherToClass {
  teacher_id: string
  subject_id?: string
  start_date?: string
}

export interface TeacherInClass {
  id: string
  teacher: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  subject: {
    id: string
    name: string
  } | null
  start_date: string
  end_date: string | null
}

export interface TeachersInClassResponse {
  data: TeacherInClass[]
}

