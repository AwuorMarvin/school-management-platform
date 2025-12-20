import apiClient from './client'

export interface CampusFeeSummary {
  campus_id: string
  campus_name: string
  active_academic_year: string | null
  active_term: string | null
  active_classes: number
  active_students: number
  total_expected_fee: number
  total_paid_amount: number
  total_pending_amount: number
  payment_rate: number
}

export interface CampusFeeSummaryResponse {
  data: CampusFeeSummary[]
  summary: {
    total_expected: number
    total_paid: number
    total_pending: number
    payment_rate: number
  }
}

export interface ClassFeeSummaryStudent {
  student_id: string
  student_name: string
  academic_year: string | null
  term: string | null
  expected_fee: number
  paid_amount: number
  pending_amount: number
  payment_rate: number
}

export interface ClassFeeSummaryResponse {
  class_id: string
  class_name: string
  academic_year: string | null
  term: string | null
  term_id: string | null
  active_students: number
  total_expected_fee: number
  total_paid_amount: number
  total_pending_amount: number
  payment_rate: number
  students: ClassFeeSummaryStudent[]
}

export interface StudentFeeSummaryResponse {
  student_id: string
  student_name: string
  academic_year: string | null
  term: string | null
  class: string | null
  expected_fee: number
  paid_amount: number
  pending_amount: number
  payment_rate: number
}

export const feeSummaryApi = {
  getCampusSummary: async (params?: {
    term_id?: string
    campus_id?: string
  }): Promise<CampusFeeSummaryResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.term_id) queryParams.append('term_id', params.term_id)
    if (params?.campus_id) queryParams.append('campus_id', params.campus_id)

    const response = await apiClient.get<CampusFeeSummaryResponse>(
      `/fees/summary/campus?${queryParams.toString()}`
    )
    return response.data
  },

  getClassSummary: async (classId: string, params?: {
    term_id?: string
  }): Promise<ClassFeeSummaryResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.term_id) queryParams.append('term_id', params.term_id)

    const response = await apiClient.get<ClassFeeSummaryResponse>(
      `/fees/summary/class/${classId}?${queryParams.toString()}`
    )
    return response.data
  },

  getStudentSummary: async (studentId: string, params?: {
    term_id?: string
  }): Promise<StudentFeeSummaryResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.term_id) queryParams.append('term_id', params.term_id)

    const response = await apiClient.get<StudentFeeSummaryResponse>(
      `/fees/summary/student/${studentId}?${queryParams.toString()}`
    )
    return response.data
  },
}

