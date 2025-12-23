import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { parentsApi, Parent, ParentListResponse } from '../api/parents'
import { studentsApi, Student } from '../api/students'
import { classesApi, Class, TeacherInClass } from '../api/classes'

type ParentPagination = ParentListResponse['pagination']

const ParentsPage = () => {
  const [parents, setParents] = useState<Parent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pagination, setPagination] = useState<ParentPagination>({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false,
  })
  const [parentNameFilter, setParentNameFilter] = useState('')
  const [studentNameFilter, setStudentNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')

  const [classOptions, setClassOptions] = useState<Class[]>([])
  const [classAssignments, setClassAssignments] = useState<
    Record<string, { teachers: { id: string; name: string }[]; subjects: { id: string; name: string }[] }>
  >({})
  const [studentClassMap, setStudentClassMap] = useState<
    Record<string, { classId: string; className: string }>
  >({})

  useEffect(() => {
    void loadParents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page])

  useEffect(() => {
    void loadStudentClasses()
    void loadClassMetadata()
  }, [])

  const loadParents = async () => {
    try {
      setLoading(true)
      setError('')
      const skip = (pagination.page - 1) * pagination.page_size
      const response = await parentsApi.list({
        skip,
        limit: pagination.page_size,
      })

      // Enrich parents with their linked students
      const parentsWithStudents = await Promise.all(
        response.data.map(async (parent) => {
          try {
            const fullParent = await parentsApi.get(parent.id)
            return { ...parent, students: fullParent.students || [] }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to load parent details', parent.id, err)
            return parent
          }
        })
      )

      setParents(parentsWithStudents)
      setPagination(response.pagination)
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to load parents')
    } finally {
      setLoading(false)
    }
  }

  const loadStudentClasses = async () => {
    try {
      const response = await studentsApi.list({ skip: 0, limit: 1000 })
      const map: Record<string, { classId: string; className: string }> = {}

      response.data.forEach((student: Student) => {
        if (student.current_class?.id) {
          map[student.id] = {
            classId: student.current_class.id,
            className: student.current_class.name,
          }
        }
      })

      setStudentClassMap(map)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load student classes', err)
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
            }
            if (assignment.subject) {
              subjectSet.set(assignment.subject.id, assignment.subject.name)
            }
          })

          assignmentsMap[cls.id] = {
            teachers: Array.from(teacherSet.entries()).map(([id, name]) => ({ id, name })),
            subjects: Array.from(subjectSet.entries()).map(([id, name]) => ({ id, name })),
          }
        } catch (err) {
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

  const getClassesForParent = (parent: Parent) => {
    const classes = new Map<string, string>()

    parent.students?.forEach((child) => {
      const entry = studentClassMap[child.student_id]
      if (entry) {
        classes.set(entry.classId, entry.className)
      }
    })

    return Array.from(classes.entries()).map(([id, name]) => ({ id, name }))
  }

  const getTeachersForParent = (parent: Parent) => {
    const teachers = new Map<string, string>()

    parent.students?.forEach((child) => {
      const entry = studentClassMap[child.student_id]
      if (!entry) return
      const assignment = classAssignments[entry.classId]
      assignment?.teachers.forEach((t) => {
        if (!teachers.has(t.id)) {
          teachers.set(t.id, t.name)
        }
      })
    })

    return Array.from(teachers.entries()).map(([id, name]) => ({ id, name }))
  }

  const getSubjectsForParent = (parent: Parent) => {
    const subjects = new Map<string, string>()

    parent.students?.forEach((child) => {
      const entry = studentClassMap[child.student_id]
      if (!entry) return
      const assignment = classAssignments[entry.classId]
      assignment?.subjects.forEach((s) => {
        if (!subjects.has(s.id)) {
          subjects.set(s.id, s.name)
        }
      })
    })

    return Array.from(subjects.entries()).map(([id, name]) => ({ id, name }))
  }

  // Derived dropdown options
  const parentNameOptions = Array.from(
    new Set(
      parents.map((parent) =>
        `${parent.first_name} ${parent.last_name}`.replace(/\s+/g, ' ').trim()
      )
    )
  )

  const studentNameOptions = Array.from(
    new Set(
      parents.flatMap((parent) =>
        (parent.students || []).map((s) => s.student_name.replace(/\s+/g, ' ').trim())
      )
    )
  )

  const statusOptions = Array.from(new Set(parents.map((p) => p.status))).filter(Boolean)

  const teacherOptions = (() => {
    const classIds =
      classFilter !== ''
        ? [classFilter]
        : Array.from(
            new Set(
              parents.flatMap((parent) =>
                (parent.students || [])
                  .map((s) => studentClassMap[s.student_id]?.classId)
                  .filter(Boolean) as string[]
              )
            )
          )

    const map = new Map<string, string>()

    classIds.forEach((classId) => {
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
    const classIds =
      classFilter !== ''
        ? [classFilter]
        : Array.from(
            new Set(
              parents.flatMap((parent) =>
                (parent.students || [])
                  .map((s) => studentClassMap[s.student_id]?.classId)
                  .filter(Boolean) as string[]
              )
            )
          )

    const map = new Map<string, string>()

    classIds.forEach((classId) => {
      const assignment = classAssignments[classId]
      assignment?.subjects.forEach((s) => {
        if (!map.has(s.id)) {
          map.set(s.id, s.name)
        }
      })
    })

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  })()

  const filteredParents = parents.filter((parent) => {
    const fullName = `${parent.first_name} ${parent.last_name}`.replace(/\s+/g, ' ').trim()

    if (parentNameFilter && fullName !== parentNameFilter) {
      return false
    }

    if (studentNameFilter) {
      const hasStudent = (parent.students || []).some(
        (s) => s.student_name.replace(/\s+/g, ' ').trim() === studentNameFilter
      )
      if (!hasStudent) return false
    }

    if (statusFilter && parent.status !== statusFilter) {
      return false
    }

    const parentClasses = getClassesForParent(parent)

    if (classFilter && !parentClasses.some((c) => c.id === classFilter)) {
      return false
    }

    const parentTeachers = getTeachersForParent(parent)
    const parentSubjects = getSubjectsForParent(parent)

    if (teacherFilter && !parentTeachers.some((t) => t.id === teacherFilter)) {
      return false
    }

    if (subjectFilter && !parentSubjects.some((s) => s.id === subjectFilter)) {
      return false
    }

    return true
  })

  const childrenNamesForParent = (parent: Parent) => {
    if (!parent.students || parent.students.length === 0) {
      return '—'
    }

    const names = Array.from(
      new Set(parent.students.map((s) => s.student_name.replace(/\s+/g, ' ').trim()))
    )

    return names.join(', ')
  }

  const parentTypesForParent = (parent: Parent) => {
    if (!parent.students || parent.students.length === 0) {
      return '—'
    }

    const labelMap: Record<string, string> = {
      FATHER: 'Father',
      MOTHER: 'Mother',
      GUARDIAN: 'Guardian',
    }

    const roles = Array.from(
      new Set(
        parent.students
          .map((s) => s.role)
          .filter(Boolean)
      )
    )

    if (roles.length === 0) {
      return '—'
    }

    return roles
      .map((role) => labelMap[role] || role)
      .join(', ')
  }

  return (
    <AppLayout>
      <PageHeader
        title="Parents"
        subtitle="Manage parent accounts"
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/dashboard" />
            <Link
              to="/parents/new"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Add Parent
            </Link>
          </div>
        }
      />

      <div className="p-8">
        {/* Filters */}
        <ContentCard>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Name</label>
              <select
                value={parentNameFilter}
                onChange={(e) => {
                  setParentNameFilter(e.target.value)
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Parents</option>
                {parentNameOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Student Name</label>
              <select
                value={studentNameFilter}
                onChange={(e) => {
                  setStudentNameFilter(e.target.value)
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
              <select
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value)
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
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
                onChange={(e) => {
                  setTeacherFilter(e.target.value)
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
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
                onChange={(e) => {
                  setSubjectFilter(e.target.value)
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
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
                  setParentNameFilter('')
                  setStudentNameFilter('')
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

        {/* Parents Table */}
        <ContentCard
          title={`Parents (${filteredParents.length})`}
          className="mt-6"
        >
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading parents...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-error-600">{error}</p>
              <button
                onClick={loadParents}
                className="mt-4 px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : parents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No parents found.</p>
              <Link
                to="/parents/new"
                className="mt-4 inline-block px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                Add First Parent
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
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Child(ren)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Parent Type
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
                    {filteredParents.map((parent) => (
                      <tr key={parent.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {parent.first_name} {parent.last_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{parent.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{parent.phone_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{parent.id_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {childrenNamesForParent(parent)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {parentTypesForParent(parent)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                              parent.status === 'ACTIVE'
                                ? 'bg-success-100 text-success-800 border-success-200'
                                : parent.status === 'PENDING_SETUP'
                                ? 'bg-warning-100 text-warning-800 border-warning-200'
                                : 'bg-gray-100 text-gray-800 border-gray-200'
                            }`}
                          >
                            {parent.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/parents/${parent.id}`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              View
                            </Link>
                            <Link
                              to={`/parents/${parent.id}/edit`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination (based on visible results on this page) */}
              {filteredParents.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-700">
                    Showing 1 to {filteredParents.length} of {filteredParents.length} results
                  </div>
                  {pagination.total_pages > 1 && (
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
                        disabled={!pagination.has_next || filteredParents.length < pagination.page_size}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default ParentsPage
