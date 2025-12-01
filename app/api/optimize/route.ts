import { NextRequest, NextResponse } from 'next/server';
import { optimizeRoute } from '@/lib/algorithm/optimizer';
import { GeocodedAppointment, OptimizeResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.appointments || !Array.isArray(body.appointments)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format. Expected { appointments: [...] }',
        },
        { status: 400 }
      );
    }

    const geocodedAppointments: GeocodedAppointment[] = body.appointments;

    // Step 1: Validate appointments have required geocoded fields
    for (const apt of geocodedAppointments) {
      if (
        !apt.id ||
        !apt.appName ||
        !apt.address ||
        typeof apt.visitDurationMinutes !== 'number' ||
        !apt.date ||
        !apt.flexibility ||
        typeof apt.latitude !== 'number' ||
        typeof apt.longitude !== 'number' ||
        !apt.formattedAddress
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Each appointment must be geocoded with: id, appName, address, visitDurationMinutes (number), date, flexibility, latitude, longitude, and formattedAddress',
          },
          { status: 400 }
        );
      }
    }

    // Step 2: Optimize the route (appointments are already geocoded)
    const optimizationResult = await optimizeRoute(geocodedAppointments);

    if (!optimizationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: optimizationResult.error || 'Route optimization failed',
          warnings: optimizationResult.warnings,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      route: optimizationResult,
    });
  } catch (error) {
    console.error('Optimization error:', error);

    const response: OptimizeResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during optimization',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
