import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import type { Achievement, AchievementLevel } from '@/features/students/records-api'

export interface ActivityStudent {
  id: number
  name: string
  admission_no: string
  section: string | null
  photo_file_id: number | null
}

export interface SchoolAchievement extends Achievement {
  student: ActivityStudent
}

export interface LeaderboardRow {
  rank: number
  student: ActivityStudent
  points: number
  achievements: number
  wins: number
  podiums: number
  outside_events: number
  best_level: AchievementLevel
}

export interface Leaderboard {
  from: string
  to: string
  rows: LeaderboardRow[]
}

export interface ActivityInsights {
  total: number
  sports: number
  wins: number
  outside_events: number
  district_or_above: number
  students: number
}

export interface ActivityFilter {
  category?: string
  class_id?: number
  section_id?: number
}

export interface ActivityListParams extends ActivityFilter {
  page?: number
  limit?: number
  search?: string
  level?: string
  result?: string
  event_scope?: string
  venue_type?: string
  participation?: string
  district_or_above?: boolean
  outside_school?: boolean
}

export const activityKeys = {
  all: ['activities'] as const,
  list: (params: ActivityListParams) => [...activityKeys.all, 'list', params] as const,
  insights: (params: ActivityFilter) => [...activityKeys.all, 'insights', params] as const,
  leaderboard: (params: ActivityFilter & { limit?: number }) =>
    [...activityKeys.all, 'leaderboard', params] as const,
}

export const activitiesApi = {
  list: (params: ActivityListParams) =>
    api.get<Paginated<SchoolAchievement>>('/admin/achievements', { ...params }),
  insights: (params: ActivityFilter) =>
    api.get<ActivityInsights>('/admin/achievements/insights', { ...params }),
  leaderboard: (params: ActivityFilter & { limit?: number }) =>
    api.get<Leaderboard>('/admin/achievements/leaderboard', { ...params }),
}

export function useActivityList(params: ActivityListParams) {
  return useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => activitiesApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useActivityInsights(params: ActivityFilter) {
  return useQuery({
    queryKey: activityKeys.insights(params),
    queryFn: () => activitiesApi.insights(params),
    placeholderData: keepPreviousData,
  })
}

export function useLeaderboard(params: ActivityFilter & { limit?: number }, enabled = true) {
  return useQuery({
    queryKey: activityKeys.leaderboard(params),
    queryFn: () => activitiesApi.leaderboard(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}
