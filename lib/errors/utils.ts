import { CSVError, CSVWarning } from '../types';
import { ERROR_DETAILS, ErrorDetails, TIME_REGEX, FLEXIBILITY_REGEX, DATE_REGEX } from './definitions';
import { applyAutoFix } from './validation';

/**
 * Apply auto-fix to a CSV error if possible
 * @param error - CSV error to potentially fix
 * @returns { hasFix: boolean, fixedValue: string | null, suggestion: string }
 */
export function getAutoFixForError(error: CSVError): {
  hasFix: boolean;
  fixedValue: string | null;
  suggestion: string;
  examples?: string[];
} {
  if (!error.field || !error.value) {
    return {
      hasFix: false,
      fixedValue: null,
      suggestion: 'No auto-fix available for this error.',
    };
  }

  // Look up enhanced error details
  const enhanced = getEnhancedErrorDetails(error);

  // Try to apply auto-fix
  const fixedValue = applyAutoFix(error.value, error.field);

  if (fixedValue !== null) {
    return {
      hasFix: true,
      fixedValue,
      suggestion: enhanced.suggestion || `Change to: "${fixedValue}"`,
      examples: enhanced.examples,
    };
  }

  return {
    hasFix: false,
    fixedValue: null,
    suggestion: enhanced.suggestion,
    examples: enhanced.examples,
  };
}

/**
 * Get enhanced error details with examples and suggestions
 * @param error - CSV error
 * @returns Enhanced error details
 */
export function getEnhancedErrorDetails(error: CSVError | CSVWarning): ErrorDetails {
  if (!error.message && !error.field) {
    return {
      message: 'Unknown error',
      suggestion: 'Please check the value and correct the format.',
    };
  }

  // Try exact message match
  const exactMatch = ERROR_DETAILS[error.message];
  if (exactMatch) return exactMatch;

  // Try partial match
  for (const [pattern, details] of Object.entries(ERROR_DETAILS)) {
    if (error.message.includes(pattern)) {
      return details;
    }
  }

  // Field-specific defaults
  if (error.field) {
    return getFieldSpecificDetails(error.field, error.message);
  }

  // Generic fallback
  return {
    message: error.message,
    suggestion: 'Please check the value and correct the format.',
  };
}

/**
 * Get field-specific error details
 */
function getFieldSpecificDetails(field: string, message: string): ErrorDetails {
  switch (field.toLowerCase()) {
    case 'app_name':
      return {
        message: 'Invalid appointment name',
        examples: ['Home Visit - Smith', 'Office Meeting - ABC Corp'],
        suggestion: 'Provide a descriptive, non-empty appointment name.',
      };

    case 'address':
      return {
        message: 'Invalid address',
        examples: ['123 Main St, Springfield, IL 62701'],
        suggestion: 'Provide a complete street address with city, state, and ZIP code.',
      };

    case 'visitdurationminutes':
      return {
        message: 'Invalid visit duration',
        examples: ['30', '60', '90', '120'],
        suggestion: 'Enter a positive number representing minutes.',
      };

    case 'starttime':
      return {
        message: 'Invalid start time',
        examples: ['09:30', '14:00', 'flexible'],
        suggestion: 'Use HH:MM format (24-hour) or enter "flexible".',
      };

    case 'date':
      return {
        message: 'Invalid date',
        examples: ['2025-01-30', '2025-12-31'],
        suggestion: 'Use YYYY-MM-DD format.',
      };

    case 'flexibility':
    case 'flexibilitylower':
      return {
        message: 'Invalid flexibility value',
        examples: ['flexible', 'inflexible'],
        suggestion: 'Enter "flexible" or "inflexible" (lowercase).',
      };

    default:
      return {
        message: message,
        suggestion: 'Please correct the value and try again.',
      };
  }
}
