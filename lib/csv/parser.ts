import Papa from 'papaparse';
import { Appointment, CSVParseResult, CSVError, CSVWarning, RawAppointment } from '../types';
import { getEnhancedErrorDetails } from '../errors/utils';
import { appointmentSchema, AppointmentRow } from './types';
import { z } from 'zod';

/**
 * Map parsed headers to expected field names after PapaParse lowercases them
 */
function mapHeadersToExpectedFormat(data: any[]): any[] {
  return data.map(row => {
    const mapped: any = {};
    // Map each lowercase key to its expected camelCase equivalent
    Object.entries(row).forEach(([key, value]) => {
      switch (key.toLowerCase()) {
        case 'app_name':
          mapped.app_name = value;
          break;
        case 'address':
          mapped.address = value;
          break;
        case 'visitdurationminutes':
          mapped.visitdurationMinutes = value;
          break;
        case 'starttime':
          mapped.startTime = value;
          break;
        case 'date':
          mapped.date = value;
          break;
        case 'flexibility':
          mapped.flexibility = value;
          break;
        default:
          mapped[key] = value; // Keep unknown keys as-is
      }
    });
    return mapped;
  });
}

/**
 * Parse CSV string and validate all required columns
 * @param csvString - The CSV content to parse
 * @returns Parse result with appointments, errors, and warnings
 */
export function parseCSV(csvString: string): CSVParseResult {
  const errors: CSVError[] = [];
  const warnings: CSVWarning[] = [];
  const appointments: Appointment[] = [];

  // Remove BOM if present
  if (csvString.charCodeAt(0) === 0xFEFF) {
    csvString = csvString.slice(1);
  }

  try {
    const result = Papa.parse<RawAppointment>(csvString, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
      transform: (value, field) => {
        // Trim whitespace from all values
        return typeof value === 'string' ? value.trim() : value;
      },
      dynamicTyping: true, // PapaParse will try to convert numbers automatically
    });

    if (result.errors && result.errors.length > 0) {
      result.errors.forEach((parseError) => {
        const enhanced = getEnhancedErrorDetails({
          row: parseError.row ? parseError.row + 1 : 1,
          message: parseError.message,
        });

        errors.push({
          row: parseError.row ? parseError.row + 1 : 1,
          message: enhanced.message || parseError.message,
          suggestion: enhanced.suggestion || 'Check the format of your CSV file.',
          examples: enhanced.examples || ['Ensure CSV is properly formatted with correct delimiters'],
        });
      });
      return { appointments: [], errors, warnings };
    }

    const data = result.data || [];
    if (data.length === 0) {
      errors.push({
        row: 1,
        message: 'CSV file is empty or contains no valid rows',
        suggestion: 'Ensure your CSV has at least one row of data after the header row.',
        examples: ['First row should contain column headers, second row should contain first appointment data'],
      });
      return { appointments: [], errors, warnings };
    }

    // Map lowercase headers to expected format
    const mappedData = mapHeadersToExpectedFormat(data);

    // Validate each row
    mappedData.forEach((row, index) => {
      const rowNumber = index + 2; // +1 for PapaParse 0-index, +1 for header row

      try {
        const parsedRow = appointmentSchema.parse(row) as AppointmentRow;

        // Convert to our internal format
        const appointment: Appointment = {
          id: crypto.randomUUID(),
          appName: parsedRow.app_name,
          address: parsedRow.address,
          visitDurationMinutes:
            typeof parsedRow.visitdurationMinutes === 'string'
              ? parseInt(parsedRow.visitdurationMinutes, 10)
              : parsedRow.visitdurationMinutes,
          startTime: parsedRow.startTime,
          date: parsedRow.date,
          flexibility: parsedRow.flexibility as 'flexible' | 'inflexible',
          rowNumber,
        };

        // Validate time not in the past
        validateTimeNotInPast(appointment, warnings, errors);

        appointments.push(appointment);
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach((zodError) => {
            const field = zodError.path.join('.');
            const message = zodError.message;
            const enhanced = getEnhancedErrorDetails({
              row: rowNumber,
              field,
              message,
              value: zodError.path.length > 0 ? (row as any)[zodError.path[0]] : undefined,
            });

            errors.push({
              row: rowNumber,
              field,
              message: enhanced.message || message,
              value: zodError.path.length > 0 ? (row as any)[zodError.path[0]] : undefined,
              suggestion: enhanced.suggestion || 'Please correct the value and try again.',
              examples: enhanced.examples,
            });
          });
        } else {
          const enhanced = getEnhancedErrorDetails({
            row: rowNumber,
            message: 'Unknown validation error',
          });

          errors.push({
            row: rowNumber,
            message: 'Unknown validation error',
            suggestion: enhanced.suggestion || 'Please check the value and correct the format.',
            examples: enhanced.examples,
          });
        }
      }
    });

    // Check for duplicate appointments
    if (appointments.length > 0) {
      checkForDuplicates(appointments, warnings);
    }

    return { appointments, errors, warnings };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse CSV';
    const errorDetails = getEnhancedErrorDetails({
      row: 1,
      message: errorMessage,
    });
    errors.push({
      row: 1,
      message: errorDetails.message || errorMessage,
      suggestion: errorDetails.suggestion || 'Please check your CSV format and try again.',
      examples: errorDetails.examples || ['Refer to the CSV template for correct format'],
    });
    return { appointments: [], errors, warnings };
  }
}

/**
 * Validate time not in the past
 */
function validateTimeNotInPast(appointment: Appointment, warnings: CSVWarning[], errors: CSVError[]) {
  const now = new Date();
  const [year, month, day] = appointment.date.split('-').map(Number);
  const [hour, minute] = appointment.startTime === 'flexible' || !appointment.startTime ? [9, 0] : appointment.startTime.split(':').map(Number);

  const appointmentDate = new Date(year, month - 1, day, hour, minute);

  if (appointmentDate < now) {
    const hoursDiff = (now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      const message = `Appointment time (${appointment.startTime} on ${appointment.date}) is in the past by ${Math.floor(hoursDiff)} hours`;
      errors.push({
        row: appointment.rowNumber,
        field: 'date',
        message,
        suggestion: 'Update the appointment to a future date or time.',
        value: appointment.date,
        examples: [new Date().toISOString().split('T')[0]], // Today's date
      });
    } else if (hoursDiff > 0) {
      const message = `Appointment time (${appointment.startTime} on ${appointment.date}) is in the past or very recent`;
      warnings.push({
        row: appointment.rowNumber,
        field: 'date',
        message,
        suggestion: 'Verify this appointment time is correct.',
        value: appointment.date,
        examples: [new Date().toISOString().split('T')[0]],
      });
    }
  }
}

/**
 * Check for duplicate appointments
 */
function checkForDuplicates(appointments: Appointment[], warnings: CSVWarning[]) {
  const seen = new Set<string>();

  appointments.forEach((apt) => {
    const key = `${apt.appName.toLowerCase().replace(/\s/g, '')}-${apt.date}`;

    if (seen.has(key)) {
      const warningDetails = getEnhancedErrorDetails({
        row: apt.rowNumber,
        field: 'app_name',
        message: 'Duplicate appointment detected',
        value: apt.appName,
      });
      warnings.push({
        row: apt.rowNumber,
        field: 'app_name',
        message: warningDetails.message,
        value: apt.appName,
        suggestion: 'This appointment appears to be a duplicate. Verify if both entries are needed.',
        examples: ['Multiple appointments should have unique names or times'],
      });
    }
    seen.add(key);
  });
}
