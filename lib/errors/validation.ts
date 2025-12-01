import { TIME_REGEX, FLEXIBILITY_REGEX, DATE_REGEX, AUTO_FIX_PATTERNS } from './definitions';

/**
 * Apply auto-fixes to a value based on field type
 * @param value - The value to fix
 * @param field - Field name
 * @returns Fixed value or null if cannot fix
 */
export function applyAutoFix(value: string, field?: string): string | null {
  if (!field || !value) return null;

  const fieldLower = field.toLowerCase();
  const trimmedValue = value.trim();

  // Try field-specific auto-fixes
  if (fieldLower === 'date') {
    for (const pattern of AUTO_FIX_PATTERNS) {
      const match = trimmedValue.match(pattern.pattern);
      if (match && pattern.description.includes('date')) {
        return pattern.fix(trimmedValue, match);
      }
    }
  }

  if (fieldLower === 'starttime') {
    // Try flexible first
    if (trimmedValue.toLowerCase() === 'flexible') {
      return 'flexible';
    }

    // Try time patterns
    for (const pattern of AUTO_FIX_PATTERNS) {
      const match = trimmedValue.match(pattern.pattern);
      if (match && pattern.description.includes('hour')) {
        return pattern.fix(trimmedValue, match);
      }
    }
  }

  if (fieldLower === 'flexibility') {
    const fixed = fixFlexibility(trimmedValue);
    return fixed;
  }

  return null;
}

/**
 * Fix flexibility value
 */
function fixFlexibility(value: string): string | null {
  const lower = value.toLowerCase().trim();

  if (FLEXIBILITY_REGEX.test(lower)) {
    return lower; // Already correct
  }

  // Common typos
  if (['flexable', 'flexibel', 'flex'].some(t => lower.includes(t))) {
    return 'flexible';
  }
  if (['unflexible', 'inflex', 'inflexibel'].some(t => lower.includes(t))) {
    return 'inflexible';
  }

  return null;
}

/**
 * Check if a value matches expected format for a field
 * @param value - Value to check
 * @param field - Field name
 * @returns True if valid
 */
export function isValidValue(value: string, field?: string): boolean {
  if (!field || !value) return false;

  switch (field.toLowerCase()) {
    case 'starttime':
      return value.toLowerCase() === 'flexible' || TIME_REGEX.test(value);

    case 'date':
      const match = DATE_REGEX.test(value);
      if (!match) return false;
      const date = new Date(value);
      return !isNaN(date.getTime());

    case 'flexibility':
    case 'flexibilitylower':
      return FLEXIBILITY_REGEX.test(value);

    default:
      return true;
  }
}
