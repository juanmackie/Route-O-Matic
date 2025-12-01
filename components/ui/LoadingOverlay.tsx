'use client'

import { ReactNode } from 'react'
import ProgressSpinner from './ProgressSpinner'

interface LoadingOverlayProps {
  isLoading: boolean
  children: ReactNode
  message?: string
  subMessage?: string
  spinnerSize?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary'
  className?: string
}

export default function LoadingOverlay({
  isLoading,
  children,
  message,
  subMessage,
  spinnerSize = 'lg',
  variant = 'primary',
  className = ''
}: LoadingOverlayProps) {
  return (
    <div className={`relative ${className}`}>
      {children}

      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center z-10 rounded-lg">
          <ProgressSpinner size={spinnerSize} variant={variant} ariaLabel={message || 'Loading'} />
          {message && (
            <p className="mt-4 text-gray-800 font-medium">
              {message}
            </p>
          )}
          {subMessage && (
            <p className="mt-1 text-gray-600 text-sm">
              {subMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
