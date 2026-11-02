import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import { config } from '@/config/env'

export interface Device {
  id: number
  imei: string
  name: string
  vehicle_no: string | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface DeviceInput {
  imei: string
  name: string
  vehicle_no?: string | null
  is_active?: boolean
}

export interface DeviceListParams {
  page: number
  limit: number
  search?: string
}

export const deviceKeys = {
  all: ['devices'] as const,
  list: (params: DeviceListParams) => [...deviceKeys.all, 'list', params] as const,
  detail: (id: number) => [...deviceKeys.all, 'detail', id] as const,
}

export const devicesApi = {
  list: (params: DeviceListParams) => api.get<Paginated<Device>>('/fleet/devices', { ...params }),
  get: (id: number) => api.get<Device>(`/fleet/devices/${id}`),
  create: (input: DeviceInput) => api.post<Device>('/fleet/devices', input),
  update: (id: number, input: Partial<DeviceInput>) =>
    api.patch<Device>(`/fleet/devices/${id}`, input),
  remove: (id: number) => api.delete<{ id: number }>(`/fleet/devices/${id}`),
}

export function useDevices(params: DeviceListParams, { live = false } = {}) {
  return useQuery({
    queryKey: deviceKeys.list(params),
    queryFn: () => devicesApi.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: live ? config.refreshIntervalMs : false,
  })
}

export function useDevice(id: number) {
  return useQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: () => devicesApi.get(id),
    enabled: Number.isInteger(id) && id > 0,
    refetchInterval: config.refreshIntervalMs,
  })
}

export function useCreateDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: devicesApi.create,
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deviceKeys.all }),
  })
}

export function useUpdateDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<DeviceInput> }) =>
      devicesApi.update(id, input),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deviceKeys.all }),
  })
}

export function useDeleteDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: devicesApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deviceKeys.all }),
  })
}
