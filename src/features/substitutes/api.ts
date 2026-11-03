import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export interface Ref {
  id: number
  name: string
}

export interface SubjectRef extends Ref {
  code: string
}

export type CoverKind = 'proxy' | 'combine'
export type MergeGroup = 'all' | 'boys' | 'girls'
export type CombineMode = 'whole' | 'split'

export interface CombinedInto {
  section: Ref
  group: MergeGroup
  students: number
  teacher: Ref | null
}

export interface AbsentPeriod {
  slot_id: number
  period_no: number
  start_time: string
  end_time: string
  section: Ref
  subject: SubjectRef
  room: string | null
  substitution_id: number | null
  kind: CoverKind | null
  substitute: Ref | null
  combined_into: CombinedInto[]
  note: string | null
}

export interface AbsentTeacher {
  teacher: Ref
  reason: string
  periods: AbsentPeriod[]
}

export interface SubstituteBoard {
  date: string
  day_of_week: number
  working_day: boolean
  holiday: string | null
  absent_teachers: number
  periods: number
  covered: number
  uncovered: number
  teachers: AbsentTeacher[]
}

export interface FreeTeacher {
  teacher: Ref
  department: string | null
  periods_today: number
  substitutions_this_week: number
  same_subject: boolean
  knows_section: boolean
}

export interface FreeTeachers {
  period: AbsentPeriod
  teachers: FreeTeacher[]
}

export interface AssignInput {
  date: string
  slot_id: number
  substitute_user_id: number
  note?: string | null
}

export interface CombineTarget {
  slot_id: number
  section: Ref
  subject: SubjectRef
  teacher: Ref
  room: string | null
  students: number
  joining: number
}

export interface CombineOptions {
  period: AbsentPeriod
  students: { total: number; boys: number; girls: number }
  targets: CombineTarget[]
}

export interface CombineInput {
  date: string
  slot_id: number
  mode: CombineMode
  section_id?: number
  boys_section_id?: number
  girls_section_id?: number
  note?: string | null
}

export interface AutoAssignResult {
  assigned: number
  left_uncovered: number
  board: SubstituteBoard
}

export const substituteKeys = {
  all: ['substitutes'] as const,
  board: (date: string) => [...substituteKeys.all, 'board', date] as const,
  free: (date: string, slotId: number) => [...substituteKeys.all, 'free', date, slotId] as const,
  combine: (date: string, slotId: number) =>
    [...substituteKeys.all, 'combine', date, slotId] as const,
}

export const substitutesApi = {
  board: (date: string) => api.get<SubstituteBoard>('/admin/substitutes', { date }),
  free: (date: string, slotId: number) =>
    api.get<FreeTeachers>('/admin/substitutes/free', { date, slot_id: slotId }),
  assign: (input: AssignInput) => api.post<SubstituteBoard>('/admin/substitutes', input),
  combineOptions: (date: string, slotId: number) =>
    api.get<CombineOptions>('/admin/substitutes/combine-options', { date, slot_id: slotId }),
  combine: (input: CombineInput) => api.post<SubstituteBoard>('/admin/substitutes/combine', input),
  auto: (date: string) => api.post<AutoAssignResult>('/admin/substitutes/auto', { date }),
  remove: (id: number) => api.delete<SubstituteBoard>(`/admin/substitutes/${id}`),
}

export function useSubstituteBoard(date: string) {
  return useQuery({
    queryKey: substituteKeys.board(date),
    queryFn: () => substitutesApi.board(date),
    placeholderData: keepPreviousData,
  })
}

export function useFreeTeachers(date: string, slotId: number) {
  return useQuery({
    queryKey: substituteKeys.free(date, slotId),
    queryFn: () => substitutesApi.free(date, slotId),
    staleTime: 0,
  })
}

export function useCombineOptions(date: string, slotId: number, enabled: boolean) {
  return useQuery({
    queryKey: substituteKeys.combine(date, slotId),
    queryFn: () => substitutesApi.combineOptions(date, slotId),
    enabled,
    staleTime: 0,
  })
}

export function useSubstituteMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: substituteKeys.all })
    },
  })
}
