import { Appointment, GeocodedAppointment } from './types';

/**
 * Parse time string in HH:MM format to minutes since midnight
 * @param time - Time string in HH:MM format
 * @returns Minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to HH:MM string
 * @param minutes - Minutes since midnight
 * @returns Time string in HH:MM format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Calculate difference in minutes between two times (HH:MM format)
 * @param time1 - First time in HH:MM format
 * @param time2 - Second time in HH:MM format
 * @returns Absolute difference in minutes
 */
export function timeDifference(time1: string, time2: string): number {
  const diff = Math.abs(timeToMinutes(time1) - timeToMinutes(time2));
  return diff;
}

/**
 * Check if a time is within a grace period of a target time
 * @param actualTime - Actual arrival time in HH:MM format
 * @param targetTime - Target time in HH:MM format
 * @param gracePeriod - Grace period in minutes (default: 15)
 * @returns Whether time is within grace period
 */
export function isWithinGracePeriod(
  actualTime: string,
  targetTime: string,
  gracePeriod: number = 15
): boolean {
  const diff = timeDifference(actualTime, targetTime);
  return diff <= gracePeriod;
}

/**
 * Get the status of an appointment arrival
 * @param arrivalTime - Actual arrival time in HH:MM format
 * @param preferredTime - Preferred time in HH:MM format
 * @param gracePeriod - Grace period in minutes (default: 15)
 * @returns 'on_time', 'early', or 'late'
 */
export function getArrivalStatus(
  arrivalTime: string,
  preferredTime: string,
  gracePeriod: number = 15
): 'on_time' | 'early' | 'late' {
  const diffMinutes = timeDifference(arrivalTime, preferredTime);

  // If within grace period, consider it on time
  if (diffMinutes <= gracePeriod) {
    return 'on_time';
  }

  // Check if early or late
  const actual = timeToMinutes(arrivalTime);
  const preferred = timeToMinutes(preferredTime);

  return actual < preferred ? 'early' : 'late';
}

/**
 * Check if an appointment is inflexible (must be at exact time)
 * @param apt - Appointment to check
 * @returns Whether appointment is inflexible
 */
export function isInflexible(apt: Appointment | GeocodedAppointment): boolean {
  return apt.flexibility === 'inflexible';
}

/**
 * Check if an appointment is flexible (can be moved)
 * @param apt - Appointment to check
 * @returns Whether appointment is flexible
 */
export function isFlexible(apt: Appointment | GeocodedAppointment): boolean {
  return apt.flexibility === 'flexible';
}

/**
 * Validate that a schedule is feasible (no impossible time conflicts)
 * @param appointments - All appointments (before optimization)
 * @returns Error messages if schedule is impossible, empty array if feasible
 */
export function validateScheduleFeasibility(appointments: Appointment[]): string[] {
  const errors: string[] = [];

  // Group appointments by date
  const byDate = new Map<string, Appointment[]>();
  appointments.forEach((apt) => {
    const date = apt.date;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(apt);
  });

  // Check each date separately
  byDate.forEach((dayAppointments, date) => {
    const inflexible = dayAppointments.filter(isInflexible).sort((a, b) => {
      if (!a.startTime || !b.startTime) return 0;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

    // Check for back-to-back inflexible appointments that might be impossible
    for (let i = 0; i < inflexible.length - 1; i++) {
      const current = inflexible[i];
      const next = inflexible[i + 1];

      if (!current.startTime || !next.startTime) continue;

      const currentTime = timeToMinutes(current.startTime);
      const nextTime = timeToMinutes(next.startTime);
      const timeBetween = nextTime - currentTime;
      const minTimeNeeded = current.visitDurationMinutes;

      if (timeBetween < minTimeNeeded) {
        errors.push(
          `Date ${date}: Inflexible appointments ${current.appName} (at ${current.startTime}) and ${next.appName} (at ${next.startTime}) are too close. Need at least ${current.visitDurationMinutes} minutes between them.`
        );
      }
    }
  });

  return errors;
}

/**
 * Calculate travel time in seconds to minutes
 * @param seconds - Travel time in seconds
 * @returns Travel time in minutes (rounded)
 */
export function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

/**
 * Hausdorff distance check (simplified - for geographic clustering)
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 * @param degrees - Value in degrees
 * @returns Value in radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
