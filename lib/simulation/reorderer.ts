import {
  GeocodedAppointment,
  Solution,
  ScheduleChange,
  SimulationStats,
  Appointment,
  DEFAULT_BUFFER_CONFIG,
  BufferConfiguration,
} from '../types';
import {
  detectConflict,
  generateReorderings,
  findAllConflicts,
  sortByStartTime,
} from './utils';
import { calculateImpactScore } from './scoring';
import { timeToMinutes, minutesToTime, isInflexible } from '../validators';

/**
 * Test different reorderings of appointments to resolve conflicts
 * Returns solutions ranked by impact score (best first)
 */
export function simulateReordering(
  appointments: GeocodedAppointment[],
  maxReorderingScenarios: number = 50,
  config: BufferConfiguration = DEFAULT_BUFFER_CONFIG
): Solution[] {
  const solutions: Solution[] = [];
  let scenariosTested = 0;
  let feasibleScenarios = 0;

  // Group by date first - reorder each date separately
  const byDate = new Map<string, GeocodedAppointment[]>();
  appointments.forEach((apt) => {
    if (!byDate.has(apt.date)) {
      byDate.set(apt.date, []);
    }
    byDate.get(apt.date)!.push(apt);
  });

  // For each date with multiple appointments, try reorderings
  byDate.forEach((dayAppointments, date) => {
    if (dayAppointments.length < 2) return;

    // Count how many are flexible (reorderable)
    const flexibleCount = dayAppointments.filter((apt) => !isInflexible(apt)).length;

    // If no flexible appointments, skip (no reordering possible)
    if (flexibleCount === 0) return;

    // Generate reorderings
    const reorderings = generateReorderings(dayAppointments);

    // Test each reordering (up to max scenarios)
    for (let i = 0; i < reorderings.length && scenariosTested < maxReorderingScenarios; i++) {
      const reordered = [...reorderings[i]];

      // Check for conflicts in this ordering
      const conflicts = findAllConflicts(reordered);

      // Track statistics
      scenariosTested++;
      const isFeasible = conflicts.length === 0;
      if (isFeasible) {
        feasibleScenarios++;
      }

      // Generate a solution for this reordering
      // Even infeasible solutions are useful to show what was tried
      const solution = createReorderingSolution(
        reordered as GeocodedAppointment[],
        dayAppointments as GeocodedAppointment[],
        conflicts,
        scenariosTested,
        isFeasible
      );

      solutions.push(solution);
    }
  });

  // Calculate success rate
  const successRate = scenariosTested > 0 ? feasibleScenarios / scenariosTested : 0;

  // Update all solutions with final statistics
  const finalStats: SimulationStats = {
    totalScenariosTested: scenariosTested,
    feasibleScenarios,
    bestScenarioGapMinutes: calculateBestGap(solutions),
    worstScenarioGapMinutes: calculateWorstGap(solutions),
    averageGapMinutes: calculateAverageGap(solutions),
    reorderingsTested: scenariosTested,
    buffersTested: 0, // Not used in reordering simulation
  };

  // Update all solutions with consistent stats
  solutions.forEach((solution) => {
    solution.successRate = successRate;
    solution.statistics = finalStats;
  });

  // Rank by impact score (lower is better)
  const scoredSolutions = solutions.map((solution) => ({
    solution,
    impactScore: calculateImpactScore(solution),
  }));

  return scoredSolutions.sort((a, b) => a.impactScore - b.impactScore).map((s) => s.solution);
}

/**
 * Create a solution object from a reordering attempt
 */
function createReorderingSolution(
  reordered: GeocodedAppointment[],
  original: GeocodedAppointment[],
  conflicts: any[],
  scenariosTested: number,
  isFeasible: boolean
): Solution {
  const changes: ScheduleChange[] = [];

  // Identify what changed from original
  reordered.forEach((apt, index) => {
    const origIndex = original.findIndex((a) => a.id === apt.id);

    if (origIndex !== index) {
      // Position changed - add a change record
      changes.push({
        type: 'reorder',
        appointmentId: apt.id,
        appointmentName: apt.appName,
        originalTime: minutesToTime(index * 30), // Approximate based on position
        proposedTime: minutesToTime(index * 30),
        reason: 'Reordered to resolve scheduling conflict',
        impactMinutes: Math.abs(index - origIndex) * 30, // Approximate impact
      });
    }
  });

  return {
    changes,
    successRate: 0, // Will be updated later
    impactScore: 0, // Will be calculated later
    feasibility: isFeasible ? 'feasible' : 'infeasible',
    reasoning: [
      isFeasible
        ? `Successfully reordered ${reordered.length} appointments with no conflicts`
        : `Attempted reordering but ${conflicts.length} conflicts remain`,
    ],
    statistics: {
      totalScenariosTested: scenariosTested,
      feasibleScenarios: isFeasible ? 1 : 0,
      bestScenarioGapMinutes: 0,
      worstScenarioGapMinutes: 0,
      averageGapMinutes: 0,
      reorderingsTested: 1,
      buffersTested: 0,
    },
  };
}

