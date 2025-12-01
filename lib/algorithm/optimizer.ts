import { GeocodedAppointment, OptimizedRoute, VisitStop } from '../types';
import { getDistanceMatrix } from '../google/distance-matrix';
import { timeToMinutes, minutesToTime, isInflexible, getArrivalStatus, haversineDistance } from '../validators';
import { GRACE_PERIOD_MINUTES } from '../types';
import { canOptimizeRoute } from './validator';

/**
 * Optimize a route using Nearest Neighbor algorithm
 * This is a simple, fast algorithm suitable for 20-50 stops
 * Time complexity: O(n²)
 * @param geocodedAppointments - All appointments with coordinates
 * @returns Optimized route with visit stops in order
 */
export async function optimizeRoute(
  geocodedAppointments: GeocodedAppointment[]
): Promise<OptimizedRoute> {
  try {
    // Validate input
    if (geocodedAppointments.length === 0) {
      throw new Error('No appointments to optimize');
    }

    // Check if optimization is possible
    const optimizationCheck = canOptimizeRoute(geocodedAppointments);
    if (!optimizationCheck.canOptimize) {
      throw new Error(optimizationCheck.reason);
    }

    // Group by date (optimize each date separately)
    const byDate = new Map<string, GeocodedAppointment[]>();
    geocodedAppointments.forEach((apt) => {
      if (!byDate.has(apt.date)) {
        byDate.set(apt.date, []);
      }
      byDate.get(apt.date)!.push(apt);
    });

    // Optimize each date
    const allStops: VisitStop[] = [];
    let totalDistance = 0;
    let totalDriveTime = 0;
    let totalVisitTime = 0;
    let warnings: string[] = [];

    const dates = Array.from(byDate.keys());
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const appointments = byDate.get(date)!;
      const dayResult = await optimizeDay(appointments);
      allStops.push(...dayResult.stops);
      totalDistance += dayResult.totalDistance;
      totalDriveTime += dayResult.totalDriveTime;
      totalVisitTime += dayResult.totalVisitTime;
      warnings = [...warnings, ...dayResult.warnings];
    }

    return {
      stops: allStops,
      totalDistance,
      totalDriveTime,
      totalVisitTime,
      routeDate: geocodedAppointments[0].date,
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      stops: [],
      totalDistance: 0,
      totalDriveTime: 0,
      totalVisitTime: 0,
      routeDate: geocodedAppointments[0]?.date || '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown optimization error',
    };
  }
}

/**
 * Optimize appointments for a single day
 * @param appointments - Appointments for this day
 * @returns Optimized stops for the day
 */
async function optimizeDay(appointments: GeocodedAppointment[]): Promise<{
  stops: VisitStop[];
  totalDistance: number;
  totalDriveTime: number;
  totalVisitTime: number;
  warnings: string[];
}> {
  const warnings: string[] = [];

  // Separate inflexible and flexible appointments
  const inflexibleAppointments = appointments.filter(isInflexible).sort((a, b) => {
    if (!a.startTime || !b.startTime) return 0;
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });

  const flexibleAppointments = appointments.filter((apt) => !isInflexible(apt));

  // Start with inflexible appointments as anchors
  const orderedAppointments: GeocodedAppointment[] = [...inflexibleAppointments];

  // Insert flexible appointments using nearest neighbor
  for (const flexibleApt of flexibleAppointments) {
    await insertFlexibleAppointment(flexibleApt, orderedAppointments);
  }

  // Final optimization: try to insert inflexible appointments earlier if better
  const finalOptimized = await optimizeInflexiblePositions(orderedAppointments, inflexibleAppointments);

  // Calculate the final route details
  const result = await calculateRoute(finalOptimized);

  // Add warning if route has many long segments (potential inefficiency)
  const avgSegmentDistance = result.totalDistance / Math.max(result.stops.length - 1, 1);
  if (avgSegmentDistance > 50000) {
    // > 50km average per segment
    warnings.push(
      'Route has long distances between stops. Consider breaking into multiple days or combining nearby appointments.'
    );
  }

  return {
    ...result,
    warnings,
  };
}

/**
 * Insert a flexible appointment at the best position (nearest neighbor)
 * @param flexibleApt - Flexible appointment to insert
 * @param orderedAppointments - Current ordered list
 */
async function insertFlexibleAppointment(
  flexibleApt: GeocodedAppointment,
  orderedAppointments: GeocodedAppointment[]
): Promise<void> {
  if (orderedAppointments.length === 0) {
    orderedAppointments.push(flexibleApt);
    return;
  }

  // Find best insertion position
  let bestPosition = 0;
  let bestCost = Infinity;

  // Try inserting at each position
  for (let position = 0; position <= orderedAppointments.length; position++) {
    const testOrder = [...orderedAppointments];
    testOrder.splice(position, 0, flexibleApt);

    // Calculate cost for this position
    const cost = await calculateRouteCost(testOrder);

    if (cost < bestCost) {
      bestCost = cost;
      bestPosition = position;
    }
  }

  // Insert at best position
  orderedAppointments.splice(bestPosition, 0, flexibleApt);
}

/**
 * Optimize positions of inflexible appointments (try to insert earlier if beneficial)
 * @param currentOrder - Current order of all appointments
 * @param inflexibleList - Original inflexible appointments
 * @returns Optimized order
 */
