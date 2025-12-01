import { Appointment, GeocodedAppointment, VisitStop } from '../types';
import { timeToMinutes, minutesToTime, haversineDistance, isInflexible } from '../validators';
import { runConflictSimulations, getSimulationSummary } from '../simulation/scheduler';
import { getBestOverallSolution } from '../simulation/scheduler';
import { generateRecommendation, generateDetailedRecommendation } from '../simulation/explanation-engine';

/**
 * Check if a route is feasible (all constraints satisfied)
 * @param stops - Ordered stops in the route
 * @param gracePeriod - Grace period in minutes (default: 15)
 * @returns Array of constraint violations (empty if feasible)
 */
export function validateRoute(stops: VisitStop[], gracePeriod: number = 15): string[] {
  const errors: string[] = [];

  if (stops.length === 0) {
    return errors;
  }

  let currentTime = 0;

  // For the first stop, assume start at its preferred time or 9:00 AM if flexible
  const firstStop = stops[0];
  const dayStartMinutes = firstStop.appointment.startTime
    ? timeToMinutes(firstStop.appointment.startTime)
    : 9 * 60;

  currentTime = dayStartMinutes;

  // Check each stop
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const appointment = stop.appointment;

    // Travel time check (except for first stop)
    if (i > 0) {
      const travelTime = stop.travelTimeFromPrevious;
      currentTime += travelTime;
    }

    // Check if arrival time matches expected
    const actualArrivalMinutes = timeToMinutes(stop.arrivalTime);
    if (Math.abs(currentTime - actualArrivalMinutes) > 1) {
      errors.push(
        `Stop ${i + 1} (${appointment.appName}): Mismatched arrival time. Expected ${minutesToTime(
          currentTime
        )}, got ${stop.arrivalTime}`
      );
    }

    // For inflexible appointments, check if arrival is within grace period
    if (isInflexible(appointment) && appointment.startTime) {
      const diff = Math.abs(timeToMinutes(stop.arrivalTime) - timeToMinutes(appointment.startTime));
      if (diff > gracePeriod) {
        errors.push(
          `Stop ${i + 1} (${appointment.appName}): Arrives at ${
            stop.arrivalTime
          } but appointment must start at ${appointment.startTime} (±${gracePeriod} min)`
        );
      }
    }

    // Add visit duration
    currentTime += appointment.visitDurationMinutes;
  }

  return errors;
}

/**
 * Calculate the time window violation penalty
 */
export function calculateTimePenalty(
  arrivalTime: string,
  preferredTime: string | null,
  gracePeriod: number = 15
): number {
  if (!preferredTime) return 0;

  const diff = Math.abs(timeToMinutes(arrivalTime) - timeToMinutes(preferredTime));
  if (diff <= gracePeriod) return 0;

  return Math.pow(diff - gracePeriod, 2) / 100;
}

/**
 * Check if schedule is feasible before optimization
 */
