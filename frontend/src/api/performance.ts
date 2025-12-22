import apiClient from './client'

// Legacy per-student performance types

export interface PerformanceEntry {
  subject_id: string
  term_id: string
  grade?: string
  subject_comment?: string
}

export interface PerformanceItem {
  subject: {
    id: string
    name: string
  }
  term: {
    id: string
    name: string
  }
  grade: string | null
  subject_comment: string | null
  entered_by: {
    first_name: string
    last_name: string
  }
  entered_at: string
}

export interface PerformanceResponse {
  student: {
    id: string
    first_name: string
    last_name: string
  }
  data: PerformanceItem[]
}

export interface TermCommentEntry {
  term_id: string
  comment: string
}

export interface TermCommentResponse {
  student: {
    id: string
    first_name: string
    last_name: string
  }
  term: {
    id: string
    name: string
  }
  comment: string
  entered_by: {
    first_name: string
    last_name: string
  }
  entered_at: string
}

// New performance report + line item types

export interface PerformanceLineItem {
  id: string
  area_label: string
  numeric_score?: number | null
  descriptive_score?: string | null
  comment?: string | null
  position: number
}

export interface PerformanceReport {
  id: string
  student_id: string
  class_id: string
  subject_id: string
  academic_year_id: string
  term_id: string
  teacher_id: string
  created_by_user_id: string
  updated_by_user_id?: string | null
  created_at: string
  updated_at?: string | null
  is_deleted: boolean
  line_items: PerformanceLineItem[]
}

export interface PerformanceReportListItem {
  id: string
  student: {
    id: string
    first_name: string
    last_name: string
  }
  cls: {
    id: string
    name: string
  }
  subject: {
    id: string
    name: string
  }
  teacher: {
    id: string
    first_name: string
    last_name: string
  }
  academic_year: {
    id: string
    name: string
  }
  term: {
    id: string
    name: string
  }
  line_items_count: number
  first_numeric_score?: number | null
  first_descriptive_score?: string | null
  created_at: string
  updated_at?: string | null
}

export interface PerformanceReportListResponse {
  data: PerformanceReportListItem[]
  total: number
  page: number
  page_size: number
}

export interface PerformanceReportCreatePayload {
  student_id: string
  class_id: string
  subject_id: string
  academic_year_id: string
  term_id: string
  teacher_id?: string
  line_items: Array<{
    area_label: string
    numeric_score?: number | null
    descriptive_score?: string | null
    comment?: string | null
    position?: number
  }>
}

export interface PerformanceReportUpdatePayload {
  line_items: Array<{
    area_label: string
    numeric_score?: number | null
    descriptive_score?: string | null
    comment?: string | null
    position?: number
  }>
}

export const performanceApi = {
  // Legacy per-student endpoints
  enterPerformance: async (studentId: string, data: PerformanceEntry): Promise<any> => {
    const response = await apiClient.put(`/students/${studentId}/performance`, data)
    return response.data
  },

  getPerformance: async (
    studentId: string,
    params?: {
      term_id?: string
      subject_id?: string
    }
  ): Promise<PerformanceResponse> => {
    const response = await apiClient.get<PerformanceResponse>(`/students/${studentId}/performance`, { params })
    return response.data
  },

  enterTermComment: async (studentId: string, data: TermCommentEntry): Promise<any> => {
    const response = await apiClient.put(`/students/${studentId}/term-comment`, data)
    return response.data
  },

  getTermComment: async (studentId: string, termId: string): Promise<TermCommentResponse> => {
    const response = await apiClient.get<TermCommentResponse>(`/students/${studentId}/term-comment`, {
      params: { term_id: termId },
    })
    return response.data
  },

  // New performance report endpoints
  listReports: async (params: {
    academic_year_id?: string
    term_id?: string
    subject_id?: string
    student_id?: string
    class_id?: string
    page?: number
    page_size?: number
  }): Promise<PerformanceReportListResponse> => {
    const response = await apiClient.get<PerformanceReportListResponse>('/performance', { params })
    return response.data
  },

  createReport: async (payload: PerformanceReportCreatePayload): Promise<PerformanceReport> => {
    const response = await apiClient.post<PerformanceReport>('/performance', payload)
    return response.data
  },

  getReport: async (id: string): Promise<PerformanceReport> => {
    const response = await apiClient.get<PerformanceReport>(`/performance/${id}`)
    return response.data
  },

  updateReport: async (id: string, payload: PerformanceReportUpdatePayload): Promise<PerformanceReport> => {
    const response = await apiClient.put<PerformanceReport>(`/performance/${id}`, payload)
    return response.data
  },

  deleteReport: async (id: string): Promise<void> => {
    await apiClient.delete(`/performance/${id}`)
  },
}
