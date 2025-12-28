import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import PaymentModal from '../components/PaymentModal'
import PayFeesModal from '../components/PayFeesModal'
import { feeSummaryApi, CampusFeeSummary, ClassFeeSummaryResponse } from '../api/feeSummary'
import { classesApi } from '../api/classes'
import { useToastStore } from '../store/toastStore'

interface ClassSummary {
  class_id: string
  class_name: string
  term_id?: string | null
  active_students: number
  total_expected_fee: number
  total_paid_amount: number
  total_pending_amount: number
  payment_rate: number
  students?: ClassFeeSummaryResponse['students']
  loading?: boolean
}

interface CampusWithClasses extends CampusFeeSummary {
  classes?: ClassSummary[]
  loading?: boolean
}

const FeeStatusPage = () => {
  const [campuses, setCampuses] = useState<CampusWithClasses[]>([])
  const [expandedCampuses, setExpandedCampuses] = useState<Set<string>>(new Set())
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [termId, _setTermId] = useState<string | undefined>()
  const [currentTermId, setCurrentTermId] = useState<string | undefined>()
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [payFeesModalOpen, setPayFeesModalOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<{
    studentId: string
    studentName: string
    expectedFee: number
    paidAmount: number
    pendingAmount: number
    termId: string
  } | null>(null)
  const errorToast = useToastStore((state) => state.error)
  const successToast = useToastStore((state) => state.success)

  useEffect(() => {
    loadCampusData()
  }, [termId])

  const loadCampusData = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await feeSummaryApi.getCampusSummary({ term_id: termId })
      setCampuses(response.data.map(c => ({ ...c, classes: undefined, loading: false })))
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to load fee summary'
      setError(errorMsg)
      errorToast(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const loadClassData = async (campusId: string, classId: string) => {
    try {
      setCampuses(prev => prev.map(c => {
        if (c.campus_id === campusId) {
          return {
            ...c,
            classes: c.classes?.map(cls => 
              cls.class_id === classId ? { ...cls, loading: true } : cls
            ) || []
          }
        }
        return c
      }))

      const response = await feeSummaryApi.getClassSummary(classId, { term_id: termId })
      
      // Store term_id from response if available
      if (response.term_id && !currentTermId) {
        setCurrentTermId(response.term_id)
      }
      
      setCampuses(prev => prev.map(c => {
        if (c.campus_id === campusId) {
          const existingClasses = c.classes || []
          const classIndex = existingClasses.findIndex(cls => cls.class_id === classId)
          
          if (classIndex >= 0) {
            // Update existing class
            const updatedClasses = [...existingClasses]
            updatedClasses[classIndex] = {
              class_id: response.class_id,
              class_name: response.class_name,
              term_id: response.term_id,
              active_students: response.active_students,
              total_expected_fee: response.total_expected_fee,
              total_paid_amount: response.total_paid_amount,
              total_pending_amount: response.total_pending_amount,
              payment_rate: response.payment_rate,
              students: response.students,
              loading: false
            }
            return { ...c, classes: updatedClasses }
          } else {
            // Add new class
            return {
              ...c,
              classes: [...existingClasses, {
                class_id: response.class_id,
                class_name: response.class_name,
                term_id: response.term_id,
                active_students: response.active_students,
                total_expected_fee: response.total_expected_fee,
                total_paid_amount: response.total_paid_amount,
                total_pending_amount: response.total_pending_amount,
                payment_rate: response.payment_rate,
                students: response.students,
                loading: false
              }]
            }
          }
        }
        return c
      }))
    } catch (err: any) {
      errorToast(err.response?.data?.message || 'Failed to load class data')
      setCampuses(prev => prev.map(c => {
        if (c.campus_id === campusId) {
          return {
            ...c,
            classes: c.classes?.map(cls => 
              cls.class_id === classId ? { ...cls, loading: false } : cls
            ) || []
          }
        }
        return c
      }))
    }
  }

  const loadClassesForCampus = async (campusId: string) => {
    try {
      setCampuses(prev => prev.map(c => {
        if (c.campus_id === campusId) {
          return { ...c, loading: true }
        }
        return c
      }))
      
      // Fetch classes for this campus
      const classesResponse = await classesApi.list({
        campus_id: campusId,
        page_size: 100
      })

      // Fetch fee summary for each class
      const classSummaries: ClassSummary[] = []
      for (const cls of classesResponse.data) {
        try {
          const classSummary = await feeSummaryApi.getClassSummary(cls.id, { term_id: termId })
          classSummaries.push({
            class_id: classSummary.class_id,
            class_name: classSummary.class_name,
            active_students: classSummary.active_students,
            total_expected_fee: classSummary.total_expected_fee,
            total_paid_amount: classSummary.total_paid_amount,
            total_pending_amount: classSummary.total_pending_amount,
            payment_rate: classSummary.payment_rate,
            students: undefined, // Load on demand
            loading: false
          })
        } catch (err) {
          // Skip classes that fail to load
          console.error(`Failed to load fee summary for class ${cls.id}:`, err)
        }
      }

      setCampuses(prev => prev.map(c => {
        if (c.campus_id === campusId) {
          return { ...c, classes: classSummaries, loading: false }
        }
        return c
      }))
    } catch (err: any) {
      errorToast(err.response?.data?.message || 'Failed to load classes')
      setCampuses(prev => prev.map(c => {
        if (c.campus_id === campusId) {
          return { ...c, loading: false }
        }
        return c
      }))
    }
  }

  const toggleCampus = (campusId: string) => {
    const newExpanded = new Set(expandedCampuses)
    if (newExpanded.has(campusId)) {
      newExpanded.delete(campusId)
      // Also collapse all classes in this campus
      const campus = campuses.find(c => c.campus_id === campusId)
      if (campus?.classes) {
        const newExpandedClasses = new Set(expandedClasses)
        campus.classes.forEach(cls => newExpandedClasses.delete(cls.class_id))
        setExpandedClasses(newExpandedClasses)
      }
    } else {
      // Collapse all other campuses (only one expanded at a time)
      newExpanded.clear()
      newExpanded.add(campusId)
      
      // Load classes if not already loaded
      const campus = campuses.find(c => c.campus_id === campusId)
      if (!campus?.classes) {
        loadClassesForCampus(campusId)
      }
    }
    setExpandedCampuses(newExpanded)
  }

  const toggleClass = (campusId: string, classId: string) => {
    const newExpanded = new Set(expandedClasses)
    if (newExpanded.has(classId)) {
      newExpanded.delete(classId)
    } else {
      newExpanded.add(classId)
      // Load class data if not already loaded
      const campus = campuses.find(c => c.campus_id === campusId)
      const classData = campus?.classes?.find(cls => cls.class_id === classId)
      if (!classData || !classData.students) {
        loadClassData(campusId, classId)
      }
    }
    setExpandedClasses(newExpanded)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getPaymentRateColor = (rate: number) => {
    if (rate >= 81) return 'bg-green-500'
    if (rate >= 41) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getPaymentRateTextColor = (rate: number) => {
    if (rate >= 81) return 'text-green-700'
    if (rate >= 41) return 'text-yellow-700'
    return 'text-red-700'
  }

  // Calculate totals for visible scope
  const calculateTotals = () => {
    let totalExpected = 0
    let totalPaid = 0
    let totalPending = 0

    campuses.forEach(campus => {
      totalExpected += campus.total_expected_fee
      totalPaid += campus.total_paid_amount
      totalPending += campus.total_pending_amount
    })

    const paymentRate = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0

    return { totalExpected, totalPaid, totalPending, paymentRate }
  }

  const totals = calculateTotals()

  if (loading && campuses.length === 0) {
    return (
      <AppLayout>
        <PageHeader title="Campus Fee Summary" />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading fee summary...</p>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  if (error && campuses.length === 0) {
    return (
      <AppLayout>
        <PageHeader title="Campus Fee Summary" />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-12">
              <p className="text-error-600">{error}</p>
              <button
                onClick={loadCampusData}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Retry
              </button>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader 
        title="Campus Fee Summary" 
        action={
          <button
            onClick={() => setPayFeesModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Pay Fees
          </button>
        }
      />
      <div className="p-8 pb-24">
        <ContentCard>
          {campuses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No campuses configured for the selected academic year.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '20%' }}>
                      Campus Name
                    </th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell" style={{ width: '8%' }}>
                      Academic Year
                    </th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell" style={{ width: '7%' }}>
                      Term
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell" style={{ width: '6%' }}>
                      Classes
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '6%' }}>
                      Students
                    </th>
                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                      Expected
                    </th>
                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                      Paid
                    </th>
                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                      Pending
                    </th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                      Payment Rate
                    </th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell" style={{ width: '8%' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campuses.map((campus) => {
                    const isExpanded = expandedCampuses.has(campus.campus_id)
                    return (
                      <>
                        {/* Campus Row */}
                        <tr
                          key={campus.campus_id}
                          className="bg-white hover:bg-gray-50 cursor-pointer font-semibold"
                          onClick={() => toggleCampus(campus.campus_id)}
                        >
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-1.5">
                              <span 
                                className="inline-block transition-transform duration-200 text-gray-400 flex-shrink-0 text-xs"
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                              >
                                ▶
                              </span>
                              <span className="text-sm font-semibold text-gray-900 truncate">{campus.campus_name}</span>
                            </div>
                          </td>
                          <td className="px-2 py-4 text-sm text-gray-900 hidden lg:table-cell">
                            {campus.active_academic_year || 'N/A'}
                          </td>
                          <td className="px-2 py-4 text-sm text-gray-900 hidden md:table-cell">
                            {campus.active_term || 'N/A'}
                          </td>
                          <td className="px-2 py-4 text-center text-sm text-gray-900 hidden lg:table-cell">
                            {campus.active_classes}
                          </td>
                          <td className="px-2 py-4 text-center text-sm text-gray-900">
                            {campus.active_students}
                          </td>
                          <td className="px-2 py-4 text-right text-sm font-medium text-gray-900">
                            {formatCurrency(campus.total_expected_fee)}
                          </td>
                          <td className="px-2 py-4 text-right text-sm font-medium text-green-600">
                            {formatCurrency(campus.total_paid_amount)}
                          </td>
                          <td className="px-2 py-4 text-right text-sm font-medium text-amber-600">
                            {formatCurrency(campus.total_pending_amount)}
                          </td>
                          <td className="px-2 py-4">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[30px] max-w-[60px]">
                                <div
                                  className={`h-2 rounded-full ${getPaymentRateColor(campus.payment_rate)}`}
                                  style={{ width: `${Math.min(campus.payment_rate, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium whitespace-nowrap ${getPaymentRateTextColor(campus.payment_rate)}`}>
                                {campus.payment_rate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-4 text-sm font-medium hidden xl:table-cell">
                            <button className="text-primary-600 hover:text-primary-900 text-xs">
                              View
                            </button>
                          </td>
                        </tr>

                        {/* Class Rows (when campus expanded) */}
                        {isExpanded && (
                          <>
                            {campus.loading ? (
                              <tr>
                                <td colSpan={10} className="px-3 py-4 text-center" style={{ paddingLeft: '48px' }}>
                                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                  <span className="ml-2 text-sm text-gray-600">Loading classes...</span>
                                </td>
                              </tr>
                            ) : campus.classes && campus.classes.length > 0 ? (
                              <>
                                {campus.classes.map((classItem) => {
                                  const isClassExpanded = expandedClasses.has(classItem.class_id)
                                  return (
                                    <>
                                      <tr
                                        key={classItem.class_id}
                                        className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                                        style={{ paddingLeft: '24px' }}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleClass(campus.campus_id, classItem.class_id)
                                        }}
                                      >
                                    <td className="px-3 py-3" style={{ paddingLeft: '48px' }}>
                                      <div className="flex items-center gap-1.5">
                                        <span 
                                          className="inline-block transition-transform duration-200 text-gray-400 flex-shrink-0 text-xs"
                                          style={{ transform: isClassExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                        >
                                          ▶
                                        </span>
                                        <span className="text-sm text-gray-900 truncate">{classItem.class_name}</span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-3 text-sm text-gray-700 hidden lg:table-cell"></td>
                                    <td className="px-2 py-3 text-sm text-gray-700 hidden md:table-cell"></td>
                                    <td className="px-2 py-3 text-sm text-gray-700 hidden lg:table-cell"></td>
                                    <td className="px-2 py-3 text-center text-sm text-gray-700">
                                      {classItem.active_students}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm font-medium text-gray-700">
                                      {formatCurrency(classItem.total_expected_fee)}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm font-medium text-green-600">
                                      {formatCurrency(classItem.total_paid_amount)}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm font-medium text-amber-600">
                                      {formatCurrency(classItem.total_pending_amount)}
                                    </td>
                                    <td className="px-2 py-3">
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[30px] max-w-[60px]">
                                          <div
                                            className={`h-2 rounded-full ${getPaymentRateColor(classItem.payment_rate)}`}
                                            style={{ width: `${Math.min(classItem.payment_rate, 100)}%` }}
                                          />
                                        </div>
                                        <span className={`text-xs font-medium whitespace-nowrap ${getPaymentRateTextColor(classItem.payment_rate)}`}>
                                          {classItem.payment_rate.toFixed(1)}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-3 text-sm font-medium hidden xl:table-cell">
                                      <button
                                        className="text-primary-600 hover:text-primary-900 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleClass(campus.campus_id, classItem.class_id)
                                        }}
                                      >
                                        View ({classItem.active_students})
                                      </button>
                                    </td>
                                      </tr>

                                      {/* Student Rows (when class expanded) */}
                                      {isClassExpanded && classItem.students && classItem.students.length > 0 && (
                                        <>
                                          {classItem.students.map((student) => (
                                            <tr
                                              key={student.student_id}
                                              className="bg-white hover:bg-gray-50"
                                              style={{ paddingLeft: '72px' }}
                                            >
                                              <td className="px-3 py-2" style={{ paddingLeft: '72px' }}>
                                                <span className="text-sm text-gray-900 truncate">{student.student_name}</span>
                                              </td>
                                              <td className="px-2 py-2 text-sm text-gray-700 hidden lg:table-cell"></td>
                                              <td className="px-2 py-2 text-sm text-gray-700 hidden md:table-cell"></td>
                                              <td className="px-2 py-2 text-sm text-gray-700 hidden lg:table-cell"></td>
                                              <td className="px-2 py-2 text-sm text-gray-700"></td>
                                              <td className="px-2 py-2 text-right text-sm font-medium text-gray-700">
                                                {formatCurrency(student.expected_fee)}
                                              </td>
                                              <td className="px-2 py-2 text-right text-sm font-medium text-green-600">
                                                {formatCurrency(student.paid_amount)}
                                              </td>
                                              <td className="px-2 py-2 text-right text-sm font-medium text-amber-600">
                                                {formatCurrency(student.pending_amount)}
                                              </td>
                                              <td className="px-2 py-2">
                                                <div className="flex items-center gap-1.5">
                                                  <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[30px] max-w-[60px]">
                                                    <div
                                                      className={`h-2 rounded-full ${getPaymentRateColor(student.payment_rate)}`}
                                                      style={{ width: `${Math.min(student.payment_rate, 100)}%` }}
                                                    />
                                                  </div>
                                                  <span className={`text-xs font-medium whitespace-nowrap ${getPaymentRateTextColor(student.payment_rate)}`}>
                                                    {student.payment_rate.toFixed(1)}%
                                                  </span>
                                                </div>
                                              </td>
                                              <td className="px-2 py-2 text-sm font-medium hidden xl:table-cell">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    // Get term_id from the class response or use current term
                                                    const termIdToUse = classItem.term_id || currentTermId || termId
                                                    
                                                    if (!termIdToUse) {
                                                      errorToast('Term ID is required. Please select a term or ensure an active term exists.')
                                                      return
                                                    }
                                                    
                                                    setSelectedStudent({
                                                      studentId: student.student_id,
                                                      studentName: student.student_name,
                                                      expectedFee: student.expected_fee,
                                                      paidAmount: student.paid_amount,
                                                      pendingAmount: student.pending_amount,
                                                      termId: termIdToUse,
                                                    })
                                                    setPaymentModalOpen(true)
                                                  }}
                                                  className="text-primary-600 hover:text-primary-900 text-xs"
                                                >
                                                  Pay
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </>
                                      )}

                                      {isClassExpanded && classItem.loading && (
                                        <tr>
                                          <td colSpan={10} className="px-3 py-4 text-center">
                                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                            <span className="ml-2 text-sm text-gray-600">Loading students...</span>
                                          </td>
                                        </tr>
                                      )}

                                      {isClassExpanded && classItem.students && classItem.students.length === 0 && (
                                        <tr>
                                          <td colSpan={10} className="px-3 py-4 text-center text-sm text-gray-600">
                                            No students enrolled in this class.
                                          </td>
                                        </tr>
                                      )}
                                    </>
                                  )
                                })}
                              </>
                            ) : (
                              <tr>
                                <td colSpan={10} className="px-3 py-4 text-center text-sm text-gray-600" style={{ paddingLeft: '48px' }}>
                                  No active classes for this campus.
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ContentCard>
      </div>

      {/* Sticky Summary Footer */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
        <div className="p-4">
          <div className="max-w-full mx-auto px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div>
                  <span className="text-sm text-gray-600">Total Expected:</span>
                  <span className="ml-2 text-sm font-semibold text-gray-900">{formatCurrency(totals.totalExpected)}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Total Paid:</span>
                  <span className="ml-2 text-sm font-semibold text-green-600">{formatCurrency(totals.totalPaid)}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Total Pending:</span>
                  <span className="ml-2 text-sm font-semibold text-amber-600">{formatCurrency(totals.totalPending)}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Overall Payment Rate:</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${getPaymentRateColor(totals.paymentRate)}`}
                      style={{ width: `${Math.min(totals.paymentRate, 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-semibold ${getPaymentRateTextColor(totals.paymentRate)}`}>
                    {totals.paymentRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal (for row-level payments) */}
      {selectedStudent && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false)
            setSelectedStudent(null)
          }}
          studentId={selectedStudent.studentId}
          studentName={selectedStudent.studentName}
          termId={selectedStudent.termId}
          expectedFee={selectedStudent.expectedFee}
          paidAmount={selectedStudent.paidAmount}
          pendingAmount={selectedStudent.pendingAmount}
          onPaymentSuccess={() => {
            // Reload the class data to refresh payment information
            if (expandedCampuses.size > 0 && expandedClasses.size > 0) {
              const campusId = Array.from(expandedCampuses)[0]
              const classId = Array.from(expandedClasses)[0]
              loadClassData(campusId, classId)
            }
            loadCampusData()
            successToast('Payment recorded successfully')
          }}
        />
      )}

      {/* Pay Fees Modal (for header button) */}
      <PayFeesModal
        isOpen={payFeesModalOpen}
        onClose={() => setPayFeesModalOpen(false)}
        onPaymentSuccess={() => {
          // Reload the class data to refresh payment information
          if (expandedCampuses.size > 0 && expandedClasses.size > 0) {
            const campusId = Array.from(expandedCampuses)[0]
            const classId = Array.from(expandedClasses)[0]
            loadClassData(campusId, classId)
          }
          loadCampusData()
        }}
      />
    </AppLayout>
  )
}

export default FeeStatusPage

