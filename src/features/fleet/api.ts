import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BadgeTone } from '@/components/ui/badge'
import { config } from '@/config/env'
import { api, type Paginated } from '@/lib/api/client'
import type { LivePosition, LiveTripEventType } from '@/lib/live/socket'

export type VehicleState = 'moving' | 'idle' | 'parked' | 'offline' | 'no_data'
export type VehicleAlert =
  'low_fuel' | 'low_battery' | 'harsh_driving' | 'engine_fault' | 'engine_overheat'
export type DrivingEvent = 'harsh_brake' | 'harsh_accel' | 'harsh_turn'

export interface Position {
  lat: number
  lng: number
  speed: number | null
  heading: number | null
  ignition: boolean | null
  recorded_at: string
}

export interface ObdSnapshot {
  rpm: number | null
  speed: number | null
  coolant_c: number | null
  engine_load_pct: number | null
  throttle_pct: number | null
  fuel_pct: number | null
  battery_v: number | null
  odometer_km: number | null
  dtc: string[]
  at: string
}

export interface Vehicle {
  id: number
  imei: string
  name: string
  vehicle_no: string | null
  state: VehicleState
  online: boolean
  last_seen_at: string | null
  fuel: number | null
  battery: number | null
  battery_voltage: number | null
  stopped_since: string | null
  harsh_today: { brake: number; accel: number; turn: number }
  alerts: VehicleAlert[]
  position: Position | null
  obd?: ObdSnapshot | null
}

export interface FleetLive {
  total: number
  moving: number
  idle: number
  parked: number
  offline: number
  harsh_events_today: number
  low_fuel: number
  engine_faults?: number
  vehicles: Vehicle[]
}

export interface PositionRow extends Position {
  id: string
  fuel: number | null
  battery: number | null
  event: DrivingEvent | null
}

export const VEHICLE_STATE: Record<
  VehicleState,
  { label: string; tone: BadgeTone; color: string }
> = {
  moving: { label: 'Moving', tone: 'success', color: '#159053' },
  idle: { label: 'Idle, engine on', tone: 'warning', color: '#c27a00' },
  parked: { label: 'Parked, engine off', tone: 'info', color: '#2563eb' },
  offline: { label: 'Offline', tone: 'neutral', color: '#7f938a' },
  no_data: { label: 'No signal yet', tone: 'neutral', color: '#7f938a' },
}

export const ALERT_LABELS: Record<VehicleAlert, string> = {
  low_fuel: 'Low fuel',
  low_battery: 'Low battery',
  harsh_driving: 'Harsh driving',
  engine_fault: 'Engine fault',
  engine_overheat: 'Engine overheating',
}

export const EVENT_LABELS: Record<DrivingEvent, string> = {
  harsh_brake: 'Harsh braking',
  harsh_accel: 'Harsh acceleration',
  harsh_turn: 'Harsh turn',
}

export const harshTotal = (vehicle: Vehicle) =>
  vehicle.harsh_today.brake + vehicle.harsh_today.accel + vehicle.harsh_today.turn

export type TripKind = 'pickup' | 'drop'
export type TripStatus = 'active' | 'ended'
export type StopStatus = 'pending' | 'approaching' | 'arrived' | 'departed' | 'skipped'

export interface TripRef {
  id: number
  name: string
}

export interface TripVehicle {
  id: number
  registration_no: string
  name: string
  device_id: number | null
}

export interface Trip {
  id: number
  kind: TripKind
  status: TripStatus
  trip_date: string
  route: TripRef
  vehicle: TripVehicle
  started_by: TripRef | null
  started_at: string
  ended_at: string | null
  end_reason: string | null
  position: LivePosition | null
  destination_eta_seconds: number | null
  stops_done: number
  stops_total: number
}

export interface TripStop {
  stop_id: number
  name: string
  sequence: number
  lat: number
  lng: number
  radius_m: number
  planned_time: string | null
  status: StopStatus
  eta_seconds: number | null
  approached_at: string | null
  arrived_at: string | null
  departed_at: string | null
  riders: number
}

export interface TripEventRow {
  id: number
  type: LiveTripEventType
  stop: TripRef | null
  eta_seconds: number | null
  occurred_at: string
  notified: number
}

export interface TripRider {
  student_id: number
  full_name: string
  class_section: string | null
  stop_id: number
  mode: 'both' | 'pickup' | 'drop'
  passenger_ref: string
  boarded: boolean
  away_today: boolean
}

export interface TripDetail extends Trip {
  stop_list: TripStop[]
  school: { lat: number; lng: number } | null
  events: TripEventRow[]
  riders: TripRider[]
  not_boarded: TripRider[]
}

export interface TripListParams {
  page: number
  limit: number
  date?: string
  status?: TripStatus
  route_id?: number
}

export interface StartTripInput {
  route_id: number
  kind: TripKind
}

export const fleetKeys = {
  all: ['fleet'] as const,
  live: () => [...fleetKeys.all, 'live'] as const,
  positions: (id: number) => [...fleetKeys.all, 'positions', id] as const,
  trips: (params: TripListParams) => [...fleetKeys.all, 'trips', params] as const,
  trip: (id: number) => [...fleetKeys.all, 'trip', id] as const,
}

const trips = '/admin/transport/trips'

export const fleetApi = {
  live: () => api.get<FleetLive>('/admin/fleet/live'),
  positions: (id: number, limit = 20) =>
    api.get<Paginated<PositionRow>>(`/admin/fleet/vehicles/${id}/positions`, { page: 1, limit }),
  trips: (params: TripListParams) => api.get<Paginated<Trip>>(trips, { ...params }),
  trip: (id: number) => api.get<TripDetail>(`${trips}/${id}`),
  startTrip: (input: StartTripInput) => api.post<TripDetail>(trips, input),
  endTrip: (id: number) => api.post<TripDetail>(`${trips}/${id}/end`),
}

export function useFleetLive(enabled = true) {
  return useQuery({
    queryKey: fleetKeys.live(),
    queryFn: fleetApi.live,
    refetchInterval: config.refreshIntervalMs,
    placeholderData: keepPreviousData,
    enabled,
    retry: false,
  })
}

export function usePositions(id: number | null) {
  return useQuery({
    queryKey: fleetKeys.positions(id ?? 0),
    queryFn: () => fleetApi.positions(id!),
    enabled: Boolean(id),
    refetchInterval: config.refreshIntervalMs,
  })
}

export function useTrips(params: TripListParams, poll = true) {
  return useQuery({
    queryKey: fleetKeys.trips(params),
    queryFn: () => fleetApi.trips(params),
    placeholderData: keepPreviousData,
    refetchInterval: poll ? config.refreshIntervalMs * 3 : false,
  })
}

export function useTrip(id: number, poll: boolean) {
  return useQuery({
    queryKey: fleetKeys.trip(id),
    queryFn: () => fleetApi.trip(id),
    refetchInterval: (query) =>
      poll && query.state.data?.status !== 'ended' ? config.refreshIntervalMs : false,
  })
}

export function useTripMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...fleetKeys.all, 'trips'] })
      void queryClient.invalidateQueries({ queryKey: [...fleetKeys.all, 'trip'] })
    },
  })
}
