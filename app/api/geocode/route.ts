import { NextRequest, NextResponse } from 'next/server';
import { batchGeocode } from '@/lib/google/geocoder';
import { Appointment, GeocodedAppointment } from '@/lib/types';

interface GeocodingErrorResponse {
  success: false;
  error: string;
  errorType?: 'API_KEY_MISSING' | 'API_KEY_INVALID' | 'QUOTA_EXCEEDED' | 'NETWORK_ERROR' | 'INVALID_ADDRESS' | 'SERVER_ERROR';
  geocoded?: GeocodedAppointment[];
  errors?: { index: number; message: string }[];
  details?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.appointments || !Array.isArray(body.appointments)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format. Expected { appointments: [...] }',
          errorType: 'SERVER_ERROR',
        },
        { status: 400 }
      );
    }

    const appointments: Appointment[] = body.appointments;

    // Validate each appointment has required fields
    for (const apt of appointments) {
      if (!apt.id || !apt.address) {
        return NextResponse.json(
          {
            success: false,
            error: 'Each appointment must have id and address',
            errorType: 'SERVER_ERROR',
          },
          { status: 400 }
        );
      }
    }

    const result = await batchGeocode(appointments);

    return NextResponse.json(result);
  } catch (error) {
    // Enhanced error logging with specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during geocoding';

    // Categorize errors based on error message content
    let errorType: GeocodingErrorResponse['errorType'] = 'SERVER_ERROR';

    if (errorMessage.includes('Google Maps API key not configured')) {
      errorType = 'API_KEY_MISSING';
      console.error('API Key Error:', errorMessage);
    } else if (errorMessage.includes('REQUEST_DENIED') || errorMessage.includes('API key')) {
      errorType = 'API_KEY_INVALID';
      console.error('Invalid API Key:', errorMessage);
    } else if (errorMessage.includes('OVER_QUERY_LIMIT') || errorMessage.includes('quota')) {
      errorType = 'QUOTA_EXCEEDED';
      console.error('Quota Exceeded:', errorMessage);
    } else if (errorMessage.includes('Network error') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNREFUSED')) {
      errorType = 'NETWORK_ERROR';
      console.error('Network Error:', errorMessage);
    } else if (errorMessage.includes('ZERO_RESULTS') || errorMessage.includes('not found')) {
      errorType = 'INVALID_ADDRESS';
      console.error('Address Error:', errorMessage);
    } else {
      console.error('Geocoding Server Error:', errorMessage, error);
    }

    const response: GeocodingErrorResponse = {
      success: false,
      error: errorMessage,
      errorType,
    };

    // Add debug details in development mode
    if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
      response.details = error instanceof Error ? { stack: error.stack } : error;
    }

    return NextResponse.json(response, { status: 500 });
  }
}
