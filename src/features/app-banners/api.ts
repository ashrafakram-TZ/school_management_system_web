import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import type { UploadedFile } from '@/lib/files'

export type BannerAudience = 'all' | 'staff' | 'parents'
export type BannerState = 'live' | 'scheduled' | 'ended' | 'paused'

export interface AppBanner {
  id: number
  title: string
  message: string | null
  image: UploadedFile | null
  audience: BannerAudience
  starts_on: string
  ends_on: string
  link_url: string | null
  sort_order: number
  is_active: boolean
  state: BannerState
  created_at: string
}

export interface AppBannerInput {
  title: string
  message: string | null
  image_file_id: number | null
  audience: BannerAudience
  starts_on: string
  ends_on: string
  link_url: string | null
  sort_order: number
  is_active: boolean
}

export interface AppBannerInsights {
  live: number
  scheduled: number
  ended: number
  paused: number
}

export interface AppBannerParams {
  page?: number
  limit?: number
  search?: string
  state?: BannerState
  audience?: BannerAudience
  sort?: string
  order?: 'asc' | 'desc'
}

export const bannerKeys = {
  all: ['app-banners'] as const,
  list: (params: AppBannerParams) => [...bannerKeys.all, 'list', params] as const,
  insights: () => [...bannerKeys.all, 'insights'] as const,
}

export const appBannersApi = {
  list: (params: AppBannerParams) =>
    api.get<Paginated<AppBanner>>('/admin/app-banners', { ...params }),
  insights: () => api.get<AppBannerInsights>('/admin/app-banners/insights'),
  create: (input: AppBannerInput) => api.post<AppBanner>('/admin/app-banners', input),
  update: (id: number, input: Partial<AppBannerInput>) =>
    api.patch<AppBanner>(`/admin/app-banners/${id}`, input),
  remove: (id: number) => api.delete<null>(`/admin/app-banners/${id}`),
}

export function useAppBanners(params: AppBannerParams) {
  return useQuery({
    queryKey: bannerKeys.list(params),
    queryFn: () => appBannersApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useAppBannerInsights() {
  return useQuery({ queryKey: bannerKeys.insights(), queryFn: appBannersApi.insights })
}

export function useBannerMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bannerKeys.all })
    },
  })
}
