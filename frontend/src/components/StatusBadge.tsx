interface StatusBadgeProps {
  status: string
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default'
  className?: string
}

const StatusBadge = ({ status, variant = 'default', className = '' }: StatusBadgeProps) => {
  const variantClasses = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-orange-100 text-orange-800 border-orange-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    default: 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <span
      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${variantClasses[variant]} ${className}`}
    >
      {status}
    </span>
  )
}

export default StatusBadge

