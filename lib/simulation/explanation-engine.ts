import { Solution, SchedulingConflict } from '../types';
import { isInflexible } from '../validators';

/**
 * Generate human-readable explanations for a solution
 * Returns array of explanation strings
 */
export function generateExplanation(solution: Solution): string[] {
  const explanations: string[] = [...solution.reasoning]; // Start with existing reasoning

  // Add change-specific explanations
  for (const change of solution.changes) {
    const changeExplanation = explainChange(change);
    if (changeExplanation) {
      explanations.push(changeExplanation);
    }
  }

  // Add overall solution analysis
  explanations.push(...analyzeSolutionFeasibility(solution));

  // Add impact analysis
  explanations.push(...analyzeImpact(solution));

  // Add recommendation if feasible
  if (solution.feasibility === 'feasible' && solution.successRate > 0.7) {
    explanations.push(explainWhyThisWorks(solution));
  }

  return explanations.filter((e) => e && e.length > 0);
}

/**
 * Explain a specific schedule change
 */
function explainChange(change: any): string {
  switch (change.type) {
    case 'reorder':
      return `REORDER: Move ${change.appointmentName} to resolve time conflict. This repositions the appointment to a better slot.`;

    case 'reschedule':
      return `RESCHEDULE: Adjust ${change.appointmentName} from ${change.originalTime} to ${change.proposedTime}. ${change.reason}`;

    case 'buffer-adjust':
      return `BUFFER: For "${change.appointmentName}", increase gap by ${change.impactMinutes} minutes to meet minimum buffer requirements.`;

    case 'duration-adjust':
      return `DURATION: Adjust length of ${change.appointmentName} to fit schedule constraints.`;

    default:
      return `CHANGE: Modified ${change.appointmentName} - ${change.reason}`;
  }
}

/**
 * Analyze why a solution is or isn't feasible
 */
function analyzeSolutionFeasibility(solution: Solution): string[] {
  const explanations: string[] = [];

  if (solution.feasibility === 'feasible') {
    explanations.push('✅ SOLUTION FEASIBLE: This schedule can be implemented without conflicts.');

    if (solution.successRate >= 1.0) {
      explanations.push('   - All tested scenarios are valid with this configuration');
    } else if (solution.successRate >= 0.7) {
      explanations.push('   - Most tested scenarios (70%+) are valid with this configuration');
    }
  } else {
    explanations.push('❌ SOLUTION NOT FEASIBLE: This schedule still has conflicts that need resolution.');

    if (solution.successRate === 0) {
      explanations.push('   - No tested scenarios work with current constraints');
      explanations.push('   - Consider more significant changes or removing appointments');
    } else if (solution.successRate < 0.3) {
      explanations.push('   - Very few scenarios work (less than 30%)');
      explanations.push('   - Schedule is very tightly packed');
    }
  }

  return explanations;
}

/**
 * Analyze the impact of a solution
 */
function analyzeImpact(solution: Solution): string[] {
  const explanations: string[] = [];

  explanations.push(`IMPACT ANALYSIS:`);

  // Disruption level
  if (solution.impactScore <= 30) {
    explanations.push(`   - LOW IMPACT (Score: ${solution.impactScore}): Minimal changes to original schedule`);
  } else if (solution.impactScore <= 60) {
    explanations.push(`   - MEDIUM IMPACT (Score: ${solution.impactScore}): Moderate changes required`);
  } else {
    explanations.push(`   - HIGH IMPACT (Score: ${solution.impactScore}): Significant schedule changes`);
  }

  // Number of changes
  if (solution.changes.length === 0) {
    explanations.push(`   - No schedule changes needed (perfect fit)`);
  } else if (solution.changes.length === 1) {
    explanations.push(`   - Only 1 appointment needs adjustment`);
  } else {
    explanations.push(`   - ${solution.changes.length} appointments require changes`);
  }

  // Calculate total impact minutes
  const totalImpact = solution.changes.reduce((sum, change) => sum + (change.impactMinutes || 0), 0);
  if (totalImpact > 0) {
    const hours = Math.floor(totalImpact / 60);
    const minutes = totalImpact % 60;
    if (hours > 0) {
      explanations.push(`   - Total schedule disruption: ${hours}h ${minutes}min`);
    } else {
      explanations.push(`   - Total schedule disruption: ${minutes} minutes`);
    }
  }

  // Success rate
  if (solution.successRate > 0.9) {
    explanations.push(`   - High confidence (${(solution.successRate * 100).toFixed(0)}% success rate)`);
  } else if (solution.successRate > 0.5) {
    explanations.push(`   - Medium confidence (${(solution.successRate * 100).toFixed(0)}% success rate)`);
  } else {
    explanations.push(`   - Low confidence (${(solution.successRate * 100).toFixed(0)}% success rate)`);
  }

  return explanations;
}

