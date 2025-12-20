import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import StatusBadge from '../components/StatusBadge'
import { feeStructuresApi, FeeStructure, AcademicYearFeeOverviewResponse } from '../api/feeStructures'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { termsApi, Term } from '../api/terms'
import { campusesApi, Campus } from '../api/campuses'
import { classesApi, Class } from '../api/classes'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { 
  Plus, 
  Calendar, 
  X, 
  Eye, 
  Edit, 
  ChevronDown, 
  ChevronRight,
  Building2,
  Users,
  DollarSign,
  FileText,
  AlertCircle
} from 'lucide-react'

const FeeStructuresPage = () => {
  const { user } = useAuthStore()
  const { showToast } = useToastStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Active structures
  const [activeStructures, setActiveStructures] = useState<FeeStructure[]>([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  
  // Filter states
  const [activeStatusFilter, setActiveStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [selectedCampus, setSelectedCampus] = useState<string>('')
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedTerm, setSelectedTerm] = useState<string>('')
  
  // Filter data
  const [terms, setTerms] = useState<Term[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [currentTerm, setCurrentTerm] = useState<Term | null>(null)
  
  // Academic year overview
  const [overviewData, setOverviewData] = useState<AcademicYearFeeOverviewResponse | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedAcademicYear) {
      // Reset filters when academic year changes (except campus and status filter)
      setSelectedTerm('')
      setSelectedClass('')
      loadFilterData()
      loadOverview()
    }
  }, [selectedAcademicYear])
  
  useEffect(() => {
    if (selectedAcademicYear && terms.length > 0 && classes.length > 0) {
      loadActiveStructures()
    }
  }, [activeStatusFilter, selectedCampus, selectedClass, selectedTerm, selectedAcademicYear, terms.length, classes.length])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [yearsResponse, campusesResponse] = await Promise.all([
        academicYearsApi.list({ page: 1, page_size: 100 }),
        campusesApi.list(),
      ])
      
      // Sort academic years: current first, then by start_date descending, then alphabetically
      const today = new Date()
      const sortedYears = [...yearsResponse.data].sort((a, b) => {
        const aStart = new Date(a.start_date)
        const aEnd = new Date(a.end_date)
        const bStart = new Date(b.start_date)
        const bEnd = new Date(b.end_date)
        
        const aIsCurrent = today >= aStart && today <= aEnd
        const bIsCurrent = today >= bStart && today <= bEnd
        
        // Current year first
        if (aIsCurrent && !bIsCurrent) return -1
        if (!aIsCurrent && bIsCurrent) return 1
        
        // Then by start_date descending (most recent first)
        const dateDiff = bStart.getTime() - aStart.getTime()
        if (dateDiff !== 0) return dateDiff
        
        // Finally alphabetically
        return a.name.localeCompare(b.name)
      })
      setAcademicYears(sortedYears)
      
      // Sort campuses alphabetically
      const sortedCampuses = [...campusesResponse.data].sort((a, b) => 
        a.name.localeCompare(b.name)
      )
      setCampuses(sortedCampuses)
      
      // Set default academic year (current year, or most recent by start_date, or first alphabetically)
      if (sortedYears.length > 0) {
        setSelectedAcademicYear(sortedYears[0])
      }
      
      // Set default campus (first alphabetically, or single campus)
      if (sortedCampuses.length > 0) {
        setSelectedCampus(sortedCampuses[0].id)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data')
      showToast('Failed to load academic years', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadFilterData = async () => {
    if (!selectedAcademicYear) return
    
    try {
      // Load terms for the selected academic year
      const termsResponse = await termsApi.list({
        academic_year_id: selectedAcademicYear.id,
        page: 1,
        page_size: 100,
      })
      
      // Sort terms by start_date
      const sortedTerms = [...termsResponse.data].sort((a, b) => {
        const dateA = new Date(a.start_date).getTime()
        const dateB = new Date(b.start_date).getTime()
        return dateA - dateB
      })
      setTerms(sortedTerms)
      
      // Find current/active term
      const today = new Date()
      const activeTerm = sortedTerms.find((term) => {
        const start = new Date(term.start_date)
        const end = new Date(term.end_date)
        return today >= start && today <= end
      })
      setCurrentTerm(activeTerm || null)
      
      // Set default term (active term if exists, otherwise first by start_date)
      if (!selectedTerm && sortedTerms.length > 0) {
        setSelectedTerm(activeTerm?.id || sortedTerms[0].id)
      }
      
      // Load classes for the selected academic year (max 100 per API limit)
      const classesResponse = await classesApi.list({
        academic_year_id: selectedAcademicYear.id,
        page: 1,
        page_size: 100,
      })
      
      // Sort classes alphabetically
      const sortedClasses = [...classesResponse.data].sort((a, b) => 
        a.name.localeCompare(b.name)
      )
      setClasses(sortedClasses)
      
      // Set default class (first alphabetically, or single class)
      // Filter by selected campus if one is selected
      const campusFilteredClasses = selectedCampus
        ? sortedClasses.filter(cls => cls.campus_id === selectedCampus)
        : sortedClasses
      
      // If no class is selected, or selected class is not in filtered list, set default
      if (campusFilteredClasses.length > 0 && (!selectedClass || !campusFilteredClasses.find(c => c.id === selectedClass))) {
        setSelectedClass(campusFilteredClasses[0].id)
      }
    } catch (err: any) {
      console.error('Failed to load filter data:', err)
      // Set empty arrays on error to prevent stuck state
      setTerms([])
      setClasses([])
      // Show error toast if classes fail to load
      if (err.response?.status === 400) {
        showToast('Failed to load classes: ' + (err.response?.data?.detail?.message || 'Invalid request'), 'error')
      }
    }
  }

  const loadActiveStructures = async () => {
    if (!selectedAcademicYear) return
    
    try {
      // Build API params
      const params: {
        academic_year_id: string
        status?: 'ACTIVE' | 'INACTIVE'
        class_id?: string
        term_id?: string
        campus_id?: string
        page: number
        page_size: number
      } = {
        academic_year_id: selectedAcademicYear.id,
        page: 1,
        page_size: 100,  // Max allowed by API
      }
      
      // Apply status filter - use backend status parameter directly
      if (activeStatusFilter === 'active') {
        params.status = 'ACTIVE'
      } else if (activeStatusFilter === 'inactive') {
        params.status = 'INACTIVE'
      }
      // For 'all', don't include status parameter - this will return all statuses
      
      // Apply term filter (if manually selected)
      if (selectedTerm) {
        params.term_id = selectedTerm
      }
      
      // Apply class filter
      if (selectedClass) {
        params.class_id = selectedClass
      }
      
      // Apply campus filter
      if (selectedCampus) {
        params.campus_id = selectedCampus
      }
      
      const response = await feeStructuresApi.list(params)
      setActiveStructures(response.data)
    } catch (err: any) {
      console.error('Failed to load active structures:', err)
    }
  }

  const loadOverview = async () => {
    if (!selectedAcademicYear) return
    
    try {
      setOverviewLoading(true)
      const response = await feeStructuresApi.getAcademicYearOverview(selectedAcademicYear.id)
      setOverviewData(response)
    } catch (err: any) {
      console.error('Failed to load overview:', err)
      // Fallback: overview endpoint might not exist yet, that's okay
    } finally {
      setOverviewLoading(false)
    }
  }

  const formatCurrency = (amount: number | string | null | undefined) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0)
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  const toggleRow = (classId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(classId)) {
        next.delete(classId)
      } else {
        next.add(classId)
      }
      return next
    })
  }

  const getClassNames = (structure: FeeStructure): string => {
    if (structure.classes && structure.classes.length > 0) {
      return structure.classes.map(c => c.name).join(', ')
    }
    if (structure.class_?.name) {
      return structure.class_.name
    }
    return 'N/A'
  }

  return (
    <AppLayout>
      <PageHeader
        title="Fee Structures"
        subtitle={selectedAcademicYear ? `Academic Year: ${selectedAcademicYear.name}` : undefined}
        action={
          isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Fee Structure
            </button>
          )
        }
      />

      <div className="p-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Create Mode Choice Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Choose Fee Structure Type</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Create a termly structure for a single term or an annual structure that applies
                  across all terms in the academic year.
                </p>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      window.location.href = '/fee-structures/new-termly'
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="font-semibold text-gray-900">Termly Fee Structure</span>
                    </div>
                    <span className="block text-xs text-gray-500 ml-6">
                      Define a fee structure for a specific term.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      window.location.href = '/fee-structures/new-annual'
                    }}
                    className="w-full px-4 py-3 border-2 border-primary-600 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 hover:border-primary-700 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="font-semibold text-primary-800">
                        Annual Fee Structure
                      </span>
                    </div>
                    <span className="block text-xs text-primary-700 ml-6">
                      Define a yearly fee structure for all terms in an academic year.
                    </span>
                  </button>
                </div>
              </div>
              <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {academicYears.length > 0 && (
          <ContentCard className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Academic Year Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Academic Year
                </label>
                <select
                  value={selectedAcademicYear?.id || ''}
                  onChange={(e) => {
                    const year = academicYears.find(y => y.id === e.target.value)
                    setSelectedAcademicYear(year || null)
                    // Reset other filters when academic year changes
                    setSelectedTerm('')
                    setSelectedClass('')
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active/Inactive Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Status</label>
                <select
                  value={activeStatusFilter}
                  onChange={(e) => {
                    setActiveStatusFilter(e.target.value as 'active' | 'inactive' | 'all')
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All</option>
                </select>
              </div>

              {/* Campus Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  Campus
                </label>
                <select
                  value={selectedCampus}
                  onChange={(e) => {
                    setSelectedCampus(e.target.value)
                    // Reset class filter when campus changes so it can be re-set to default
                    setSelectedClass('')
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Campuses</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Classes</option>
                  {classes
                    .filter(cls => !selectedCampus || cls.campus_id === selectedCampus)
                    .map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Term Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Term
                </label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Terms</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>
                      {term.name} {term.is_current ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ContentCard>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading fee structures...</p>
          </div>
        ) : (
          <>
            {/* SECTION A: Active Fee Structures */}
            <ContentCard 
              title="Active Fee Structures"
              subtitle={`${activeStructures.length} structure(s) found`}
            >
              {activeStructures.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No active fee structures found</p>
                  <p className="text-sm text-gray-500">for this academic year.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Campus
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Class(es)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Academic Year
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Term
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Version
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Scope
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Expected
                        </th>
                        {isAdmin && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activeStructures.map((structure) => (
                        <tr key={structure.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {structure.structure_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {structure.campus?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {getClassNames(structure)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {structure.academic_year?.name || selectedAcademicYear?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {structure.term?.name || (structure.structure_scope === 'YEAR' ? 'All Terms' : 'N/A')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            v{structure.version || 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {structure.structure_scope || 'TERM'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge 
                              status={structure.status} 
                              variant={structure.status === 'ACTIVE' ? 'success' : 'default'}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {formatCurrency(structure.base_fee)}
                          </td>
                          {isAdmin && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`/fee-structures/${structure.id}/edit`}
                                  className="text-gray-600 hover:text-primary-600 flex items-center gap-1"
                                  title="View / Edit"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ContentCard>

            {/* SECTION B: Academic Year Fee Overview (Matrix) */}
            {selectedAcademicYear && (
              <ContentCard 
                title="Academic Year Fee Overview"
                subtitle="Fee breakdown by class and term"
              >
                {overviewLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="text-gray-600 mt-4">Loading overview...</p>
                  </div>
                ) : overviewData ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Campus
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fee Name / Class(es)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Term 1
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Term 2
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Term 3
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            One-Off
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Annual
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          {isAdmin && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {overviewData.rows.map((row) => {
                          const isExpanded = expandedRows.has(row.class_id)
                          return (
                            <React.Fragment key={`${row.campus_id}-${row.class_id}`}>
                              <tr className="hover:bg-muted/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                  {row.campus_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <button
                                    type="button"
                                    onClick={() => toggleRow(row.class_id)}
                                    className="flex items-center gap-2 font-medium hover:text-primary-600 transition-colors"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                    {row.class_name}
                                  </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  {formatCurrency(row.term_1_amount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  {formatCurrency(row.term_2_amount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  {formatCurrency(row.term_3_amount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  {formatCurrency(row.one_off_amount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  {formatCurrency(row.annual_amount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary-600">
                                  {formatCurrency(row.total_amount)}
                                </td>
                                {isAdmin && (
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <Link
                                      to={`/fee-structures/${row.structure_ids[0]}/edit`}
                                      className="text-gray-600 hover:text-primary-600 flex items-center gap-1"
                                      title="View / Edit"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Link>
                                  </td>
                                )}
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={isAdmin ? 9 : 8} className="px-6 py-4 bg-gray-50">
                                    {!row.line_items || row.line_items.length === 0 ? (
                                      <p className="text-sm text-gray-600">
                                        No line item details available for this class.
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                          <thead className="bg-white">
                                            <tr>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                Category
                                              </th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                Item Name
                                              </th>
                                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                Amount
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-gray-200">
                                            {row.line_items
                                              .sort((a, b) => {
                                                // Sort by term order, then display_order
                                                const termOrder = { TERM_1: 1, TERM_2: 2, TERM_3: 3, ANNUAL: 4, ONE_OFF: 5 }
                                                const termDiff = (termOrder[a.term] || 99) - (termOrder[b.term] || 99)
                                                if (termDiff !== 0) return termDiff
                                                return a.display_order - b.display_order
                                              })
                                              .map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                  <td className="px-4 py-2 whitespace-nowrap">
                                                    <span className="text-xs font-medium text-gray-700">
                                                      {item.term === 'TERM_1' && 'Term 1'}
                                                      {item.term === 'TERM_2' && 'Term 2'}
                                                      {item.term === 'TERM_3' && 'Term 3'}
                                                      {item.term === 'ANNUAL' && 'Annual'}
                                                      {item.term === 'ONE_OFF' && 'One-Off'}
                                                    </span>
                                                  </td>
                                                  <td className="px-4 py-2">
                                                    <div className="text-sm text-gray-900">{item.item_name}</div>
                                                    {(item.is_annual || item.is_one_off) && (
                                                      <div className="text-xs text-gray-500 mt-1">
                                                        {item.is_annual && 'Annual fee'}
                                                        {item.is_one_off && 'One-time fee'}
                                                      </div>
                                                    )}
                                                  </td>
                                                  <td className="px-4 py-2 whitespace-nowrap text-right">
                                                    <span className="text-sm font-semibold text-gray-900">
                                                      {formatCurrency(item.amount)}
                                                    </span>
                                                  </td>
                                                </tr>
                                              ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">Overview data not available</p>
                    <p className="text-sm text-gray-500">Fee structures may need to be created first.</p>
                  </div>
                )}
              </ContentCard>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default FeeStructuresPage

