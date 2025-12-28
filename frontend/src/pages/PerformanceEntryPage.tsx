import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { performanceApi, PerformanceEntry } from '../api/performance'
import { studentsApi, Student } from '../api/students'
import { subjectsApi, Subject } from '../api/subjects'
import { termsApi, Term } from '../api/terms'
import { useAuthStore } from '../store/authStore'

const PerformanceEntryPage = () => {
  const { studentId } = useParams<{ studentId: string }>()
  const { user } = useAuthStore()
  const [student, setStudent] = useState<Student | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<PerformanceEntry>({
    subject_id: '',
    term_id: '',
    grade: '',
    subject_comment: '',
  })

  useEffect(() => {
    if (studentId) {
      loadData()
    }
  }, [studentId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [studentData, termsData] = await Promise.all([
        studentsApi.get(studentId!),
        termsApi.list({ page: 1, page_size: 100 }),
      ])
      setStudent(studentData)
      setTerms(termsData.data)
      
      // Load subjects from student's current class
      if (studentData.current_class?.id) {
        const subjectsData = await subjectsApi.listForClass(studentData.current_class.id)
        setSubjects(subjectsData.data)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data: PerformanceEntry = {
        subject_id: formData.subject_id,
        term_id: formData.term_id,
        grade: formData.grade || undefined,
        subject_comment: formData.subject_comment || undefined,
      }
      await performanceApi.enterPerformance(studentId!, data)
      // Reset form
      setFormData({
        subject_id: '',
        term_id: '',
        grade: '',
        subject_comment: '',
      })
      alert('Performance entry saved successfully!')
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail
      if (typeof errorDetail === 'string') {
        setError(errorDetail)
      } else if (errorDetail?.message) {
        setError(errorDetail.message)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to save performance entry. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  if (loading && !student) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
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

  if (!student) return null

  const isTeacher = user?.role === 'TEACHER'
  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'
  const canEnter = isTeacher || isAdmin

  if (!canEnter) {
    return (
      <AppLayout>
        <PageHeader title="Access Denied" subtitle="Only teachers and administrators can enter performance data" />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">You don't have permission to access this page.</p>
              <Link to={`/students/${studentId}`} className="mt-4 inline-block text-primary-600 hover:text-primary-700">
                ← Back to Student
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
        title={`Enter Performance - ${student.first_name} ${student.last_name}`}
        subtitle={student.current_class?.name || 'No class assigned'}
        action={
          <div className="flex items-center gap-2">
            <BackButton to={`/students/${studentId}`} />
            <Link
              to={`/students/${studentId}/performance`}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Performance
            </Link>
          </div>
        }
      />

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm">
            {error}
          </div>
        )}

        {!student.current_class && (
          <ContentCard className="mb-6">
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
              <p className="text-warning-800 text-sm">
                <strong>Note:</strong> This student is not assigned to any class. Please assign the student to a class before entering performance data.
              </p>
            </div>
          </ContentCard>
        )}

        <ContentCard>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="term_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Term <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="term_id"
                    name="term_id"
                    value={formData.term_id}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="">Select Term</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="subject_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="subject_id"
                    name="subject_id"
                    value={formData.subject_id}
                    onChange={handleChange}
                    required
                    disabled={!student.current_class}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  {!student.current_class && (
                    <p className="mt-1 text-xs text-error-500">Student must be assigned to a class</p>
                  )}
                </div>

                <div>
                  <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">
                    Grade (Optional)
                  </label>
                  <input
                    type="text"
                    id="grade"
                    name="grade"
                    value={formData.grade}
                    onChange={handleChange}
                    maxLength={10}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., A, A+, B, 85%"
                  />
                  <p className="mt-1 text-xs text-gray-500">Grade (1-10 characters)</p>
                </div>

                <div>
                  <label htmlFor="subject_comment" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Comment (Optional)
                  </label>
                  <textarea
                    id="subject_comment"
                    name="subject_comment"
                    value={formData.subject_comment}
                    onChange={handleChange}
                    maxLength={1000}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter subject-specific comment..."
                  />
                  <p className="mt-1 text-xs text-gray-500">Max 1000 characters</p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                to={`/students/${studentId}`}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || !student.current_class}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Saving...' : 'Save Performance'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default PerformanceEntryPage

