import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { BadgeTone } from '@/components/ui/badge'
import { config } from '@/config/env'
import { api, type Paginated } from '@/lib/api/client'

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

export const fleetKeys = {
  all: ['fleet'] as const,
  live: () => [...fleetKeys.all, 'live'] as const,
  positions: (id: number) => [...fleetKeys.all, 'positions', id] as const,
}

export const fleetApi = {
  live: () => api.get<FleetLive>('/admin/fleet/live'),
  positions: (id: number, limit = 20) =>
    api.get<Paginated<PositionRow>>(`/admin/fleet/vehicles/${id}/positions`, { page: 1, limit }),
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