async function optimizeInflexiblePositions(
  currentOrder: GeocodedAppointment[],
  inflexibleList: GeocodedAppointment[]
): Promise<GeocodedAppointment[]> {
  // For now, keep inflexible in their original order
  // In V2, we could try swapping if it reduces total distance
  return currentOrder;
}

/**
 * Calculate the total cost (distance) of a route
 * Lower is better
 * @param appointments - Ordered appointments
 * @returns Total route cost
 */
async function calculateRouteCost(appointments: GeocodedAppointment[]): Promise<number> {
  if (appointments.length <= 1) return 0;

  let totalCost = 0;

  // Calculate cost between consecutive appointments
  for (let i = 0; i < appointments.length - 1; i++) {
    const from = appointments[i];
    const to = appointments[i + 1];

    try {
      const distance = await getDistanceMatrix(
        { lat: from.latitude, lng: from.longitude },
        [{ lat: to.latitude, lng: to.longitude }]
      );

      if (distance.length > 0) {
        totalCost += distance[0].distance;
      } else {
        // Could not get distance, use geodesic distance as fallback
        const geodesicDist = haversineDistance(
          from.latitude,
          from.longitude,
          to.latitude,
          to.longitude
        );
        totalCost += geodesicDist * 1000; // Convert km to meters
      }
    } catch (error) {
      // Fallback to geodesic distance
      const geodesicDist = haversineDistance(
        from.latitude,
        from.longitude,
        to.latitude,
        to.longitude
      );
      totalCost += geodesicDist * 1000;
    }
  }

  return totalCost;
}

/**
 * Calculate final route details (arrival times, travel times, etc.)
 * @param orderedAppointments - Final ordered appointments
 * @returns Route with all details
 */
async function calculateRoute(orderedAppointments: GeocodedAppointment[]): Promise<{
  stops: VisitStop[];
  totalDistance: number;
  totalDriveTime: number;
  totalVisitTime: number;
}> {
  const stops: VisitStop[] = [];
  let totalDistance = 0;
  let totalDriveTime = 0;
  let totalVisitTime = 0;

  if (orderedAppointments.length === 0) {
    return { stops, totalDistance, totalDriveTime, totalVisitTime };
  }

  // Start time: 9:00 AM or first appointment's preferred time (whichever is earlier)
  let currentTime =
    orderedAppointments[0].startTime && isInflexible(orderedAppointments[0])
      ? timeToMinutes(orderedAppointments[0].startTime)
      : 9 * 60; // 9:00 AM

  // First stop has no travel time
  const firstApt = orderedAppointments[0];
  const firstStop: VisitStop = {
    appointment: firstApt,
    order: 1,
    arrivalTime: minutesToTime(currentTime),
    travelTimeFromPrevious: 0,
    distanceFromPrevious: 0,
    status: getArrivalStatus(minutesToTime(currentTime), firstApt.startTime || '09:00', GRACE_PERIOD_MINUTES),
    minutesFromPreferred: firstApt.startTime
      ? Math.abs(timeToMinutes(minutesToTime(currentTime)) - timeToMinutes(firstApt.startTime))
      : 0,
  };
  stops.push(firstStop);
  totalVisitTime += firstApt.visitDurationMinutes;

  // Calculate for remaining stops
  for (let i = 1; i < orderedAppointments.length; i++) {
    const prevApt = orderedAppointments[i - 1];
    const currentApt = orderedAppointments[i];

    // Get travel from previous to current
    const distanceResult = await getDistanceMatrix(
      { lat: prevApt.latitude, lng: prevApt.longitude },
      [{ lat: currentApt.latitude, lng: currentApt.longitude }]
    );

    let travelTime = 10; // Default
    let distance = 5000; // Default 5km

    if (distanceResult.length > 0) {
      travelTime = distanceResult[0].duration;
      distance = distanceResult[0].distance;
    } else {
      // Fallback to geodesic distance
      const geodesicDist = haversineDistance(
        prevApt.latitude,
        prevApt.longitude,
        currentApt.latitude,
        currentApt.longitude
      );
      travelTime = Math.round(geodesicDist * 1.2); // Assume km/h speed
      distance = geodesicDist * 1000;
    }

    // Update times
    currentTime += prevApt.visitDurationMinutes + travelTime;

    // Create stop
    const stop: VisitStop = {
      appointment: currentApt,
      order: i + 1,
      arrivalTime: minutesToTime(currentTime),
      travelTimeFromPrevious: travelTime,
      distanceFromPrevious: distance,
      status: getArrivalStatus(
        minutesToTime(currentTime),
        currentApt.startTime || minutesToTime(currentTime),
        GRACE_PERIOD_MINUTES
      ),
      minutesFromPreferred: currentApt.startTime
        ? Math.abs(timeToMinutes(minutesToTime(currentTime)) - timeToMinutes(currentApt.startTime))
        : 0,
    };

    stops.push(stop);
    totalDistance += distance;
    totalDriveTime += travelTime;
    totalVisitTime += currentApt.visitDurationMinutes;
  }

  return { stops, totalDistance, totalDriveTime, totalVisitTime };
}
