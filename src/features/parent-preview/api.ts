import { useQuery } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import { config } from '@/config/env'
import type { AttendanceStatus } from '@/features/attendance/api'
import type { Trip, TripStop } from '@/features/fleet/api'
import type { Achievement } from '@/features/students/records-api'
import type { Gender, Relation } from '@/features/students/api'

export interface PreviewChild {
  id: number
  full_name: string
  admission_no: string
  gender: Gender
  dob: string
  photo_url: string | null
  class_name: string | null
  section_name: string | null
  roll_no: number | null
  class_teacher: string | null
  relation: Relation
  school: { id: number; name: string }
  blood_group: string | null
  house: string | null
  academic_year: string | null
}

export interface ParentPreview {
  parent: { user_id: number; name: string; relation: Relation } | null
  child: PreviewChild | null
  today: { date: string; status: AttendanceStatus | null }
}

export type ChildBusStatus =
  'no_trip' | 'on_the_way' | 'approaching' | 'at_stop' | 'passed' | 'trip_ended'

export interface ChildBus {
  status: ChildBusStatus
  headline: string
  route: { id: number; name: string }
  stop: TripStop | null
  vehicle: { id: number; registration_no: string; name: string | null } | null
  trip: Trip | null
  eta_seconds: number | null
  position_stale: boolean
  boarding: { action: 'boarded' | 'alighted'; occurred_at: string } | null
}

export type DayStatus = AttendanceStatus | 'not_marked' | 'holiday' | 'weekly_off'

export interface MonthlyAttendance {
  month: string
  working_days: number
  present: number
  absent: number
  late: number
  half_day: number
  leave: number
  percent: number | null
  days: { date: string; status: DayStatus }[]
}

export interface ParentNotification {
  id: number
  category: string
  template_code: string | null
  title: string
  body: string
  is_read: boolean
  created_at: string
}

export const parentBase = (id: number) => `/admin/students/${id}/parent-view`

const base = parentBase

export const previewKeys = {
  all: ['parent-preview'] as const,
  home: (id: number) => [...previewKeys.all, 'home', id] as const,
  bus: (id: number) => [...previewKeys.all, 'bus', id] as const,
  achievements: (id: number) => [...previewKeys.all, 'achievements', id] as const,
  notifications: (id: number) => [...previewKeys.all, 'notifications', id] as const,
  month: (id: number, month: string) => [...previewKeys.all, 'month', id, month] as const,
}

export function usePreviewHome(id: number) {
  return useQuery({
    queryKey: previewKeys.home(id),
    queryFn: () => api.get<ParentPreview>(base(id)),
    enabled: id > 0,
  })
}

export function usePreviewBus(id: number) {
  return useQuery({
    queryKey: previewKeys.bus(id),
    queryFn: () => api.get<ChildBus | null>(`${base(id)}/bus`),
    refetchInterval: config.refreshIntervalMs,
  })
}

export function usePreviewAchievements(id: number) {
  return useQuery({
    queryKey: previewKeys.achievements(id),
    queryFn: () => api.get<Achievement[]>(`${base(id)}/achievements`),
  })
}

export function usePreviewNotifications(id: number) {
  return useQuery({
    queryKey: previewKeys.notifications(id),
    queryFn: () =>
      api.get<Paginated<ParentNotification>>(`${base(id)}/notifications`, { page: 1, limit: 30 }),
  })
}

export function useStudentMonth(id: number, month: string) {
  return useQuery({
    queryKey: previewKeys.month(id, month),
    queryFn: () => api.get<MonthlyAttendance>(`/admin/attendance/students/${id}`, { month }),
  })
}
