import apiClient from './client'

export interface FeeLineItem {
  id: string
  item_name: string
  amount: string
  display_order: number
  is_annual: boolean
  is_one_off: boolean
}

export interface FeeLineItemCreate {
  item_name: string
  amount: string
  display_order?: number
  is_annual?: boolean
  is_one_off?: boolean
}

export interface FeeStructure {
  id: string
  school_id: string
  structure_name: string
  campus_id: string
  academic_year_id: string
  term_id: string | null
  structure_scope: 'TERM' | 'YEAR'
  version: number
  parent_structure_id?: string | null
  status: 'ACTIVE' | 'INACTIVE'
  base_fee: string
  effective_from?: string | null
  effective_to?: string | null
  created_at: string
  updated_at: string | null
  class_ids: string[]
  classes?: Array<{
    id: string
    name: string
  }> | null
  campus?: {
    id: string
    name: string
  } | null
  academic_year?: {
    id: string
    name: string
  } | null
  term?: {
    id: string
    name: string
  } | null
  line_items: FeeLineItem[]
  // Legacy fields for backward compatibility
  class_id?: string
  class_?: {
    id: string
    name: string
  } | null
}

export interface FeeStructureListResponse {
  data: FeeStructure[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export interface FeeStructureCreate {
  structure_name: string
  class_id: string
  term_id: string
  line_items: FeeLineItemCreate[]
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface FeeStructureUpdate {
  structure_name?: string
  line_items?: FeeLineItemCreate[]
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface FeeStructureCarryForward {
  structure_name?: string
  term_id: string
  line_items?: FeeLineItemCreate[]
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface FeeStructureYearlyCreate {
  class_id: string
  academic_year_id: string
  line_items: FeeLineItemCreate[]
  status?: 'ACTIVE' | 'INACTIVE'
}

// V2 Schemas
export interface FeeStructureTermlyCreate {
  campus_id: string
  academic_year_id: string
  term_id: string
  class_ids: string[]
  line_items: FeeLineItemCreate[]
  // status is not set during creation - determined by academic year and term status
}

export interface FeeStructureAnnualCreate {
  campus_id: string
  academic_year_id: string
  class_ids: string[]
  conflict_resolution: 'MERGE' | 'OVERRIDE'
  term_1_items?: FeeLineItemCreate[]
  term_2_items?: FeeLineItemCreate[]
  term_3_items?: FeeLineItemCreate[]
  annual_items?: FeeLineItemCreate[]
  one_off_items?: FeeLineItemCreate[]
  // status is not set during creation - determined by academic year and term status
  structure_name?: string // Not in backend schema but keeping for potential future use
}

export interface FeeStructureConflictInfo {
  class_id: string
  class_name: string
  existing_term_ids: string[]
  existing_term_names: string[]
  existing_structure_ids: string[]
}

export interface FeeStructureConflictResponse {
  has_conflicts: boolean
  conflicts: FeeStructureConflictInfo[]
  message: string
}

export interface AcademicYearFeeOverviewRow {
  campus_id: string
  campus_name: string
  class_id: string
  class_name: string
  term_1_amount?: number | null
  term_2_amount?: number | null
  term_3_amount?: number | null
  one_off_amount?: number | null
  annual_amount?: number | null
  total_amount: number
  structure_ids: string[]
  line_items?: Array<{
    term: 'TERM_1' | 'TERM_2' | 'TERM_3' | 'ANNUAL' | 'ONE_OFF'
    item_name: string
    amount: number
    is_annual: boolean
    is_one_off: boolean
    display_order: number
  }> | null
}

export interface AcademicYearFeeOverviewResponse {
  academic_year_id: string
  academic_year_name: string
  rows: AcademicYearFeeOverviewRow[]
}

export const feeStructuresApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    class_id?: string
    term_id?: string
    status?: 'ACTIVE' | 'INACTIVE'
    academic_year_id?: string
    campus_id?: string
  }): Promise<FeeStructureListResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('skip', String((params.page - 1) * (params.page_size || 100)))
    if (params?.page_size) queryParams.append('limit', String(params.page_size))
    if (params?.class_id) queryParams.append('class_id', params.class_id)
    if (params?.term_id) queryParams.append('term_id', params.term_id)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.academic_year_id) queryParams.append('academic_year_id', params.academic_year_id)
    if (params?.campus_id) queryParams.append('campus_id', params.campus_id)

    const response = await apiClient.get<FeeStructureListResponse>(
      `/fee-structures?${queryParams.toString()}`
    )
    return response.data
  },

  get: async (id: string): Promise<FeeStructure> => {
    const response = await apiClient.get<FeeStructure>(`/fee-structures/${id}`)
    return response.data
  },

  create: async (data: FeeStructureCreate): Promise<FeeStructure> => {
    const response = await apiClient.post<FeeStructure>('/fee-structures', data)
    return response.data
  },

  // V2 Endpoints
  createTermly: async (data: FeeStructureTermlyCreate): Promise<FeeStructure> => {
    const response = await apiClient.post<FeeStructure>('/fee-structures/termly', data)
    return response.data
  },

  checkAnnualConflicts: async (params: {
    campus_id: string
    academic_year_id: string
    class_ids: string[]
  }): Promise<FeeStructureConflictResponse> => {
    // Build query string with class_ids as repeated parameters
    const queryParams = new URLSearchParams()
    queryParams.append('campus_id', params.campus_id)
    queryParams.append('academic_year_id', params.academic_year_id)
    params.class_ids.forEach(classId => {
      queryParams.append('class_ids', classId)
    })
    
    const response = await apiClient.post<FeeStructureConflictResponse>(
      `/fee-structures/annual/check-conflicts?${queryParams.toString()}`,
      {} // Empty body since all params are in query string
    )
    return response.data
  },

  createAnnual: async (data: FeeStructureAnnualCreate): Promise<FeeStructureListResponse> => {
    const response = await apiClient.post<FeeStructureListResponse>('/fee-structures/annual', data)
    return response.data
  },

  getAcademicYearOverview: async (academic_year_id: string): Promise<AcademicYearFeeOverviewResponse> => {
    const response = await apiClient.get<AcademicYearFeeOverviewResponse>(
      `/fee-structures/academic-year-overview?academic_year_id=${academic_year_id}`
    )
    return response.data
  },

  createYearly: async (data: FeeStructureYearlyCreate): Promise<FeeStructureListResponse> => {
    const response = await apiClient.post<FeeStructureListResponse>('/fee-structures/yearly', data)
    return response.data
  },

  update: async (id: string, data: FeeStructureUpdate): Promise<FeeStructure> => {
    const response = await apiClient.put<FeeStructure>(`/fee-structures/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/fee-structures/${id}`)
  },

  carryForward: async (id: string, data: FeeStructureCarryForward): Promise<FeeStructure> => {
    const response = await apiClient.post<FeeStructure>(`/fee-structures/${id}/carry-forward`, data)
    return response.data
  },
}