/**
 * Explain why this solution works
 */
function explainWhyThisWorks(solution: Solution): string {
  if (solution.changes.length === 0) {
    return `This works because no changes are needed - the schedule is already optimal.`;
  }

  const changeTypes = new Set(solution.changes.map((c) => c.type));
  const reasons: string[] = [];

  if (changeTypes.has('reorder')) {
    reasons.push('reordering appointments eliminates time conflicts');
  }
  if (changeTypes.has('reschedule')) {
    reasons.push('rescheduling to better times provides adequate gaps');
  }
  if (changeTypes.has('buffer-adjust')) {
    reasons.push('adjusting buffers ensures minimum time between appointments');
  }
  if (changeTypes.has('duration-adjust')) {
    reasons.push('adjusting durations makes the schedule fit in available time');
  }

  if (reasons.length === 0) {
    return `This solution provides a feasible schedule with acceptable changes.`;
  }

  return `This solution works because ${reasons.join(', ')}.`;
}

/**
 * Generate a recommendation from conflict resolution
 */
export function generateRecommendation(resolution: any): string {
  if (resolution.recommendedSolution) {
    const solution = resolution.recommendedSolution;
    const impactCat = solution.impactScore <= 30 ? 'low' : solution.impactScore <= 60 ? 'medium' : 'high';

    return `RECOMMENDATION: ${solution.feasibility === 'feasible' ? '✅' : '⚠️'} ${solution.feasibility.toUpperCase()} solution with ${impactCat} impact. ${solution.changes.length} change(s) required.`;
  }

  return `⚠️ NO FEASIBLE SOLUTION: Consider rescheduling to different days or removing appointments.`;
}

/**
 * Generate detailed recommendations
 */
export function generateDetailedRecommendation(resolution: any): string[] {
  const recommendations: string[] = [];

  if (!resolution.recommendedSolution) {
    return [
      `⚠️ This conflict cannot be resolved with simple adjustments.`,
      `Consider:`,
      `  1. Rescheduling one appointment to a different day`,
      `  2. Extending operating hours (if possible)`,
      `  3. Splitting long appointments across multiple days`,
      `  4. Consult with clients about time flexibility`,
    ];
  }

  const solution = resolution.recommendedSolution;

  if (solution.changes.length === 0) {
    return [`✅ No changes needed. The schedule is already optimal.`];
  }

  recommendations.push(`RECOMMENDED ACTION:`);

  solution.changes.forEach((change: any, index: number) => {
    if (change.type === 'reorder') {
      recommendations.push(`${index + 1}. Reorder "${change.appointmentName}" to better position in schedule`);
    } else if (change.type === 'reschedule') {
      recommendations.push(`${index + 1}. Move "${change.appointmentName}" from ${change.originalTime} to ${change.proposedTime}`);
    } else if (change.type === 'buffer-adjust') {
      recommendations.push(
        `${index + 1}. Add ${Math.abs(change.impactMinutes)} minutes buffer before "${change.appointmentName}"`
      );
    } else if (change.type === 'duration-adjust') {
      recommendations.push(`${index + 1}. Adjust duration for "${change.appointmentName}"`);
    }
  });

  return recommendations;
}
