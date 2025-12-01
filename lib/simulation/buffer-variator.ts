import {
  GeocodedAppointment,
  Solution,
  ScheduleChange,
  SimulationStats,
  BufferConfiguration,
  DEFAULT_BUFFER_CONFIG,
} from '../types';
import {
  detectConflict,
  findAllConflicts,
  calculateSmartBuffer,
  sortByStartTime,
} from './utils';
import { timeToMinutes } from '../validators';
import { calculateImpactScore } from './scoring';
import { isInflexible } from '../validators';

/**
 * Test different buffer configurations to resolve conflicts
 * Returns solutions ranked by impact score (best first)
 */
export function simulateBufferVariation(
  appointments: GeocodedAppointment[],
  buffersToTest: number[] = [30, 35, 40, 45, 50, 55, 60],
  baseConfig: BufferConfiguration = DEFAULT_BUFFER_CONFIG
): Solution[] {
  const solutions: Solution[] = [];
  const baseBufferConfig = { ...baseConfig };

  // Test each buffer size
  for (const bufferMinutes of buffersToTest) {
    // Create a config with this buffer size
    const testConfig: BufferConfiguration = {
      ...baseBufferConfig,
      baseBufferMinutes: bufferMinutes,
    };

    // Check if schedule is feasible with this buffer
    const isFeasible = isScheduleFeasible(appointments, testConfig);

    // Generate solution
    const solution = createBufferSolution(
      appointments,
      bufferMinutes,
      testConfig,
      isFeasible,
      buffersToTest.length
    );

    solutions.push(solution);
  }

  // Rank by impact score
  const scored = solutions.map((solution) => ({
    solution,
    impactScore: calculateImpactScore(solution),
  }));

  return scored.sort((a, b) => a.impactScore - b.impactScore).map((s) => s.solution);
}

/**
 * Check if a schedule is feasible with a given buffer configuration
 */
function isScheduleFeasible(
  appointments: GeocodedAppointment[],
  config: BufferConfiguration
): boolean {
  // Group by date
  const byDate = new Map<string, GeocodedAppointment[]>();
  appointments.forEach((apt) => {
    if (!byDate.has(apt.date)) {
      byDate.set(apt.date, []);
    }
    byDate.get(apt.date)!.push(apt);
  });

  // Check each date
  const dateValues = Array.from(byDate.values());
  for (let i = 0; i < dateValues.length; i++) {
    const dayAppointments = dateValues[i];
    const sorted = sortByStartTime(dayAppointments);

    // Check each consecutive pair
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      const conflict = detectConflict(current, next);
      if (conflict) {
        // With the new buffer config, would this still be a conflict?
        const smartBuffer = calculateSmartBuffer(current, next, config);
        if (conflict.gapMinutes < smartBuffer) {
          return false; // Still infeasible
        }
      }
    }
  }

  return true;
}

/**
 * Create a solution for a specific buffer configuration
 */
