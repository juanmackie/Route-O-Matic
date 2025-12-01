'use client'

import { useState } from 'react'
import { Appointment, GeocodedAppointment, CSVError, CSVWarning } from '@/lib/types'
import ProgressSpinner from './ui/ProgressSpinner'
import ProgressBar from './ui/ProgressBar'
import { downloadErrorReport } from '@/lib/error-report-generator'
import { getAutoFixForError } from '@/lib/errors/utils'

interface AddressValidatorProps {
  appointments: Appointment[]
  errors: CSVError[]
  warnings: CSVWarning[]
  onValidated: (geocoded: GeocodedAppointment[], allPassed: boolean) => void
  onBack: () => void
}

export default function AddressValidator({ appointments, errors, warnings, onValidated, onBack }: AddressValidatorProps) {
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState(0)
  const [geocodeStatus, setGeocodeStatus] = useState('')
  const [geocodeErrors, setGeocodeErrors] = useState<string[]>([])

  const hasBlockingErrors = errors.length > 0
  const hasOnlyWarnings = errors.length === 0 && warnings.length > 0
  const allClear = errors.length === 0 && warnings.length === 0

  const totalCount = appointments.length
  const errorCount = errors.length
  const warningCount = warnings.length

  const groupErrorsByRow = (): Record<number, CSVError[]> => {
    const grouped: Record<number, CSVError[]> = {}
    errors.forEach(error => {
      if (!grouped[error.row]) grouped[error.row] = []
      grouped[error.row].push(error)
    })
    return grouped
  }

  const groupWarningsByRow = (): Record<number, CSVWarning[]> => {
    const grouped: Record<number, CSVWarning[]> = {}
    warnings.forEach(warning => {
      if (!grouped[warning.row]) grouped[warning.row] = []
      grouped[warning.row].push(warning)
    })
    return grouped
  }

  const handleContinue = async () => {
    if (hasBlockingErrors) return

    setGeocoding(true)
    setGeocodeProgress(0)
    setGeocodeStatus('Initializing...')
    setGeocodeErrors([])

    const BATCH_SIZE = 10
    const totalBatches = Math.ceil(appointments.length / BATCH_SIZE)
    const totalTimeEstimate = totalBatches * 220 // ~220ms per batch (200ms delay + 20ms processing)

    // Simulate progress based on batch processing timeline
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const batchIndex = Math.floor(elapsed / 220)
      const batchProgress = Math.min(90, (batchIndex / totalBatches) * 90)
      setGeocodeProgress(batchProgress)
    }, 100)

    try {
      setGeocodeStatus(`Validating ${appointments.length} addresses...`)

      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointments })
      })

      clearInterval(interval)

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Geocoding failed')
      }

      setGeocodeProgress(100)
      setGeocodeStatus('Validation complete!')

      // Check for geocoding errors
      if (result.errors && result.errors.length > 0) {
        const errorMessages: string[] = []

        // Check if any errors are critical API errors
        const apiKeyError = result.errors.find((e: any) => e.errorType === 'API_KEY_MISSING' || e.errorType === 'API_KEY_INVALID')
        const quotaError = result.errors.find((e: any) => e.errorType === 'QUOTA_EXCEEDED')
        const networkError = result.errors.find((e: any) => e.errorType === 'NETWORK_ERROR')

        // Show specific error message for critical API errors
        if (apiKeyError) {
          if (apiKeyError.errorType === 'API_KEY_MISSING') {
            errorMessages.push('⚠️ Google Maps API key is not configured. Please add your API key to the .env.local file.')
          } else if (apiKeyError.errorType === 'API_KEY_INVALID') {
            errorMessages.push('⚠️ Google Maps API key is invalid or restricted. Please verify your API key in the Google Cloud Console and ensure Geocoding API is enabled.')
          }
        } else if (quotaError) {
          errorMessages.push('⚠️ Google Maps API quota exceeded. Please check your usage limits in the Google Cloud Console or wait before retrying.')
        } else if (networkError) {
          errorMessages.push('⚠️ Unable to connect to Google Maps API. Please check your internet connection and try again.')
        } else {
          // Show individual address errors
          const addressErrors = result.errors
            .filter((e: any) => e.index >= 0) // Only show actual address errors, not critical system errors
            .map((e: any) => `Row ${e.index + 2}: ${e.message}`)
          errorMessages.push(...addressErrors)
        }

        setGeocodeErrors(errorMessages)
        setGeocoding(false)
        return
      }

      setTimeout(() => {
        setGeocoding(false)
        const allPassed = !result.errors || result.errors.length === 0
        onValidated(result.geocoded || [], allPassed)
      }, 500)
    } catch (error) {
      clearInterval(interval)
      setGeocoding(false)
      setGeocodeProgress(0)
      setGeocodeErrors(['⚠️ Network error: Unable to validate addresses. Please check your connection and try again.'])
    }
  }

  const errorRows = groupErrorsByRow()
  const warningRows = groupWarningsByRow()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Validate Addresses</h2>
            <p className="text-gray-600 mt-1">
              Review your appointments before optimizing
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Appointments</div>
          <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Errors</div>
          <div className={`text-2xl font-bold ${errorCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {errorCount}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Warnings</div>
          <div className={`text-2xl font-bold ${warningCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {warningCount}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Ready</div>
          <div className={`text-2xl font-bold ${allClear ? 'text-green-600' : 'text-gray-400'}`}>
            {allClear ? '✓' : '—'}
          </div>
        </div>
      </div>

      {/* Download Error Report Button */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mb-6 text-center">
          <button
            onClick={() => downloadErrorReport(errors, warnings, appointments)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download Error Report</span>
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Export errors and warnings to CSV for offline review
          </p>
        </div>
      )}

      {geocoding && (
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Validating Addresses with Google Maps</h3>
          <ProgressBar
            value={geocodeProgress}
            variant="primary"
            showPercentage={true}
            animated={true}
            height="normal"
          />
          <p className="text-sm text-blue-800 mt-2 font-medium">
            {geocodeStatus || `Processing ${appointments.length} addresses...`}
          </p>
          {geocodeProgress > 0 && geocodeProgress < 100 && (
            <p className="text-xs text-blue-700 mt-1">
              This may take a few moments depending on the number of addresses
            </p>
          )}
        </div>
      )}

      {geocodeErrors.length > 0 && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="font-semibold text-red-900 mb-2">Geocoding Errors</h3>
          <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
            {geocodeErrors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues Summary */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mb-6">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-red-900 mb-2">🚫 Errors (Must Fix)</h3>
              <p className="text-sm text-red-800">
                {errors.length} appointment{errors.length !== 1 ? 's' : ''} must be corrected before continuing.
              </p>
            </div>
          )}

          {hasOnlyWarnings && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 mb-2">⚠️ Warnings (Optional)</h3>
              <p className="text-sm text-amber-800">
                {warnings.length} warning{warnings.length !== 1 ? 's' : ''} found. You can continue, but results may not be optimal.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Appointments List */}
      <div className="space-y-3 mb-8">
        <h3 className="text-lg font-semibold text-gray-800">Appointment Details</h3>
        {appointments.map((appointment) => {
          const rowErrors = errorRows[appointment.rowNumber] || []
          const rowWarnings = warningRows[appointment.rowNumber] || []
          const hasRowErrors = rowErrors.length > 0
          const hasRowWarnings = rowWarnings.length > 0
          const isValid = !hasRowErrors

          return (
            <div
              key={appointment.id}
              className={`bg-white rounded-lg shadow p-4 ${
                hasRowErrors ? 'border-l-4 border-red-400' : hasRowWarnings ? 'border-l-4 border-amber-400' : 'border-l-4 border-green-400'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <span className={`mt-1 text-xs font-semibold px-2 py-1 rounded ${
                    hasRowErrors ? 'bg-red-100 text-red-800' : hasRowWarnings ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                  }`}>
                    Row {appointment.rowNumber}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-gray-900">{appointment.appName}</h4>
                      {!isValid && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          Invalid
                        </span>
                      )}
                      {isValid && hasRowWarnings && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                          Warning
                        </span>
                      )}
                      {isValid && !hasRowWarnings && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Valid
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {appointment.address}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                      <span>📅 {appointment.date}</span>
                      <span>⏰ {appointment.startTime || 'Flexible'}</span>
                      <span>⏱️ {appointment.visitDurationMinutes}min</span>
                      <span>
                        {appointment.flexibility === 'flexible' ? '🔄 Flexible' : '🔒 Inflexible'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {hasRowErrors && (
                <div className="mt-3 pl-12 space-y-3">
                  {rowErrors.map((error, idx) => {
                    const autoFix = getAutoFixForError(error)
                    return (
                      <div key={idx} className="border-l-2 border-red-300 pl-3 py-2">
                        <div className="flex items-start justify-between">
                          <div className="text-sm text-red-700 flex items-start space-x-2">
                            <span className="text-red-600 mt-0.5">✕</span>
                            <span>
                              {error.field && (
                                <span className="font-medium">{error.field}:</span>
                              )} {error.message}
                              {error.value && (
                                <span className="ml-1 font-normal">
                                  (current value: "{error.value}")
                                </span>
                              )}
                            </span>
                          </div>
                          {autoFix.hasFix && autoFix.fixedValue && (
                            <span className="ml-2 inline-block px-2 py-1 text-xs bg-white text-red-600 border border-red-300 rounded">
                              🔧 Auto-fix available: "{autoFix.fixedValue}"
                            </span>
                          )}
                        </div>
                        {error.examples && error.examples.length > 0 && (
                          <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            <span className="font-medium">Examples:</span> {error.examples.join(', ')}
                          </div>
                        )}
                        {error.suggestion && (
                          <div className="mt-2 text-xs text-red-600 italic">
                            💡 {error.suggestion}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {hasRowWarnings && (
                <div className="mt-3 pl-12 space-y-3">
                  {rowWarnings.map((warning, idx) => (
                    <div key={idx} className="border-l-2 border-amber-300 pl-3 py-2">
                      <div className="text-sm text-amber-700 flex items-start space-x-2">
                        <span className="text-amber-600 mt-0.5">⚠</span>
                        <span>
                          {warning.field}: {warning.message}
                          {warning.value && (
                            <span className="ml-1 font-normal">
                              (current value: "{warning.value}")
                            </span>
                          )}
                        </span>
                      </div>
                      {warning.examples && warning.examples.length > 0 && (
                        <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          <span className="font-medium">Examples:</span> {warning.examples.join(', ')}
                        </div>
                      )}
                      {warning.suggestion && (
                        <div className="mt-2 text-xs text-amber-600 italic">
                          ℹ {warning.suggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        {!geocoding && geocodeErrors.length === 0 && (
          <button
            onClick={handleContinue}
            disabled={hasBlockingErrors || geocoding}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              allClear
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : hasOnlyWarnings
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {hasOnlyWarnings
              ? 'Continue with Warnings'
              : allClear
              ? 'Continue to Optimization'
              : 'Fix Errors to Continue'}
          </button>
        )}
      </div>

      {!geocoding && errors.length === 0 && warnings.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Continuing with warnings may result in less optimal routes.
          </p>
        </div>
      )}
    </div>
  )
}
