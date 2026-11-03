import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'

export type RunStatus = 'draft' | 'finalized'

export interface SalaryAmounts {
  basic: number
  da: number
  hra: number
  conveyance: number
  special_allowance: number
  other_allowance: number
  professional_tax: number
  tds: number
  other_deduction: number
}

export interface SalaryStructureInput extends SalaryAmounts {
  effective_from: string
  pf_enabled: boolean
  esi_enabled: boolean
}

export interface SalaryStructure extends SalaryStructureInput {
  monthly_gross: number
  monthly_deductions: number
  monthly_net: number
}

export interface SalaryStaff {
  user_id: number
  name: string
  employee_no: string
  designation: string
  department: string | null
  staff_type: string
  structure: SalaryStructure | null
}

export interface PayrollRun {
  id: number
  month: string
  month_label: string
  status: RunStatus
  working_days: number
  staff_count: number
  total_gross: number
  total_deductions: number
  total_net: number
  finalized_at: string | null
  created_at: string
}

export interface Payslip {
  id: number
  run_id: number
  month: string
  month_label: string
  status: RunStatus
  user_id: number
  employee_no: string
  name: string
  designation: string
  department: string | null
  bank_name: string | null
  bank_account_last4: string | null
  working_days: number
  lop_days: number
  paid_days: number
  basic: number
  da: number
  hra: number
  conveyance: number
  special_allowance: number
  other_allowance: number
  gross: number
  pf: number
  esi: number
  professional_tax: number
  tds: number
  other_deduction: number
  total_deductions: number
  net: number
}

export interface MissingSalary {
  user_id: number
  name: string
  employee_no: string
}

export interface PayrollRunDetail extends PayrollRun {
  payslips: Payslip[]
  missing: MissingSalary[]
}

export interface SalaryListParams {
  page: number
  limit: number
  search?: string
  has_structure?: boolean
}

export interface RunListParams {
  page: number
  limit: number
}

export const payrollKeys = {
  all: ['payroll'] as const,
  salaries: (params: SalaryListParams) => [...payrollKeys.all, 'salaries', params] as const,
  salary: (userId: number) => [...payrollKeys.all, 'salary', userId] as const,
  runs: (params: RunListParams) => [...payrollKeys.all, 'runs', params] as const,
  run: (id: number) => [...payrollKeys.all, 'run', id] as const,
}

export const payslipPdfUrl = (id: number) => `/admin/payroll/payslips/${id}/pdf`

export const payrollApi = {
  salaries: (params: SalaryListParams) =>
    api.get<Paginated<SalaryStaff>>('/admin/payroll/salaries', { ...params }),
  salary: (userId: number) => api.get<SalaryStaff>(`/admin/payroll/salaries/${userId}`),
  setSalary: (userId: number, input: SalaryStructureInput) =>
    api.put<SalaryStaff>(`/admin/payroll/salaries/${userId}`, input),
  runs: (params: RunListParams) =>
    api.get<Paginated<PayrollRun>>('/admin/payroll/runs', { ...params }),
  run: (id: number) => api.get<PayrollRunDetail>(`/admin/payroll/runs/${id}`),
  runMonth: (month: string) => api.post<PayrollRunDetail>('/admin/payroll/runs', { month }),
  finalize: (id: number) => api.post<PayrollRunDetail>(`/admin/payroll/runs/${id}/finalize`),
  remove: (id: number) => api.delete<null>(`/admin/payroll/runs/${id}`),
}

export function useSalaries(params: SalaryListParams) {
  return useQuery({
    queryKey: payrollKeys.salaries(params),
    queryFn: () => payrollApi.salaries(params),
    placeholderData: keepPreviousData,
  })
}

export function useSalary(userId: number) {
  return useQuery({
    queryKey: payrollKeys.salary(userId),
    queryFn: () => payrollApi.salary(userId),
    staleTime: 0,
  })
}

export function usePayrollRuns(params: RunListParams) {
  return useQuery({
    queryKey: payrollKeys.runs(params),
    queryFn: () => payrollApi.runs(params),
    placeholderData: keepPreviousData,
  })
}

export function usePayrollRun(id: number | undefined) {
  return useQuery({
    queryKey: payrollKeys.run(id ?? 0),
    queryFn: () => payrollApi.run(id!),
    enabled: Boolean(id),
  })
}

export function usePayrollMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}

export function useDeleteRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => payrollApi.remove(id),
    meta: { silent: true },
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: payrollKeys.run(id) })
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}
