import { useEffect, useState } from 'react'
import AppLayout from '../../components/AppLayout'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import ContentCard from '../../components/ContentCard'
import { useAuthStore } from '../../store/authStore'
import { studentsApi, Student } from '../../api/students'

const TeacherDashboard = () => {
  const { user } = useAuthStore()
  const [myChildren, setMyChildren] = useState<Student[]>([])
  const [pendingFees, setPendingFees] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      // TODO: Load only students in classes assigned to this teacher
      const response = await studentsApi.list({ skip: 0, limit: 100 })
      setMyChildren(response.data)
      // TODO: Calculate pending fees from fees API
      setPendingFees(0)
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount)
  }

  const getCurrentMonthYear = () => {
    const now = new Date()
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        subtitle={`Overview for ${getCurrentMonthYear()}. Welcome, ${user?.first_name} ${user?.last_name}!`}
      />

      <div className="p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <StatCard
            title="My Students"
            value={myChildren.length}
            subtitle="Students in my classes"
            icon={<span className="text-2xl">👥</span>}
            valueColor="primary"
          />
          <StatCard
            title="Pending Fees"
            value={formatCurrency(pendingFees)}
            subtitle="Unpaid fees"
            icon={<span className="text-2xl">💰</span>}
            valueColor="error"
            link="/fee-status"
            linkText="View Details"
          />
        </div>

        {/* My Students */}
        <ContentCard
          title="My Students"
          subtitle="Students in classes assigned to you"
        >
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          ) : myChildren.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No students assigned to your classes.</p>
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
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {myChildren.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.first_name} {student.middle_name || ''} {student.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        N/A
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

export default TeacherDashboard

