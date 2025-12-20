import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import ContentCard from '../components/ContentCard'
import StatusBadge from '../components/StatusBadge'
import { useAuthStore } from '../store/authStore'
import { studentsApi, Student } from '../api/students'
import { usersApi } from '../api/users'
import { feeSummaryApi } from '../api/feeSummary'
import ParentDashboard from './dashboards/ParentDashboard'
import TeacherDashboard from './dashboards/TeacherDashboard'
import { Users, UserCircle2, Users2, DollarSign, Eye, MoreVertical } from 'lucide-react'

const DashboardPage = () => {
  const { user } = useAuthStore()

  // Route to role-specific dashboard
  if (user?.role === 'PARENT') {
    return <ParentDashboard />
  }

  if (user?.role === 'TEACHER') {
    return <TeacherDashboard />
  }

  // Admin dashboard (SCHOOL_ADMIN, CAMPUS_ADMIN, SUPER_ADMIN)
  const [stats, setStats] = useState({
    activeStudents: 0,
    activeTeachers: 0,
    activeParents: 0,
    pendingFees: 0,
    studentTeacherRatio: '0:0',
  })
  const [loading, setLoading] = useState(true)
  const [recentStudents, setRecentStudents] = useState<Student[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load all students first to ensure we get data
      const allStudentsResponse = await studentsApi.list({ skip: 0, limit: 1000 })
      // Filter for active students on frontend
      const activeStudents = allStudentsResponse.data.filter(s => s.status === 'ACTIVE')
      
      // Load teachers
      const teachersResponse = await usersApi.list({ 
        page: 1, 
        page_size: 1000, 
        role: 'TEACHER', 
        status: 'ACTIVE' 
      })
      const activeTeachers = teachersResponse.data.filter(t => t.status === 'ACTIVE')
      
      // Get recent students (all, then filter for active, sorted by created_at desc)
      const recentActiveStudents = allStudentsResponse.data
        .filter(s => s.status === 'ACTIVE')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
      
      // Load pending fees from fee summary
      let pendingFees = 0
      try {
        const feeSummaryResponse = await feeSummaryApi.getCampusSummary({
          campus_id: user?.campus_id || undefined
        })
        pendingFees = feeSummaryResponse.summary.total_pending || 0
      } catch (feeErr: any) {
        console.error('Failed to load fee summary:', feeErr)
        // Continue with 0 if fees API fails
      }
      
      // Calculate ratio
      const ratio = activeTeachers.length > 0 
        ? `${Math.round(activeStudents.length / activeTeachers.length)}:1`
        : '0:0'
      
      setStats({
        activeStudents: activeStudents.length,
        activeTeachers: activeTeachers.length,
        activeParents: 0, // Not needed for current cards
        pendingFees,
        studentTeacherRatio: ratio,
      })
      setRecentStudents(recentActiveStudents)
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
        title="Dashboard Overview"
        subtitle={`Welcome back, ${user?.first_name}!!!`}
      />

      <div className="p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Active Students"
            value={stats.activeStudents}
            subtitle="Students in campus"
            icon={<Users className="w-6 h-6" />}
            borderColor="green"
            link="/students"
            linkText="View Details"
          />
          <StatCard
            title="Active Teachers"
            value={stats.activeTeachers}
            subtitle="Teachers in campus"
            icon={<UserCircle2 className="w-6 h-6" />}
            borderColor="blue"
            link="/admin/members"
            linkText="View Details"
          />
          <StatCard
            title="Student Teacher Ratio"
            value={stats.studentTeacherRatio}
            subtitle="Average ratio"
            icon={<Users2 className="w-6 h-6" />}
            borderColor="purple"
            link="/students"
            linkText="View Details"
          />
          <StatCard
            title="Pending Fees"
            value={formatCurrency(stats.pendingFees)}
            subtitle="Unpaid fees"
            icon={<DollarSign className="w-6 h-6" />}
            borderColor="red"
            link="/fee-status"
            linkText="View Details"
          />
        </div>

        {/* Recent Students */}
        <ContentCard
          title="Recent Students"
          headerAction={
            <Link
              to="/students"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all students →
            </Link>
          }
        >
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          ) : recentStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No recent students found.</p>
              <Link
                to="/students/new"
                className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Add First Student
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date of Birth
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
                  {recentStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          #{student.id.toString().slice(0, 8).toUpperCase()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.first_name} {student.middle_name || ''} {student.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(student.date_of_birth).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge 
                          status={student.status === 'ACTIVE' ? 'Active' : student.status} 
                          variant={student.status === 'ACTIVE' ? 'success' : 'default'}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/students/${student.id}`}
                            className="text-gray-600 hover:text-primary-600"
                            title="View"
                          >
                            <Eye className="w-5 h-5" />
                          </Link>
                          <button
                            className="text-gray-600 hover:text-gray-900"
                            title="More options"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </div>
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

export default DashboardPage
