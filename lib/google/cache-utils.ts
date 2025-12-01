import { geocodingCache, distanceCache } from './cache';

/**
 * Clear all caches (useful for testing)
 */
export function clearCaches(): void {
  geocodingCache.clear();
  distanceCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { geocoding: number; distance: number } {
  return {
    geocoding: geocodingCache.size(),
    distance: distanceCache.size(),
  };
}