export function checkScheduleFeasibility(appointments: GeocodedAppointment[]): string[] {
  const errors: string[] = [];

  // Group by date
  const byDate = new Map<string, GeocodedAppointment[]>();
  appointments.forEach((apt) => {
    if (!byDate.has(apt.date)) {
      byDate.set(apt.date, []);
    }
    byDate.get(apt.date)!.push(apt);
  });

  // Check each date
  byDate.forEach((dayAppointments, date) => {
    const inflexible = dayAppointments.filter(isInflexible).sort((a, b) => {
      if (!a.startTime || !b.startTime) return 0;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

    for (let i = 0; i < inflexible.length - 1; i++) {
      const current = inflexible[i];
      const next = inflexible[i + 1];

      if (!current.startTime || !next.startTime) continue;

      const timeGap = timeToMinutes(next.startTime) - timeToMinutes(current.startTime);
      const minTimeNeeded = current.visitDurationMinutes;

      if (timeGap < minTimeNeeded) {
        errors.push(
          `Date ${date}: ${current.appName} (at ${current.startTime}) and ${
            next.appName
          } (at ${next.startTime}) are too close. Need at least ${
            current.visitDurationMinutes
          } minutes between them.`
        );
      }
    }

    // Check if travel between inflexible appointments might be impossible
    for (let i = 0; i < inflexible.length - 1; i++) {
      const current = inflexible[i];
      const next = inflexible[i + 1];

      if (!current.startTime || !next.startTime) continue;

      const timeGap = timeToMinutes(next.startTime) - timeToMinutes(current.startTime);
      const distance = haversineDistance(current.latitude, current.longitude, next.latitude, next.longitude);

      if (distance > 200 && timeGap < 120) {
        errors.push(
          `Date ${date}: ${current.appName} and ${next.appName} might be impossible to reach (distance: ${
            Math.round(distance)
          }km, time gap: ${timeGap}min).`
        );
      }
    }
  });

  return errors;
}

/**
 * Enhanced schedule feasibility check that runs simulations and provides solutions
 * This is the ultrathinking version that goes beyond simple error reporting
 * @param appointments - All appointments (before optimization)
 * @returns Object containing errors, solutions, and recommendations
 */
export function checkScheduleFeasibilityEnhanced(
  appointments: GeocodedAppointment[]
): {
  errors: string[];
  solutions: any[];
  recommendations: string[];
  bestSolution: any | null;
  summary: any;
} {
  const errors: string[] = [];

  // First, run the original error detection to maintain backward compatibility
  const originalErrors = checkScheduleFeasibility(appointments);
  errors.push(...originalErrors);

  // Early exit: If no errors, no need for simulations
  if (errors.length === 0) {
    return {
      errors: [],
      solutions: [],
      recommendations: ['✅ Schedule is feasible with current constraints'],
      bestSolution: null,
      summary: {
        totalConflicts: 0,
        conflictsWithSolutions: 0,
        conflictsWithoutSolutions: 0,
      },
    };
  }

  // Run ultrathinking simulations
  let resolutions: any[] = [];
  try {
    resolutions = runConflictSimulations(appointments);
  } catch (error) {
    console.warn('Simulation failed:', error);
    return {
      errors,
      solutions: [],
      recommendations: [
        '⚠️ Could not run conflict resolution simulations',
        'Consider manual schedule adjustment',
      ],
      bestSolution: null,
      summary: {
        totalConflicts: errors.length,
        conflictsWithSolutions: 0,
        conflictsWithoutSolutions: errors.length,
      },
    };
  }

  // Generate comprehensive recommendations
  const allRecommendations: string[] = [];
  const solutions: any[] = [];

  for (const resolution of resolutions) {
    // Add main recommendation
    allRecommendations.push(generateRecommendation(resolution));

    // Add detailed recommendations
    allRecommendations.push(...generateDetailedRecommendation(resolution));

    // Format the solution for output
    if (resolution.recommendedSolution) {
      const formatted = formatSolution(resolution);
      solutions.push(formatted);
    }
  }

  // Get the best overall solution
  const bestSolution = getBestOverallSolution(resolutions);

  // Get summary statistics
  const summary = getSimulationSummary(resolutions);

  return {
    errors,
    solutions,
    recommendations: allRecommendations,
    bestSolution,
    summary,
  };
}

/**
 * Format a conflict resolution for output
 */
function formatSolution(resolution: any): any {
  if (!resolution.recommendedSolution) {
    return null;
  }

  const solution = resolution.recommendedSolution;
  const conflict = resolution.conflict;

  return {
    summary: generateRecommendation(resolution),
    conflict: {
      appointments: {
        first: {
          name: conflict.appointments[0].appName,
          time: conflict.appointments[0].startTime,
          duration: conflict.appointments[0].visitDurationMinutes,
        },
        second: {
          name: conflict.appointments[1].appName,
          time: conflict.appointments[1].startTime,
          duration: conflict.appointments[1].visitDurationMinutes,
        },
      },
      gapMinutes: conflict.gapMinutes,
      requiredMinutes: conflict.requiredMinutes,
      severity: conflict.severity,
    },
    solution: {
      feasibility: solution.feasibility,
      successRate: solution.successRate,
      impactScore: solution.impactScore,
      impactCategory: solution.impactScore <= 30 ? 'low' : solution.impactScore <= 60 ? 'medium' : 'high',
      changes: solution.changes.map((change: any) => ({
        type: change.type,
        appointment: change.appointmentName,
        action: change.reason,
        impact: change.impactMinutes ? `${change.impactMinutes} minutes` : 'unknown',
      })),
      reasoning: solution.reasoning.slice(0, 3), // Top 3 reasons
    },
  };
}

/**
 * Calculate schedule tightness (0-1, where 1 is very tight)
 */
export function calculateScheduleTightness(appointments: GeocodedAppointment[]): number {
  const byDate = new Map<string, GeocodedAppointment[]>();
  appointments.forEach((apt) => {
    if (!byDate.has(apt.date)) {
      byDate.set(apt.date, []);
    }
    byDate.get(apt.date)!.push(apt);
  });

  let totalTightness = 0;
  let dayCount = 0;

  byDate.forEach((dayAppointments) => {
    const inflexibleCount = dayAppointments.filter(isInflexible).length;
    const totalCount = dayAppointments.length;
    const tightness = inflexibleCount / Math.max(totalCount, 1);

    totalTightness += tightness;
    dayCount++;
  });

  return dayCount > 0 ? totalTightness / dayCount : 0;
}

/**
 * Estimate if route can be optimized
 */
export function canOptimizeRoute(appointments: GeocodedAppointment[]): { canOptimize: boolean; reason: string } {
  const total = appointments.length;
  const inflexible = appointments.filter(isInflexible).length;
  const flexible = appointments.filter((apt) => !isInflexible(apt)).length;

  if (flexible === 0) {
    return {
      canOptimize: false,
      reason: 'All appointments are inflexible. No optimization possible.',
    };
  }

  const ratio = inflexible / total;
  if (ratio > 0.8) {
    return {
      canOptimize: true,
      reason: `Only ${flexible} flexible appointments out of ${total}. Optimization will be limited.`,
    };
  }

  const feasibilityErrors = checkScheduleFeasibility(appointments);
  if (feasibilityErrors.length > 0) {
    return {
      canOptimize: false,
      reason: feasibilityErrors.join(' | '),
    };
  }

  return {
    canOptimize: true,
    reason: `Successfully scheduled ${total} appointments (${inflexible} inflexible, ${flexible} flexible).`,
  };
}
