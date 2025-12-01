import { CSVError, CSVWarning } from '../types';
import { AUTO_FIX_PATTERNS } from './auto-fix-patterns';

// Regular expressions for validation
export const TIME_REGEX = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const FLEXIBILITY_REGEX = /^(flexible|inflexible)$/i;

// Re-export AUTO_FIX_PATTERNS from auto-fix-patterns
export { AUTO_FIX_PATTERNS };

/**
 * Enhanced error details with examples and suggestions
 */
export interface ErrorDetails {
  message: string;
  examples?: string[];
  suggestion: string;
  autoFix?: (value: string) => string | null;
}

/**
 * Auto-fix-able patterns and their descriptions
 */
export interface AutoFixPattern {
  pattern: RegExp;
  fix: (value: string, match?: RegExpMatchArray) => string | null;
  description: string;
}

/**
 * Error message definitions with examples and suggestions
 */
export const ERROR_DETAILS: Record<string, ErrorDetails> = {
  // Required field errors
  'Appointment name cannot be empty': {
    message: 'Appointment name is required and cannot be blank',
    examples: ['Home Visit - Smith', 'Office Meeting - ABC Corp', 'Delivery - XYZ Company'],
    suggestion: 'Provide a descriptive name that helps identify this appointment.'
  },

  'Address must be at least 5 characters': {
    message: 'Address is too short or missing',
    examples: [
      '123 Main St, Springfield, IL 62701',
      '456 Oak Ave, Chicago, IL 60601',
      '789 Elm St, Seattle, WA 98101'
    ],
    suggestion: 'Include a complete street address with street number, street name, city, state abbreviation, and ZIP code.'
  },

  'Visit duration must be positive': {
    message: 'Visit duration must be a positive number',
    examples: ['30', '60', '90', '120'],
    suggestion: 'Enter the duration in minutes as a positive whole number (no decimals).'
  },

  'Visit duration must be a positive number': {
    message: 'Visit duration must be a positive number',
    examples: ['30', '60', '90', '120'],
    suggestion: 'Enter only numeric digits (no letters, symbols, or negative numbers).'
  },

  // Time format errors
  'Start time must be HH:MM format or "flexible"': {
    message: 'Time format is invalid',
    examples: ['09:30', '14:00', '08:00', 'flexible'],
    suggestion: 'Use 24-hour format (military time) or enter exactly "flexible" (lowercase).',
    autoFix: (value: string) => {
      // Try to auto-fix common time format issues
      const lowerValue = value.toLowerCase().trim();

      // Allow "flexible"
      if (lowerValue === 'flexible') return 'flexible';

      // Try 12-hour formats with AM/PM
      const ampmMatch = value.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)$/i);
      if (ampmMatch) {
        let hour = parseInt(ampmMatch[1]);
        const minute = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0;
        const period = ampmMatch[3].toLowerCase();

        if (period === 'pm' && hour !== 12) hour += 12;
        if (period === 'am' && hour === 12) hour = 0;

        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMin = minute.toString().padStart(2, '0');
        return `${formattedHour}:${formattedMin}`;
      }

      // Try partial times
      if (/^(\d{1,2}):(\d{2})$/.test(value)) {
        return TIME_REGEX.test(value) ? value : null;
      }

      return null;
    }
  },

  // Date format errors
  'Date must be in YYYY-MM-DD format': {
    message: 'Date format is invalid',
    examples: ['2025-01-30', '2025-12-31', '2025-06-15'],
    suggestion: 'Use ISO 8601 format: YYYY-MM-DD (4-digit year, 2-digit month, 2-digit day).',
    autoFix: (value: string) => {
      const normalized = value.trim();

      // Try MM/DD/YYYY or DD/MM/YYYY formats
      const mmddMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (mmddMatch) {
        const month = parseInt(mmddMatch[1]);
        const day = parseInt(mmddMatch[2]);
        const year = parseInt(mmddMatch[3]);

        // Assume US format (MM/DD/YYYY) if month <= 12
        if (month <= 12) {
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
      }

      // Try DD-MM-YYYY format
      const ddmmMatch = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (ddmmMatch) {
        const day = parseInt(ddmmMatch[1]);
        const month = parseInt(ddmmMatch[2]);
        const year = parseInt(ddmmMatch[3]);
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }

      return null;
    }
  },

  // Flexibility errors
  'Flexibility must be "flexible" or "inflexible"': {
    message: 'Flexibility value is invalid',
    examples: ['flexible', 'inflexible'],
    suggestion: 'Enter exactly "flexible" or "inflexible" in lowercase, no typos.',
    autoFix: (value: string) => {
      const lower = value.toLowerCase().trim();

      // Common typos and alternatives
      if (['flexable', 'flexibel', 'flexible ', ' flexible'].includes(lower)) {
        return 'flexible';
      }
      if (['unflexible', 'unflexibel', 'in-flexible', 'inflexible '].includes(lower)) {
        return 'inflexible';
      }

      // Partial matches
      if (lower.startsWith('flex')) return 'flexible';
      if (lower.startsWith('inflex') || lower.startsWith('unflex')) return 'inflexible';

      return null;
    }
  },

  // Generic errors
  'Missing required column': {
    message: 'A required column is missing from the CSV',
    examples: ['app_name, address, visitdurationMinutes, startTime, date, flexibility'],
    suggestion: 'Ensure your CSV includes all 6 required columns with exact column names.'
  }
};
