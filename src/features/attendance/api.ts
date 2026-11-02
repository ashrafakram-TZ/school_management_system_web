import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave'
export type StudentLeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type StaffAttendanceStatus = 'present' | 'late' | 'half_day' | 'absent'
export type StaffBoardStatus = StaffAttendanceStatus | 'on_leave' | 'not_checked_in'
export type PunchSource = 'app' | 'biometric' | 'manual'
export type StaffLeaveStatus =
  'pending_hod' | 'pending_principal' | 'approved' | 'rejected' | 'cancelled'
export type Decision = 'approved' | 'rejected'

export interface Ref {
  id: number
  name: string
}

export interface AttendanceSummary {
  total: number
  present: number
  absent: number
  late: number
  half_day: number
  leave: number
  percent: number | null
}

export interface BoardSection extends AttendanceSummary {
  section_id: number
  name: string
  class_teacher: string | null
  marked: boolean
  taken_by: string | null
  taken_at: string | null
}

export interface AttendanceBoard {
  date: string
  working_day: boolean
  holiday: string | null
  summary: AttendanceSummary
  sections_total: number
  sections_not_marked: number
  below_75: number
  leave_pending: number
  sections: BoardSection[]
}

export interface RosterStudent {
  student_id: number
  full_name: string
  admission_no: string
  roll_no: number | null
  status: AttendanceStatus
  remarks: string | null
  on_leave: boolean
}

export interface Roster {
  section: Ref
  date: string
  period: number
  working_day: boolean
  holiday: string | null
  marked: boolean
  taken_by: Ref | null
  taken_at: string | null
  summary: AttendanceSummary
  students: RosterStudent[]
}

export interface MarkItem {
  student_id: number
  status: AttendanceStatus
  remarks?: string | null
}

export interface MarkInput {
  date: string
  period?: number
  subject_id?: number | null
  items: MarkItem[]
}

export interface SectionReportRow {
  student_id: number
  full_name: string
  roll_no: number | null
  present: number
  absent: number
  late: number
  half_day: number
  leave: number
  percent: number | null
}

export interface SectionReport {
  month: string
  working_days: number
  marked_days: number
  students: SectionReportRow[]
}

export interface StudentLeave {
  id: number
  student: Ref
  class_section: string | null
  from_date: string
  to_date: string
  days: number
  reason: string
  file_id: number | null
  status: StudentLeaveStatus
  requested_by: Ref | null
  decided_by: Ref | null
  decided_at: string | null
  decision_note: string | null
  created_at: string
}

export interface StaffDay {
  date: string
  status: StaffBoardStatus
  check_in_at: string | null
  check_out_at: string | null
  check_in_distance_m: number | null
  source: PunchSource | null
  remarks: string | null
}

export interface StaffBoardRow extends StaffDay {
  user_id: number
  staff_id: number
  name: string
  designation: string
  department: string | null
}

export interface StaffBoard {
  date: string
  reporting_time: string
  total: number
  present: number
  late: number
  on_leave: number
  not_checked_in: number
  staff: StaffBoardRow[]
}

export interface ManualMarkInput {
  date: string
  status: StaffAttendanceStatus
  check_in_at?: string | null
  check_out_at?: string | null
  remarks: string
}

export interface LeaveType {
  id: number
  code: string
  name: string
  days_per_year: number
  is_paid: boolean
  is_active: boolean
}

export interface LeaveBalance {
  leave_type: LeaveType
  allowed: number | null
  used: number
  pending: number
  remaining: number | null
}

export interface StaffLeave {
  id: number
  staff: Ref
  department: string | null
  leave_type: LeaveType
  from_date: string
  to_date: string
  half_day: boolean
  days: number
  reason: string
  status: StaffLeaveStatus
  hod: Ref | null
  hod_note: string | null
  principal: Ref | null
  principal_note: string | null
  created_at: string
}

export interface LeaveListParams {
  page: number
  limit: number
  search?: string
  section_id?: number
  user_id?: number
}

export interface StudentLeaveParams extends LeaveListParams {
  status?: StudentLeaveStatus
}

export interface StaffLeaveParams extends LeaveListParams {
  status?: StaffLeaveStatus
}

export interface DecisionInput {
  status: Decision
  note?: string | null
}

