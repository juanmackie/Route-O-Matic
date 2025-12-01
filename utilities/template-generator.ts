/**
 * Generate a CSV template for appointment data entry
 * @returns CSV string with headers and example data
 */
export function generateTemplateCSV(): string {
  const headers = [
    'app_name',
    'address',
    'visitdurationMinutes',
    'startTime',
    'date',
    'flexibility'
  ]

  // Example rows demonstrating proper format
  const exampleRows = [
    [
      'Morning Client Meeting',
      '123 George St, Sydney NSW 2000',
      '30',
      '09:00',
      '2024-01-15',
      'inflexible'
    ],
    [
      'Site Visit - Construction',
      '456 Pitt St, Sydney NSW 2000',
      '60',
      '13:00',
      '2024-01-15',
      'inflexible'
    ],
    [
      'Client Consultation',
      '789 Kent St, Sydney NSW 2000',
      '45',
      'flexible',
      '2024-01-15',
      'flexible'
    ],
    [
      'Equipment Inspection',
      '321 Market St, Sydney NSW 2000',
      '30',
      '16:30',
      '2024-01-15',
      'inflexible'
    ],
    [
      'Follow-up Training',
      '654 Sussex St, Sydney NSW 2000',
      '90',
      'flexible',
      '2024-01-15',
      'flexible'
    ]
  ]

  // Combine headers and rows
  const allRows = [
    headers,
    ...exampleRows
  ]

  // Convert to CSV string
  const csv = allRows.map((row) =>
    row.map((cell) => {
      const cellStr = String(cell)
      // Escape if contains commas, quotes, or newlines
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`
      }
      return cellStr
    }).join(',')
  ).join('\n')

  return csv
}

/**
 * Download the CSV template as a file
 * @param filename - Optional filename (default: 'route-o-matic-template.csv')
 */
export function downloadTemplate(filename = 'route-o-matic-template.csv'): void {
  const csv = generateTemplateCSV()
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
