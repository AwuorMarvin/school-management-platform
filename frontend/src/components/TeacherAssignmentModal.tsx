import { useState, useEffect, useCallback } from 'react'
import { teachersApi, TeacherAssignmentCreate, ConflictInfo, TeacherAssignment } from '../api/teachers'
import { classesApi, Class } from '../api/classes'
import { subjectsApi, Subject } from '../api/subjects'
import { useToastStore } from '../store/toastStore'

interface TeacherAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  teacherId: string
  teacherName: string
  teacherCampusId: string
  mode?: 'create' | 'adjust'
  assignment?: TeacherAssignment
  onAssignmentSuccess?: () => void
}

const TeacherAssignmentModal: React.FC<TeacherAssignmentModalProps> = ({
  isOpen,
  onClose,
  teacherId,
  teacherName,
  teacherCampusId,
  mode = 'create',
  assignment,
  onAssignmentSuccess,
}) => {
  const isAdjustMode = mode === 'adjust'
  const [loading, setLoading] = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [classes, setClasses] = useState<Class[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([])
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [formData, setFormData] = useState({
    class_ids: [] as string[],
    subject_ids: [] as string[],
    start_date: new Date().toISOString().split('T')[0],
    end_date: '' as string | null,
  })
  const successToast = useToastStore((state) => state.success)
  const errorToast = useToastStore((state) => state.error)

  // Load classes when modal opens
  useEffect(() => {
    if (isOpen) {
      loadClasses()
      // Reset or populate form based on mode
      if (isAdjustMode && assignment) {
        // Adjust mode: pre-populate with assignment data
        setFormData({
          class_ids: [assignment.class.id],
          subject_ids: assignment.subjects.map(s => s.id),
          start_date: assignment.start_date,
          end_date: assignment.end_date || null,
        })
        // Load subjects for the class
        loadSubjectsForClass(assignment.class.id)
      } else {
        // Create mode: reset form
        setFormData({
          class_ids: [],
          subject_ids: [],
          start_date: new Date().toISOString().split('T')[0],
          end_date: null,
        })
      }
      setConflicts([])
    }
  }, [isOpen, teacherCampusId, isAdjustMode, assignment])

  // Load subjects when classes are selected
  useEffect(() => {
    if (isOpen && formData.class_ids.length > 0) {
      loadSubjectsForClasses()
    } else {
      setAvailableSubjects([])
      setFormData(prev => ({ ...prev, subject_ids: [] }))
    }
  }, [isOpen, formData.class_ids])

  // Check conflicts when form data changes
  useEffect(() => {
    if (isOpen && formData.class_ids.length > 0 && formData.subject_ids.length > 0 && formData.start_date) {
      const timeoutId = setTimeout(() => {
        checkConflicts()
      }, 500) // Debounce conflict checking
      return () => clearTimeout(timeoutId)
    } else {
      setConflicts([])
    }
  }, [isOpen, formData.class_ids, formData.subject_ids, formData.start_date, formData.end_date])

  const loadClasses = async () => {
    try {
      setLoadingClasses(true)
      const response = await classesApi.list({
        campus_id: teacherCampusId,
        page: 1,
        page_size: 100,
      })
      setClasses(response.data)
    } catch (err: any) {
      console.error('Failed to load classes:', err)
      errorToast('Failed to load classes')
    } finally {
      setLoadingClasses(false)
    }
  }

  const loadSubjectsForClass = async (classId: string) => {
    try {
      setLoadingSubjects(true)
      const response = await subjectsApi.listForClass(classId)
      setAvailableSubjects(response.data)
    } catch (err: any) {
      console.error('Failed to load subjects:', err)
      errorToast('Failed to load subjects')
    } finally {
      setLoadingSubjects(false)
    }
  }

  const loadSubjectsForClasses = async () => {
    try {
      setLoadingSubjects(true)
      // Load subjects for each selected class and combine unique subjects
      const subjectPromises = formData.class_ids.map(classId =>
        subjectsApi.listForClass(classId)
      )
      const subjectResponses = await Promise.all(subjectPromises)
      
      // Combine all subjects and remove duplicates
      const allSubjects: Subject[] = []
      const subjectIds = new Set<string>()
      
      subjectResponses.forEach(response => {
        response.data.forEach(subject => {
          if (!subjectIds.has(subject.id)) {
            subjectIds.add(subject.id)
            allSubjects.push(subject)
          }
        })
      })
      
      setAvailableSubjects(allSubjects)
      
      // Remove any selected subjects that are no longer available
      setFormData(prev => ({
        ...prev,
        subject_ids: prev.subject_ids.filter(id => subjectIds.has(id))
      }))
    } catch (err: any) {
      console.error('Failed to load subjects:', err)
      errorToast('Failed to load subjects')
    } finally {
      setLoadingSubjects(false)
    }
  }

  const checkConflicts = useCallback(async () => {
    if (!formData.start_date || formData.class_ids.length === 0 || formData.subject_ids.length === 0) {
      setConflicts([])
      return
    }

    try {
      setCheckingConflicts(true)
      const assignmentData: TeacherAssignmentCreate = {
        class_ids: formData.class_ids,
        subject_ids: formData.subject_ids,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        override_conflicts: false,
      }
      const result = await teachersApi.checkConflicts(teacherId, assignmentData)
      setConflicts(result.conflicts || [])
    } catch (err: any) {
      console.error('Failed to check conflicts:', err)
      // Don't show error toast for conflict checking failures
    } finally {
      setCheckingConflicts(false)
    }
  }, [teacherId, formData.class_ids, formData.subject_ids, formData.start_date, formData.end_date])

  const handleClassToggle = (classId: string) => {
    setFormData(prev => {
      const isSelected = prev.class_ids.includes(classId)
      return {
        ...prev,
        class_ids: isSelected
          ? prev.class_ids.filter(id => id !== classId)
          : [...prev.class_ids, classId],
      }
    })
  }

  const handleSubjectToggle = (subjectId: string) => {
    setFormData(prev => {
      const isSelected = prev.subject_ids.includes(subjectId)
      return {
        ...prev,
        subject_ids: isSelected
          ? prev.subject_ids.filter(id => id !== subjectId)
          : [...prev.subject_ids, subjectId],
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isAdjustMode) {
      // Adjust mode: only validate end_date
      if (formData.end_date && formData.end_date < formData.start_date) {
        errorToast('End date must be after start date')
        return
      }

      if (!assignment) {
        errorToast('Assignment data is missing')
        return
      }

      setLoading(true)
      try {
        // Pass null if end_date is empty, otherwise pass the date string
        const endDateParam = formData.end_date || null
        await teachersApi.updateAssignmentEndDate(teacherId, assignment.id, endDateParam)
        successToast('Assignment end date updated successfully')
        onAssignmentSuccess?.()
        onClose()
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to update assignment'
        errorToast(errorMsg)
      } finally {
        setLoading(false)
      }
      return
    }

    // Create mode: full validation
    if (formData.class_ids.length === 0) {
      errorToast('Please select at least one class')
      return
    }

    if (formData.subject_ids.length === 0) {
      errorToast('Please select at least one subject')
      return
    }

    if (!formData.start_date) {
      errorToast('Start date is required')
      return
    }

    if (formData.end_date && formData.end_date < formData.start_date) {
      errorToast('End date must be after start date')
      return
    }

    if (conflicts.length > 0) {
      errorToast('Please resolve conflicts before submitting')
      return
    }

    setLoading(true)
    try {
      const assignmentData: TeacherAssignmentCreate = {
        class_ids: formData.class_ids,
        subject_ids: formData.subject_ids,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        override_conflicts: false,
      }

      await teachersApi.createAssignment(teacherId, assignmentData)
      successToast('Assignment created successfully')
      onAssignmentSuccess?.()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to create assignment'
      errorToast(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleOverride = async () => {
    if (formData.class_ids.length === 0 || formData.subject_ids.length === 0 || !formData.start_date) {
      return
    }

    setLoading(true)
    try {
      const assignmentData: TeacherAssignmentCreate = {
        class_ids: formData.class_ids,
        subject_ids: formData.subject_ids,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        override_conflicts: true,
      }

      await teachersApi.createAssignment(teacherId, assignmentData)
      successToast('Assignment created successfully (conflicting assignments ended)')
      onAssignmentSuccess?.()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to create assignment'
      errorToast(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Active (no end date)'
    return new Date(dateString).toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {isAdjustMode ? 'Adjust Assignment End Date' : 'Assign Teacher to Classes'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">{teacherName}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-6">
            {/* Class Selection - Read-only in adjust mode */}
            {!isAdjustMode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Classes <span className="text-red-500">*</span>
                  </label>
                  {loadingClasses ? (
                    <div className="text-sm text-gray-500">Loading classes...</div>
                  ) : classes.length === 0 ? (
                    <div className="text-sm text-gray-500">No classes available</div>
                  ) : (
                    <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {classes.map((cls) => (
                          <label key={cls.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={formData.class_ids.includes(cls.id)}
                              onChange={() => handleClassToggle(cls.id)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-900">{cls.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Subject Selection - Read-only in adjust mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subjects <span className="text-red-500">*</span>
                  </label>
                  {formData.class_ids.length === 0 ? (
                    <div className="text-sm text-gray-500">Select classes first to see available subjects</div>
                  ) : loadingSubjects ? (
                    <div className="text-sm text-gray-500">Loading subjects...</div>
                  ) : availableSubjects.length === 0 ? (
                    <div className="text-sm text-gray-500">No subjects available for selected classes</div>
                  ) : (
                    <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {availableSubjects.map((subject) => (
                          <label key={subject.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={formData.subject_ids.includes(subject.id)}
                              onChange={() => handleSubjectToggle(subject.id)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-900">{subject.name}</span>
                            {subject.code && (
                              <span className="text-xs text-gray-500">({subject.code})</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Show assignment details in adjust mode */}
            {isAdjustMode && assignment && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Class:</span>
                  <span className="ml-2 text-gray-900">{assignment.class.name}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Subjects:</span>
                  <span className="ml-2 text-gray-900">{assignment.subjects.map(s => s.name).join(', ')}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Start Date:</span>
                  <span className="ml-2 text-gray-900">{new Date(assignment.start_date).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {/* Date Fields */}
            <div className="grid grid-cols-2 gap-4">
              {!isAdjustMode && (
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}
              <div className={isAdjustMode ? 'col-span-2' : ''}>
                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date <span className="text-xs text-gray-500">(optional)</span>
                </label>
                <input
                  type="date"
                  id="end_date"
                  value={formData.end_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value || null }))}
                  min={formData.start_date}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for active assignment</p>
              </div>
            </div>

            {/* Conflict Warning */}
            {checkingConflicts && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">Checking for conflicts...</p>
              </div>
            )}

            {!checkingConflicts && conflicts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">Conflicts Detected</h3>
                <p className="text-sm text-amber-800 mb-3">
                  Other teachers are already assigned to some of these class/subject combinations:
                </p>
                <div className="space-y-2 mb-4">
                  {conflicts.map((conflict, idx) => (
                    <div key={idx} className="bg-white rounded p-2 text-sm">
                      <div className="font-medium text-gray-900">
                        {conflict.class_name} - {conflict.subject_name}
                      </div>
                      <div className="text-gray-600 mt-1">
                        Currently assigned to: <span className="font-medium">{conflict.existing_teacher_name}</span>
                      </div>
                      <div className="text-gray-600 text-xs mt-1">
                        Existing: {formatDate(conflict.existing_start_date)} to {formatDate(conflict.existing_end_date)}
                      </div>
                      <div className="text-gray-600 text-xs">
                        New: {formatDate(conflict.new_start_date)} to {formatDate(conflict.new_end_date)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleOverride}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    Override (End Conflicting Assignments)
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!isAdjustMode && (conflicts.length > 0 || formData.class_ids.length === 0 || formData.subject_ids.length === 0 || !formData.start_date))}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? (isAdjustMode ? 'Updating...' : 'Creating...') : (isAdjustMode ? 'Update End Date' : 'Create Assignment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TeacherAssignmentModal

