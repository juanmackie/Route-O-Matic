import { GeocodingErrorType } from '../types';

/**
 * Validate Google Maps API key
 */
export function validateApiKey(): { valid: boolean; error?: string; errorType?: GeocodingErrorType } {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return {
      valid: false,
      error: 'Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY environment variable.',
      errorType: 'API_KEY_MISSING',
    };
  }

  // Check if it's the dummy key
  if (apiKey.includes('DummyKey') || apiKey.includes('AIzaSyDummyKey')) {
    return {
      valid: false,
      error: 'Google Maps API key appears to be a dummy/test key. Please set a valid API key.',
      errorType: 'API_KEY_INVALID',
    };
  }

  return { valid: true };
}

/**
 * Get cache key for an address (normalized)
 */
export function getCacheKey(address: string): string {
  return address.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get cache key for a distance query
 */
export function getDistanceCacheKey(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}:${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
}

/**
 * Parse Google Maps API error status and get error type
 */
export function getErrorTypeFromStatus(status: string | undefined, errorMessage?: string): GeocodingErrorType {
  if (!status) return 'SERVER_ERROR';

  switch (status) {
    case 'REQUEST_DENIED':
      return 'API_KEY_INVALID';
    case 'OVER_QUERY_LIMIT':
      return 'QUOTA_EXCEEDED';
    case 'INVALID_REQUEST':
      return 'INVALID_ADDRESS';
    case 'UNKNOWN_ERROR':
      return 'SERVER_ERROR';
    case 'ZERO_RESULTS':
      return 'ZERO_RESULTS';
    default:
      return 'SERVER_ERROR';
  }
}