export const attendanceKeys = {
  all: ['attendance'] as const,
  board: (date: string) => [...attendanceKeys.all, 'board', date] as const,
  roster: (sectionId: number, date: string) =>
    [...attendanceKeys.all, 'roster', sectionId, date] as const,
  report: (sectionId: number, month: string) =>
    [...attendanceKeys.all, 'report', sectionId, month] as const,
  studentLeaves: (params: StudentLeaveParams) =>
    [...attendanceKeys.all, 'student-leaves', params] as const,
  staffBoard: (date: string) => [...attendanceKeys.all, 'staff-board', date] as const,
  staffLeaves: (params: StaffLeaveParams) =>
    [...attendanceKeys.all, 'staff-leaves', params] as const,
  balances: (userId: number) => [...attendanceKeys.all, 'balances', userId] as const,
}

export const attendanceApi = {
  board: (date: string) => api.get<AttendanceBoard>('/admin/attendance/board', { date }),
  roster: (sectionId: number, date: string) =>
    api.get<Roster>(`/admin/attendance/sections/${sectionId}`, { date, period: 0 }),
  mark: (sectionId: number, input: MarkInput) =>
    api.put<Roster>(`/admin/attendance/sections/${sectionId}`, input),
  report: (sectionId: number, month: string) =>
    api.get<SectionReport>(`/admin/attendance/sections/${sectionId}/report`, { month }),
  studentLeaves: (params: StudentLeaveParams) =>
    api.get<Paginated<StudentLeave>>('/admin/student-leaves', { ...params }),
  decideStudentLeave: (id: number, input: DecisionInput) =>
    api.post<StudentLeave>(`/admin/student-leaves/${id}/decision`, input),
  staffBoard: (date: string) => api.get<StaffBoard>('/admin/staff-attendance/board', { date }),
  correctStaff: (userId: number, input: ManualMarkInput) =>
    api.put<StaffDay>(`/admin/staff-attendance/${userId}`, input),
  staffLeaves: (params: StaffLeaveParams) =>
    api.get<Paginated<StaffLeave>>('/admin/staff-leaves', { ...params }),
  balances: (userId: number) => api.get<LeaveBalance[]>(`/admin/staff-leaves/balances/${userId}`),
  decideStaffLeave: (id: number, input: DecisionInput) =>
    api.post<StaffLeave>(`/admin/staff-leaves/${id}/decision`, input),
}

export function useAttendanceBoard(date: string) {
  return useQuery({
    queryKey: attendanceKeys.board(date),
    queryFn: () => attendanceApi.board(date),
    placeholderData: keepPreviousData,
  })
}

export function useRoster(sectionId: number | null, date: string) {
  return useQuery({
    queryKey: attendanceKeys.roster(sectionId ?? 0, date),
    queryFn: () => attendanceApi.roster(sectionId!, date),
    enabled: Boolean(sectionId),
    staleTime: 0,
  })
}

export function useSectionReport(sectionId: number | null, month: string, enabled = true) {
  return useQuery({
    queryKey: attendanceKeys.report(sectionId ?? 0, month),
    queryFn: () => attendanceApi.report(sectionId!, month),
    enabled: Boolean(sectionId) && enabled,
    placeholderData: keepPreviousData,
  })
}

export function useStudentLeaves(params: StudentLeaveParams) {
  return useQuery({
    queryKey: attendanceKeys.studentLeaves(params),
    queryFn: () => attendanceApi.studentLeaves(params),
    placeholderData: keepPreviousData,
  })
}

export function useStaffBoard(date: string) {
  return useQuery({
    queryKey: attendanceKeys.staffBoard(date),
    queryFn: () => attendanceApi.staffBoard(date),
    placeholderData: keepPreviousData,
  })
}

export function useStaffLeaves(params: StaffLeaveParams) {
  return useQuery({
    queryKey: attendanceKeys.staffLeaves(params),
    queryFn: () => attendanceApi.staffLeaves(params),
    placeholderData: keepPreviousData,
  })
}

export function useLeaveBalances(userId: number | null) {
  return useQuery({
    queryKey: attendanceKeys.balances(userId ?? 0),
    queryFn: () => attendanceApi.balances(userId!),
    enabled: Boolean(userId),
    meta: { silent: true },
  })
}

export function useAttendanceMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}
