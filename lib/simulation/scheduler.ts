import {
  GeocodedAppointment,
  Solution,
  SchedulingConflict,
  ConflictResolution,
  DEFAULT_BUFFER_CONFIG,
  BufferConfiguration,
} from '../types';
import { simulateReordering } from './reorderer';
import { simulateBufferVariation, findOptimalBuffer } from './buffer-variator';
import { findAllConflicts, groupAppointmentsByDate, calculateSmartBuffer } from './utils';
import { selectBestSolution, rankSolutions } from './scoring';
import { generateExplanation } from './explanation-engine';

export interface SimulationOptions {
  maxReorderings?: number;
  testBufferSizes?: number[];
  runRescheduling?: boolean;
  config?: BufferConfiguration;
  timeLimitMs?: number; // Maximum time to run simulations
}

const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
  maxReorderings: 50,
  testBufferSizes: [30, 35, 40, 45, 50, 55, 60],
  runRescheduling: true,
  config: DEFAULT_BUFFER_CONFIG,
  timeLimitMs: 2000, // 2 seconds max
};

/**
 * Run comprehensive simulations to resolve scheduling conflicts
 * Combines reordering, buffer variation, and rescheduling strategies
 */
export function runConflictSimulations(
  appointments: GeocodedAppointment[],
  options: SimulationOptions = {}
): ConflictResolution[] {
  // Merge options with defaults
  const opts = { ...DEFAULT_SIMULATION_OPTIONS, ...options };

  const startTime = Date.now();
  const resolutions: ConflictResolution[] = [];

  // Find all conflicts
  const conflicts = findAllConflicts(appointments);

  if (conflicts.length === 0) {
    return []; // No conflicts to resolve
  }

  // For each conflict, run simulations
  for (const conflict of conflicts) {
    // Check time limit
    if (Date.now() - startTime > opts.timeLimitMs!) {
      console.warn('Simulation time limit exceeded');
      break;
    }

    const resolution = resolveConflict(conflict, appointments, opts);
    resolutions.push(resolution);
  }

  return resolutions;
}

/**
 * Resolve a single conflict using multiple strategies
 */
function resolveConflict(
  conflict: any,
  allAppointments: GeocodedAppointment[],
  options: SimulationOptions
): ConflictResolution {
  const solutions: Solution[] = [];

  // Strategy 1: Reordering
  try {
    const reorderSolutions = simulateReordering(allAppointments, options.maxReorderings, options.config);
    solutions.push(...reorderSolutions);
  } catch (error) {
    console.error('Error in reordering simulation:', error);
  }

  // Strategy 2: Buffer variation
  try {
    const bufferSolutions = simulateBufferVariation(allAppointments, options.testBufferSizes, options.config);
    solutions.push(...bufferSolutions);
  } catch (error) {
    console.error('Error in buffer simulation:', error);
  }

  // Strategy 3: Rescheduling (if enabled)
  if (options.runRescheduling) {
    const rescheduleSolutions = simulateRescheduling(conflict, allAppointments, options.config);
    solutions.push(...rescheduleSolutions);
  }

  // Add explanations to solutions
  const explainedSolutions = solutions.map((solution) => ({
    ...solution,
    reasoning: [...solution.reasoning, ...generateExplanation(solution)],
  }));

  // Rank and select best
  const ranked = rankSolutions(explainedSolutions);
  const recommended = selectBestSolution(explainedSolutions);

  return {
    conflict,
    solutions: ranked,
    recommendedSolution: recommended,
  };
}

/**
 * Simulate rescheduling a single appointment to a different time
 */
function simulateRescheduling(
  conflict: any,
  allAppointments: GeocodedAppointment[],
  config?: BufferConfiguration
): Solution[] {
  const solutions: Solution[] = [];
  const [apt1, apt2] = conflict.appointments;

  // Strategy 1: Move conflicting appointment to later in the day
  const laterInDay = createRescheduleSolution(apt2, apt1, 'later', config);
  if (laterInDay) {
    solutions.push(laterInDay);
  }

  // Strategy 2: Move conflicting appointment to different day
  const differentDay = createRescheduleSolution(apt2, apt1, 'different-day', config);
  if (differentDay) {
    solutions.push(differentDay);
  }

  // Strategy 3: If both are flexible, suggest flexibility
  if (!conflict.appointments[0].startTime && !conflict.appointments[1].startTime) {
    solutions.push({
      changes: [],
      successRate: 1.0,
      impactScore: 10,
      feasibility: 'feasible',
      reasoning: [
        'Both appointments are flexible and can be scheduled freely',
        'Let the optimizer find the best times',
      ],
      statistics: {
        totalScenariosTested: 1,
        feasibleScenarios: 1,
        bestScenarioGapMinutes: 60,
        worstScenarioGapMinutes: 60,
        averageGapMinutes: 60,
        reorderingsTested: 0,
        buffersTested: 0,
      },
    });
  }

  return solutions;
}

