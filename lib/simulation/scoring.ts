import { Solution, Appointment, BufferConfiguration, DEFAULT_BUFFER_CONFIG } from '../types';
import { timeToMinutes } from '../validators';

/**
 * Score a solution based on multiple factors
 * Lower scores are better (less disruption, higher success)
 *
 * impactScore = (disruption * 0.4) + (1 - successRate) * 0.3 + (bufferDeviation * 0.3)
 */
export function calculateImpactScore(
  solution: Solution,
  originalAppointments?: Appointment[],
  config: BufferConfiguration = DEFAULT_BUFFER_CONFIG
): number {
  const disruption = calculateDisruptionScore(solution, originalAppointments);
  const successPenalty = (1 - solution.successRate) * 100;
  const bufferDeviation = calculateBufferDeviationScore(solution, config);

  // Weighted average
  const impactScore =
    (disruption * 0.4) +
    (successPenalty * 0.3) +
    (bufferDeviation * 0.3);

  return Math.round(impactScore * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate disruption score based on how much we changed the original schedule
 * Returns 0-100 scale where 0 = no changes, 100 = completely different schedule
 */
export function calculateDisruptionScore(
  solution: Solution,
  originalAppointments?: Appointment[]
): number {
  if (!solution.changes || solution.changes.length === 0) {
    return 0; // No changes = no disruption
  }

  let totalImpactMinutes = 0;
  let maxPossibleImpact = 0;

  for (const change of solution.changes) {
    totalImpactMinutes += change.impactMinutes;

    // Track maximum possible impact for normalization
    // Assume max impact is moving 8 hours (480 minutes)
    maxPossibleImpact += 480;
  }

  // Normalize to 0-100 scale
  const disruptionScore = (totalImpactMinutes / Math.max(maxPossibleImpact, 1)) * 100;

  return Math.min(100, Math.round(disruptionScore * 10) / 10);
}

/**
 * Calculate buffer deviation score
 * Returns 0-100 scale where 0 = optimal buffer, 100 = excessive deviation
 */
export function calculateBufferDeviationScore(
  solution: Solution,
  config: BufferConfiguration = DEFAULT_BUFFER_CONFIG
): number {
  // If no statistics available, assume optimal
  if (!solution.statistics || solution.statistics.bestScenarioGapMinutes === 0) {
    return 0;
  }

  const bestGap = solution.statistics.bestScenarioGapMinutes;
  const targetGap = config.baseBufferMinutes;

  // If we exceeded target by more than 2x, that's high deviation
  const deviationRatio = bestGap / targetGap;

  if (deviationRatio <= 1.0) {
    return 0; // At or below target is optimal
  } else if (deviationRatio <= 1.5) {
    return 25; // 1-1.5x target = acceptable
  } else if (deviationRatio <= 2.0) {
    return 60; // 1.5-2x target = moderate deviation
  } else {
    return 100; // >2x target = excessive deviation
  }
}

/**
 * Rank multiple solutions by impact score
 * Returns sorted array (best = lowest impact score)
 */
export function rankSolutions(
  solutions: Solution[],
  originalAppointments?: Appointment[],
  config?: BufferConfiguration
): Solution[] {
  return [...solutions]
    .map((solution) => ({
      solution,
      impactScore: calculateImpactScore(solution, originalAppointments, config),
    }))
    .sort((a, b) => a.impactScore - b.impactScore)
    .map(({ solution }) => solution);
}

/**
 * Select the best solution from a list
 * Returns the solution with the lowest impact score
 */
export function selectBestSolution(
  solutions: Solution[],
  originalAppointments?: Appointment[],
  config?: BufferConfiguration
): Solution | null {
  if (!solutions || solutions.length === 0) {
    return null;
  }

  const ranked = rankSolutions(solutions, originalAppointments, config);
  return ranked[0];
}

/**
 * Calculate statistics for a set of solutions
 * Returns metadata about solution quality and distribution
 */
export function calculateSolutionStats(solutions: Solution[]) {
  const total = solutions.length;
  const feasible = solutions.filter(s => s.feasibility === 'feasible').length;

  const successRates = solutions.map(s => s.successRate);
  const minSuccess = Math.min(...successRates);
  const maxSuccess = Math.max(...successRates);
  const avgSuccess = successRates.reduce((a, b) => a + b, 0) / total;

  return {
    totalSolutions: total,
    feasibleSolutions: feasible,
    infeasibleSolutions: total - feasible,
    feasibilityRate: total > 0 ? (feasible / total) * 100 : 0,
    minSuccessRate: minSuccess,
    maxSuccessRate: maxSuccess,
    avgSuccessRate: avgSuccess,
  };
}

/**
 * Calculate impact category for a solution
 * Returns 'low', 'medium', or 'high' impact
 */
export function categorizeImpact(score: number): 'low' | 'medium' | 'high' {
  if (score <= 30) {
    return 'low';
  } else if (score <= 60) {
    return 'medium';
  } else {
    return 'high';
  }
}

/**
 * Generate a scorecard for a solution
 * Returns human-readable breakdown of scores
 */
export interface Scorecard {
  totalImpact: number;
  disruption: number;
  successPenalty: number;
  bufferDeviation: number;
  impactCategory: 'low' | 'medium' | 'high';
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export function generateScorecard(
  solution: Solution,
  originalAppointments?: Appointment[],
  config?: BufferConfiguration
): Scorecard {
  const disruption = calculateDisruptionScore(solution, originalAppointments);
  const successPenalty = (1 - solution.successRate) * 100;
  const bufferDeviation = calculateBufferDeviationScore(solution, config);
  const totalImpact = calculateImpactScore(solution, originalAppointments, config);

  const impactCategory = categorizeImpact(totalImpact);

  // Convert to letter grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (totalImpact <= 25) grade = 'A';
  else if (totalImpact <= 40) grade = 'B';
  else if (totalImpact <= 55) grade = 'C';
  else if (totalImpact <= 70) grade = 'D';
  else grade = 'F';

  return {
    totalImpact,
    disruption,
    successPenalty,
    bufferDeviation,
    impactCategory,
    grade,
  };
}
