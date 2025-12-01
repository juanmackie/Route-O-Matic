import { GeocodedAppointment, Appointment, GeocodingResult, GeocodingErrorType } from '../types';
import { geocodingCache } from './cache';
import { validateApiKey, getCacheKey, getErrorTypeFromStatus } from './client';

/**
 * Geocode an address using Google Geocoding API
 * @param address - Address to geocode
 * @returns Geocoding result with coordinates or error
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const cacheKey = getCacheKey(address);

  // Check cache first
  const cached = geocodingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Validate API key
  const apiKeyValidation = validateApiKey();
  if (!apiKeyValidation.valid) {
    return {
      success: false,
      error: apiKeyValidation.error,
      errorType: apiKeyValidation.errorType,
    };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY!;

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 1 day
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      const errorType = getErrorTypeFromStatus(data.status, data.error_message);
      const error = `Geocoding failed: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`;

      return {
        success: false,
        error,
        errorType,
      };
    }

    // Get the first result
    const result = data.results[0];
    const { lat, lng } = result.geometry.location;

    const geocodingResult: GeocodingResult = {
      success: true,
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
    };

    // Cache the result
    geocodingCache.set(cacheKey, geocodingResult);

    return geocodingResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during geocoding';
    const errorType = errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')
      ? 'NETWORK_ERROR'
      : 'SERVER_ERROR';

    return {
      success: false,
      error: errorMessage,
      errorType,
    };
  }
}

/**
 * Batch geocode multiple addresses
 * @param appointments - Appointments to geocode
 * @returns Array of geocoded appointments or errors
 */
export async function batchGeocode(
  appointments: Appointment[]
): Promise<{ success: boolean; geocoded: GeocodedAppointment[]; errors: { index: number; message: string; errorType?: GeocodingErrorType }[] }> {
  const results: GeocodedAppointment[] = [];
  const errors: { index: number; message: string; errorType?: GeocodingErrorType }[] = [];

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 10;
  const batches: Appointment[][] = [];

  for (let i = 0; i < appointments.length; i += BATCH_SIZE) {
    batches.push(appointments.slice(i, i + BATCH_SIZE));
  }

  // Flag to check if we encountered a critical API error (should stop processing)
  let criticalError: { type: GeocodingErrorType; message: string } | undefined = undefined;

  // Process each batch sequentially
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    if (criticalError !== undefined) {
      // If we hit a critical API error, stop processing and return immediately
      break;
    }

    const batch = batches[batchIndex];

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (apt, indexInBatch) => {
        const result = await geocodeAddress(apt.address);
        const appointmentIndex = batchIndex * BATCH_SIZE + indexInBatch;

        if (!result.success || result.latitude === undefined || result.longitude === undefined) {
          // Check if this is a critical API error (affects all geocoding)
          if (
            result.errorType === 'API_KEY_MISSING' ||
            result.errorType === 'API_KEY_INVALID' ||
            result.errorType === 'QUOTA_EXCEEDED' ||
            result.errorType === 'NETWORK_ERROR'
          ) {
            criticalError = {
              type: result.errorType,
              message: result.error || 'Critical API error',
            };
            return null;
          }

          errors.push({
            index: appointmentIndex,
            message: result.error || 'Geocoding failed',
            errorType: result.errorType,
          });
          return null;
        }

        return {
          ...apt,
          latitude: result.latitude,
          longitude: result.longitude,
          formattedAddress: result.formattedAddress || apt.address,
        } as GeocodedAppointment;
      })
    );

    // Add successful results
    results.push(...batchResults.filter((r): r is GeocodedAppointment => r !== null));

    // Brief delay between batches to respect rate limits
    if (batchIndex < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // If we encountered a critical error, return it immediately
  if (criticalError) {
    return {
      success: false,
      geocoded: results,
      errors: [
        {
          index: -1,
          message: (criticalError as any).message,
          errorType: (criticalError as any).type,
        },
      ],
    };
  }

  return {
    success: errors.length === 0,
    geocoded: results,
    errors,
  };
}