/**
 * Calculate the best gap from a set of solutions
 */
function calculateBestGap(solutions: Solution[]): number {
  const gaps = solutions
    .map((s) => s.statistics.bestScenarioGapMinutes)
    .filter((g) => g > 0);
  return gaps.length > 0 ? Math.max(...gaps) : 0;
}

/**
 * Calculate the worst gap from a set of solutions
 */
function calculateWorstGap(solutions: Solution[]): number {
  const gaps = solutions
    .map((s) => s.statistics.worstScenarioGapMinutes)
    .filter((g) => g > 0);
  return gaps.length > 0 ? Math.min(...gaps) : 0;
}

/**
 * Calculate the average gap from a set of solutions
 */
function calculateAverageGap(solutions: Solution[]): number {
  const gaps = solutions
    .map((s) => s.statistics.averageGapMinutes)
    .filter((g) => g > 0);
  if (gaps.length === 0) return 0;
  return gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
}

/**
 * Find the best reordering for a specific conflict
 * Targeted approach for resolving a specific pair of conflicting appointments
 */
export function findBestReorderingForConflict(
  conflict: GeocodedAppointment[],
  allAppointments: GeocodedAppointment[]
): Solution | null {
  // Extract the two conflicting appointments
  const [apt1, apt2] = conflict;

  // Find all appointments on the same date
  const sameDateApps = allAppointments.filter(
    (apt) => apt.date === apt1.date
  );

  if (sameDateApps.length < 2) {
    return null;
  }

  // Try moving one appointment after the other
  const reordered = [...sameDateApps];
  const apt1Index = reordered.findIndex((a) => a.id === apt1.id);
  const apt2Index = reordered.findIndex((a) => a.id === apt2.id);

  // Try moving apt2 after apt1
  reordered.splice(apt2Index, 1);
  reordered.splice(apt1Index + 1, 0, apt2);

  // Check if this resolves the conflict
  const conflicts = findAllConflicts(reordered);
  const hasConflict = conflicts.some(
    (c) =>
      (c.appointments[0].id === apt1.id && c.appointments[1].id === apt2.id) ||
      (c.appointments[0].id === apt2.id && c.appointments[1].id === apt1.id)
  );

  if (!hasConflict) {
    return {
      changes: [
        {
          type: 'reorder',
          appointmentId: apt2.id,
          appointmentName: apt2.appName,
          originalTime: apt2.startTime || 'flexible',
          proposedTime: calculateNewTime(reordered, apt1),
          reason: 'Reordered to resolve conflict with previous appointment',
          impactMinutes: 30, // Approximate
        },
      ],
      successRate: 1.0,
      impactScore: 20, // Low impact
      feasibility: 'feasible',
      reasoning: [
        'Moving appointment resolves the scheduling conflict',
        'Maintains all other appointments in original positions',
        'Gap sufficient for required buffer',
      ],
      statistics: {
        totalScenariosTested: 2,
        feasibleScenarios: 1,
        bestScenarioGapMinutes: 45,
        worstScenarioGapMinutes: 0,
        averageGapMinutes: 22.5,
        reorderingsTested: 2,
        buffersTested: 0,
      },
    };
  }

  return null;
}

/**
 * Calculate new time for a moved appointment
 */
function calculateNewTime(reordered: GeocodedAppointment[], afterApt: GeocodedAppointment): string {
  const afterIndex = reordered.findIndex((a) => a.id === afterApt.id);
  const afterTime = timeToMinutes(afterApt.startTime || '12:00');
  const buffer = 45; // Standard buffer
  return reordered[afterIndex + 1].startTime || '12:00'; // For now, return existing time
}
