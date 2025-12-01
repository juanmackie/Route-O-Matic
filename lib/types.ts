// CSV Input Types
export interface RawAppointment {
  app_name: string;
  address: string;
  visitdurationMinutes: string | number;
  startTime: string; // HH:MM or "flexible"
  date: string; // YYYY-MM-DD
  flexibility: 'flexible' | 'inflexible' | string;
}

// Processed Appointment (after CSV parsing and validation)
export interface Appointment {
  id: string;
  appName: string;
  address: string;
  visitDurationMinutes: number;
  startTime: string | null; // HH:MM or null if flexible
  date: string; // YYYY-MM-DD
  flexibility: 'flexible' | 'inflexible';
  rowNumber: number; // Original row number in CSV for error reporting
}

// Geocoded Appointment (with coordinates)
export interface GeocodedAppointment extends Appointment {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

// Stop in the optimized route
export interface VisitStop {
  appointment: GeocodedAppointment;
  order: number;
  arrivalTime: string; // HH:MM
  travelTimeFromPrevious: number; // minutes
  distanceFromPrevious: number; // meters
  status: 'on_time' | 'early' | 'late';
  minutesFromPreferred: number; // how far from preferred time
}

// Complete optimized route
export interface OptimizedRoute {
  stops: VisitStop[];
  totalDistance: number; // meters
  totalDriveTime: number; // minutes
  totalVisitTime: number; // minutes (sum of all visit durations)
  routeDate: string; // YYYY-MM-DD
  success: boolean;
  error?: string;
  warnings?: string[];
}

// CSV parsing result
export interface CSVParseResult {
  appointments: Appointment[];
  errors: CSVError[];
  warnings: CSVWarning[];
}

// CSV parse error
export interface CSVError {
  row: number;
  field?: string;
  message: string;
  value?: string;
  suggestion?: string;
  examples?: string[];
}

// CSV parse warning
export interface CSVWarning {
  row: number;
  field: string;
  message: string;
  value: string;
  suggestion?: string;
  examples?: string[];
}

// Geocoding error types
export type GeocodingErrorType = 'API_KEY_MISSING' | 'API_KEY_INVALID' | 'QUOTA_EXCEEDED' | 'NETWORK_ERROR' | 'INVALID_ADDRESS' | 'ZERO_RESULTS' | 'SERVER_ERROR';

// Geocoding result
export interface GeocodingResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  error?: string;
  errorType?: GeocodingErrorType;
}

// Distance between two points
export interface DistanceResult {
  distance: number; // meters
  duration: number; // minutes
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

// Client application state for multi-step flow
type AppStep = 'upload' | 'validation' | 'optimizing' | 'results' | 'error';

export interface AppState {
  step: AppStep;
  data?: {
    appointments?: Appointment[];
    geocodedAppointments?: GeocodedAppointment[];
    optimizedRoute?: OptimizedRoute;
    errors?: CSVError[];
    warnings?: CSVWarning[];
  };
}

// Grace period constant
export const GRACE_PERIOD_MINUTES = 15;

// Maximum file size (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// Default buffer configuration for appointment conflicts
export const DEFAULT_BUFFER_CONFIG: BufferConfiguration = {
  baseBufferMinutes: 45,  // Standard 45-minute buffer between appointments
  minimumBufferMinutes: 15,  // Never go below 15 minutes
  maximumBufferMinutes: 120,  // Cap at 2 hours maximum buffer
  flexibleFactor: 0.8,  // Flexible appointments can have 20% shorter buffers
  locationFactor: 1.0,  // Base location factor (adjusts based on distance)
  durationFactor: 1.0,  // Base duration factor (adjusts based on appointment length)
}

// Smart buffer configuration for scheduling conflicts
export interface BufferConfiguration {
  baseBufferMinutes: number;  // Starting point for buffer calculations (e.g., 45 minutes)
  minimumBufferMinutes: number;  // Never go below this buffer size
  maximumBufferMinutes: number;  // Upper bound for buffer size
  flexibleFactor: number;  // Multiplier for flexible appointments (e.g., 0.8 for shorter buffers)
  locationFactor: number;  // Adjustment based on distance between locations
  durationFactor: number;  // Adjustment based on appointment duration
}

// Scheduling conflict details
export interface SchedulingConflict {
  appointments: [Appointment, Appointment];
  gapMinutes: number;
  requiredMinutes: number;
  severity: 'critical' | 'major' | 'minor';
}

// Solution for resolving a scheduling conflict
export interface Solution {
  changes: ScheduleChange[];
  successRate: number;  // 0-1 scale, percentage of simulated scenarios that are feasible
  impactScore: number;  // Lower is better, weighted score of disruption
  feasibility: 'feasible' | 'infeasible';
  reasoning: string[];
  statistics: SimulationStats;
}

// Individual change in a proposed solution
export interface ScheduleChange {
  type: 'reorder' | 'reschedule' | 'buffer-adjust' | 'duration-adjust';
  appointmentId: string;
  appointmentName: string;
  originalTime: string;
  proposedTime: string;
  reason: string;
  impactMinutes: number;  // How many minutes changed from original
}

// Statistics from simulation runs
export interface SimulationStats {
  totalScenariosTested: number;
  feasibleScenarios: number;
  bestScenarioGapMinutes: number;  // Best gap found between appointments
  worstScenarioGapMinutes: number;  // Worst gap found
  averageGapMinutes: number;
  reorderingsTested: number;
  buffersTested: number;
}

// Comprehensive conflict resolution result
export interface ConflictResolution {
  conflict: SchedulingConflict;
  solutions: Solution[];
  recommendedSolution: Solution | null;
}

// API Response types
export interface OptimizeRequest {
  appointments: Appointment[];
}

export interface OptimizeResponse {
  success: boolean;
  route?: OptimizedRoute;
  error?: string;
}

export interface GeocodeRequest {
  appointments: Appointment[];
}

export interface GeocodeResponse {
  success: boolean;
  geocoded?: GeocodedAppointment[];
  errors?: Array<{ index: number; message: string }>;
}

// Error types
export class ImpossibleScheduleError extends Error {
  constructor(message: string, public readonly conflicts: Appointment[]) {
    super(message);
    this.name = 'ImpossibleScheduleError';
  }
}

export class GeocodingError extends Error {
  constructor(message: string, public readonly index: number) {
    super(message);
    this.name = 'GeocodingError';
  }
}
