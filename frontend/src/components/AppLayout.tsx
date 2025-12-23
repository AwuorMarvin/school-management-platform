import { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/auth'
import { 
  LayoutDashboard, 
  Users, 
  UserCircle2, 
  DollarSign, 
  ClipboardList,
  Calendar,
  CalendarDays,
  Building2,
  BookOpen,
  Target,
  Bus,
  Megaphone,
  FileText,
  Settings,
  MoreVertical
} from 'lucide-react'

interface AppLayoutProps {
  children: ReactNode
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  const handleLogout = async () => {
    const refreshToken = useAuthStore.getState().refreshToken
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken)
      } catch (err) {
        console.error('Logout error:', err)
      }
    }
    clearAuth()
    navigate('/login')
  }

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  // Role-specific navigation items
  const getNavigationItems = () => {
    const role = user?.role

    if (role === 'PARENT') {
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/fee-status', label: 'Fee Status', icon: DollarSign },
        { path: '/fee-structures', label: 'Fee Structures', icon: ClipboardList },
        { path: '/performance', label: 'Performance', icon: ClipboardList },
        { path: '/announcements', label: 'Announcements', icon: Megaphone },
        { path: '/notice-board', label: 'Notice Board', icon: FileText },
      ]
    }

    if (role === 'TEACHER') {
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/fee-status', label: 'Fee Status', icon: DollarSign },
        { path: '/fee-structures', label: 'Fee Structures', icon: ClipboardList },
        { path: '/performance', label: 'Performance', icon: ClipboardList },
        { path: '/announcements', label: 'Announcements', icon: Megaphone },
        { path: '/notice-board', label: 'Notice Board', icon: FileText },
      ]
    }

    // SCHOOL_ADMIN, CAMPUS_ADMIN, SUPER_ADMIN
    return [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/students', label: 'Students', icon: Users },
      { path: '/parents', label: 'Parents', icon: UserCircle2 },
      { path: '/performance', label: 'Performance', icon: ClipboardList },
      { path: '/teachers', label: 'Teachers', icon: UserCircle2 },
      { path: '/fee-status', label: 'Fee Status', icon: DollarSign },
      { path: '/fee-structures', label: 'Fee Structures', icon: ClipboardList },
      { path: '/academic-years', label: 'Academic Years', icon: Calendar },
      { path: '/terms', label: 'Terms', icon: CalendarDays },
      { path: '/classes', label: 'Classes', icon: Building2 },
      { path: '/subjects', label: 'Subjects/Units', icon: BookOpen },
      { path: '/club-activities', label: 'Clubs & Extra Curricular', icon: Target },
      { path: '/transport-routes', label: 'Transport Routes', icon: Bus },
    ]
  }

  const navigationItems = getNavigationItems()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <span className="font-semibold text-gray-900">School Management</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const IconComponent = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-primary-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-2 py-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold flex-shrink-0">
                  {user?.first_name?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}

export default AppLayout
