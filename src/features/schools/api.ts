import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import type { SchoolProfile } from '@/features/setup/api'

export type School = SchoolProfile

export interface SchoolInput {
  name: string
  code: string
  board?: SchoolProfile['board']
  city?: string | null
  state?: string | null
  phone?: string | null
  email?: string | null
  admin_name?: string
  admin_mobile?: string
}

export interface SchoolListParams {
  page: number
  limit: number
  search?: string
}

export const schoolKeys = {
  all: ['schools'] as const,
  list: (params: SchoolListParams) => [...schoolKeys.all, 'list', params] as const,
  options: () => [...schoolKeys.all, 'options'] as const,
}

export const schoolsApi = {
  list: (params: SchoolListParams) => api.get<Paginated<School>>('/admin/schools', { ...params }),
  create: (input: SchoolInput) => api.post<School>('/admin/schools', input),
  update: (id: number, input: Partial<SchoolInput> & { is_active?: boolean }) =>
    api.patch<School>(`/admin/schools/${id}`, input),
}

export function useSchools(params: SchoolListParams) {
  return useQuery({
    queryKey: schoolKeys.list(params),
    queryFn: () => schoolsApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useSchoolOptions(enabled: boolean) {
  return useQuery({
    queryKey: schoolKeys.options(),
    queryFn: () => schoolsApi.list({ page: 1, limit: 100 }),
    enabled,
    staleTime: 60_000,
    meta: { silent: true },
  })
}

export function useSaveSchool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: SchoolInput & { is_active?: boolean } }) =>
      id ? schoolsApi.update(id, input) : schoolsApi.create(input),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schoolKeys.all }),
  })
}
