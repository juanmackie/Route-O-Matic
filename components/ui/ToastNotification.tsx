'use client'

import { useEffect, useState } from 'react'

interface ToastNotificationProps {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
  onClose: () => void
}

export default function ToastNotification({
  message,
  type = 'info',
  duration = 3000,
  onClose
}: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger show animation
    setTimeout(() => setIsVisible(true), 10)

    // Auto-close after duration
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Wait for exit animation
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const bgClasses = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`
          ${bgClasses[type]}
          text-white
          px-4 py-3
          rounded-lg
          shadow-lg
          min-w-[200px]
          transition-all duration-300
          ${isVisible ? 'toast-enter' : 'toast-exit'}
        `}
      >
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  )
}
