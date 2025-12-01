'use client'

import { useState } from 'react'
import { OptimizedRoute, VisitStop } from '@/lib/types'
import { exportAndDownloadRoute } from '@/utilities/export-utils'
import ProgressSpinner from './ui/ProgressSpinner'

interface ResultsDisplayProps {
  route: OptimizedRoute
  onBack: () => void
  onReset: () => void
}

export default function ResultsDisplay({ route, onBack, onReset }: ResultsDisplayProps) {
  const [selectedStop, setSelectedStop] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
  }

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}min`
  }

  const getStatusColor = (status: VisitStop['status']) => {
    switch (status) {
      case 'on_time':
        return 'text-green-600'
      case 'early':
        return 'text-amber-600'
      case 'late':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusBgColor = (status: VisitStop['status']) => {
    switch (status) {
      case 'on_time':
        return 'bg-green-100'
      case 'early':
        return 'bg-amber-100'
      case 'late':
        return 'bg-red-100'
      default:
        return 'bg-gray-100'
    }
  }

  const handleExport = () => {
    setExporting(true)
    try {
      exportAndDownloadRoute(route)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              Optimized Route - {route.routeDate}
            </h2>
            <p className="text-gray-600 mt-1">
              {route.stops.length} stops optimized successfully
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors flex items-center space-x-2"
            >
              {exporting ? (
                <>
                  <ProgressSpinner size="sm" variant="primary" ariaLabel="Exporting" />
                  <span>Exporting...</span>
                </>
              ) : (
                <span>Export CSV</span>
              )}
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              New Route
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Distance</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatDistance(route.totalDistance)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Drive Time</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatTime(route.totalDriveTime)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Visit Time</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatTime(route.totalVisitTime)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Route Time</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatTime(route.totalDriveTime + route.totalVisitTime)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stops List */}
        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Route Stops</h3>
          <div className="space-y-3">
            {route.stops.map((stop) => (
              <div
                key={stop.order}
                onClick={() => setSelectedStop(stop.order)}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                  selectedStop === stop.order ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                      {stop.order}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold text-gray-900">{stop.appointment.appName}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBgColor(stop.status)} ${getStatusColor(stop.status)}`}>
                          {stop.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{stop.appointment.formattedAddress || stop.appointment.address}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                        <span>📍 {stop.arrivalTime}</span>
                        <span>⏱️ {stop.appointment.visitDurationMinutes}min visit</span>
                        {stop.order > 1 && (
                          <>
                            <span>🚗 {formatTime(stop.travelTimeFromPrevious)}</span>
                            <span>📏 {formatDistance(stop.distanceFromPrevious)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Details Panel */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Stop Details</h3>
          {selectedStop ? (
            <div className="bg-white rounded-lg shadow p-4">
              {(() => {
                const stop = route.stops.find(s => s.order === selectedStop)
                if (!stop) return null
                return (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{stop.appointment.appName}</h4>
                      <p className="text-sm text-gray-600">{stop.appointment.formattedAddress || stop.appointment.address}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Visit Order</span>
                        <span className="text-sm font-medium">#{stop.order}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Arrival Time</span>
                        <span className="text-sm font-medium">{stop.arrivalTime}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Visit Duration</span>
                        <span className="text-sm font-medium">{stop.appointment.visitDurationMinutes} minutes</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Preferred Time</span>
                        <span className="text-sm font-medium">
                          {stop.appointment.startTime || 'Flexible'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Status</span>
                        <span className={`text-sm font-medium capitalize ${getStatusColor(stop.status)}`}>
                          {stop.status.replace('_', ' ')}
                        </span>
                      </div>
                      {stop.order > 1 && (
                        <>
                          <div className="flex justify-between py-2 border-b border-gray-200">
                            <span className="text-sm text-gray-600">Travel Time</span>
                            <span className="text-sm font-medium">{formatTime(stop.travelTimeFromPrevious)}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-gray-200">
                            <span className="text-sm text-gray-600">Distance</span>
                            <span className="text-sm font-medium">{formatDistance(stop.distanceFromPrevious)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {stop.minutesFromPreferred !== 0 && (
                      <div className={`mt-4 p-3 rounded-lg ${getStatusBgColor(stop.status)} bg-opacity-50`}>
                        <p className="text-sm text-gray-700">
                          {Math.abs(stop.minutesFromPreferred)} minutes {stop.minutesFromPreferred > 0 ? 'late' : 'early'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Outside the ±15 minute grace period
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-400 mb-2">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500">Select a stop to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Warnings */}
      {route.warnings && route.warnings.length > 0 && (
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2">Route Warnings</h4>
          <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
            {route.warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
