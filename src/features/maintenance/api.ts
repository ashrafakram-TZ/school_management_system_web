import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fleetKeys } from '@/features/fleet/api'
import { api, type Paginated } from '@/lib/api/client'
import type { UploadedFile } from '@/lib/files'

export type TicketStatus = 'open' | 'in_progress' | 'done'
export type TicketSource = 'obd' | 'manual'
export type TicketSeverity = 'low' | 'medium' | 'high'
export type SortOrder = 'asc' | 'desc'

export interface VehicleRef {
  id: number
  registration_no: string
  name: string
}

export interface Ticket {
  id: number
  vehicle: VehicleRef
  source: TicketSource
  fault_code: string | null
  severity: TicketSeverity | null
  title: string
  description: string | null
  status: TicketStatus
  opened_at: string
  closed_at: string | null
  cost: number | null
  vendor: string | null
  odometer_km: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TicketInsights {
  total: number
  open: number
  in_progress: number
  done: number
  obd_open: number
  cost_this_month: number
}

export interface TicketListParams {
  page: number
  limit: number
  search?: string
  sort?: 'opened_at' | 'closed_at' | 'cost' | 'status'
  order?: SortOrder
  status?: TicketStatus
  source?: TicketSource
  vehicle_id?: number
}

export interface TicketInput {
  vehicle_id?: number
  title?: string
  description?: string | null
  fault_code?: string | null
  severity?: TicketSeverity | null
  status?: TicketStatus
  odometer_km?: number | null
  vendor?: string | null
  cost?: number | null
  notes?: string | null
}

export interface CloseTicketInput {
  cost?: number
  vendor?: string
  notes?: string
  odometer_km?: number
}

export interface FuelEntry {
  id: number
  vehicle: VehicleRef
  filled_on: string
  litres: number
  amount: number
  price_per_litre: number
  odometer_km: number
  km_since_last: number | null
  km_per_litre: number | null
  station: string | null
  bill_file: UploadedFile | null
  filled_by: { id: number; name: string } | null
  created_at: string
}

export interface FuelInsights {
  entries_this_month: number
  litres_this_month: number
  amount_this_month: number
  avg_km_per_litre: number | null
}

export interface FuelListParams {
  page: number
  limit: number
  search?: string
  sort?: 'filled_on' | 'amount' | 'litres'
  order?: SortOrder
  vehicle_id?: number
  from?: string
  to?: string
}

export interface FuelInput {
  vehicle_id: number
  filled_on: string
  litres: number
  amount: number
  odometer_km: number
  station?: string | null
  bill_file_id?: number | null
  filled_by?: number | null
}

export const maintenanceKeys = {
  all: ['maintenance'] as const,
  tickets: (params: TicketListParams) => [...maintenanceKeys.all, 'tickets', params] as const,
  ticketInsights: (vehicleId?: number) =>
    [...maintenanceKeys.all, 'ticket-insights', vehicleId ?? 0] as const,
  fuel: (params: FuelListParams) => [...maintenanceKeys.all, 'fuel', params] as const,
  fuelInsights: (vehicleId?: number) =>
    [...maintenanceKeys.all, 'fuel-insights', vehicleId ?? 0] as const,
}

const tickets = '/admin/fleet/maintenance'
const fuel = '/admin/fleet/fuel'

export const maintenanceApi = {
  tickets: (params: TicketListParams) => api.get<Paginated<Ticket>>(tickets, { ...params }),
  ticketInsights: (vehicleId?: number) =>
    api.get<TicketInsights>(`${tickets}/insights`, { vehicle_id: vehicleId }),
  createTicket: (input: TicketInput) => api.post<Ticket>(tickets, input),
  updateTicket: (id: number, input: TicketInput) => api.patch<Ticket>(`${tickets}/${id}`, input),
  closeTicket: (id: number, input: CloseTicketInput) =>
    api.post<Ticket>(`${tickets}/${id}/close`, input),
  fuel: (params: FuelListParams) => api.get<Paginated<FuelEntry>>(fuel, { ...params }),
  fuelInsights: (vehicleId?: number) =>
    api.get<FuelInsights>(`${fuel}/insights`, { vehicle_id: vehicleId }),
  createFuel: (input: FuelInput) => api.post<FuelEntry>(fuel, input),
  updateFuel: (id: number, input: Partial<FuelInput>) =>
    api.patch<FuelEntry>(`${fuel}/${id}`, input),
  removeFuel: (id: number) => api.delete<null>(`${fuel}/${id}`),
}

export function useTickets(params: TicketListParams, enabled = true) {
  return useQuery({
    queryKey: maintenanceKeys.tickets(params),
    queryFn: () => maintenanceApi.tickets(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useTicketInsights(vehicleId?: number, enabled = true) {
  return useQuery({
    queryKey: maintenanceKeys.ticketInsights(vehicleId),
    queryFn: () => maintenanceApi.ticketInsights(vehicleId),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useFuelLog(params: FuelListParams, enabled = true) {
  return useQuery({
    queryKey: maintenanceKeys.fuel(params),
    queryFn: () => maintenanceApi.fuel(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useFuelInsights(vehicleId?: number, enabled = true) {
  return useQuery({
    queryKey: maintenanceKeys.fuelInsights(vehicleId),
    queryFn: () => maintenanceApi.fuelInsights(vehicleId),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useMaintenanceMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: maintenanceKeys.all })
      void queryClient.invalidateQueries({ queryKey: [...fleetKeys.all, 'health'] })
    },
  })
}
