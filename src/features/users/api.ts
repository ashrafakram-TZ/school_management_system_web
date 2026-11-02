import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import type { AppSection, Language, Me, RoleSummary } from '@/features/auth/api'

export type UserStatus = 'active' | 'inactive'

export interface UserListItem {
  id: number
  name: string
  mobile: string
  email: string | null
  status: UserStatus
  language: Language
  last_login_at: string | null
  created_at: string
  roles: RoleSummary[]
}

export type UserDetail = Me

export interface UserInsights {
  total: number
  active: number
  inactive: number
  never_signed_in: number
  tamil: number
  by_app: Record<AppSection, number>
}

export interface Role {
  id: number
  code: string
  name: string
  description: string | null
  app: AppSection
  user_count: number
  permissions: string[]
}

export interface UserInput {
  name: string
  mobile: string
  email?: string | null
  role_codes: string[]
  status?: UserStatus
  language?: Language
}

export interface UserListParams {
  page: number
  limit: number
  search?: string
  role?: string
  app?: AppSection
  status?: UserStatus
  never_signed_in?: boolean
  language?: Language
  sort?: string
  order?: 'asc' | 'desc'
}

export const userKeys = {
  all: ['users'] as const,
  list: (params: UserListParams) => [...userKeys.all, 'list', params] as const,
  insights: () => [...userKeys.all, 'insights'] as const,
  roles: () => ['roles'] as const,
}

export const usersApi = {
  list: (params: UserListParams) => api.get<Paginated<UserListItem>>('/admin/users', { ...params }),
  insights: () => api.get<UserInsights>('/admin/users/insights'),
  roles: () => api.get<Role[]>('/admin/roles'),
  create: (input: UserInput) => api.post<UserDetail>('/admin/users', input),
  update: (id: number, input: Partial<UserInput>) =>
    api.patch<UserDetail>(`/admin/users/${id}`, input),
  remove: (id: number) => api.delete<{ id: number }>(`/admin/users/${id}`),
}

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useUserInsights() {
  return useQuery({ queryKey: userKeys.insights(), queryFn: usersApi.insights })
}

export function useRoles() {
  return useQuery({ queryKey: userKeys.roles(), queryFn: usersApi.roles, staleTime: 5 * 60_000 })
}

export function useSaveUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: UserInput }) =>
      id ? usersApi.update(id, input) : usersApi.create(input),
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
      void queryClient.invalidateQueries({ queryKey: userKeys.roles() })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
      void queryClient.invalidateQueries({ queryKey: userKeys.roles() })
    },
  })
}
