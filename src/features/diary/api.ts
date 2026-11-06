import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import type { UploadedFile } from '@/lib/files'

export type DiaryType = 'homework' | 'remark' | 'feedback' | 'note'
export type DiaryScope = 'class' | 'section' | 'students'
export type DiaryStatus = 'pending_review' | 'published' | 'rejected' | 'hidden'

export interface Ref {
  id: number
  name: string
}

export interface DiaryEntry {
  id: number
  type: DiaryType
  title: string
  body: string
  due_date: string | null
  subject: Ref | null
  scope: DiaryScope
  target_label: string
  class: Ref | null
  section: Ref | null
  author: Ref
  status: DiaryStatus
  review: { by: Ref | null; at: string | null; note: string | null }
  published_at: string | null
  attachments: UploadedFile[]
  recipient_count: number
  seen_count: number
  academic_year: Ref
  created_at: string
}

export interface DiaryRecipient {
  student: Ref
  class_section: string | null
  seen_at: string | null
  seen_by: Ref | null
}

export interface DiaryDetail extends DiaryEntry {
  recipients: DiaryRecipient[]
}

export interface DiaryInsights {
  pending_review: number
  published_today: number
  published: number
  rejected: number
  hidden: number
  homework_due_this_week: number
  review_mode: 'all' | 'remarks' | 'none'
}

export interface DiaryListParams {
  page: number
  limit: number
  search?: string
  status?: DiaryStatus
  type?: DiaryType
  sort?: string
  order?: 'asc' | 'desc'
}

export const diaryKeys = {
  all: ['diary'] as const,
  list: (params: DiaryListParams) => [...diaryKeys.all, 'list', params] as const,
  insights: () => [...diaryKeys.all, 'insights'] as const,
  detail: (id: number) => [...diaryKeys.all, 'detail', id] as const,
}

export const diaryApi = {
  list: (params: DiaryListParams) => api.get<Paginated<DiaryEntry>>('/admin/diary', { ...params }),
  insights: () => api.get<DiaryInsights>('/admin/diary/insights'),
  detail: (id: number) => api.get<DiaryDetail>(`/admin/diary/${id}`),
  approve: (id: number) => api.post<DiaryDetail>(`/admin/diary/${id}/approve`),
  reject: (id: number, note: string) =>
    api.post<DiaryDetail>(`/admin/diary/${id}/reject`, { note }),
  hide: (id: number, note: string | null) =>
    api.post<DiaryDetail>(`/admin/diary/${id}/hide`, { note }),
  restore: (id: number) => api.post<DiaryDetail>(`/admin/diary/${id}/restore`),
}

export function useDiary(params: DiaryListParams) {
  return useQuery({
    queryKey: diaryKeys.list(params),
    queryFn: () => diaryApi.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
}

export function useDiaryInsights() {
  return useQuery({
    queryKey: diaryKeys.insights(),
    queryFn: diaryApi.insights,
    refetchInterval: 30_000,
  })
}

export function useDiaryEntry(id: number | null) {
  return useQuery({
    queryKey: diaryKeys.detail(id ?? 0),
    queryFn: () => diaryApi.detail(id ?? 0),
    enabled: Boolean(id),
  })
}

export function useDiaryAction<TInput>(fn: (input: TInput) => Promise<DiaryDetail>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.all }),
  })
}
