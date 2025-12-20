import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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
  const [expandedActiveStructures, setExpandedActiveStructures] = useState<Set<string>>(new Set())

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

  const toggleActiveStructure = (structureId: string) => {
    setExpandedActiveStructures(prev => {
      const next = new Set(prev)
      if (next.has(structureId)) {
        next.delete(structureId)
      } else {
        next.add(structureId)
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
              onClick={() => navigate('/fee-structures/new-annual')}
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
                      {activeStructures.map((structure) => {
                        const isExpanded = expandedActiveStructures.has(structure.id)
                        return (
                          <React.Fragment key={structure.id}>
                            <tr className="hover:bg-gray-50">
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
                                  <button
                                    type="button"
                                    onClick={() => toggleActiveStructure(structure.id)}
                                    className="text-gray-600 hover:text-primary-600 flex items-center gap-1"
                                    title="View"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronDown className="w-4 h-4" />
                                        <span className="text-xs">View</span>
                                      </>
                                    ) : (
                                      <>
                                        <ChevronRight className="w-4 h-4" />
                                        <span className="text-xs">View</span>
                                      </>
                                    )}
                                  </button>
                                </td>
                              )}
                            </tr>
                            {isExpanded && structure.line_items && structure.line_items.length > 0 && (
                              <tr>
                                <td colSpan={isAdmin ? 10 : 9} className="px-6 py-4 bg-gray-50">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-white">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                            Item Name
                                          </th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                            Amount
                                          </th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                            Total
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {structure.line_items
                                          .sort((a, b) => Number(b.amount) - Number(a.amount))
                                          .map((item, idx) => {
                                            const itemTotal = item.amount
                                            return (
                                              <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  {item.item_name}
                                                  {(item.is_annual || item.is_one_off) && (
                                                    <span className="text-xs text-gray-500 italic ml-2">
                                                      ({item.is_annual && 'Annual fee'}
                                                      {item.is_annual && item.is_one_off && ' / '}
                                                      {item.is_one_off && 'One-time fee'})
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                                                  {formatCurrency(item.amount)}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                                                  {formatCurrency(itemTotal)}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                  {row.class_name}
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
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => toggleRow(row.class_id)}
                                        className="text-gray-600 hover:text-primary-600 flex items-center gap-1"
                                        title="View"
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronDown className="w-4 h-4" />
                                            <span className="text-xs">View</span>
                                          </>
                                        ) : (
                                          <>
                                            <ChevronRight className="w-4 h-4" />
                                            <span className="text-xs">View</span>
                                          </>
                                        )}
                                      </button>
                                      <Link
                                        to={`/fee-structures/${row.structure_ids[0]}/edit`}
                                        className="text-gray-600 hover:text-primary-600 flex items-center gap-1"
                                        title="Edit"
                                      >
                                        <Edit className="w-4 h-4" />
                                        <span className="text-xs">Edit</span>
                                      </Link>
                                    </div>
                                  </td>
                                )}
                              </tr>
                              {isExpanded && row.line_items && row.line_items.length > 0 && (() => {
                                // Group items by item_name to handle items that appear in multiple terms
                                const itemsByName = new Map<string, Array<typeof row.line_items[0]>>()
                                
                                row.line_items.forEach(item => {
                                  if (!itemsByName.has(item.item_name)) {
                                    itemsByName.set(item.item_name, [])
                                  }
                                  itemsByName.get(item.item_name)!.push(item)
                                })
                                
                                // Convert to array and calculate totals for sorting
                                const sortedItems = Array.from(itemsByName.entries())
                                  .map(([itemName, items]) => {
                                    const sortedItems = items.sort((a, b) => a.display_order - b.display_order)
                                    // Find item for each term/category to calculate total
                                    const term1Item = sortedItems.find(item => item.term === 'TERM_1')
                                    const term2Item = sortedItems.find(item => item.term === 'TERM_2')
                                    const term3Item = sortedItems.find(item => item.term === 'TERM_3')
                                    const annualItem = sortedItems.find(item => item.term === 'ANNUAL')
                                    const oneOffItem = sortedItems.find(item => item.term === 'ONE_OFF')
                                    
                                    const itemTotal = (term1Item?.amount || 0) +
                                                     (term2Item?.amount || 0) +
                                                     (term3Item?.amount || 0) +
                                                     (annualItem?.amount || 0) +
                                                     (oneOffItem?.amount || 0)
                                    
                                    return {
                                      itemName,
                                      items: sortedItems,
                                      itemTotal
                                    }
                                  })
                                  .sort((a, b) => b.itemTotal - a.itemTotal) // Sort by total descending (highest to lowest)
                                
                                return sortedItems.map(({ itemName, items, itemTotal }, idx) => {
                                  // Find item for each term/category
                                  const term1Item = items.find(item => item.term === 'TERM_1')
                                  const term2Item = items.find(item => item.term === 'TERM_2')
                                  const term3Item = items.find(item => item.term === 'TERM_3')
                                  const annualItem = items.find(item => item.term === 'ANNUAL')
                                  const oneOffItem = items.find(item => item.term === 'ONE_OFF')
                                  
                                  // Determine if this is an annual or one-off item
                                  const isAnnual = annualItem?.is_annual || false
                                  const isOneOff = oneOffItem?.is_one_off || false
                                  
                                  return (
                                    <tr key={idx} className="hover:bg-gray-50 bg-gray-50/50">
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {/* Empty for campus column */}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 pl-8">
                                        <div className="flex items-center gap-2">
                                          <span>{itemName}</span>
                                          {(isAnnual || isOneOff) && (
                                            <span className="text-xs text-gray-500 italic">
                                              ({isAnnual && 'Annual fee'}
                                              {isAnnual && isOneOff && ' / '}
                                              {isOneOff && 'One-time fee'})
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {term1Item ? formatCurrency(term1Item.amount) : '-'}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {term2Item ? formatCurrency(term2Item.amount) : '-'}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {term3Item ? formatCurrency(term3Item.amount) : '-'}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {oneOffItem ? formatCurrency(oneOffItem.amount) : '-'}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {annualItem ? formatCurrency(annualItem.amount) : '-'}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {formatCurrency(itemTotal)}
                                      </td>
                                      {isAdmin && (
                                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                                          {/* Actions column - empty for line items */}
                                        </td>
                                      )}
                                    </tr>
                                  )
                                })
                              })()}
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

