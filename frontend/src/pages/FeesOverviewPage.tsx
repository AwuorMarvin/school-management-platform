import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import { feeSummaryApi, CampusFeeSummary } from '../api/feeSummary'
import { feeStructuresApi, FeeStructure } from '../api/feeStructures'
import { useAuthStore } from '../store/authStore'
import { termsApi, Term } from '../api/terms'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { classesApi } from '../api/classes'

const FeesOverviewPage = () => {
  const { user } = useAuthStore()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [campusSummary, setCampusSummary] = useState<CampusFeeSummary[]>([])
  const [overallSummary, setOverallSummary] = useState({
    total_expected: 0,
    total_paid: 0,
    total_pending: 0,
    payment_rate: 0,
  })
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [activeTerm, setActiveTerm] = useState<Term | null>(null)
  const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYear | null>(null)
  const [yearTerms, setYearTerms] = useState<Term[]>([])

  type FeeStructureMatrixRow = {
    classId: string
    campusName: string
    className: string
    termAmounts: Record<string, number>
    annualAmount: number
    totalAmount: number
    lineItems: {
      termId: string
      itemName: string
      amount: number
      isAnnual: boolean
    }[]
  }

  const [feeStructureMatrix, setFeeStructureMatrix] = useState<FeeStructureMatrixRow[]>([])
  const [feeStructureMatrixLoading, setFeeStructureMatrixLoading] = useState(false)
  const [feeStructureMatrixError, setFeeStructureMatrixError] = useState('')
  const [expandedMatrixClasses, setExpandedMatrixClasses] = useState<Set<string>>(new Set())
  const [showCreateModeChoice, setShowCreateModeChoice] = useState(false)
  const [expandedCampuses, setExpandedCampuses] = useState<Set<string>>(new Set())
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'
  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    loadActiveTermAndYear()
  }, [])

  useEffect(() => {
    if (activeTerm) {
      loadData()
    }
  }, [activeTerm])

  const loadActiveTermAndYear = async () => {
    setLoading(true)
    setError('')
    try {
      // Get all academic years and find the current one
      const yearsResponse = await academicYearsApi.list()
      const today = new Date()

      const currentYear = yearsResponse.data.find((year) => {
        const start = new Date(year.start_date)
        const end = new Date(year.end_date)
        return today >= start && today <= end
      })

      if (!currentYear) {
        setActiveAcademicYear(null)
        setActiveTerm(null)
        setError('No active academic year found. Please configure the current academic year and terms.')
        return
      }

      setActiveAcademicYear(currentYear)

      // Get terms for this academic year and sort by start_date
      const termsResponse = await termsApi.list({ academic_year_id: currentYear.id })
      const sortedYearTerms = [...termsResponse.data].sort((a, b) => {
        const dateA = new Date(a.start_date).getTime()
        const dateB = new Date(b.start_date).getTime()
        return dateA - dateB
      })
      setYearTerms(sortedYearTerms)

      const currentTerm = termsResponse.data.find((term) => {
        const start = new Date(term.start_date)
        const end = new Date(term.end_date)
        return today >= start && today <= end
      })

      if (!currentTerm) {
        setActiveTerm(null)
        setError('No active term found for the current academic year.')
        return
      }

      setActiveTerm(currentTerm)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load academic year and term')
    } finally {
      // If we have an active term, load fee data; otherwise stop loading spinner
      if (!activeTerm) {
        setLoading(false)
      }
    }
  }

  const loadData = async () => {
    if (!activeTerm) return

    try {
      setLoading(true)
      setError('')

      // Load campus summary and fee structures
      const campusResponse = await feeSummaryApi.getCampusSummary({
        term_id: activeTerm.id,
        campus_id: user?.role === 'CAMPUS_ADMIN' ? user.campus_id || undefined : undefined,
      })
      setCampusSummary(campusResponse.data)
      setOverallSummary(campusResponse.summary)

      // Load fee structures (only for admins) for the active term (used by existing summary card)
      if (isAdmin) {
        const structuresResponse = await feeStructuresApi.list({
          term_id: activeTerm.id,
        })
        setFeeStructures(structuresResponse.data)

        // Additionally load fee structure matrix for the whole academic year
        if (activeAcademicYear && yearTerms.length > 0) {
          await loadFeeStructureMatrix(activeAcademicYear, yearTerms)
        } else {
          setFeeStructureMatrix([])
        }
      } else {
        setFeeStructureMatrix([])
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load fee data')
    } finally {
      setLoading(false)
    }
  }

  const loadFeeStructureMatrix = async (academicYear: AcademicYear, termsInYear: Term[]) => {
    if (!isAdmin) return

    setFeeStructureMatrixLoading(true)
    setFeeStructureMatrixError('')

    try {
      // Load all classes for this academic year (backend enforces tenant + role filters)
      const classesResponse = await classesApi.list({
        academic_year_id: academicYear.id,
        page: 1,
        page_size: 100,
      })
      const classes = classesResponse.data

      if (classes.length === 0 || termsInYear.length === 0) {
        setFeeStructureMatrix([])
        return
      }

      const classMap = new Map<
        string,
        { campusName: string; className: string }
      >()
      classes.forEach((cls: any) => {
        classMap.set(cls.id, {
          campusName: cls.campus?.name || 'N/A',
          className: cls.name,
        })
      })

      const rowsByClass = new Map<string, FeeStructureMatrixRow>()

      // Sort terms by start_date to identify the first term (for annual items)
      const sortedTerms = [...termsInYear].sort((a, b) => {
        const dateA = new Date(a.start_date).getTime()
        const dateB = new Date(b.start_date).getTime()
        return dateA - dateB
      })
      const firstTermId = sortedTerms.length > 0 ? sortedTerms[0].id : null

      // Track annual items already counted per class to avoid double-counting
      const annualItemsCounted = new Map<string, Set<string>>()
      // Track which structures we've already processed per class+term (use most recent only)
      const processedStructures = new Map<string, FeeStructure>()

      // Load fee structures per term sequentially to be more fault-tolerant
      for (const term of sortedTerms) {
        let termStructures: FeeStructure[] = []
        try {
          const res = await feeStructuresApi.list({
            term_id: term.id,
            page: 1,
            page_size: 1000,
          })
          // Get all structures (status is no longer used for filtering - most recent is used)
          // Structures are returned ordered by created_at desc, so first is most recent
          termStructures = res.data
        } catch (err) {
          console.error('Failed to list fee structures for term', term.id, err)
          continue
        }

        for (const s of termStructures) {
          // Only process the most recent structure per class+term
          const structureKey = `${s.class_id}::${term.id}`
          if (processedStructures.has(structureKey)) {
            continue // Skip older structures for this class+term
          }
          let structure: FeeStructure | null = null
          try {
            const full = await feeStructuresApi.get(s.id)
            structure = full
          } catch (err) {
            console.error('Failed to load fee structure details', s.id, err)
            continue
          }

          const classId = structure.class_id
          const classMeta = classMap.get(classId)
          if (!classMeta) {
            continue
          }

          let row = rowsByClass.get(classId)
          if (!row) {
            row = {
              classId,
              campusName: classMeta.campusName,
              className: classMeta.className,
              termAmounts: {},
              annualAmount: 0,
              totalAmount: 0,
              lineItems: [],
            }
            rowsByClass.set(classId, row)
            annualItemsCounted.set(classId, new Set())
          }

          // Mark this structure as processed for this class+term
          processedStructures.set(structureKey, structure)

          const termId = term.id
          const isFirstTerm = termId === firstTermId
          const countedAnnualItems = annualItemsCounted.get(classId)!

          structure.line_items.forEach((item: any) => {
            const amountNum =
              typeof item.amount === 'string' ? parseFloat(item.amount) : Number(item.amount)
            if (!Number.isFinite(amountNum)) {
              return
            }

            const isAnnual = item.is_annual === true

            if (isAnnual) {
              // Only count annual items once, in the first term
              const itemKey = `${item.item_name}::${amountNum}`
              if (isFirstTerm && !countedAnnualItems.has(itemKey)) {
                row!.annualAmount += amountNum
                countedAnnualItems.add(itemKey)
              }
              // Still add to lineItems for display, but only show in first term column
              if (isFirstTerm) {
                row!.lineItems.push({
                  termId,
                  itemName: item.item_name,
                  amount: amountNum,
                  isAnnual,
                })
              }
            } else {
              row!.termAmounts[termId] = (row!.termAmounts[termId] || 0) + amountNum
              row!.lineItems.push({
                termId,
                itemName: item.item_name,
                amount: amountNum,
                isAnnual,
              })
            }
          })
        }
      }

      // Finalise totals
      const rows: FeeStructureMatrixRow[] = Array.from(rowsByClass.values()).map((row) => {
        const totalTermly = termsInYear.reduce((sum, term) => {
          return sum + (row.termAmounts[term.id] || 0)
        }, 0)
        return {
          ...row,
          totalAmount: totalTermly + row.annualAmount,
        }
      })

      // Sort by campus then class name
      rows.sort((a, b) => {
        if (a.campusName === b.campusName) {
          return a.className.localeCompare(b.className)
        }
        return a.campusName.localeCompare(b.campusName)
      })

      setFeeStructureMatrix(rows)
    } catch (err: any) {
      console.error('Failed to load fee structure matrix:', err)
      setFeeStructureMatrix([])
      setFeeStructureMatrixError('Failed to load fee structure overview.')
    } finally {
      setFeeStructureMatrixLoading(false)
    }
  }

  const toggleCampus = (campusId: string) => {
    setExpandedCampuses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(campusId)) {
        newSet.delete(campusId)
      } else {
        newSet.add(campusId)
      }
      return newSet
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const subtitle = activeAcademicYear && activeTerm
    ? `${activeAcademicYear.name} – ${activeTerm.name}`
    : 'Loading...'

  const isStructuresRoute = location.pathname.startsWith('/fee-structures')
  const headerTitle = isStructuresRoute ? 'Fee Structures' : 'Fee Status'

  const toggleMatrixClass = (classId: string) => {
    setExpandedMatrixClasses(prev => {
      const next = new Set(prev)
      if (next.has(classId)) {
        next.delete(classId)
      } else {
        next.add(classId)
      }
      return next
    })
  }

  return (
    <AppLayout>
      <PageHeader
        title={headerTitle}
        subtitle={subtitle}
        action={
          isAdmin && isStructuresRoute && (
            <button
              type="button"
              onClick={() => setShowCreateModeChoice(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Create New Fee Structure
            </button>
          )
        }
      />

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Create mode choice modal for structures */}
        {showCreateModeChoice && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Choose Fee Structure Type</h2>
                <button
                  type="button"
                  onClick={() => setShowCreateModeChoice(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Create a termly structure for a single term or a yearly structure that applies
                  across all terms in the academic year.
                </p>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModeChoice(false)
                      window.location.href = '/fee-structures/new'
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <span className="block font-semibold text-gray-900">Termly Fee Structure</span>
                    <span className="block text-xs text-gray-500">
                      Define a fee structure for a specific term.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModeChoice(false)
                      window.location.href = '/fee-structures/new-yearly'
                    }}
                    className="w-full px-4 py-2.5 border border-primary-600 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 text-left"
                  >
                    <span className="block font-semibold text-primary-800">
                      Yearly Fee Structure
                    </span>
                    <span className="block text-xs text-primary-700">
                      Define a yearly fee for a class across all terms in an academic year.
                    </span>
                  </button>
                </div>
              </div>
              <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModeChoice(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading fee data...</p>
          </div>
        ) : (
          <>
            {/* Fee Structures Summary - Only for School Admin (active term), on structures route */}
            {isStructuresRoute && isSchoolAdmin && feeStructures.length > 0 && (
              <ContentCard title="Fee Structures" className="mb-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fee Structure Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Class
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Term
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Expected Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {feeStructures.map((structure) => (
                        <tr key={structure.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {structure.structure_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {structure.class_?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {structure.term?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                structure.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {structure.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {formatCurrency(parseFloat(structure.base_fee))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/fee-structures/${structure.id}/edit`}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                View / Edit
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ContentCard>
            )}

            {/* Campus-Level Fee Status Summary - only on status route */}
            {!isStructuresRoute && (
            <ContentCard title="Campus Fee Summary" className="mb-6">
              {campusSummary.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No fee data available</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Campus Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Active Academic Year
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Active Term
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            # Active Classes
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            # Active Students
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Expected Fee
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Paid Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Pending Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Payment Rate
                          </th>
                          {isSchoolAdmin && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {campusSummary.map((campus) => (
                          <>
                            <tr key={campus.campus_id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => toggleCampus(campus.campus_id)}
                                  className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-primary-600"
                                >
                                  <span>{expandedCampuses.has(campus.campus_id) ? '▼' : '▶'}</span>
                                  {campus.campus_name}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {campus.active_academic_year || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {campus.active_term || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {campus.active_classes}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {campus.active_students}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                {formatCurrency(campus.total_expected_fee)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                {formatCurrency(campus.total_paid_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                {formatCurrency(campus.total_pending_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`text-sm font-semibold ${
                                    campus.payment_rate >= 80
                                      ? 'text-green-600'
                                      : campus.payment_rate >= 50
                                      ? 'text-yellow-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {formatPercentage(campus.payment_rate)}
                                </span>
                              </td>
                              {isSchoolAdmin && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <Link
                                to="/fee-status"
                                className="text-primary-600 hover:text-primary-900"
                              >
                                View Details
                              </Link>
                                </td>
                              )}
                            </tr>
                            {expandedCampuses.has(campus.campus_id) && (
                              <tr>
                                <td colSpan={isSchoolAdmin ? 10 : 9} className="px-6 py-4 bg-gray-50">
                                  <CampusClassBreakdown campusId={campus.campus_id} termId={activeTerm?.id || ''} />
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Overall Summary */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Total Expected</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(overallSummary.total_expected)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Paid</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(overallSummary.total_paid)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Pending</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(overallSummary.total_pending)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Overall Payment Rate</p>
                        <p
                          className={`text-lg font-semibold ${
                            overallSummary.payment_rate >= 80
                              ? 'text-green-600'
                              : overallSummary.payment_rate >= 50
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatPercentage(overallSummary.payment_rate)}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </ContentCard>
            )}

            {/* Fee Structure Matrix - per academic year, only on structures route */}
            {isStructuresRoute && isAdmin && (
              <ContentCard title="Fee Structure (Academic Year Overview)" className="mb-6">
                {feeStructureMatrixError && (
                  <p className="mb-4 text-sm text-red-600">{feeStructureMatrixError}</p>
                )}
                {feeStructureMatrixLoading ? (
                  <p className="text-sm text-gray-600">Loading fee structures...</p>
                ) : yearTerms.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    No terms configured for the current academic year.
                  </p>
                ) : feeStructureMatrix.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    No active fee structures configured for the current academic year.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Campus
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Class
                          </th>
                          {yearTerms.map((term) => (
                            <th
                              key={term.id}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {term.name}
                            </th>
                          ))}
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            One-off / Annual
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {feeStructureMatrix.map((row) => {
                          const isExpanded = expandedMatrixClasses.has(row.classId)

                          // Build per-line-item breakdown for expanded view
                          const lineItemMap: Record<
                            string,
                            {
                              itemName: string
                              isAnnual: boolean
                              termAmounts: Record<string, number>
                              annualAmount: number
                            }
                          > = {}

                          if (isExpanded) {
                            row.lineItems.forEach((li) => {
                              const key = `${li.itemName}::${li.isAnnual ? 'annual' : 'termly'}`
                              if (!lineItemMap[key]) {
                                lineItemMap[key] = {
                                  itemName: li.itemName,
                                  isAnnual: li.isAnnual,
                                  termAmounts: {},
                                  annualAmount: 0,
                                }
                              }
                              const entry = lineItemMap[key]
                              if (li.isAnnual) {
                                entry.annualAmount += li.amount
                              } else {
                                entry.termAmounts[li.termId] =
                                  (entry.termAmounts[li.termId] || 0) + li.amount
                              }
                            })
                          }

                          return (
                            <>
                              <tr key={row.classId} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {row.campusName}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <button
                                    type="button"
                                    onClick={() => toggleMatrixClass(row.classId)}
                                    className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-primary-600"
                                  >
                                    <span>{isExpanded ? '▼' : '▶'}</span>
                                    {row.className}
                                  </button>
                                </td>
                                {yearTerms.map((term) => (
                                  <td
                                    key={term.id}
                                    className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900"
                                  >
                                    {formatCurrency(row.termAmounts[term.id] || 0)}
                                  </td>
                                ))}
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  {formatCurrency(row.annualAmount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600">
                                  {formatCurrency(row.totalAmount)}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td
                                    colSpan={2 + yearTerms.length + 2}
                                    className="px-6 py-4 bg-gray-50"
                                  >
                                    {Object.keys(lineItemMap).length === 0 ? (
                                      <p className="text-sm text-gray-600">
                                        No line item details available for this class.
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                          <thead className="bg-white">
                                            <tr>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                Item
                                              </th>
                                              {yearTerms.map((term) => (
                                                <th
                                                  key={term.id}
                                                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                                >
                                                  {term.name}
                                                </th>
                                              ))}
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                One-off / Annual
                                              </th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                Total
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-gray-200">
                                            {Object.values(lineItemMap).map((entry) => {
                                              const totalTermly = yearTerms.reduce((sum, term) => {
                                                return sum + (entry.termAmounts[term.id] || 0)
                                              }, 0)
                                              const total = totalTermly + entry.annualAmount

                                              return (
                                                <tr key={`${entry.itemName}-${entry.isAnnual}`}>
                                                  <td className="px-4 py-2 text-sm text-gray-900">
                                                    {entry.itemName}{' '}
                                                    {entry.isAnnual && (
                                                      <span className="text-xs text-gray-500">
                                                        (Annual)
                                                      </span>
                                                    )}
                                                  </td>
                                                  {yearTerms.map((term) => (
                                                    <td
                                                      key={term.id}
                                                      className="px-4 py-2 text-sm text-gray-900"
                                                    >
                                                      {formatCurrency(
                                                        entry.termAmounts[term.id] || 0
                                                      )}
                                                    </td>
                                                  ))}
                                                  <td className="px-4 py-2 text-sm text-gray-900">
                                                    {formatCurrency(entry.annualAmount)}
                                                  </td>
                                                  <td className="px-4 py-2 text-sm font-semibold text-primary-600">
                                                    {formatCurrency(total)}
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </>
                          )
                        })}
                      </tbody>
                    </table>
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

// Campus Class Breakdown Component
const CampusClassBreakdown = ({ campusId, termId }: { campusId: string; termId: string }) => {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<any[]>([])
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadClasses()
  }, [campusId, termId])

  const loadClasses = async () => {
    try {
      setLoading(true)
      const response = await classesApi.list({ campus_id: campusId })
      setClasses(response.data)
    } catch (err) {
      console.error('Failed to load classes:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(classId)) {
        newSet.delete(classId)
      } else {
        newSet.add(classId)
      }
      return newSet
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (loading) {
    return <div className="text-sm text-gray-600 py-4">Loading class breakdown...</div>
  }

  if (classes.length === 0) {
    return <div className="text-sm text-gray-600 py-4">No classes found in this campus</div>
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Classes in Campus</h4>
      {classes.map((classItem) => (
        <ClassStudentBreakdown
          key={classItem.id}
          classId={classItem.id}
          className={classItem.name}
          termId={termId}
          isExpanded={expandedClasses.has(classItem.id)}
          onToggle={() => toggleClass(classItem.id)}
        />
      ))}
    </div>
  )
}

// Class Student Breakdown Component
const ClassStudentBreakdown = ({
  classId,
  className,
  termId,
  isExpanded,
  onToggle,
}: {
  classId: string
  className: string
  termId: string
  isExpanded: boolean
  onToggle: () => void
}) => {
  const [loading, setLoading] = useState(false)
  const [classSummary, setClassSummary] = useState<any>(null)
  const { user } = useAuthStore()

  useEffect(() => {
    if (isExpanded && !classSummary) {
      loadClassSummary()
    }
  }, [isExpanded, classId, termId])

  const loadClassSummary = async () => {
    try {
      setLoading(true)
      const summary = await feeSummaryApi.getClassSummary(classId, { term_id: termId })
      setClassSummary(summary)
    } catch (err) {
      console.error('Failed to load class summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
          <span className="text-sm font-medium text-gray-900">{className}</span>
        </div>
        {classSummary && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">{classSummary.active_students} students</span>
            <span className="font-semibold text-gray-900">{formatCurrency(classSummary.total_expected_fee)}</span>
            <span className="font-semibold text-green-600">{formatCurrency(classSummary.total_paid_amount)}</span>
            <span className="font-semibold text-gray-900">{formatCurrency(classSummary.total_pending_amount)}</span>
            <span
              className={`font-semibold ${
                classSummary.payment_rate >= 80
                  ? 'text-green-600'
                  : classSummary.payment_rate >= 50
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {formatPercentage(classSummary.payment_rate)}
            </span>
          </div>
        )}
      </button>
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {loading ? (
            <div className="text-sm text-gray-600">Loading students...</div>
          ) : classSummary ? (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expected Fee</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pending Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Rate</th>
                      {isAdmin && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {classSummary.students.map((student: any) => (
                      <tr key={student.student_id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{student.student_name}</td>
                        <td className="px-4 py-2 text-sm font-semibold text-gray-900">
                          {formatCurrency(student.expected_fee)}
                        </td>
                        <td className="px-4 py-2 text-sm font-semibold text-green-600">
                          {formatCurrency(student.paid_amount)}
                        </td>
                        <td className="px-4 py-2 text-sm font-semibold text-gray-900">
                          {formatCurrency(student.pending_amount)}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`font-semibold ${
                              student.payment_rate >= 80
                                ? 'text-green-600'
                                : student.payment_rate >= 50
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
                            {formatPercentage(student.payment_rate)}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2 text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <Link
                                to="/fee-status"
                                className="text-primary-600 hover:text-primary-900"
                              >
                                View
                              </Link>
                              <Link
                                to={`/fee-status/students/${student.student_id}/adjust`}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                Adjust Fee
                              </Link>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">No student data available</div>
          )}
        </div>
      )}
    </div>
  )
}

export default FeesOverviewPage

