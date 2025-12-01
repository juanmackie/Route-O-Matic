import { OptimizedRoute } from '@/lib/types'

/**
 * Export an optimized route to CSV format
 * @param route - The optimized route to export
 * @returns CSV string that can be downloaded
 */
export function exportRouteToCSV(route: OptimizedRoute): string {
  // Define headers
  const headers = [
    'Order',
    'Appointment Name',
    'Address',
    'Arrival Time',
    'Visit Duration (min)',
    'Travel Time from Previous (min)',
    'Travel Distance from Previous (km)',
    'Status',
    'Minutes from Preferred',
  ]

  // Convert stops to rows
  const rows = route.stops.map((stop) => [
    stop.order,
    stop.appointment.appName,
    stop.appointment.formattedAddress || stop.appointment.address,
    stop.arrivalTime,
    stop.appointment.visitDurationMinutes,
    Math.round(stop.travelTimeFromPrevious),
    (stop.distanceFromPrevious / 1000).toFixed(2), // Convert meters to km
    stop.status,
    stop.minutesFromPreferred,
  ])

  // Add summary row
  const summaryRows = [
    [], // Empty row for spacing
    ['Route Summary', '', '', '', '', '', '', '', ''],
    ['Total Distance (km)', (route.totalDistance / 1000).toFixed(2), '', '', '', '', '', '', ''],
    ['Total Drive Time (min)', route.totalDriveTime, '', '', '', '', '', '', ''],
    ['Total Visit Time (min)', route.totalVisitTime, '', '', '', '', '', '', ''],
  ]

  // Combine all rows
  const allRows = [headers, ...rows, ...summaryRows]

  // Convert to CSV string
  const csv = allRows.map((row) => row.map((cell) => {
    // Escape cell if it contains commas, quotes, or newlines
    const cellStr = String(cell ?? '')
    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
      return `"${cellStr.replace(/"/g, '""')}"`
    }
    return cellStr
  }).join(',')).join('\n')

  return csv
}

/**
 * Download a CSV string as a file
 * @param csv - The CSV string to download
 * @param filename - The filename to use (default: 'optimized-route.csv')
 */
export function downloadCSV(csv: string, filename = 'optimized-route.csv'): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

/**
 * Export and download route in one step
 * @param route - The optimized route
 * @param filename - Output filename
 */
export function exportAndDownloadRoute(route: OptimizedRoute, filename?: string): void {
  const csv = exportRouteToCSV(route)
  const dateStr = new Date().toISOString().split('T')[0]
  const defaultFilename = `route-${dateStr}.csv`
  downloadCSV(csv, filename || defaultFilename)
}
