'use client'

interface ProgressBarProps {
  value: number // 0-100
  variant?: 'primary' | 'secondary' | 'success'
  showPercentage?: boolean
  animated?: boolean
  height?: 'thin' | 'normal' | 'thick'
}

export default function ProgressBar({
  value,
  variant = 'primary',
  showPercentage = false,
  animated = true,
  height = 'normal'
}: ProgressBarProps) {
  const heightClasses = {
    thin: 'h-1',
    normal: 'h-2',
    thick: 'h-4'
  }

  const bgColorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600'
  }

  const gradientBgClasses = {
    primary: 'bg-blue-200',
    secondary: 'bg-gray-200',
    success: 'bg-green-200'
  }

  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={`w-full ${heightClasses[height]} ${gradientBgClasses[variant]} rounded-full overflow-hidden relative`}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedValue}
        className={`
          ${heightClasses[height]}
          ${bgColorClasses[variant]}
          rounded-full
          transition-all duration-300 ease-out
          ${animated ? '' : ''}
        `}
        style={{
          width: `${clampedValue}%`,
          transitionProperty: 'width',
          ...animated && {
            transitionTimingFunction: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
            transitionDuration: '300ms'
          }
        }}
      />
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-blue-900 drop-shadow-sm">
            {Math.round(clampedValue)}%
          </span>
        </div>
      )}
    </div>
  )
}
