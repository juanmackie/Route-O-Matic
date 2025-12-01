import { DistanceResult } from '../types';
import { distanceCache } from './cache';
import { getDistanceCacheKey } from './client';

/**
 * Get driving distance and duration between two points using Distance Matrix API
 * @param from - Starting point coordinates
 * @param to - Destination point coordinates
 * @returns Distance and duration result
 */
export async function getDistance(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<DistanceResult> {
  const cacheKey = getDistanceCacheKey(from, to);

  // Check cache first
  const cached = distanceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  try {
    const fromStr = `${from.lat},${from.lng}`;
    const toStr = `${to.lat},${to.lng}`;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      fromStr
    )}&destinations=${encodeURIComponent(toStr)}&key=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 1 day
    });

    if (!response.ok) {
      throw new Error(`Distance Matrix API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Distance Matrix failed: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
    }

    if (!data.rows || !data.rows[0] || !data.rows[0].elements || !data.rows[0].elements[0]) {
      throw new Error('Invalid Distance Matrix response format');
    }

    const element = data.rows[0].elements[0];

    if (element.status !== 'OK') {
      throw new Error(`Route not found: ${element.status}`);
    }

    const distanceResult: DistanceResult = {
      distance: element.distance.value,
      duration: Math.round(element.duration.value / 60), // Convert to minutes
      from,
      to,
    };

    // Cache the result
    distanceCache.set(cacheKey, distanceResult);

    return distanceResult;
  } catch (error) {
    throw new Error(`Failed to get distance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get distances and durations from one origin to multiple destinations
 * @param from - Starting point coordinates
 * @param to - Array of destination coordinates
 * @returns Array of distance results (kept in same order as input)
 */
export async function getDistanceMatrix(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }[]
): Promise<DistanceResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  // Split into chunks of 25 (Distance Matrix API limit)
  const CHUNK_SIZE = 25;
  const results: DistanceResult[] = [];

  for (let i = 0; i < to.length; i += CHUNK_SIZE) {
    const chunk = to.slice(i, i + CHUNK_SIZE);
    const fromStr = `${from.lat},${from.lng}`;
    const toStr = chunk.map((c) => `${c.lat},${c.lng}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${encodeURIComponent(fromStr)}&` +
      `destinations=${encodeURIComponent(toStr)}&` +
      `key=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`Distance Matrix API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Distance Matrix failed: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
    }

    if (!data.rows || !data.rows[0] || !data.rows[0].elements) {
      throw new Error('Invalid Distance Matrix response format');
    }

    const elements = data.rows[0].elements;

    elements.forEach((element: any, idx: number) => {
      const destination = chunk[idx];

      if (element.status === 'OK') {
        const distanceResult: DistanceResult = {
          distance: element.distance.value,
          duration: Math.round(element.duration.value / 60),
          from,
          to: destination,
        };

        results.push(distanceResult);

        // Cache the result
        const cacheKey = getDistanceCacheKey(from, destination);
        distanceCache.set(cacheKey, distanceResult);
      } else {
        // Could not find route, use a large distance
        results.push({
          distance: 999999, // Very large distance
          duration: 9999, // Very long duration
          from,
          to: destination,
        });
      }
    });

    // Brief delay to respect rate limits
    if (i + CHUNK_SIZE < to.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}

// Re-export utility functions for convenience
export { clearCaches, getCacheStats } from './cache-utils';
