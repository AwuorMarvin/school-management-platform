import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { termsApi, Term } from '../api/terms'
import { useAuthStore } from '../store/authStore'

const AcademicYearDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [yearData, termsData] = await Promise.all([
        academicYearsApi.get(id!),
        termsApi.list({ academic_year_id: id, page: 1, page_size: 100 }),
      ])
      setAcademicYear(yearData)
      setTerms(termsData.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load academic year')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN'

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading academic year...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !academicYear) {
    return (
      <AppLayout>
        <PageHeader title="Error" subtitle={error || 'Academic year not found'} />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">{error || 'Academic year not found'}</p>
              <Link to="/academic-years" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
                ← Back to Academic Years
              </Link>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title={academicYear.name}
        subtitle={`${formatDate(academicYear.start_date)} - ${formatDate(academicYear.end_date)}`}
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/academic-years" />
            {isSchoolAdmin && (
              <Link
                to={`/academic-years/${id}/edit`}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Edit
              </Link>
            )}
          </div>
        }
      />

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ContentCard>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Year Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{academicYear.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(academicYear.start_date)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">End Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(academicYear.end_date)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  {academicYear.is_current ? (
                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-100 text-success-800 border border-success-200">
                      Current
                    </span>
                  ) : (
                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                      Past
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </ContentCard>

          <ContentCard>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {isSchoolAdmin && (
                <Link
                  to={`/academic-years/${id}/terms/new`}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  + Add Term
                </Link>
              )}
              <Link
                to={`/classes?academic_year_id=${id}`}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Classes
              </Link>
            </div>
          </ContentCard>
        </div>

        <ContentCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Terms</h3>
              <p className="text-sm text-gray-500 mt-1">{terms.length} term{terms.length !== 1 ? 's' : ''} in this academic year</p>
            </div>
            {isSchoolAdmin && (
              <Link
                to={`/academic-years/${id}/terms/new`}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
              >
                Add Term
              </Link>
            )}
          </div>

          {terms.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No terms found for this academic year.</p>
              {isSchoolAdmin && (
                <Link
                  to={`/academic-years/${id}/terms/new`}
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
                >
                  Create first term
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Term Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {terms.map((term) => (
                    <tr key={term.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{term.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(term.start_date)} - {formatDate(term.end_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {term.is_current ? (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-100 text-success-800 border border-success-200">
                            Current
                          </span>
                        ) : (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                            Past
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/terms/${term.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default AcademicYearDetailPage

