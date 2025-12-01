import Papa from 'papaparse';
import { CSVError, CSVWarning, Appointment } from './types';

interface ErrorReportRow {
  rowNumber: number;
  field: string;
  severity: 'Error' | 'Warning';
  currentValue: string;
  errorMessage: string;
  expectedFormat: string;
  suggestion: string;
  examples: string;
}

/**
 * Generate a CSV error report from parsing errors and warnings
 * @param errors - Array of CSV errors
 * @param warnings - Array of CSV warnings
 * @param appointments - Array of appointments for context
 * @returns CSV string containing error report
 */
export function generateErrorReport(
  errors: CSVError[],
  warnings: CSVWarning[],
  appointments: Appointment[]
): string {
  const reportRows: ErrorReportRow[] = [];

  // Process errors
  errors.forEach((error) => {
    const reportRow: ErrorReportRow = {
      rowNumber: error.row,
      field: error.field || 'General',
      severity: 'Error',
      currentValue: error.value || '',
      errorMessage: error.message,
      expectedFormat: getExpectedFormat(error.field, error.message),
      suggestion: error.suggestion || getDefaultSuggestion(error.field, error.message),
      examples: error.examples ? error.examples.join('; ') : getDefaultExamples(error.field, error.message).join('; '),
    };
    reportRows.push(reportRow);
  });

  // Process warnings
  warnings.forEach((warning) => {
    const reportRow: ErrorReportRow = {
      rowNumber: warning.row,
      field: warning.field,
      severity: 'Warning',
      currentValue: warning.value || '',
      errorMessage: warning.message,
      expectedFormat: getExpectedFormat(warning.field, warning.message),
      suggestion: warning.suggestion || getDefaultSuggestion(warning.field, warning.message),
      examples: warning.examples ? warning.examples.join('; ') : getDefaultExamples(warning.field, warning.message).join('; '),
    };
    reportRows.push(reportRow);
  });

  // Sort by row number
  reportRows.sort((a, b) => a.rowNumber - b.rowNumber);

  // Generate CSV manually
  const headers = [
    'Row Number',
    'Field',
    'Severity',
    'Current Value',
    'Error Message',
    'Expected Format',
    'Suggestion',
    'Examples',
  ];

  const escapeValue = (value: string): string => {
    if (!value) return '';

    // Replace any double quotes with two double quotes (CSV escaping)
    const escaped = value.replace(/"/g, '""');

    // If value contains comma, quote, or newline, wrap in quotes
    if (/[",\n\r]/.test(escaped)) {
      return `"${escaped}"`;
    }

    return escaped;
  };

  // Build CSV content
  let csvContent = headers.join(',') + '\r\n';

  reportRows.forEach((row) => {
    const values = [
      row.rowNumber.toString(),
      row.field,
      row.severity,
      row.currentValue,
      row.errorMessage,
      row.expectedFormat,
      row.suggestion,
      row.examples,
    ].map(escapeValue);

    csvContent += values.join(',') + '\r\n';
  });

  return csvContent;
}

/**
 * Get expected format based on field and error message
 * @param field - Field name
 * @param message - Error message
 * @returns String describing expected format
 */
function getExpectedFormat(field?: string, message?: string): string {
  if (!field) return 'Depends on context';

  switch (field.toLowerCase()) {
    case 'app_name':
      return 'Text (at least 1 character)';

    case 'address':
      return 'Street address with city, state, ZIP (at least 5 characters)';

    case 'visitdurationminutes':
      return 'Positive integer (e.g., 30, 60, 120)';

    case 'starttime':
      return 'HH:MM (24-hour) or "flexible" (e.g., 09:30, 14:00, flexible)';

    case 'date':
      return 'YYYY-MM-DD format (e.g., 2025-01-30)';

    case 'flexibility':
      return '"flexible" or "inflexible"';

    default:
      if (message?.includes('Missing required column')) {
        return 'Required CSV column';
      }
      return 'Depends on context';
  }
}

/**
 * Get default suggestion for error
 * @param field - Field name
 * @param message - Error message
 * @returns String with suggestion
 */
function getDefaultSuggestion(field?: string, message?: string): string {
  if (!field) {
    return 'Please check the format and try again.';
  }

  if (message?.includes('Missing required column')) {
    return 'Add the missing column to your CSV file.';
  }

  switch (field.toLowerCase()) {
    case 'app_name':
      return 'Provide a descriptive name for the appointment (e.g., "Home Visit - Smith").';

    case 'address':
      return 'Include street number, street name, city, state, and ZIP code.';

    case 'visitdurationminutes':
      return 'Enter a positive number representing minutes (e.g., 60 for 1 hour).';

    case 'starttime':
      return 'Use 24-hour format (e.g., 14:30 for 2:30 PM) or enter "flexible".';

    case 'date':
      return 'Use ISO format: YYYY-MM-DD (e.g., 2025-12-31 for Dec 31, 2025).';

    case 'flexibility':
      return 'Enter exactly "flexible" or "inflexible" (lowercase).';

    default:
      return 'Please check the value and correct the format.';
  }
}

/**
 * Get default examples for field or error
 * @param field - Field name
 * @param message - Error message
 * @returns Array of example strings
 */
function getDefaultExamples(field?: string, message?: string): string[] {
  if (message?.includes('Missing required column')) {
    const columnName = message.replace('Missing required column: ', '');
    return [`Ensure CSV has a "${columnName}" column`];
  }

  if (!field) {
    return ['Check the error message for details'];
  }

  switch (field.toLowerCase()) {
    case 'app_name':
      return ['Home Visit - Smith', 'Office Meeting - ABC Corp', 'Delivery - XYZ Company'];

    case 'address':
      return ['123 Main St, Springfield, IL 62701', '456 Oak Ave, Chicago, IL 60601'];

    case 'visitdurationminutes':
      return ['30', '60', '90', '120'];

    case 'starttime':
      return ['09:30', '14:00', '08:00', 'flexible'];

    case 'date':
      return ['2025-01-30', '2025-12-31', '2025-06-15'];

    case 'flexibility':
      return ['flexible', 'inflexible'];

    default:
      return ['Refer to the field requirements'];
  }
}

/**
 * Download error report as CSV file
 * @param errors - Array of CSV errors
 * @param warnings - Array of CSV warnings
 * @param appointments - Array of appointments for context
 * @param originalFilename - Original CSV filename (optional)
 */
export function downloadErrorReport(
  errors: CSVError[],
  warnings: CSVWarning[],
  appointments: Appointment[],
  originalFilename?: string
): void {
  const csvContent = generateErrorReport(errors, warnings, appointments);

  // Generate filename
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const baseName = originalFilename ? originalFilename.replace(/\.csv$/i, '') : 'upload';
  const filename = `${baseName}-errors-${timestamp}.csv`;

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
