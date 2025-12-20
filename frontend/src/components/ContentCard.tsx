import { ReactNode } from 'react'

interface ContentCardProps {
  title?: string
  subtitle?: string
  children: ReactNode
  headerAction?: ReactNode
  className?: string
}

const ContentCard = ({ title, subtitle, children, headerAction, className = '' }: ContentCardProps) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {(title || subtitle || headerAction) && (
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}

export default ContentCard

