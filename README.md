# Route-O-Matic V3

Route optimization application for appointment scheduling. Built with Next.js, TypeScript, and Google Maps API.

## Features

- Upload CSV files with appointment data
- Optimize routes for 20-50 stops
- Respect time windows (±15 min grace period for inflexible appointments)
- Calculate efficient routes using Google Maps Distance Matrix API
- Download optimized routes as CSV

## Getting Started

### Prerequisites

- Node.js 18+ (LATEST LTS 20.x Recommended)
- Google Maps API key with Geocoding and Distance Matrix APIs enabled

### Installation

1. Clone the repository or download the codebase
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

4. Edit `.env.local` and add your Google Maps API key:

```env
GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Getting a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Geocoding API
   - Distance Matrix API
4. Create an API key (APIs & Services > Credentials)
5. Restrict the API key (recommended):
   - Application restrictions: HTTP referrers
   - Add: `*.vercel.app/*`
   - API restrictions: Only enable Geocoding API and Distance Matrix API

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### CSV Format

The CSV file must have the following columns (in any order):

| Column | Description | Format |
|--------|-------------|--------|
| app_name | Appointment name | String |
| address | Full street address | String (e.g., "123 Main St, City, State") |
| visitdurationMinutes | Time required at location | Number |
| startTime | Preferred start time | HH:MM or "flexible" |
| date | Date of appointment | YYYY-MM-DD |
| flexibility | Whether appointment can be moved | "flexible" or "inflexible" |

**Example CSV:**

```csv
app_name,address,visitdurationMinutes,startTime,date,flexibility
Morning Client,123 George St Sydney NSW 2000,30,09:00,2024-01-15,inflexible
Lunch Meeting,456 Pitt St Sydney NSW 2000,60,12:30,2024-01-15,flexible
Site Visit,789 Kent St Sydney NSW 2000,45,flexible,2024-01-15,flexible
```

### Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Froute-o-matic-v3)

```bash
# Or deploy manually
npm i -g vercel
vercel
```

## API Reference

### POST /api/geocode

Geocodes addresses from uploaded appointments.

**Request Body:**
```json
{
  "appointments": [
    {
      "id": "1",
      "appName": "Client A",
      "address": "123 Main St"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "geocoded": [{ ... }],
  "errors": []
}
```

### POST /api/optimize

Optimizes the route for given appointments.

**Request Body:**
```json
{
  "appointments": [
    {
      "id": "1",
      "appName": "Client A",
      "address": "123 Main St",
      "visitDurationMinutes": 30,
      "startTime": "09:00",
      "date": "2024-01-15",
      "flexibility": "inflexible",
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "route": {
    "stops": [...],
    "totalDistance": 15000,
    "totalDriveTime": 45,
    "totalVisitTime": 180
  }
}
```

## Development

### Project Structure

```
├── app/                     # Next.js App Router
│   ├── api/                # API routes
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page
│   └── globals.css         # Global styles
├── components/             # React components
├── lib/                    # Utility libraries
│   ├── algorithm/          # Optimization algorithms
│   ├── cache/              # Caching utilities
│   ├── csv-parser.ts       # CSV parsing
│   ├── google-api.ts       # Google Maps API client
│   ├── types.ts            # TypeScript types
│   └── validators.ts       # Validation utilities
├── public/                 # Static assets
└── __tests__/              # Unit tests
```

### Key Algorithms

**V1 (Current): Nearest Neighbor**
- Simple greedy approach
- Fast: O(n²) complexity
- Good enough for 20-30 stops
- Typically 70-80% as efficient as optimal

**V2 (Future): 2-opt Local Search**
- Will improve routes by 5-15%
- Adds 1-3 seconds optimization time
- Only implement if V1 results unsatisfactory

### Caching

The app caches:
- Geocoding results (by normalized address)
- Distance calculations (by coordinates)

Cache is in-memory only (resets on server restart)

## Performance

**30 stops (20 flexible, 10 inflexible):**
- CSV parsing: ~50ms
- Geocoding: ~3-4s (parallel API calls)
- Distance Matrix: ~2-3s
- Optimization: ~100-200ms
- **Total: ~5-7 seconds**

**Vercel Timeout:** 10 seconds (Hobby), 60 seconds (Pro)

If you experience timeouts with 40+ stops, consider:
- Upgrading to Vercel Pro
- Reducing number of stops
- Using V1.1 cost optimization (reduces API calls by 60-80%)

## Cost Estimates

**V1 (Basic without optimizations)**
- 25 stops: ~$8-12 per route
- 100 routes/month: ~$800-1200/month

**V1.1 (With cost optimizations)**
- 25 stops: ~$1.50-3.00 per route
- 100 routes/month: ~$150-300/month

**Recommendations:**
1. Start with low volume to test
2. Monitor costs in Google Cloud Console
3. Implement V1.1 optimizations before scaling
4. Set up billing alerts

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

## Troubleshooting

**Issue: "Google Maps API key not configured"**
- Solution: Set GOOGLE_MAPS_API_KEY in .env.local

**Issue: Timeout with many stops**
- Solutions:
  - Reduce number of stops per optimization
  - Upgrade to Vercel Pro for 60s timeout
  - Implement streaming/progress updates

**Issue: "Geocoding failed: ZERO_RESULTS"**
- Check that addresses are complete and valid
- Use full addresses: "123 Main St, City, State, Country"

**Issue: "Impossible schedule" error**
- Inflexible appointments may be too close together
- Add more flexible appointments
- Spread appointments further apart in time

## Contributing

1. Follow the coding guidelines in @rules.md
2. Write tests for new features
3. Update documentation
4. Submit PR with clear description

## License

MIT

## Support

For issues and feature requests, please create an issue on GitHub.

## Roadmap

**V1.1 (Week 2)**
- Route map visualization
- Address validation UI improvements
- Cost optimization strategies

**V2 (Month 2)**
- 2-opt local search optimization
- Multi-day support
- GPX export

**Future**
- Mobile app companion
- Real-time traffic updates
- Machine learning optimization
