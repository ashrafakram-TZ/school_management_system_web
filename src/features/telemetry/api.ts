import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import { config } from '@/config/env'

export interface Telemetry {
  id: string
  device_id: number
  recorded_at: string
  lat: number
  lng: number
  speed: number | null
  heading: number | null
  ignition: boolean | null
  odometer: number | null
  fuel: number | null
  received_at: string
}

export interface TelemetryHistoryParams {
  page: number
  limit: number
  from?: string
  to?: string
}

export const telemetryKeys = {
  all: ['telemetry'] as const,
  latest: (deviceId: number) => [...telemetryKeys.all, 'latest', deviceId] as const,
  history: (deviceId: number, params: TelemetryHistoryParams) =>
    [...telemetryKeys.all, 'history', deviceId, params] as const,
}

const fetchLatest = async (deviceId: number) => {
  try {
    return await api.get<Telemetry>(`/fleet/devices/${deviceId}/telemetry/latest`)
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null
    throw error
  }
}

export const telemetryApi = {
  latest: fetchLatest,
  history: (deviceId: number, params: TelemetryHistoryParams) =>
    api.get<Paginated<Telemetry>>(`/fleet/devices/${deviceId}/telemetry`, { ...params }),
}

export function useLatestTelemetry(deviceId: number) {
  return useQuery({
    queryKey: telemetryKeys.latest(deviceId),
    queryFn: () => telemetryApi.latest(deviceId),
    enabled: deviceId > 0,
    refetchInterval: config.refreshIntervalMs,
  })
}

const combineLatest = (results: { data?: Telemetry | null }[]) =>
  results.map((result) => result.data ?? null)

export function useLatestTelemetryMany(deviceIds: number[]) {
  return useQueries({
    queries: deviceIds.map((deviceId) => ({
      queryKey: telemetryKeys.latest(deviceId),
      queryFn: () => telemetryApi.latest(deviceId),
      refetchInterval: config.refreshIntervalMs,
      meta: { silent: true },
    })),
    combine: combineLatest,
  })
}

export function useTelemetryHistory(deviceId: number, params: TelemetryHistoryParams) {
  return useQuery({
    queryKey: telemetryKeys.history(deviceId, params),
    queryFn: () => telemetryApi.history(deviceId, params),
    enabled: deviceId > 0,
    placeholderData: keepPreviousData,
    refetchInterval: params.page === 1 ? config.refreshIntervalMs : false,
  })
}
