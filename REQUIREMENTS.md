# Route-O-Matic V3 - Requirements Specification

## Overview
A minimal, highly efficient route optimization application for desktop users, hosted on Vercel. The application ingests appointment data via CSV, validates addresses using Google Maps API, and computes the most efficient route while respecting time window constraints.

---

## Core Philosophy
Following vibe coding principles:
- **Simplicity first**: Build the minimum viable solution that works
- **Progressive enhancement**: Start basic, add features as needed
- **Security-conscious**: Protect API keys, validate all inputs
- **Desktop-optimized**: No mobile responsiveness required for V1

---

## CSV Input Specification

### Required Headers (exact match, case-sensitive)
```csv
app_name,address,visitdurationMinutes,startTime,flexible/inflexible
```

### Field Definitions

| Field | Type | Description | Example | Validation |
|-------|------|-------------|---------|------------|
| `app_name` | String | User-friendly appointment name | "Client Meeting", "Site Visit" | Required, 1-200 chars |
| `address` | String | Street address for appointment | "123 Main St, Sydney NSW 2000" | Required, will be validated by Google Maps |
| `visitdurationMinutes` | Integer | Time required at appointment (minutes) | 30, 60, 120 | Required, 1-480 (8 hours max) |
| `startTime` | Time | Preferred/required start time | "09:00", "14:30" | Required, 24h format HH:MM |
| `flexible/inflexible` | Enum | Whether appointment can be rescheduled | "flexible", "inflexible" | Required, exactly these strings |

### Example CSV
```csv
app_name,address,visitdurationMinutes,startTime,flexible/inflexible
Morning Delivery,456 George St Sydney NSW 2000,45,09:00,inflexible
Client Consultation,78 Pitt St Sydney NSW 2000,60,11:00,flexible
Lunch Meeting,321 Kent St Sydney NSW 2000,90,12:30,inflexible
Site Inspection,12 Bridge St Sydney NSW 2000,30,15:00,flexible
```

### Edge Cases to Handle
- **BOM (Byte Order Mark)**: Strip UTF-8 BOM if present
- **Empty rows**: Ignore blank lines
- **Malformed data**: Flag and report errors with row numbers
- **Duplicate addresses**: Allow, but warn user
- **Time format variations**: Accept both "9:00" and "09:00"

---

## Google Maps API Integration

### Address Validation API
**Purpose**: Sanitize and validate addresses before geocoding

