import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { BadgeTone } from '@/components/ui/badge'
import { config } from '@/config/env'
import { api, type Paginated } from '@/lib/api/client'

export type VehicleState = 'moving' | 'idle' | 'offline' | 'no_data'

export interface Position {
  lat: number
  lng: number
  speed: number | null
  heading: number | null
  ignition: boolean | null
  fuel: number | null
  recorded_at: string
}

export interface Vehicle {
  id: number
  imei: string
  name: string
  vehicle_no: string | null
  state: VehicleState
  online: boolean
  last_seen_at: string | null
  position: Position | null
}

export interface FleetLive {
  total: number
  moving: number
  idle: number
  offline: number
  vehicles: Vehicle[]
}

export interface PositionRow extends Position {
  id: string
}

export const VEHICLE_STATE: Record<
  VehicleState,
  { label: string; tone: BadgeTone; color: string }
> = {
  moving: { label: 'Moving', tone: 'success', color: '#159053' },
  idle: { label: 'Stopped', tone: 'warning', color: '#c27a00' },
  offline: { label: 'Offline', tone: 'neutral', color: '#7f938a' },
  no_data: { label: 'No signal yet', tone: 'neutral', color: '#7f938a' },
}

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
