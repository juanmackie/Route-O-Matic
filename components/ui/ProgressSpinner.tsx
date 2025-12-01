'use client'

interface ProgressSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'accent'
  ariaLabel?: string
}

export default function ProgressSpinner({
  size = 'md',
  variant = 'primary',
  ariaLabel = 'Loading...'
}: ProgressSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const colorClasses = {
    primary: 'border-blue-600',
    secondary: 'border-gray-600',
    accent: 'border-green-600'
  }

  return (
    <div className="flex items-center justify-center">
      <div
        role="status"
        aria-label={ariaLabel}
        className={`
          animate-spin rounded-full
          border-2 border-gray-300
          ${colorClasses[variant]}
          border-t-transparent
          ${sizeClasses[size]}
        `}
      />
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}
