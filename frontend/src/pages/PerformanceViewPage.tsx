import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { performanceApi, PerformanceResponse } from '../api/performance'
import { studentsApi, Student } from '../api/students'
import { termsApi, Term } from '../api/terms'
import { useAuthStore } from '../store/authStore'

const PerformanceViewPage = () => {
  const { studentId } = useParams<{ studentId: string }>()
  const { user } = useAuthStore()
  const [student, setStudent] = useState<Student | null>(null)
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null)
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    term_id: '',
    subject_id: '',
  })

  useEffect(() => {
    if (studentId) {
      loadData()
    }
  }, [studentId])

  useEffect(() => {
    if (studentId && (filters.term_id || filters.subject_id)) {
      loadPerformance()
    } else if (studentId) {
      loadPerformance()
    }
  }, [studentId, filters.term_id, filters.subject_id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [studentData, termsData] = await Promise.all([
        studentsApi.get(studentId!),
        termsApi.list({ page: 1, page_size: 100 }),
      ])
      setStudent(studentData)
      setTerms(termsData.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadPerformance = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (filters.term_id) params.term_id = filters.term_id
      if (filters.subject_id) params.subject_id = filters.subject_id
      
      const performanceData = await performanceApi.getPerformance(studentId!, params)
      setPerformance(performanceData)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load performance')
    } finally {
      setLoading(false)
    }
  }

  const isTeacher = user?.role === 'TEACHER'
  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'
  const isParent = user?.role === 'PARENT'
  const canEnter = isTeacher || isAdmin

  if (loading && !student) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading performance data...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error && !student) {
    return (
      <AppLayout>
        <PageHeader title="Error" subtitle={error} />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">{error}</p>
              <Link to="/students" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
                ← Back to Students
              </Link>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  if (!student || !performance) return null

  // Group performance by term
  const performanceByTerm: Record<string, PerformanceResponse['data']> = {}
  performance.data.forEach((item) => {
    const termName = item.term.name
    if (!performanceByTerm[termName]) {
      performanceByTerm[termName] = []
    }
    performanceByTerm[termName].push(item)
  })

  return (
    <AppLayout>
      <PageHeader
        title={`Performance - ${student.first_name} ${student.last_name}`}
        subtitle={student.current_class?.name || 'No class assigned'}
        action={
          <div className="flex items-center gap-2">
            <BackButton to={`/students/${studentId}`} />
            {canEnter && (
              <Link
                to={`/students/${studentId}/performance/enter`}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Enter Performance
              </Link>
            )}
          </div>
        }
      />

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <ContentCard className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Term
              </label>
              <select
                value={filters.term_id}
                onChange={(e) => setFilters(prev => ({ ...prev, term_id: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Terms</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ term_id: '', subject_id: '' })}
                className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </ContentCard>

        {/* Performance Data */}
        {performance.data.length === 0 ? (
          <ContentCard>
            <div className="text-center py-8 text-gray-600">
              <p>No performance records found for this student.</p>
              {canEnter && (
                <Link
                  to={`/students/${studentId}/performance/enter`}
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
                >
                  Enter first performance record
                </Link>
              )}
            </div>
          </ContentCard>
        ) : (
          Object.entries(performanceByTerm).map(([termName, items]) => (
            <ContentCard key={termName} className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{termName}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Comment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entered By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item, index) => (
                      <tr key={`${item.subject.id}_${item.term.id}_${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.subject.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.grade ? (
                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800 border border-primary-200">
                              {item.grade}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-md">{item.subject_comment || '—'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.entered_by.first_name} {item.entered_by.last_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.entered_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContentCard>
          ))
        )}
      </div>
    </AppLayout>
  )
}

export default PerformanceViewPage

