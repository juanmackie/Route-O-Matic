import { GeocodingResult, DistanceResult } from '../types';

/**
 * Simple in-memory cache for geocoding results
 */
export class GeocodingCache {
  private cache = new Map<string, GeocodingResult>();

  get(key: string): GeocodingResult | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: GeocodingResult): void {
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Simple in-memory cache for distance matrix results
 */
export class DistanceCache {
  private cache = new Map<string, DistanceResult>();

  get(key: string): DistanceResult | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: DistanceResult): void {
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Initialize singleton cache instances
const geocodingCache = new GeocodingCache();
const distanceCache = new DistanceCache();

export { geocodingCache, distanceCache };
