import { useState, useEffect } from 'react'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'
import BackButton from '../components/BackButton'
import { parentsApi, AllChildrenTeachersResponse } from '../api/parents'
import { Phone } from 'lucide-react'

const ParentTeachersPage = () => {
  const [data, setData] = useState<AllChildrenTeachersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTeachers()
  }, [])

  const loadTeachers = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await parentsApi.getAllTeachers()
      setData(response)
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || err.response?.data?.message || 'Failed to load teachers')
    } finally {
      setLoading(false)
    }
  }

  const formatPhoneNumber = (phone: string) => {
    return phone.replace(/(\+254)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading teachers...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <PageHeader title="Error" subtitle={error} />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">{error}</p>
              <button
                onClick={loadTeachers}
                className="mt-4 px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                Retry
              </button>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  if (!data || data.children.length === 0) {
    return (
      <AppLayout>
        <PageHeader
          title="My Children's Teachers"
          subtitle="Teachers teaching your children"
          action={<BackButton to="/dashboard" />}
        />
        <div className="p-8">
          <ContentCard>
            <div className="text-center py-8">
              <p className="text-gray-600">No teachers found. Your children may not be assigned to any classes yet.</p>
            </div>
          </ContentCard>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title="My Children's Teachers"
        subtitle="Teachers teaching your children"
        action={<BackButton to="/dashboard" />}
      />

      <div className="p-8">
        <div className="space-y-6">
          {data.children.map((childData) => (
            <ContentCard key={childData.child.id}>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {childData.child.name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Class: {childData.child.class.name}
                </p>
              </div>

              {childData.teachers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No teachers assigned to this class yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Teacher Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subjects Taught
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Students in Class
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {childData.teachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {teacher.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              <a
                                href={`tel:${teacher.phone_number}`}
                                className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
                              >
                                <Phone className="h-4 w-4" />
                                {formatPhoneNumber(teacher.phone_number)}
                              </a>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {teacher.subjects.map(s => s.name).join(', ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {teacher.students_in_class}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ContentCard>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

export default ParentTeachersPage

