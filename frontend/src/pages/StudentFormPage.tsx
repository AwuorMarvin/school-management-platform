import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { studentsApi, StudentCreate, StudentUpdate } from '../api/students'
import { campusesApi, Campus } from '../api/campuses'
import { academicYearsApi, AcademicYear } from '../api/academicYears'
import { termsApi, Term } from '../api/terms'
import { classesApi, Class } from '../api/classes'
import { clubActivitiesApi, ClubActivity } from '../api/clubActivities'
import { transportRoutesApi, TransportRoute } from '../api/transportRoutes'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { getErrorMessage } from '../utils/errorHandler'

interface ParentFormData {
  first_name: string
  last_name: string
  phone_number: string
  email: string
  id_number: string
}

const StudentFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [loadingCampuses, setLoadingCampuses] = useState(false)
  const [loadingAcademicYears, setLoadingAcademicYears] = useState(false)
  const [loadingTerms, setLoadingTerms] = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingClubActivities, setLoadingClubActivities] = useState(false)
  const [loadingTransportRoutes, setLoadingTransportRoutes] = useState(false)
  const errorToast = useToastStore((state) => state.error)
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [clubActivities, setClubActivities] = useState<ClubActivity[]>([])
  const [transportRoutes, setTransportRoutes] = useState<TransportRoute[]>([])
  
  const [formData, setFormData] = useState({
    campus_id: '',
    class_id: '',
    academic_year_id: '',
    term_id: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    status: 'ACTIVE',
    club_activity_ids: [] as string[],
    transport_route_id: '',
    transport_type: 'TWO_WAY' as 'ONE_WAY' | 'TWO_WAY',
    father: {
      first_name: '',
      last_name: '',
      phone_number: '',
      email: '',
      id_number: '',
    } as ParentFormData,
    mother: {
      first_name: '',
      last_name: '',
      phone_number: '',
      email: '',
      id_number: '',
    } as ParentFormData,
    guardian: {
      first_name: '',
      last_name: '',
      phone_number: '',
      email: '',
      id_number: '',
    } as ParentFormData,
  })

  useEffect(() => {
    if (!isEdit) {
      loadCampuses()
      loadAcademicYears()
      // Auto-set campus if user has only one campus
      if (user?.campus_id && user.role === 'CAMPUS_ADMIN') {
        setFormData(prev => ({ ...prev, campus_id: user.campus_id! }))
      }
    } else if (id) {
      loadStudent()
    }
  }, [id, isEdit, user])

  // Load terms when academic_year_id changes
  useEffect(() => {
    if (!isEdit && formData.academic_year_id) {
      loadTerms(formData.academic_year_id)
    }
  }, [formData.academic_year_id, isEdit])

  // Load classes when campus_id and academic_year_id change
  useEffect(() => {
    if (!isEdit && formData.campus_id && formData.academic_year_id) {
      loadClasses(formData.campus_id, formData.academic_year_id)
    }
  }, [formData.campus_id, formData.academic_year_id, isEdit])

  // Load club activities and transport routes when term_id changes
  useEffect(() => {
    if (!isEdit && formData.term_id) {
      loadClubActivities(formData.term_id)
      loadTransportRoutes()
    }
  }, [formData.term_id, isEdit])

  const loadCampuses = async () => {
    try {
      setLoadingCampuses(true)
      const response = await campusesApi.list()
      setCampuses(response.data)
      
      // Auto-select campus if only one
      if (response.data.length === 1) {
        setFormData(prev => ({ ...prev, campus_id: response.data[0].id }))
      } else if (user?.campus_id && user.role === 'CAMPUS_ADMIN') {
        // CAMPUS_ADMIN with single campus
        setFormData(prev => ({ ...prev, campus_id: user.campus_id! }))
      }
    } catch (err: any) {
      console.error('Failed to load campuses:', err)
    } finally {
      setLoadingCampuses(false)
    }
  }

  const loadAcademicYears = async () => {
    try {
      setLoadingAcademicYears(true)
      const response = await academicYearsApi.list({ page_size: 100 })
      // Filter to only active academic years
      const activeYears = response.data.filter(ay => {
        const today = new Date()
        const startDate = new Date(ay.start_date)
        const endDate = new Date(ay.end_date)
        return startDate <= today && today <= endDate
      })
      setAcademicYears(activeYears)
      
      // Auto-select if only one active academic year
      if (activeYears.length === 1) {
        setFormData(prev => ({ ...prev, academic_year_id: activeYears[0].id }))
      }
    } catch (err: any) {
      console.error('Failed to load academic years:', err)
    } finally {
      setLoadingAcademicYears(false)
    }
  }

  const loadTerms = async (academicYearId: string) => {
    try {
      setLoadingTerms(true)
      const response = await termsApi.list({ academic_year_id: academicYearId, page_size: 100 })
      // Filter to only active terms
      const activeTerms = response.data.filter(term => {
        const today = new Date()
        const startDate = new Date(term.start_date)
        const endDate = new Date(term.end_date)
        return startDate <= today && today <= endDate
      })
      setTerms(activeTerms)
      
      // Reset term_id if current selection is not in the new list
      setFormData(prev => {
        if (prev.term_id && !activeTerms.find(t => t.id === prev.term_id)) {
          return { ...prev, term_id: '' }
        }
        return prev
      })
      
      // Auto-select if only one active term
      if (activeTerms.length === 1) {
        setFormData(prev => ({ ...prev, term_id: activeTerms[0].id }))
      }
    } catch (err: any) {
      console.error('Failed to load terms:', err)
    } finally {
      setLoadingTerms(false)
    }
  }

  const loadClasses = async (campusId: string, academicYearId: string) => {
    try {
      setLoadingClasses(true)
      const response = await classesApi.list({ 
        campus_id: campusId, 
        academic_year_id: academicYearId,
        page_size: 100 
      })
      setClasses(response.data)
      
      // Reset class_id if current selection is not in the new list
      setFormData(prev => {
        if (prev.class_id && !response.data.find(c => c.id === prev.class_id)) {
          return { ...prev, class_id: '' }
        }
        return prev
      })
    } catch (err: any) {
      console.error('Failed to load classes:', err)
    } finally {
      setLoadingClasses(false)
    }
  }

  const loadClubActivities = async (termId: string) => {
    try {
      setLoadingClubActivities(true)
      const response = await clubActivitiesApi.list({
        term_id: termId,
        page_size: 100,
      })
      setClubActivities(response.data)
    } catch (err: any) {
      console.error('Failed to load club activities:', err)
    } finally {
      setLoadingClubActivities(false)
    }
  }

  const loadTransportRoutes = async () => {
    try {
      setLoadingTransportRoutes(true)
      const response = await transportRoutesApi.list({ page_size: 100 })
      setTransportRoutes(response.data)
    } catch (err: any) {
      console.error('Failed to load transport routes:', err)
    } finally {
      setLoadingTransportRoutes(false)
    }
  }

  const loadStudent = async () => {
    try {
      setLoading(true)
      const student = await studentsApi.get(id!)
      setFormData((prev) => ({
        ...prev,
        campus_id: student.campus_id,
        first_name: student.first_name,
        middle_name: student.middle_name || '',
        last_name: student.last_name,
        date_of_birth: student.date_of_birth,
        status: student.status,
      }))
    } catch (err: any) {
      errorToast(err.response?.data?.message || 'Failed to load student')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate at least one parent is provided (for new students)
    if (!isEdit) {
      // Validate required fields
      if (!formData.class_id) {
        errorToast('Class is required')
        return
      }
      if (!formData.academic_year_id) {
        errorToast('Academic Year is required')
        return
      }
      if (!formData.term_id) {
        errorToast('Term is required')
        return
      }

      const hasFather = formData.father.first_name || formData.father.last_name || formData.father.phone_number || formData.father.email || formData.father.id_number
      const hasMother = formData.mother.first_name || formData.mother.last_name || formData.mother.phone_number || formData.mother.email || formData.mother.id_number
      const hasGuardian = formData.guardian.first_name || formData.guardian.last_name || formData.guardian.phone_number || formData.guardian.email || formData.guardian.id_number
      
      if (!hasFather && !hasMother && !hasGuardian) {
        errorToast('At least one parent (father, mother, or guardian) must be provided')
        return
      }
      
      // Validate that if a parent section is started, required fields are filled
      if (hasFather && (!formData.father.phone_number || !formData.father.email || !formData.father.id_number)) {
        errorToast('Father: Phone number, email, and ID number are required if father information is provided')
        return
      }
      if (hasMother && (!formData.mother.phone_number || !formData.mother.email || !formData.mother.id_number)) {
        errorToast('Mother: Phone number, email, and ID number are required if mother information is provided')
        return
      }
      if (hasGuardian && (!formData.guardian.phone_number || !formData.guardian.email || !formData.guardian.id_number)) {
        errorToast('Guardian: Phone number, email, and ID number are required if guardian information is provided')
        return
      }
    }
    
    setLoading(true)

    try {
      if (isEdit && id) {
        // Update student (no parent changes in edit mode)
        const data: StudentUpdate = {
          campus_id: formData.campus_id,
          first_name: formData.first_name,
          middle_name: formData.middle_name || undefined,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth,
        }
        await studentsApi.update(id, data)
      } else {
        // Create student with parents
        const data: StudentCreate = {
          campus_id: formData.campus_id,
          class_id: formData.class_id,
          academic_year_id: formData.academic_year_id,
          term_id: formData.term_id,
          first_name: formData.first_name,
          middle_name: formData.middle_name || undefined,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth,
          status: formData.status,
          father: formData.father.first_name ? {
            first_name: formData.father.first_name,
            last_name: formData.father.last_name,
            phone_number: formData.father.phone_number,
            email: formData.father.email,
            id_number: formData.father.id_number,
          } : undefined,
          mother: formData.mother.first_name ? {
            first_name: formData.mother.first_name,
            last_name: formData.mother.last_name,
            phone_number: formData.mother.phone_number,
            email: formData.mother.email,
            id_number: formData.mother.id_number,
          } : undefined,
          guardian: formData.guardian.first_name ? {
            first_name: formData.guardian.first_name,
            last_name: formData.guardian.last_name,
            phone_number: formData.guardian.phone_number,
            email: formData.guardian.email,
            id_number: formData.guardian.id_number,
          } : undefined,
        }
        await studentsApi.create(data)
      }

      const successToast = useToastStore.getState().success
      successToast(isEdit ? 'Student updated successfully' : 'Student created successfully')
      setTimeout(() => {
        navigate('/students')
      }, 500) // Small delay to show toast
    } catch (err: any) {
      errorToast(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleParentChange = (parentType: 'father' | 'mother' | 'guardian', field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [parentType]: {
        ...prev[parentType],
        [field]: value,
      },
    }))
  }

  const showCampusSelector = campuses.length > 1 || (user?.role === 'SCHOOL_ADMIN' && campuses.length > 0)
  const selectedCampus = campuses.find(c => c.id === formData.campus_id)

  if (loading && isEdit) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading student...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? 'Edit Student' : 'Add New Student'}
        subtitle={isEdit ? 'Update student information' : 'Create a new student record with parent information'}
        action={
          <div className="flex items-center gap-2">
            <BackButton to="/students" />
            <Link
              to="/students"
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            >
              Cancel
            </Link>
          </div>
        }
      />

      <div className="p-8">
        <ContentCard>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Student Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label htmlFor="middle_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    id="middle_name"
                    name="middle_name"
                    value={formData.middle_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter middle name (optional)"
                  />
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Enter last name"
                  />
                </div>

                <div>
                  <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="date_of_birth"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    required
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  />
                </div>

                {/* Campus Selector */}
                {!isEdit && (
                  <>
                    {showCampusSelector ? (
                      <div>
                        <label htmlFor="campus_id" className="block text-sm font-medium text-gray-700 mb-2">
                          Campus <span className="text-error-500">*</span>
                        </label>
                        <select
                          id="campus_id"
                          name="campus_id"
                          value={formData.campus_id}
                          onChange={handleChange}
                          required
                          disabled={loadingCampuses}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                        >
                          <option value="">Select Campus</option>
                          {campuses.map((campus) => (
                            <option key={campus.id} value={campus.id}>
                              {campus.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Campus
                        </label>
                        <input
                          type="text"
                          value={selectedCampus?.name || 'Loading...'}
                          disabled
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                        />
                        <input
                          type="hidden"
                          name="campus_id"
                          value={formData.campus_id}
                        />
                      </div>
                    )}

                    <div>
                      <label htmlFor="academic_year_id" className="block text-sm font-medium text-gray-700 mb-2">
                        Academic Year <span className="text-error-500">*</span>
                      </label>
                      <select
                        id="academic_year_id"
                        name="academic_year_id"
                        value={formData.academic_year_id}
                        onChange={handleChange}
                        required
                        disabled={loadingAcademicYears}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                      >
                        <option value="">Select Academic Year</option>
                        {academicYears.map((ay) => (
                          <option key={ay.id} value={ay.id}>
                            {ay.name}
                          </option>
                        ))}
                      </select>
                    </div>

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
                        disabled={loadingTerms || !formData.academic_year_id}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                      >
                        <option value="">{formData.academic_year_id ? 'Select Term' : 'Select Academic Year first'}</option>
                        {terms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="class_id" className="block text-sm font-medium text-gray-700 mb-2">
                        Class <span className="text-error-500">*</span>
                      </label>
                      <select
                        id="class_id"
                        name="class_id"
                        value={formData.class_id}
                        onChange={handleChange}
                        required
                        disabled={loadingClasses || !formData.campus_id || !formData.academic_year_id}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                      >
                        <option value="">{formData.campus_id && formData.academic_year_id ? 'Select Class' : 'Select Campus and Academic Year first'}</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                        Initial Status
                      </label>
                      <select
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Clubs & Activities and Transport - Only for new students */}
            {!isEdit && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Clubs/Activities & Transport (Optional)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="transport_route_id" className="block text-sm font-medium text-gray-700 mb-2">
                      Transport Route
                    </label>
                    <select
                      id="transport_route_id"
                      name="transport_route_id"
                      value={formData.transport_route_id}
                      onChange={handleChange}
                      disabled={loadingTransportRoutes}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100"
                    >
                      <option value="">No transport</option>
                      {transportRoutes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.zone} - One way: KES {parseFloat(route.one_way_cost_per_term).toLocaleString()} / Two way: KES{' '}
                          {parseFloat(route.two_way_cost_per_term).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-gray-700 mb-2">Transport Type</span>
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="transport_type"
                          value="ONE_WAY"
                          checked={formData.transport_type === 'ONE_WAY'}
                          onChange={handleChange}
                          disabled={!formData.transport_route_id}
                          className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                        />
                        <span>One way</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="transport_type"
                          value="TWO_WAY"
                          checked={formData.transport_type === 'TWO_WAY'}
                          onChange={handleChange}
                          disabled={!formData.transport_route_id}
                          className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                        />
                        <span>Two way</span>
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      If no option is selected but a route is chosen, the system assumes Two way.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Clubs & Extra Curricular Activities
                    </label>
                    {loadingClubActivities ? (
                      <div className="text-sm text-gray-500">Loading activities...</div>
                    ) : !formData.term_id ? (
                      <div className="text-sm text-gray-500">Select a term first</div>
                    ) : clubActivities.length === 0 ? (
                      <div className="text-sm text-gray-500">No activities available for this term</div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                        {clubActivities.map((activity) => (
                          <label
                            key={activity.id}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.club_activity_ids.includes(activity.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    club_activity_ids: [...prev.club_activity_ids, activity.id]
                                  }))
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    club_activity_ids: prev.club_activity_ids.filter(id => id !== activity.id)
                                  }))
                                }
                              }}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700 flex-1">
                              {activity.service_name}
                              <span className="text-gray-500 ml-2">
                                ({activity.activity_type === 'CLUB' ? 'Club' : 'Extra Curricular'})
                              </span>
                            </span>
                            <span className="text-sm text-gray-600 font-medium">
                              KES {parseFloat(activity.cost_per_term).toLocaleString()}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    {formData.club_activity_ids.length > 0 && (
                      <p className="mt-2 text-sm text-gray-600">
                        {formData.club_activity_ids.length} activit{formData.club_activity_ids.length !== 1 ? 'ies' : 'y'} selected
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Parent Information - Only for new students */}
            {!isEdit && (
              <>
                {/* Father */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Father Information (Optional)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['first_name', 'last_name', 'phone_number', 'email', 'id_number'] as const).map((field) => {
                      const hasAnyField = formData.father.first_name || formData.father.last_name || formData.father.phone_number || formData.father.email || formData.father.id_number
                      const isRequired = hasAnyField && (field === 'phone_number' || field === 'email' || field === 'id_number')
                      return (
                        <div key={field}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            {isRequired && <span className="text-error-500">*</span>}
                          </label>
                          <input
                            type={field === 'email' ? 'email' : field === 'phone_number' ? 'tel' : 'text'}
                            value={formData.father[field]}
                            onChange={(e) => handleParentChange('father', field, e.target.value)}
                            required={!!isRequired}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                            placeholder={`Enter ${field.replace('_', ' ')}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Mother */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Mother Information (Optional)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['first_name', 'last_name', 'phone_number', 'email', 'id_number'] as const).map((field) => {
                      const hasAnyField = formData.mother.first_name || formData.mother.last_name || formData.mother.phone_number || formData.mother.email || formData.mother.id_number
                      const isRequired = hasAnyField && (field === 'phone_number' || field === 'email' || field === 'id_number')
                      return (
                        <div key={field}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            {isRequired && <span className="text-error-500">*</span>}
                          </label>
                          <input
                            type={field === 'email' ? 'email' : field === 'phone_number' ? 'tel' : 'text'}
                            value={formData.mother[field]}
                            onChange={(e) => handleParentChange('mother', field, e.target.value)}
                            required={!!isRequired}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                            placeholder={`Enter ${field.replace('_', ' ')}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Guardian */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Guardian Information (Optional)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['first_name', 'last_name', 'phone_number', 'email', 'id_number'] as const).map((field) => {
                      const hasAnyField = formData.guardian.first_name || formData.guardian.last_name || formData.guardian.phone_number || formData.guardian.email || formData.guardian.id_number
                      const isRequired = hasAnyField && (field === 'phone_number' || field === 'email' || field === 'id_number')
                      return (
                        <div key={field}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            {isRequired && <span className="text-error-500">*</span>}
                          </label>
                          <input
                            type={field === 'email' ? 'email' : field === 'phone_number' ? 'tel' : 'text'}
                            value={formData.guardian[field]}
                            onChange={(e) => handleParentChange('guardian', field, e.target.value)}
                            required={!!isRequired}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                            placeholder={`Enter ${field.replace('_', ' ')}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                to="/students"
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Student' : 'Create Student'}
              </button>
            </div>
          </form>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default StudentFormPage