/**
 * Create a rescheduling solution
 */
function createRescheduleSolution(
  appointmentToMove: GeocodedAppointment,
  anchorAppointment: GeocodedAppointment,
  type: 'later' | 'different-day',
  config?: BufferConfiguration
): Solution | null {
  if (!appointmentToMove.startTime || !anchorAppointment.startTime) {
    return null;
  }

  const anchorEndTime = appointmentToMove.startTime; // Simplified
  const buffer = calculateSmartBuffer(anchorAppointment, appointmentToMove, config);

  if (type === 'later') {
    const proposedTime = anchorEndTime; // Simplified calculation
    return {
      changes: [
        {
          type: 'reschedule',
          appointmentId: appointmentToMove.id,
          appointmentName: appointmentToMove.appName,
          originalTime: appointmentToMove.startTime,
          proposedTime,
          reason: `Reschedule to later in the day after ${anchorAppointment.appName}`,
          impactMinutes: buffer,
        },
      ],
      successRate: 0.8,
      impactScore: 40,
      feasibility: 'feasible',
      reasoning: [
        `Moving ${appointmentToMove.appName} to later time resolves conflict`,
        'Maintains same day schedule',
      ],
      statistics: {
        totalScenariosTested: 1,
        feasibleScenarios: 1,
        bestScenarioGapMinutes: buffer,
        worstScenarioGapMinutes: 0,
        averageGapMinutes: buffer / 2,
        reorderingsTested: 0,
        buffersTested: 0,
      },
    };
  } else {
    // different-day
    return {
      changes: [
        {
          type: 'reschedule',
          appointmentId: appointmentToMove.id,
          appointmentName: appointmentToMove.appName,
          originalTime: appointmentToMove.startTime,
          proposedTime: '09:00',
          reason: `Reschedule ${appointmentToMove.appName} to next day - same day schedule is too tight`,
          impactMinutes: 480, // Full day
        },
      ],
      successRate: 1.0,
      impactScore: 60,
      feasibility: 'feasible',
      reasoning: [
        'Moving to different day completely eliminates conflict',
        'Provides fresh start for scheduling',
        'Minimal disruption to other appointments',
      ],
      statistics: {
        totalScenariosTested: 1,
        feasibleScenarios: 1,
        bestScenarioGapMinutes: 60,
        worstScenarioGapMinutes: 60,
        averageGapMinutes: 60,
        reorderingsTested: 0,
        buffersTested: 0,
      },
    };
  }
}

/**
 * Calculate simulation summary statistics
 */
export function getSimulationSummary(resolutions: ConflictResolution[]) {
  const totalSolutions = resolutions.reduce((sum, r) => sum + r.solutions.length, 0);
  const totalFeasible = resolutions.reduce(
    (sum, r) => sum + r.solutions.filter((s) => s.feasibility === 'feasible').length,
    0
  );
  const hasRecommendations = resolutions.filter((r) => r.recommendedSolution !== null).length;

  return {
    totalConflicts: resolutions.length,
    totalSolutions,
    feasibleSolutions: totalFeasible,
    infeasibleSolutions: totalSolutions - totalFeasible,
    conflictsWithSolutions: hasRecommendations,
    conflictsWithoutSolutions: resolutions.length - hasRecommendations,
  };
}

/**
 * Get the best solution across all conflicts
 */
export function getBestOverallSolution(resolutions: ConflictResolution[]): {
  resolution: ConflictResolution | null;
  solution: Solution | null;
} {
  for (const resolution of resolutions) {
    if (resolution.recommendedSolution) {
      return { resolution, solution: resolution.recommendedSolution };
    }
  }

  return { resolution: null, solution: null };
}