function createBufferSolution(
  appointments: GeocodedAppointment[],
  bufferMinutes: number,
  config: BufferConfiguration,
  isFeasible: boolean,
  buffersTested: number
): Solution {
  const conflicts = findAllConflicts(appointments);
  const severity = calculateSeverity(conflicts, config);

  const changes: ScheduleChange[] = [];

  // For each conflict, suggest which appointment to move
  conflicts.forEach((conflict) => {
    const [apt1, apt2] = conflict.appointments as unknown as GeocodedAppointment[];
    const smartBuffer = calculateSmartBuffer(apt1, apt2, config);
    const gapShortage = smartBuffer - conflict.gapMinutes;

    // Suggest moving the second appointment
    if (!isInflexible(apt2)) {
      changes.push({
        type: 'buffer-adjust',
        appointmentId: apt2.id,
        appointmentName: apt2.appName,
        originalTime: apt2.startTime || 'flexible',
        proposedTime: calculateAdjustedTime(apt1, smartBuffer),
        reason: `Adjust buffer from ${conflict.gapMinutes} to ${smartBuffer} minutes (${gapShortage} more minutes needed)`,
        impactMinutes: gapShortage,
      });
    } else if (!isInflexible(apt1)) {
      // Move the first if second is inflexible
      changes.push({
        type: 'buffer-adjust',
        appointmentId: apt1.id,
        appointmentName: apt1.appName,
        originalTime: apt1.startTime || 'flexible',
        proposedTime: calculateAdjustedTimeBackwards(apt2, smartBuffer),
        reason: `Adjust buffer from ${conflict.gapMinutes} to ${smartBuffer} minutes (${gapShortage} more minutes needed) - second appointment is inflexible`,
        impactMinutes: gapShortage,
      });
    }
  });

  const feasibleCount = isFeasible ? 1 : 0;
  const successRate = buffersTested > 0 ? feasibleCount / buffersTested : 0;

  return {
    changes,
    successRate,
    impactScore: calculateBufferImpactScore(bufferMinutes, config),
    feasibility: isFeasible ? 'feasible' : 'infeasible',
    reasoning: [
      isFeasible
        ? `Buffer of ${bufferMinutes} minutes resolves all conflicts`
        : `Buffer of ${bufferMinutes} minutes still has ${conflicts.length} conflicts`,
      isFeasible
        ? 'All appointments can be scheduled with adequate gaps'
        : `Appointments are too densely packed. Minimum ${bufferMinutes + 15}-minute buffer needed.`,
    ],
    statistics: {
      totalScenariosTested: buffersTested,
      feasibleScenarios: feasibleCount,
      bestScenarioGapMinutes: bufferMinutes,
      worstScenarioGapMinutes: severity.worstGap,
      averageGapMinutes: severity.averageGap,
      reorderingsTested: 0,
      buffersTested,
    },
  };
}

/**
 * Calculate severity of conflicts under a buffer configuration
 */
function calculateSeverity(
  conflicts: any[],
  config: BufferConfiguration
): { worstGap: number; averageGap: number } {
  if (conflicts.length === 0) {
    return { worstGap: 0, averageGap: 0 };
  }

  const gaps = conflicts.map((c) => c.gapMinutes);
  const worst = Math.min(...gaps);
  const average = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  return { worstGap: worst, averageGap: average };
}

/**
 * Calculate impact score for a specific buffer size
 * Larger buffers are higher impact (more disruption)
 */
function calculateBufferImpactScore(
  bufferMinutes: number,
  config: BufferConfiguration
): number {
  const deviation = Math.abs(bufferMinutes - config.baseBufferMinutes);
  const score = (deviation / config.baseBufferMinutes) * 50; // Normalize to 0-50 scale
  return Math.min(100, Math.round(score * 10) / 10);
}

/**
 * Calculate new time for an appointment moved after another
 */
function calculateAdjustedTime(apt: GeocodedAppointment, bufferMinutes: number): string {
  const startMinutes = apt.startTime ? timeToMinutes(apt.startTime) : 540; // 9 AM default
  const endMinutes = startMinutes + apt.visitDurationMinutes;
  const newTimeMinutes = endMinutes + bufferMinutes;

  // Format as HH:MM
  const hours = Math.floor(newTimeMinutes / 60);
  const minutes = newTimeMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Calculate new time for an appointment moved before another
 */
function calculateAdjustedTimeBackwards(
  aft: GeocodedAppointment,
  bufferMinutes: number
): string {
  const startMinutes = aft.startTime ? timeToMinutes(aft.startTime) : 540; // 9 AM default
  const newTimeMinutes = startMinutes - aft.visitDurationMinutes - bufferMinutes;

  // Format as HH:MM
  const hours = Math.floor(newTimeMinutes / 60);
  const minutes = newTimeMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Find the optimal buffer size for a given schedule
 * Tests all common buffer sizes and returns the best one
 */
export function findOptimalBuffer(
  appointments: GeocodedAppointment[],
  config: BufferConfiguration = DEFAULT_BUFFER_CONFIG
): { bufferMinutes: number; feasibility: number; solution: Solution | null } {
  const testBuffers = [30, 35, 40, 45, 50, 55, 60, 75, 90];
  const solutions = simulateBufferVariation(appointments, testBuffers, config);

  const bestSolution = solutions.find((s) => s.feasibility === 'feasible');

  if (bestSolution) {
    return {
      bufferMinutes: bestSolution.statistics.bestScenarioGapMinutes,
      feasibility: bestSolution.successRate,
      solution: bestSolution,
    };
  }

  // No feasible solution found
  return {
    bufferMinutes: config.maximumBufferMinutes,
    feasibility: 0,
    solution: solutions[0] || null,
  };
}
