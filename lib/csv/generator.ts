import Papa from 'papaparse';
import { VisitStop } from '../types';

/**
 * Convert appointments back to CSV string for download
 * @param stops - Array of VisitStop objects from optimized route
 * @returns CSV string with original data + optimization columns
 */
export function generateCSVFromResults(stops: VisitStop[]): string {
  const headers = [
    'app_name',
    'address',
    'visitdurationMinutes',
    'startTime',
    'date',
    'flexibility',
    'optimized_order',
    'estimated_arrival',
    'travel_time_to_next_minutes',
    'arrival_status',
    'start_location',
  ];

  const rows = stops.map((stop) => {
    const apt = stop.appointment;
    return {
      app_name: apt.appName,
      address: apt.address,
      visitdurationMinutes: apt.visitDurationMinutes.toString(),
      startTime: apt.startTime || 'flexible',
      date: apt.date,
      flexibility: apt.flexibility,
      optimized_order: stop.order.toString(),
      estimated_arrival: stop.arrivalTime,
      travel_time_to_next_minutes: stop.travelTimeFromPrevious.toString(),
      arrival_status: stop.status,
      start_location: stop.order === 1 ? 'Start' : stops[stop.order - 2]?.appointment.address || '',
    };
  });

  return Papa.unparse(rows, {
    header: true,
    columns: headers,
  });
}

/**
 * Sanitize cell values to prevent CSV injection attacks
 * @param value - The cell value to sanitize
 * @returns Sanitized value
 */
export function sanitizeCell(value: string): string {
  // Prevent formula injection by prefixing with single quote
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  const trimmedValue = value.trim();

  if (dangerousPrefixes.some((prefix) => trimmedValue.startsWith(prefix))) {
    return `'${value}`;
  }

  return value;
}

/**
 * Validate file size
 * @param file - File to validate
 * @param maxSize - Maximum file size in bytes
 * @returns Whether file is valid
 */
export function validateFileSize(file: File, maxSize: number = 5 * 1024 * 1024): boolean {
  return file.size <= maxSize;
}

/**
 * Generate CSV template for download
 * @param includeInstructions - Whether to include instructions in the CSV
 * @returns CSV template string
 */
export function generateCSVTemplate(): string {
  const template = [
    {
      app_name: 'Home Visit - Smith Family',
      address: '123 Main St, Springfield, IL, 62701',
      visitdurationMinutes: '45',
      startTime: '09:30',
      date: '2025-01-15',
      flexibility: 'flexible',
    },
    {
      app_name: 'Office Meeting - ABC Corp',
      address: '456 Oak Ave, Chicago, IL, 60601',
      visitdurationMinutes: '60',
      startTime: 'flexible',
      date: '2025-01-15',
      flexibility: 'inflexible',
    },
    {
      app_name: 'Delivery - XYZ Company',
      address: '789 Elm St, Seattle, WA, 98101',
      visitdurationMinutes: '30',
      startTime: '14:00',
      date: '2025-01-15',
      flexibility: 'flexible',
    },
  ];

  return Papa.unparse(template, {
    header: true,
  });
}
