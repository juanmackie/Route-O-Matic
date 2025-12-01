import { DistanceResult } from '../types';

/**
 * In-memory cache for distance matrix results
 * Cache key format: "lat1,lng1:lat2,lng2"
 */
export class DistanceCache {
  private cache = new Map<string, DistanceResult>();

  /**
   * Generate cache key for a distance query
   * @param from - Origin coordinates
   * @param to - Destination coordinates
   * @returns Cache key string
   */
  private static generateKey(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): string {
    // Use 5 decimal precision for coordinates (about 1 meter accuracy)
    return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}:${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  }

  /**
   * Get cached distance result
   * @param from - Origin coordinates
   * @param to - Destination coordinates
   * @returns Cached result or undefined if not found
   */
  get(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): DistanceResult | undefined {
    const key = DistanceCache.generateKey(from, to);
    return this.cache.get(key);
  }

  /**
   * Store distance result in cache
   * @param from - Origin coordinates
   * @param to - Destination coordinates
   * @param result - Distance result to cache
   */
  set(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    result: DistanceResult
  ): void {
    const key = DistanceCache.generateKey(from, to);
    this.cache.set(key, result);
  }

  /**
   * Check if result exists in cache
   * @param from - Origin coordinates
   * @param to - Destination coordinates
   * @returns Whether result is cached
   */
  has(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): boolean {
    const key = DistanceCache.generateKey(from, to);
    return this.cache.has(key);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get number of cached entries
   * @returns Cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns Object with cache size
   */
  getStats(): { size: number } {
    return {
      size: this.size(),
    };
  }

  /**
   * Get all cache keys (for debugging)
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Create a global cache instance
const globalDistanceCache = new DistanceCache();

/**
 * Get the global distance cache instance
 * @returns Global cache instance
 */
export function getDistanceCache(): DistanceCache {
  return globalDistanceCache;
}

/**
 * Clear the global distance cache
 */
export function clearDistanceCache(): void {
  globalDistanceCache.clear();
}

/**
 * Get cache statistics
 * @returns Cache statistics
 */
export function getCacheStats(): { size: number } {
  return globalDistanceCache.getStats();
}
