import { validateApiKey } from './google/client';
import { GeocodingErrorType } from './types';

/**
 * API Configuration Validation Result
 */
export interface APIValidationResult {
  success: boolean;
  apiKeyPresent: boolean;
  apiKeyValid: boolean | null; // null = not tested
  geocodingAPIEnabled: boolean | null;
  distanceMatrixAPIEnabled: boolean | null;
  error?: string;
  errorType?: GeocodingErrorType;
  details?: {
    testAddress?: string;
    testResult?: string;
  };
}

/**
 * Validate API configuration and optionally test the API key
 * @param test - Whether to actually test the API with a test geocoding request
 * @returns Validation result
 */
export async function validateAPI(
  test: boolean = false
): Promise<APIValidationResult> {
  // First check if API key is present
  const apiKeyValidation = validateApiKey();

  if (!apiKeyValidation.valid) {
    return {
      success: false,
      apiKeyPresent: !!process.env.GOOGLE_MAPS_API_KEY,
      apiKeyValid: false,
      geocodingAPIEnabled: null,
      distanceMatrixAPIEnabled: null,
      error: apiKeyValidation.error,
      errorType: apiKeyValidation.errorType,
    };
  }

  // If not testing, return partial validation
  if (!test) {
    return {
      success: true,
      apiKeyPresent: true,
      apiKeyValid: null, // Not tested
      geocodingAPIEnabled: null,
      distanceMatrixAPIEnabled: null,
    };
  }

  // If testing, perform a test geocoding request
  try {
    const testAddress = '1600 Pennsylvania Avenue, Washington, DC'; // Well-known test address
    const apiKey = process.env.GOOGLE_MAPS_API_KEY!;

    const encodedAddress = encodeURIComponent(testAddress);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: data.status === 'OK',
      apiKeyPresent: true,
      apiKeyValid: data.status !== 'REQUEST_DENIED',
      geocodingAPIEnabled: data.status !== 'REQUEST_DENIED',
      distanceMatrixAPIEnabled: null, // Would need separate test
      error: data.status === 'OK' ? undefined : `Geocoding API test failed: ${data.status}`,
      details: {
        testAddress,
        testResult: data.status,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during API test';

    return {
      success: false,
      apiKeyPresent: true,
      apiKeyValid: null,
      geocodingAPIEnabled: null,
      distanceMatrixAPIEnabled: null,
      error: `API test error: ${errorMessage}`,
      errorType: 'SERVER_ERROR',
    };
  }
}

/**
 * Get API diagnostics to help troubleshoot issues
 * @returns Diagnostics information
 */
export async function getAPIDiagnostics(): Promise<{
  apiKeyPresent: boolean;
  apiKeyConfigured: boolean;
  isDummyKey: boolean;
  apiKeyLength: number;
  apiKeyFormat: 'valid' | 'invalid' | 'unknown';
  recommendation?: string;
}> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return {
      apiKeyPresent: false,
      apiKeyConfigured: false,
      isDummyKey: false,
      apiKeyLength: 0,
      apiKeyFormat: 'invalid',
      recommendation: 'Please set GOOGLE_MAPS_API_KEY in your .env.local file',
    };
  }

  const isDummyKey = apiKey.includes('DummyKey') || apiKey.includes('AIzaSyDummyKey');
  const expectedKeyPattern = /^AIza[0-9A-Za-z\-_]{35}$/;
  const apiKeyFormat = expectedKeyPattern.test(apiKey) ? 'valid' : 'invalid';

  if (isDummyKey) {
    return {
      apiKeyPresent: true,
      apiKeyConfigured: true,
      isDummyKey: true,
      apiKeyLength: apiKey.length,
      apiKeyFormat: 'invalid',
      recommendation: 'Please replace the dummy API key with your actual Google Maps API key',
    };
  }

  if (apiKeyFormat === 'invalid') {
    return {
      apiKeyPresent: true,
      apiKeyConfigured: true,
      isDummyKey: false,
      apiKeyLength: apiKey.length,
      apiKeyFormat: 'invalid',
      recommendation: 'API key format appears incorrect. Google Maps API keys should start with "AIza" and be 39 characters',
    };
  }

  return {
    apiKeyPresent: true,
    apiKeyConfigured: true,
    isDummyKey: false,
    apiKeyLength: apiKey.length,
    apiKeyFormat: 'valid',
    recommendation: 'API key appears to be configured correctly. Try testing the geocoding API.',
  };
}

/**
 * Get helpful error resolution suggestions based on error type
 */
export function getErrorResolution(errorType: GeocodingErrorType): string {
  switch (errorType) {
    case 'API_KEY_MISSING':
      return 'Add your Google Maps API key to the .env.local file: GOOGLE_MAPS_API_KEY=your_key_here';

    case 'API_KEY_INVALID':
      return `1. Verify your API key at https://console.cloud.google.com/apis/credentials
2. Enable Geocoding API for your project
3. Check API restrictions (should allow HTTP referrers or be unrestricted during testing)
4. Ensure billing is enabled on your Google Cloud project`;

    case 'QUOTA_EXCEEDED':
      return `1. Check your API usage at https://console.cloud.google.com/apis/api/geocoding.googleapis.com/quotas
2. Consider increasing your quota limits
3. Implement rate limiting optimization
4. Wait before retrying`;

    case 'NETWORK_ERROR':
      return `1. Check your internet connection
2. Verify firewall/proxy settings
3. Try again in a few moments
4. Check if Google Maps API is accessible from your network`;

    case 'ZERO_RESULTS':
      return `1. Check the address format and spelling
2. Ensure the address is complete (street number, city, state, country)
3. Try a more general address format
4. Verify the address exists`;

    case 'INVALID_ADDRESS':
      return 'Review and correct the address format in your CSV file';

    case 'SERVER_ERROR':
      return 'This may be a temporary Google Maps API issue. Try again in a few moments.';

    default:
      return 'Please check the error message and try again.';
  }
}
