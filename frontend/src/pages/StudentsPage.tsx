import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { studentsApi, Student, StudentListResponse } from '../api/students'
import { classesApi, Class, TeacherInClass } from '../api/classes'

type StudentPagination = StudentListResponse['pagination']

const StudentsPage = () => {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pagination, setPagination] = useState<StudentPagination>({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false,
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [classFilter, setClassFilter] = useState<string>('')
  const [teacherFilter, setTeacherFilter] = useState<string>('')
  const [subjectFilter, setSubjectFilter] = useState<string>('')
  const [classOptions, setClassOptions] = useState<Class[]>([])
  const [classAssignments, setClassAssignments] = useState<
    Record<string, { teachers: { id: string; name: string }[]; subjects: { id: string; name: string }[] }>
  >({})

  useEffect(() => {
    void loadStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, statusFilter])

  useEffect(() => {
    loadClassMetadata()
  }, [])

  const loadStudents = async () => {
    try {
      setLoading(true)
      setError('')
      const skip = (pagination.page - 1) * pagination.page_size
      const response = await studentsApi.list({
        skip,
        limit: pagination.page_size,
        status: statusFilter || undefined,
      })
      setStudents(response.data)
      setPagination(response.pagination)
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const loadClassMetadata = async () => {
    try {
      const classesResponse = await classesApi.list({ page: 1, page_size: 100 })
      const classes = classesResponse.data
      setClassOptions(classes)

      const assignmentsMap: Record<
        string,
        { teachers: { id: string; name: string }[]; subjects: { id: string; name: string }[] }
      > = {}
      const teacherMap = new Map<string, string>()
      const subjectMap = new Map<string, string>()

      for (const cls of classes) {
        try {
          const teacherResponse = await classesApi.listTeachers(cls.id)
          const teachersInClass: TeacherInClass[] = teacherResponse.data

          const teacherSet = new Map<string, string>()
          const subjectSet = new Map<string, string>()

          teachersInClass.forEach((assignment) => {
            if (assignment.teacher) {
              const name = `${assignment.teacher.first_name} ${assignment.teacher.last_name}`
              teacherSet.set(assignment.teacher.id, name)
              teacherMap.set(assignment.teacher.id, name)
            }
            if (assignment.subject) {
              subjectSet.set(assignment.subject.id, assignment.subject.name)
              subjectMap.set(assignment.subject.id, assignment.subject.name)
            }
          })

          assignmentsMap[cls.id] = {
            teachers: Array.from(teacherSet.entries()).map(([id, name]) => ({ id, name })),
            subjects: Array.from(subjectSet.entries()).map(([id, name]) => ({ id, name })),
          }
        } catch (err) {
          // Skip classes that fail to load teacher metadata
          // eslint-disable-next-line no-console
          console.error('Failed to load teachers for class', cls.id, err)
        }
      }

      setClassAssignments(assignmentsMap)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load class metadata', err)
    }
  }

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const getTeachersForStudent = (student: Student) => {
    const classId = student.current_class?.id
    if (!classId) return []
    return classAssignments[classId]?.teachers || []
  }

  const getSubjectsForStudent = (student: Student) => {
    const classId = student.current_class?.id
    if (!classId) return []
    return classAssignments[classId]?.subjects || []
  }

  const getPaginationRange = () => {
    // If client-side filters are active, use filtered results count
    const hasClientFilters = !!(classFilter || teacherFilter || subjectFilter || search)
    
    if (hasClientFilters) {
      const total = filteredStudents.length
      if (total === 0) {
        return { from: 0, to: 0, total: 0 }
      }
      return { from: 1, to: total, total }
    }

    // Otherwise, use API pagination
    const page = pagination?.page ?? 1
    const pageSize = pagination?.page_size ?? 0
    const total = pagination?.total ?? 0

    if (total === 0 || pageSize === 0) {
      return { from: 0, to: 0, total: 0 }
    }

    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)

    return { from, to, total }
  }
  
  const shouldShowPagination = () => {
    // If client-side filters are active, don't show pagination (all results are shown)
    const hasClientFilters = !!(classFilter || teacherFilter || subjectFilter || search)
    if (hasClientFilters) {
      return false
    }
    // Otherwise, show pagination if there are multiple pages from API
    return pagination.total_pages > 1
  }

  const filteredStudents = students.filter((student) => {
    const fullName = `${student.first_name} ${student.middle_name || ''} ${student.last_name}`
      .replace(/\s+/g, ' ')
      .trim()

    if (search && fullName !== search) {
      return false
    }

    if (classFilter && student.current_class?.id !== classFilter) {
      return false
    }

    const teachers = getTeachersForStudent(student)
    const subjects = getSubjectsForStudent(student)

    if (teacherFilter && !teachers.some((t) => t.id === teacherFilter)) {
      return false
    }

    if (subjectFilter && !subjects.some((s) => s.id === subjectFilter)) {
      return false
    }

    return true
  })

  const paginationRange = getPaginationRange()

  // Derived teacher and subject options based on current class filter
  const teacherOptions = (() => {
    const ids = classFilter ? [classFilter] : Object.keys(classAssignments)
    const map = new Map<string, string>()

    ids.forEach((classId) => {
      const assignment = classAssignments[classId]
      assignment?.teachers.forEach((t) => {
        if (!map.has(t.id)) {
          map.set(t.id, t.name)
        }
      })
    })

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  })()

  const subjectOptions = (() => {
    const ids = classFilter ? [classFilter] : Object.keys(classAssignments)
    const map = new Map<string, string>()

    ids.forEach((classId) => {
      const assignment = classAssignments[classId]
      assignment?.subjects.forEach((s) => {
        if (!map.has(s.id)) {
          map.set(s.id, s.name)
        }
      })
    })

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  })()

  const studentNameOptions = Array.from(
    new Set(
      students.map(
        (student) =>
          `${student.first_name} ${student.middle_name || ''} ${student.last_name}`.replace(/\s+/g, ' ').trim()
      )
    )
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Students"
        subtitle="Manage student records"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/dashboard" />
            <Link
              to="/students/new"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Add Student
            </Link>
          </div>
        }
      />

      <div className="p-8">
        {/* Filters */}
        <ContentCard>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <select
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Students</option>
                {studentNameOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="COMPLETED">Completed</option>
                <option value="TRANSFERRED_OUT">Transferred Out</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Classes</option>
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Teacher</label>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Teachers</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Subjects</option>
                {subjectOptions.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch('')
                  setStatusFilter('')
                  setClassFilter('')
                  setTeacherFilter('')
                  setSubjectFilter('')
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </ContentCard>

        {/* Students Table */}
        <ContentCard
          title={`Students (${filteredStudents.length})`}
          className="mt-6"
        >
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading students...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-error-600">{error}</p>
              <button
                onClick={loadStudents}
                className="mt-4 px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No students found.</p>
              <Link
                to="/students/new"
                className="mt-4 inline-block px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                Add First Student
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fee Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Teachers
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subjects
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStudents.map((student) => {
                      const teachers = getTeachersForStudent(student)
                      const subjects = getSubjectsForStudent(student)

                      const teacherNames = teachers.map((t) => t.name).join(', ')
                      const subjectNames = subjects.map((s) => s.name).join(', ')

                      return (
                        <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {student.first_name} {student.middle_name || ''} {student.last_name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            DOB: {new Date(student.date_of_birth).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {student.current_class?.name || 'N/A'}
                          </div>
                          {student.current_class?.academic_year && (
                            <div className="text-xs text-gray-500 mt-1">
                              {student.current_class.academic_year}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {student.fee_balance
                              ? formatCurrency(parseFloat(student.fee_balance.pending_amount))
                              : formatCurrency(0)}
                          </div>
                          {student.fee_balance && parseFloat(student.fee_balance.pending_amount) > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              Expected: {formatCurrency(parseFloat(student.fee_balance.expected_amount))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                              student.status === 'ACTIVE'
                                ? 'bg-success-100 text-success-800 border-success-200'
                                : student.status === 'COMPLETED'
                                ? 'bg-primary-100 text-primary-800 border-primary-200'
                                : student.status === 'TRANSFERRED_OUT'
                                ? 'bg-gray-100 text-gray-800 border-gray-200'
                                : 'bg-warning-100 text-warning-800 border-warning-200'
                            }`}
                          >
                            {student.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {teacherNames || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {subjectNames || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/students/${student.id}`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              View
                            </Link>
                            <Link
                              to={`/students/${student.id}/edit`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {shouldShowPagination() && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-700">
                    Showing {paginationRange.from} to {paginationRange.to} of {paginationRange.total} results
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={!pagination.has_previous}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={!pagination.has_next}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              {/* Show count when client-side filters are active */}
              {!shouldShowPagination() && filteredStudents.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 mt-4">
                  <div className="text-sm text-gray-700">
                    Showing {filteredStudents.length} result{filteredStudents.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </>
          )}
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default StudentsPage
