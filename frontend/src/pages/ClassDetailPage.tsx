import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { classesApi, Class, StudentInClass, TeacherInClass, AssignTeacherToClass } from '../api/classes'
import { subjectsApi, Subject } from '../api/subjects'
import { studentsApi, Student } from '../api/students'
import { usersApi, User } from '../api/users'
import { useAuthStore } from '../store/authStore'

const ClassDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [classData, setClassData] = useState<Class | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<StudentInClass[]>([])
  const [teachers, setTeachers] = useState<TeacherInClass[]>([])
  const [availableStudents, setAvailableStudents] = useState<Student[]>([])
  const [availableTeachers, setAvailableTeachers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingTeachers, setLoadingTeachers] = useState(false)
  const [error, setError] = useState('')
  const [showAssignStudent, setShowAssignStudent] = useState(false)
  const [showAssignTeacher, setShowAssignTeacher] = useState(false)
  const [assignFormData, setAssignFormData] = useState({
    student_id: '',
    start_date: new Date().toISOString().split('T')[0],
  })
  const [assignTeacherFormData, setAssignTeacherFormData] = useState({
    teacher_id: '',
    subject_id: '',
    start_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      // Always load core class + subjects first
      const [classResponse, subjectsResponse] = await Promise.all([
        classesApi.get(id!),
        subjectsApi.listForClass(id!),
      ])

      setClassData(classResponse)
      setSubjects(subjectsResponse.data)

      // Load students (if endpoint available)
      try {
        const studentsResponse = await classesApi.listStudents(id!, { page: 1, page_size: 100 })
        setStudents(studentsResponse.data)
      } catch (err: any) {
        console.error('Failed to load students for class:', err)
        // Don't block page load if students endpoint is missing/misconfigured
      }

      // Load teachers (if endpoint available)
      try {
        const teachersResponse = await classesApi.listTeachers(id!)
        setTeachers(teachersResponse.data)
      } catch (err: any) {
        console.error('Failed to load teachers for class:', err)
      }
    } catch (err: any) {
      const message =
        err.response?.data?.detail?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to load class'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableStudents = async () => {
    try {
      setLoadingStudents(true)
      const response = await studentsApi.list({ skip: 0, limit: 1000, status: 'ACTIVE' })
      // Filter out students already in this class
      const studentIdsInClass = new Set(students.map(s => s.id))
      setAvailableStudents(response.data.filter(s => !studentIdsInClass.has(s.id)))
    } catch (err: any) {
      console.error('Failed to load students:', err)
    } finally {
      setLoadingStudents(false)
    }
  }

  const loadAvailableTeachers = async () => {
    try {
      setLoadingTeachers(true)
      const response = await usersApi.list({ page: 1, page_size: 100, role: 'TEACHER', status: 'ACTIVE' })
      // Filter out teachers already assigned to this class
      const teacherIdsInClass = new Set(teachers.map(t => t.teacher.id))
      setAvailableTeachers(response.data.filter(t => !teacherIdsInClass.has(t.id)))
    } catch (err: any) {
      console.error('Failed to load teachers:', err)
    } finally {
      setLoadingTeachers(false)
    }
  }

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data: AssignTeacherToClass = {
        teacher_id: assignTeacherFormData.teacher_id,
        subject_id: assignTeacherFormData.subject_id || undefined,
        start_date: assignTeacherFormData.start_date,
      }
      await classesApi.assignTeacher(id!, data)
      setShowAssignTeacher(false)
      setAssignTeacherFormData({ teacher_id: '', subject_id: '', start_date: new Date().toISOString().split('T')[0] })
      loadData() // Reload to show new teacher
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail
      if (typeof errorDetail === 'string') {
        setError(errorDetail)
      } else if (errorDetail?.message) {
        setError(errorDetail.message)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to assign teacher. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTeacher = async (teacherId: string, subjectId?: string) => {
    if (!confirm('Are you sure you want to remove this teacher from the class?')) {
      return
    }

    try {
      setLoading(true)
      await classesApi.removeTeacher(id!, teacherId, subjectId)
      loadData() // Reload to update list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove teacher')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await classesApi.assignStudent(id!, {
        student_id: assignFormData.student_id,
        start_date: assignFormData.start_date,
      })
      setShowAssignStudent(false)
      setAssignFormData({ student_id: '', start_date: new Date().toISOString().split('T')[0] })
      loadData() // Reload to show new student
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail
      if (typeof errorDetail === 'string') {
        setError(errorDetail)
      } else if (errorDetail?.message) {
        setError(errorDetail.message)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to assign student. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to remove this student from the class?')) {
      return
    }

    try {
      setLoading(true)
      await classesApi.removeStudent(id!, studentId)
      loadData() // Reload to update list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove student')
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'CAMPUS_ADMIN' || user?.role === 'SUPER_ADMIN'

  if (loading && !classData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading class...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error && !classData) {
    return (
      <AppLayout>
        <PageHeader title="Error" subtitle={error} />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">{error}</p>
              <Link to="/classes" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
                ← Back to Classes
              </Link>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  if (!classData) return null

  return (
    <AppLayout>
      <PageHeader
        title={classData.name}
        subtitle={`${classData.campus?.name || 'N/A'} - ${classData.academic_year?.name || 'N/A'}`}
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/classes" />
            {isAdmin && (
              <Link
                to={`/classes/${id}/edit`}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Edit
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ContentCard>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Class Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Class Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{classData.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Campus</dt>
                <dd className="mt-1 text-sm text-gray-900">{classData.campus?.name || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Academic Year</dt>
                <dd className="mt-1 text-sm text-gray-900">{classData.academic_year?.name || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Students</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {classData.student_count || 0}
                  {classData.capacity && ` / ${classData.capacity}`}
                </dd>
              </div>
            </dl>
          </ContentCard>

          <ContentCard>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setShowAssignStudent(true)
                      loadAvailableStudents()
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    + Assign Student
                  </button>
                  <Link
                    to={`/classes/${id}/subjects/new`}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    + Add Subject
                  </Link>
                  <button
                    onClick={() => {
                      setShowAssignTeacher(true)
                      loadAvailableTeachers()
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    + Assign Teacher
                  </button>
                </>
              )}
            </div>
          </ContentCard>
        </div>

        {/* Assign Student Form */}
        {showAssignStudent && isAdmin && (
          <ContentCard className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Student to Class</h3>
            <form onSubmit={handleAssignStudent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="student_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Student <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="student_id"
                    name="student_id"
                    value={assignFormData.student_id}
                    onChange={(e) => setAssignFormData(prev => ({ ...prev, student_id: e.target.value }))}
                    required
                    disabled={loadingStudents}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                  >
                    <option value="">Select Student</option>
                    {availableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.middle_name || ''} {student.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={assignFormData.start_date}
                    onChange={(e) => setAssignFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Assign Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignStudent(false)
                    setAssignFormData({ student_id: '', start_date: new Date().toISOString().split('T')[0] })
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </ContentCard>
        )}

        {/* Students List */}
        <ContentCard className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Students</h3>
              <p className="text-sm text-gray-500 mt-1">{students.length} student{students.length !== 1 ? 's' : ''} in this class</p>
            </div>
            {isAdmin && !showAssignStudent && (
              <button
                onClick={() => {
                  setShowAssignStudent(true)
                  loadAvailableStudents()
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
              >
                Assign Student
              </button>
            )}
          </div>

          {students.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No students assigned to this class.</p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setShowAssignStudent(true)
                    loadAvailableStudents()
                  }}
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
                >
                  Assign first student
                </button>
              )}
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
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Date
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.first_name} {student.middle_name || ''} {student.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                            student.status === 'ACTIVE'
                              ? 'bg-success-100 text-success-800 border-success-200'
                              : 'bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.assignment?.start_date
                          ? new Date(student.assignment.start_date).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleRemoveStudent(student.id)}
                            className="text-error-600 hover:text-error-900"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ContentCard>

        {/* Assign Teacher Form */}
        {showAssignTeacher && isAdmin && (
          <ContentCard className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Teacher to Class</h3>
            <form onSubmit={handleAssignTeacher} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="teacher_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Teacher <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="teacher_id"
                    name="teacher_id"
                    value={assignTeacherFormData.teacher_id}
                    onChange={(e) => setAssignTeacherFormData(prev => ({ ...prev, teacher_id: e.target.value }))}
                    required
                    disabled={loadingTeachers}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                  >
                    <option value="">Select Teacher</option>
                    {availableTeachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name} ({teacher.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="subject_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject (Optional)
                  </label>
                  <select
                    id="subject_id"
                    name="subject_id"
                    value={assignTeacherFormData.subject_id}
                    onChange={(e) => setAssignTeacherFormData(prev => ({ ...prev, subject_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  >
                    <option value="">Class Teacher (All Subjects)</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Leave empty to assign as class teacher</p>
                </div>
                <div>
                  <label htmlFor="teacher_start_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="teacher_start_date"
                    name="teacher_start_date"
                    value={assignTeacherFormData.start_date}
                    onChange={(e) => setAssignTeacherFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Assign Teacher
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignTeacher(false)
                    setAssignTeacherFormData({ teacher_id: '', subject_id: '', start_date: new Date().toISOString().split('T')[0] })
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </ContentCard>
        )}

        {/* Teachers List */}
        <ContentCard className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Teachers</h3>
              <p className="text-sm text-gray-500 mt-1">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''} assigned to this class</p>
            </div>
            {isAdmin && !showAssignTeacher && (
              <button
                onClick={() => {
                  setShowAssignTeacher(true)
                  loadAvailableTeachers()
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
              >
                Assign Teacher
              </button>
            )}
          </div>

          {teachers.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No teachers assigned to this class.</p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setShowAssignTeacher(true)
                    loadAvailableTeachers()
                  }}
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
                >
                  Assign first teacher
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Date
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teachers.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {assignment.teacher.first_name} {assignment.teacher.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{assignment.teacher.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {assignment.subject ? (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800 border border-primary-200">
                            {assignment.subject.name}
                          </span>
                        ) : (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                            Class Teacher
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(assignment.start_date).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleRemoveTeacher(assignment.teacher.id, assignment.subject?.id)}
                            className="text-error-600 hover:text-error-900"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ContentCard>

        {/* Subjects List */}
        <ContentCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Subjects</h3>
              <p className="text-sm text-gray-500 mt-1">{subjects.length} subject{subjects.length !== 1 ? 's' : ''} in this class</p>
            </div>
            {isAdmin && (
              <Link
                to={`/classes/${id}/subjects/new`}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
              >
                Add Subject
              </Link>
            )}
          </div>

          {subjects.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No subjects found for this class.</p>
              {isAdmin && (
                <Link
                  to={`/classes/${id}/subjects/new`}
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium"
                >
                  Create first subject
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {subject.code || 'N/A'}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            to={`/subjects/${subject.id}/edit`}
                            className="text-primary-600 hover:text-primary-900 mr-4"
                          >
                            Edit
                          </Link>
                        </td>
                      )}
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

export default ClassDetailPage

