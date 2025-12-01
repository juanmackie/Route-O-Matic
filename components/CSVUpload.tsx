'use client'

import { useState, useRef } from 'react'
import { parseCSV } from '@/lib/csv/parser'
import { CSVParseResult } from '@/lib/types'
import { downloadTemplate } from '@/utilities/template-generator'
import ProgressSpinner from './ui/ProgressSpinner'
import ProgressBar from './ui/ProgressBar'

interface CSVUploadProps {
  onDataParsed: (result: CSVParseResult) => void;
}

export default function CSVUpload({ onDataParsed }: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState(0)
  const [parseMessage, setParseMessage] = useState('')
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file')
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('File size must be less than 5MB')
      return
    }

    setSelectedFileName(file.name)
    setIsParsing(true)
    setParseProgress(0)
    setParseMessage('Reading file...')

    // Simulate progress during FileReader operations
    const reader = new FileReader()

    // Update progress every 100ms
    const progressInterval = setInterval(() => {
      setParseProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return prev
        }
        return Math.min(prev + 10, 85)
      })
    }, 150)

    reader.onloadstart = () => {
      setParseMessage('Reading file...')
    }

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 30)
        setParseProgress(progress)
      }
    }

    reader.onload = (e) => {
      try {
        setParseMessage('Parsing data...')
        setParseProgress(40)

        const csvContent = e.target?.result as string

        // Small delay to show parsing animation
        setTimeout(() => {
          setParseMessage('Validating format...')
          setParseProgress(70)

          const parseResult = parseCSV(csvContent)

          setParseMessage('Complete!')
          setParseProgress(100)
          setIsParsing(false)
          onDataParsed(parseResult)
          setParseProgress(0)
        }, 300)
      } catch (error) {
        clearInterval(progressInterval)
        setIsParsing(false)
        setParseProgress(0)
        alert('Error parsing CSV file: ' + (error instanceof Error ? error.message : 'Unknown error'))
      }
    }

    reader.onerror = () => {
      clearInterval(progressInterval)
      setIsParsing(false)
      setParseProgress(0)
      alert('Error reading file')
    }

    reader.readAsText(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Upload Appointments CSV</h2>
      <p className="text-gray-600 mb-8">Select a CSV file with your appointment data</p>

      <div
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
          ${isParsing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!isParsing ? handleBrowseClick : undefined}
      >
        <div className="mb-4">
          {isParsing ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <ProgressSpinner size="lg" variant="primary" />
              {parseProgress > 0 && (
                <div className="w-full max-w-xs">
                  <ProgressBar
                    value={parseProgress}
                    variant="primary"
                    showPercentage={true}
                    animated={true}
                    height="thin"
                  />
                </div>
              )}
            </div>
          ) : (
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <div className="space-y-2">
          {isParsing ? (
            <>
              <p className="text-lg font-medium text-gray-800">{parseMessage}</p>
              <p className="text-sm text-gray-600">
                {parseProgress < 40
                  ? 'Reading file contents'
                  : parseProgress < 70
                  ? 'Parsing CSV data'
                  : parseProgress < 100
                  ? 'Validating format'
                  : 'File processed successfully!'}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-800">
                {selectedFileName ? selectedFileName : 'Drop your CSV file here, or click to browse'}
              </p>
              <p className="text-sm text-gray-600">
                {selectedFileName ? 'Click to select a different file' : 'Supports .csv files up to 5MB'}
              </p>
            </>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".csv"
          className="hidden"
          disabled={isParsing}
        />
      </div>

      <div className="mt-6">
        <button
          onClick={() => downloadTemplate()}
          className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
        >
          📄 Download CSV Template
        </button>
        <p className="text-sm text-gray-600 mt-2">
          Get a template with correct headers and example data
        </p>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">CSV Format Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <p><span className="font-medium">app_name:</span> Appointment name (required)</p>
            <p><span className="font-medium">address:</span> Full street address (required)</p>
            <p><span className="font-medium">visitdurationMinutes:</span> Duration in minutes (required)</p>
          </div>
          <div>
            <p><span className="font-medium">startTime:</span> HH:MM or "flexible" (required)</p>
            <p><span className="font-medium">date:</span> YYYY-MM-DD format (required)</p>
            <p><span className="font-medium">flexibility:</span> "flexible" or "inflexible" (required)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
