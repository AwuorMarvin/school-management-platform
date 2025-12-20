import apiClient from './client'

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

export const performanceApi = {
  enterPerformance: async (studentId: string, data: PerformanceEntry): Promise<any> => {
    const response = await apiClient.put(`/students/${studentId}/performance`, data)
    return response.data
  },

  getPerformance: async (studentId: string, params?: {
    term_id?: string
    subject_id?: string
  }): Promise<PerformanceResponse> => {
    const response = await apiClient.get<PerformanceResponse>(`/students/${studentId}/performance`, { params })
    return response.data
  },

  enterTermComment: async (studentId: string, data: TermCommentEntry): Promise<any> => {
    const response = await apiClient.put(`/students/${studentId}/term-comment`, data)
    return response.data
  },

  getTermComment: async (studentId: string, termId: string): Promise<TermCommentResponse> => {
    const response = await apiClient.get<TermCommentResponse>(`/students/${studentId}/term-comment`, {
      params: { term_id: termId }
    })
    return response.data
  },
}

