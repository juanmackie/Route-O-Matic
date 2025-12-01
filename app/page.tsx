'use client'

import { useState } from 'react'
import CSVUpload from '@/components/CSVUpload'
import AddressValidator from '@/components/AddressValidator'
import ResultsDisplay from '@/components/ResultsDisplay'
import { CSVParseResult, Appointment, GeocodedAppointment, OptimizedRoute, AppState } from '@/lib/types'

export default function Home() {
  const [step, setStep] = useState<'upload' | 'validation' | 'optimizing' | 'results' | 'error'>('upload')
  const [appState, setAppState] = useState<AppState>({
    step: 'upload',
  })
  const [error, setError] = useState<string | null>(null)

  const handleCSVUpload = (parseResult: CSVParseResult) => {
    // Store the parsed data and move to validation step
    setAppState({
      step: 'validation',
      data: {
        appointments: parseResult.appointments,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
      }
    })

    // If there are errors or warnings, show validation screen
    // If all clear, we could skip validation, but showing is more transparent
    setStep('validation')
  }

  const handleValidationComplete = (geocodedAppointments: GeocodedAppointment[], allPassed: boolean) => {
    // Update state with geocoded appointments
    setAppState(prev => ({
      ...prev,
      data: {
        ...prev.data!,
        geocodedAppointments,
      }
    }))

    // Move to optimization step
    setStep('optimizing')

    // Call optimization API
    optimizeRoute(geocodedAppointments)
  }

  const optimizeRoute = async (appointments: GeocodedAppointment[]) => {
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointments }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Optimization failed')
      }

      // Success! Move to results
      setAppState(prev => ({
        step: 'results',
        data: {
          ...prev.data!,
          optimizedRoute: result.route,
        }
      }))
      setStep('results')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
      setStep('error')
    }
  }

  const handleBack = () => {
    switch (step) {
      case 'validation':
        setStep('upload')
        setAppState({ step: 'upload' })
        break
      case 'optimizing':
        // Can't go back from optimizing, wait for completion
        break
      case 'results':
        setStep('validation')
        setAppState(prev => ({
          step: 'validation',
          data: {
            appointments: prev.data?.appointments || [],
            errors: prev.data?.errors || [],
            warnings: prev.data?.warnings || [],
          }
        }))
        break
      case 'error':
        setStep('upload')
        setAppState({ step: 'upload' })
        setError(null)
        break
    }
  }

  const handleReset = () => {
    setStep('upload')
    setAppState({ step: 'upload' })
    setError(null)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Route-O-Matic V3
              </h1>
              <p className="text-gray-600 mt-2">
                Optimize routes for appointment scheduling
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Step: {step}
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-6">
            <div className="flex items-center space-x-4 text-sm">
              <div className={`flex items-center space-x-2 ${step === 'upload' ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  step === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  1
                </div>
                <span>Upload CSV</span>
              </div>
              <div className="flex-1 h-px bg-gray-300"></div>
              <div className={`flex items-center space-x-2 ${step === 'validation' ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  step === 'validation' ? 'bg-blue-600 text-white' :
                  step === 'optimizing' || step === 'results' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {step === 'optimizing' || step === 'results' ? '✓' : '2'}
                </div>
                <span>Validate Addresses</span>
              </div>
              <div className="flex-1 h-px bg-gray-300"></div>
              <div className={`flex items-center space-x-2 ${step === 'optimizing' ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  step === 'optimizing' ? 'bg-blue-600 text-white' :
                  step === 'results' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {step === 'results' ? '✓' : '3'}
                </div>
                <span>Optimize Route</span>
              </div>
              <div className="flex-1 h-px bg-gray-300"></div>
              <div className={`flex items-center space-x-2 ${step === 'results' ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  step === 'results' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  4
                </div>
                <span>View Results</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {step === 'upload' && (
            <CSVUpload onDataParsed={handleCSVUpload} />
          )}

          {step === 'validation' && appState.data && (
            <AddressValidator
              appointments={appState.data.appointments || []}
              errors={appState.data.errors || []}
              warnings={appState.data.warnings || []}
              onValidated={handleValidationComplete}
              onBack={handleBack}
            />
          )}

          {step === 'optimizing' && (
            <div className="py-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Optimizing Your Route...
              </h3>
              <p className="text-gray-600">
                Calculating the most efficient route for your appointments
              </p>
              <p className="text-sm text-gray-500 mt-4">
                This may take {Math.max(2, Math.round((appState.data?.geocodedAppointments?.length || 0) * 0.2))} seconds depending on the number of stops
              </p>
            </div>
          )}

          {step === 'results' && appState.data?.optimizedRoute && (
            <ResultsDisplay
              route={appState.data.optimizedRoute}
              onBack={handleBack}
              onReset={handleReset}
            />
          )}

          {step === 'error' && (
            <div className="py-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="text-red-600">
                  <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Error Occurred
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {error || 'An unexpected error occurred while optimizing your route.'}
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Start Over
                </button>
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Common solutions:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 max-w-md mx-auto text-left">
                    <li>• Check that all addresses are valid and complete</li>
                    <li>• Ensure flexible and inflexible appointments are sensibly scheduled</li>
                    <li>• Reduce the number of appointments if you have many</li>
                    <li>• Verify your Google Maps API key is working</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
