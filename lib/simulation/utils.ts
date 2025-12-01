import {
  Appointment,
  GeocodedAppointment,
  SchedulingConflict,
  BufferConfiguration,
  DEFAULT_BUFFER_CONFIG,
} from '../types';
import { timeToMinutes, isInflexible } from '../validators';
import { haversineDistance } from '../validators';

/**
 * Calculate the required buffer between two appointments
 * Uses smart adaptive logic based on appointment characteristics
 */
export function calculateSmartBuffer(
  apt1: GeocodedAppointment,
  apt2: GeocodedAppointment,
  config: BufferConfiguration = DEFAULT_BUFFER_CONFIG
): number {
  let buffer = config.baseBufferMinutes;

  // Adjust for flexibility (flexible appointments need less buffer)
  if (!isInflexible(apt1) && !isInflexible(apt2)) {
    buffer *= config.flexibleFactor;
  }

  // Adjust for duration (longer appointments need more buffer)
  const avgDuration = (apt1.visitDurationMinutes + apt2.visitDurationMinutes) / 2;
  if (avgDuration > 60) {
    buffer *= 1.2; // Long appointments need 20% more buffer
  } else if (avgDuration < 30) {
    buffer *= 0.9; // Short appointments need less buffer
  }

  // Adjust for location distance
  if (apt1.latitude && apt1.longitude && apt2.latitude && apt2.longitude) {
    const distance = haversineDistance(
      apt1.latitude,
      apt1.longitude,
      apt2.latitude,
      apt2.longitude
    );

    // Add travel time buffer for distant locations
    if (distance > 10) { // More than 10km apart
      buffer += 15; // Add 15 minutes for travel
    } else if (distance > 50) { // More than 50km apart
      buffer += 30; // Add 30 minutes for long travel
    }
  }

  // Ensure within bounds
  buffer = Math.max(config.minimumBufferMinutes, Math.min(config.maximumBufferMinutes, buffer));

  return Math.round(buffer);
}

/**
 * Check if two appointments have a time conflict
 * Returns null if no conflict, otherwise returns conflict details
 */
export function detectConflict(
  apt1: Appointment,
  apt2: Appointment
): SchedulingConflict | null {
  // Need both appointments to have start times
  if (!apt1.startTime || !apt2.startTime) {
    return null;
  }

  const time1 = timeToMinutes(apt1.startTime);
  const time2 = timeToMinutes(apt2.startTime);

  // Order them chronologically
  const [first, second, firstTime, secondTime] =
    time1 < time2
      ? [apt1, apt2, time1, time2]
      : [apt2, apt1, time2, time1];

  // Calculate actual gap
  const gapMinutes = secondTime - firstTime;

  // For now, use simple requirement (first appointment duration)
  // This will be enhanced with smart buffer calculation later
  const requiredMinutes = first.visitDurationMinutes;

  if (gapMinutes < requiredMinutes) {
    const severity: 'critical' | 'major' | 'minor' =
      requiredMinutes - gapMinutes > 30
        ? 'critical'
        : requiredMinutes - gapMinutes > 15
        ? 'major'
        : 'minor';

    return {
      appointments: [first, second],
      gapMinutes,
      requiredMinutes,
      severity,
    };
  }

  return null;
}

/**
 * Get all unique pairs of appointments that could conflict
 */
export function getAppointmentPairs<T extends Appointment>(
  appointments: T[]
): [T, T][] {
  const pairs: [T, T][] = [];

  for (let i = 0; i < appointments.length; i++) {
    for (let j = i + 1; j < appointments.length; j++) {
      pairs.push([appointments[i], appointments[j]]);
    }
  }

  return pairs;
}

/**
 * Group appointments by date
 */
export function groupAppointmentsByDate<T extends Appointment>(
  appointments: T[]
): Map<string, T[]> {
  const byDate = new Map<string, T[]>();

  appointments.forEach((apt) => {
    if (!byDate.has(apt.date)) {
      byDate.set(apt.date, []);
    }
    byDate.get(apt.date)!.push(apt);
  });

  return byDate;
}

/**
 * Check if a schedule is feasible (no conflicts)
 * Returns array of conflicts, empty if feasible
 */
export function findAllConflicts<T extends Appointment>(
  appointments: T[]
): SchedulingConflict[] {
  const conflicts: SchedulingConflict[] = [];
  const pairs = getAppointmentPairs(appointments);

  for (const [apt1, apt2] of pairs) {
    // Only check same-date appointments
    if (apt1.date !== apt2.date) continue;

    const conflict = detectConflict(apt1, apt2);
    if (conflict) {
      conflicts.push(conflict);
    }
  }

  return conflicts;
}

/**
 * Sort appointments by start time
 */
export function sortByStartTime<T extends Appointment>(
  appointments: T[]
): T[] {
  return [...appointments].sort((a, b) => {
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}

/**
 * Generate all valid permutations of appointments
 * Maintains inflexible appointments at their original times
 */
export function generateReorderings(
  appointments: Appointment[]
): Appointment[][] {
  const reorderings: Appointment[][] = [];
  const inflexible = appointments.filter(isInflexible);
  const flexible = appointments.filter((apt) => !isInflexible(apt));

  // If all are inflexible or all are flexible, return original
  if (inflexible.length === 0 || flexible.length === 0) {
    return [appointments];
  }

  // Generate permutations of flexible appointments
  const permutations = permute(flexible);

  // For each permutation, interleave with inflexible appointments
  for (const flexiblePerm of permutations) {
    const reordered: Appointment[] = [];
    let flexIndex = 0;

    // Sort inflexible by time
    const sortedInflexible = sortByStartTime(inflexible);

    // Interleave based on original order positions
    appointments.forEach((orig) => {
      if (isInflexible(orig)) {
        reordered.push(orig);
      } else {
        reordered.push(flexiblePerm[flexIndex++]);
      }
    });

    reorderings.push(reordered);
  }

  return reorderings;
}

/**
 * Generate all permutations of an array (non-recursive for performance)
 */
function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];

  const result: T[][] = [];

  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = permute(remaining);

    for (const perm of perms) {
      result.push([current, ...perm]);
    }
  }

  return result;
}

/**
 * Calculate time difference between end of first and start of second appointment
 */
export function calculateGapMinutes(apt1: Appointment, apt2: Appointment): number {
  if (!apt1.startTime || !apt2.startTime) {
    return Infinity; // No conflict if no start times
  }

  const start1 = timeToMinutes(apt1.startTime);
  const end1 = start1 + apt1.visitDurationMinutes;
  const start2 = timeToMinutes(apt2.startTime);

  return start2 - end1;
}
