import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import ContentCard from '../components/ContentCard'
import StatusBadge from '../components/StatusBadge'
import { useAuthStore } from '../store/authStore'
import { studentsApi, Student } from '../api/students'
import { teachersApi } from '../api/teachers'
import { feeSummaryApi } from '../api/feeSummary'
import ParentDashboard from './dashboards/ParentDashboard'
import TeacherDashboard from './dashboards/TeacherDashboard'
import { Users, UserCircle2, Users2, DollarSign, Eye, MoreVertical } from 'lucide-react'
import FeePerformancePerClassChart from '../components/FeePerformancePerClassChart'
import FeePerformancePerTermChart from '../components/FeePerformancePerTermChart'

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
    studentTeacherRatio: '0:0',
  })
  const [loading, setLoading] = useState(true)
  const [recentStudents, setRecentStudents] = useState<Student[]>([])
  const [feeStats, setFeeStats] = useState({
    expected: 0,
    paid: 0,
    pending: 0,
    collectionRate: 0,
  })

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
      const teachersResponse = await teachersApi.list({
        page: 1,
        page_size: 100,
        status: 'ACTIVE',
        campus_id: user?.campus_id || undefined,
      })
      const activeTeachers = teachersResponse.data
      
      // Get recent students (all, then filter for active, sorted by created_at desc)
      const recentActiveStudents = allStudentsResponse.data
        .filter(s => s.status === 'ACTIVE')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
      
      // Load fee summary for current term
      let expectedFees = 0
      let paidFees = 0
      let pendingFees = 0
      let collectionRate = 0
      try {
        const feeSummaryResponse = await feeSummaryApi.getCampusSummary({
          campus_id: user?.campus_id || undefined
        })
        expectedFees = feeSummaryResponse.summary.total_expected || 0
        paidFees = feeSummaryResponse.summary.total_paid || 0
        pendingFees = feeSummaryResponse.summary.total_pending || 0
        collectionRate = feeSummaryResponse.summary.payment_rate ?? (
          expectedFees > 0 ? (paidFees / expectedFees) * 100 : 0
        )
      } catch (feeErr: any) {
        console.error('Failed to load fee summary:', feeErr)
        // Continue with 0s if fees API fails
      }
      
      // Calculate ratio
      const ratio = activeTeachers.length > 0 
        ? `${Math.round(activeStudents.length / activeTeachers.length)}:1`
        : '0:0'
      
      setStats({
        activeStudents: activeStudents.length,
        activeTeachers: activeTeachers.length,
        activeParents: 0, // Not needed for current cards
        studentTeacherRatio: ratio,
      })
      setFeeStats({
        expected: expectedFees,
        paid: paidFees,
        pending: pendingFees,
        collectionRate,
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

  const getPaymentRateTextColor = (rate: number) => {
    if (rate >= 81) return 'text-green-700'
    if (rate >= 41) return 'text-yellow-700'
    return 'text-red-700'
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
            link="/teachers"
            linkText="View Details"
          />
          <StatCard
            title="Student Teacher Ratio"
            value={stats.studentTeacherRatio}
            subtitle="Average ratio"
            icon={<Users2 className="w-6 h-6" />}
            borderColor="purple"
          />
          <StatCard
            title="Fee Collection"
            value={`${feeStats.collectionRate.toFixed(1)}%`}
            subtitle={`Expected this term: ${formatCurrency(feeStats.expected)}`}
            secondaryText={`Paid this term: ${formatCurrency(feeStats.paid)}`}
            icon={<DollarSign className="w-6 h-6" />}
            borderColor="red"
            link="/fee-status"
            linkText="View Details"
            valueClassName={getPaymentRateTextColor(feeStats.collectionRate)}
          />
        </div>

        {/* Recent Students */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ContentCard title="Fee Performance per Class">
            <FeePerformancePerClassChart />
          </ContentCard>
          <ContentCard title="Fee Performance per Term">
            <FeePerformancePerTermChart />
          </ContentCard>
        </div>
      </div>
    </AppLayout>
  )
}

export default DashboardPage
