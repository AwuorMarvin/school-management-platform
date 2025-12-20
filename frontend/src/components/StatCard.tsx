import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  borderColor?: 'green' | 'red' | 'blue' | 'purple' | 'default'
  link?: string
  linkText?: string
}

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  borderColor = 'default',
  link,
  linkText 
}: StatCardProps) => {
  const borderColorClasses = {
    green: 'border-l-green-500',
    red: 'border-l-red-500',
    blue: 'border-l-blue-500',
    purple: 'border-l-purple-500',
    default: 'border-l-gray-300'
  }

  const content = (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 ${borderColorClasses[borderColor]} border-t border-r border-b border-gray-200 p-6`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
          {link && linkText && (
            <Link
              to={link}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-2 inline-block"
            >
              {linkText} →
            </Link>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 ml-4 text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  )

  return content
}

export default StatCard

