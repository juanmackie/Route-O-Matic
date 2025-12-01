import { AutoFixPattern } from './definitions';

/**
 * Auto-fix patterns for various value formats
 */
export const AUTO_FIX_PATTERNS: AutoFixPattern[] = [
  {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    fix: (value, match) => {
      const parts = value.split('/');
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    },
    description: 'MM/DD/YYYY to YYYY-MM-DD'
  },
  {
    pattern: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    fix: (value, match) => {
      const parts = value.split('-');
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    },
    description: 'DD-MM-YYYY to YYYY-MM-DD'
  },
  {
    pattern: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
    fix: (value, match) => {
      if (!match) return null;
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = parseInt(match[3]);
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    },
    description: 'DD.MM.YYYY to YYYY-MM-DD'
  },
  {
    pattern: /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
    fix: (value, match) => {
      if (!match) return null;
      let hour = parseInt(match[1]);
      const minute = parseInt(match[2]);
      const period = match[3].toLowerCase();

      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;

      const formattedHour = hour.toString().padStart(2, '0');
      const formattedMin = minute.toString().padStart(2, '0');
      return `${formattedHour}:${formattedMin}`;
    },
    description: '12-hour with AM/PM to 24-hour'
  },
  {
    pattern: /^(\d{1,2}):?(\d{2})$/,
    fix: (value, match) => {
      if (!match) return null;
      const hour = parseInt(match[1]);
      const minute = parseInt(match[2] || '0');
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    },
    description: 'H:MM or HMM to HH:MM'
  }
];