**Process**:
1. Send each address to [Address Validation API](https://developers.google.com/maps/documentation/address-validation)
2. Check `verdict.addressComplete` and `verdict.hasInferredComponents`
3. Use `formattedAddress` from response as canonical address
4. Store geocoded `latitude` and `longitude`
5. Flag addresses with low confidence scores

**Error Handling**:
- Address not found → Flag for user review with suggestion
- Ambiguous address → Present alternatives to user
- API quota exceeded → Batch requests, show progress

### Distance Matrix API
**Purpose**: Calculate travel times and distances between all appointments

**Process**:
1. Build matrix of all appointment pairs (N×N where N = number of appointments)
2. Request driving directions with departure time consideration
3. Store both `distance.value` (meters) and `duration.value` (seconds)
4. Handle API element limits (max 100 elements per request = 10×10 matrix)

**Batching Strategy**:
- If N > 10, split into batches
- Cache results to avoid redundant API calls
- Use `departure_time` parameter to account for traffic

> [!WARNING]
> **API Costs**: Distance Matrix API charges per element. 100 appointments = 10,000 elements = significant cost. Implement caching and minimize redundant calls.

---

## Route Optimization Algorithm

### Core Requirements

1. **Time Window Constraints** (STRICT)
   - **Inflexible appointments**: MUST occur at exact `startTime`
   - **Flexible appointments**: Can be moved to any time that improves route efficiency
   - Travel time + visit duration must not cause conflicts

2. **Optimization Goal**
   - Minimize total travel time while respecting all constraints
   - Secondary goal: Minimize total distance if travel times are equal

3. **Constraints**
   - Appointment start time >= previous appointment end time + travel time
   - No overlapping appointments
   - All appointments must be visited exactly once

### Algorithm Strategy

**Recommended Approach**: Nearest Neighbor with Time Window Constraints

```
1. Sort inflexible appointments by startTime (these are anchors)
2. For each time window between inflexible appointments:
   a. Find unassigned flexible appointments that fit
   b. Use nearest neighbor to minimize travel within window
   c. Assign optimal startTime to each flexible appointment
3. Build final route respecting chronological order
```

**Alternative for Advanced Optimization**: Genetic Algorithm or Simulated Annealing
- Only if basic algorithm proves insufficient
- Trade-off: complexity vs. marginal gains

### Output Format

```typescript
interface OptimizedRoute {
  appointments: Array<{
    app_name: string;
    address: string;
    latitude: number;
    longitude: number;
    visitdurationMinutes: number;
    originalStartTime: string;
    optimizedStartTime: string;
    optimizedEndTime: string;
    travelTimeFromPrevious: number; // seconds
    distanceFromPrevious: number;   // meters
    flexibility: 'flexible' | 'inflexible';
    sequence: number; // 1-indexed route order
  }>;
  summary: {
    totalTravelTime: number;    // seconds
    totalDistance: number;      // meters
    totalDuration: number;      // seconds (travel + visits)
    routeStartTime: string;
    routeEndTime: string;
  };
}
```

---

## User Workflow

### Phase 1: Upload
1. User drags/selects CSV file
2. Application parses CSV and validates format
3. Display preview table with all appointments
4. Show immediate errors (missing fields, invalid formats)

### Phase 2: Validation
1. Send addresses to Google Address Validation API
2. Show progress indicator (e.g., "Validating 8/15 addresses...")
3. Display validation results:
   - ✅ Confirmed addresses
   - ⚠️ Addresses with suggestions (let user accept/edit)
   - ❌ Invalid addresses (require user correction)
4. User reviews and confirms all addresses

### Phase 3: Optimization
1. Calculate distance matrix (show progress)
2. Run optimization algorithm
3. Display optimized route with:
   - Map visualization (Google Maps embed or Leaflet)
   - Timeline view showing appointment sequence
   - Summary statistics (total time, distance)
   - Highlight which appointments were moved

### Phase 4: Export/Use
1. User can download optimized route as:
   - CSV with new times
   - Google Maps link with waypoints
   - Printable itinerary
2. Option to adjust and re-optimize

---

## Technical Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS (confirm preferred version with user if needed)
- **CSV Parsing**: `papaparse` (proven, reliable, no hallucination)
- **Maps**: Google Maps JavaScript API or `react-google-maps/api`
- **State Management**: React hooks (keep it simple)

### Backend/API
- **Serverless Functions**: Vercel Edge Functions or Node.js Serverless
- **Google Maps Integration**: Server-side API calls to protect API keys
- **Environment Variables**: Store `GOOGLE_MAPS_API_KEY` in Vercel env vars

### Deployment
- **Platform**: Vercel
- **Domain**: Vercel-provided or custom domain
- **Build**: Next.js static export or SSR (TBD based on needs)

---

## Security Considerations

> [!CAUTION]
> **API Key Protection**: Never expose Google Maps API key in client-side code. Always proxy through serverless functions.

### Required Security Measures
1. **API Key Protection**:
   - Store in Vercel environment variables
   - Use API key restrictions (HTTP referrers for Maps JS, IP for backend APIs)
   - Implement rate limiting on serverless endpoints

2. **Input Validation**:
   - Sanitize all CSV inputs
   - Validate data types before processing
   - Prevent CSV injection attacks (escape formulas)

3. **File Upload**:
   - Limit file size (e.g., max 1MB)
   - Validate MIME type (text/csv)
   - Scan for malicious content

4. **CORS & Headers**:
   - Set appropriate CORS policies
   - Use CSP headers to prevent XSS

---

## Open Questions for User

> [!IMPORTANT]
> **Critical Decisions Needed**:

1. **Start Location**: 
   - Does the route start from a depot/home address?
   - Or from the first appointment in the optimized sequence?

2. **End Location**: 
   - Should the route return to the starting point (round trip)?
   - Or end at the last appointment?

3. **Flexible Appointment Windows**: 
   - Can flexible appointments be moved to ANY time on the same day?
   - Or are there working hours constraints (e.g., 8am-6pm)?

4. **Multi-Day Support**: 
   - V1: Single day only?
   - Future: Multiple days in one CSV?

5. **Google Maps API Budget**: 
   - Expected number of appointments per route?
   - Monthly usage estimates for cost planning?

6. **Authentication**: 
   - Public access or login required?
   - Per-user route history needed?

---

## Assumptions (Confirm or Correct)

- All appointments occur on the same day
- No traffic/time-of-day optimization in V1 (can add later)
- Desktop users have modern browsers (Chrome/Firefox/Edge)
- Average route has 5-20 appointments (impacts API batching strategy)
- User manually triggers optimization (no auto-save/background processing)

---

## Success Criteria

### Minimum Viable Product (V1)
- ✅ Parse CSV with exact headers specified
- ✅ Validate all addresses via Google Maps
- ✅ Respect inflexible appointment times (zero tolerance)
- ✅ Optimize flexible appointments to minimize travel time
- ✅ Display optimized route on map
- ✅ Export results as CSV
- ✅ Deploy to Vercel without errors
- ✅ API keys secured in environment variables

### Future Enhancements (V2+)
- Support for multiple days
- Real-time traffic consideration
- User accounts and route history
- Mobile responsiveness
- Alternative route suggestions
- Integration with calendar apps (Google Calendar, Outlook)

---

## Next Steps

1. **Review this document** and answer open questions
2. **Confirm tech stack** (especially Tailwind version if using)
3. **Set up Google Cloud Project** and enable required APIs:
   - Address Validation API
   - Distance Matrix API
   - Maps JavaScript API (for visualization)
4. **Create Vercel project** and configure environment variables
5. **Begin implementation** following task.md checklist

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-30  
**Status**: Awaiting user feedback on open questions
