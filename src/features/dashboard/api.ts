import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { config } from '@/config/env'
import { api } from '@/lib/api/client'

export interface DashboardStudents {
  total: number
  joined_this_month: number
  applications_waiting: number
  approved_not_enrolled: number
}

export interface DashboardStaff {
  total: number
  teachers: number
  need_attention: number
}

export interface StudentAttendanceToday {
  working_day: boolean
  marked_sections: number
  total_sections: number
  present: number
  absent: number
  on_leave: number
  percent: number | null
}

export interface StaffAttendanceToday {
  total: number
  checked_in: number
  late: number
  on_leave: number
  absent: number
  percent: number | null
}

export interface DashboardBuses {
  telematics_available: boolean
  total: number
  with_tracker: number
  live: number | null
  moving: number | null
  offline: number | null
}

export interface DashboardAlerts {
  open: number
  sos_open: number
  high_open: number
}

export interface DashboardFees {
  academic_year: string
  due_amount: number
  overdue_amount: number
  overdue_students: number
  todays_collection: number
}

export interface DashboardExams {
  total: number
  upcoming: number
  in_progress: number
  published: number
}

export interface Dashboard {
  date: string
  students: DashboardStudents | null
  staff: DashboardStaff | null
  attendance: { students: StudentAttendanceToday; staff: StaffAttendanceToday } | null
  buses: DashboardBuses | null
  alerts: DashboardAlerts | null
  fees: DashboardFees | null
  exams: DashboardExams | null
}

export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: () => [...dashboardKeys.all, 'overview'] as const,
}

export const dashboardApi = {
  overview: () => api.get<Dashboard>('/admin/dashboard'),
}

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: dashboardApi.overview,
    refetchInterval: config.refreshIntervalMs * 3,
    placeholderData: keepPreviousData,
  })
}
