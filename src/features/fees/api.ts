import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'

export type InvoiceStatus = 'unpaid' | 'partly_paid' | 'paid' | 'cancelled'
export type StudentFeeStatus = 'paid' | 'partly_paid' | 'due' | 'overdue'
export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque'

export interface FeeHead {
  id: number
  name: string
  code: string
  is_transport: boolean
  is_active: boolean
  plan_lines: number
  created_at: string
}

export interface FeeHeadInput {
  name: string
  code: string
  is_transport: boolean
  is_active: boolean
}

export interface InstallmentTotal {
  installment: string
  due_date: string
  amount: number
}

export interface FeePlanLine {
  id: number
  fee_head_id: number
  head_name: string
  installment: string
  amount: number
  due_date: string
}

export interface FeePlan {
  class_id: number
  class_name: string
  academic_year_id: number
  academic_year: string
  lines: FeePlanLine[]
  installments: InstallmentTotal[]
  total: number
}

export interface FeePlanSummary {
  class_id: number
  class_name: string
  student_count: number
  installments: InstallmentTotal[]
  total: number
}

export interface FeePlanLineInput {
  fee_head_id: number
  installment: string
  amount: number
  due_date: string
}

export interface GenerateInput {
  class_id?: number
  installment: string
  due_date?: string
}

export interface GenerateResult {
  installment: string
  classes: number
  created: number
  already_invoiced: number
  with_transport: number
  total_amount: number
}

export interface FeeStudentRef {
  id: number
  full_name: string
  admission_no: string
  class_section: string | null
}

export interface InvoiceLine {
  id: number
  fee_head_id: number | null
  head_name: string
  description: string | null
  amount: number
}

export interface FeePayment {
  id: number
  receipt_no: string
  invoice_id: number
  invoice_no: string
  installment: string
  student: FeeStudentRef
  amount: number
  mode: PaymentMode
  reference: string | null
  paid_on: string
  received_by: string | null
  notes: string | null
  invoice_balance: number
  created_at: string
}

export interface FeeInvoice {
  id: number
  invoice_no: string
  academic_year_id: number
  installment: string
  due_date: string
  student: FeeStudentRef
  class_id: number
  section_id: number | null
  gross: number
  discount: number
  discount_reason: string | null
  total: number
  paid: number
  balance: number
  status: InvoiceStatus
  is_overdue: boolean
  days_overdue: number
  cancel_reason: string | null
  created_at: string
}

export interface FeeInvoiceDetail extends FeeInvoice {
  lines: InvoiceLine[]
  payments: FeePayment[]
}

export interface FeeTotals {
  status: StudentFeeStatus
  total: number
  paid: number
  balance: number
  overdue_amount: number
  next_due_date: string | null
  last_payment: { date: string; amount: number } | null
}

export interface StudentFees extends FeeTotals {
  student: FeeStudentRef
  invoices: FeeInvoiceDetail[]
  payments: FeePayment[]
}

export interface FeeInsights {
  academic_year: string
  invoices: number
  total_billed: number
  collected: number
  outstanding: number
  overdue_amount: number
  students_overdue: number
  todays_collection: number
  todays_payments: number
  by_status: Record<Exclude<InvoiceStatus, 'cancelled'>, number>
}

export interface PaymentInput {
  amount: number
  mode: PaymentMode
  reference?: string
  paid_on?: string
  notes?: string
}

export interface PaymentSummary {
  count: number
  amount: number
  by_mode: { mode: PaymentMode; count: number; amount: number }[]
}

export interface InvoiceListParams {
  page: number
  limit: number
  search?: string
  status?: InvoiceStatus
  class_id?: number
  section_id?: number
  installment?: string
  overdue?: boolean
  sort?: string
  order?: 'asc' | 'desc'
}

export interface PaymentFilters {
  from?: string
  to?: string
  mode?: PaymentMode
  class_id?: number
}

export interface PaymentListParams extends PaymentFilters {
  page: number
  limit: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
}

export const feeKeys = {
  all: ['fees'] as const,
  insights: () => [...feeKeys.all, 'insights'] as const,
  heads: () => [...feeKeys.all, 'heads'] as const,
  plans: () => [...feeKeys.all, 'plans'] as const,
  plan: (classId: number) => [...feeKeys.all, 'plan', classId] as const,
  installments: () => [...feeKeys.all, 'installments'] as const,
  invoices: (params: InvoiceListParams) => [...feeKeys.all, 'invoices', params] as const,
  invoice: (id: number) => [...feeKeys.all, 'invoice', id] as const,
  payments: (params: PaymentListParams) => [...feeKeys.all, 'payments', params] as const,
  paymentSummary: (filters: PaymentFilters) =>
    [...feeKeys.all, 'payment-summary', filters] as const,
  student: (id: number) => [...feeKeys.all, 'student', id] as const,
}

export const receiptUrl = (paymentId: number) => `/admin/fees/payments/${paymentId}/receipt`

export const feesApi = {
  insights: () => api.get<FeeInsights>('/admin/fees/insights'),
  heads: () =>
    api.get<Paginated<FeeHead>>('/admin/fees/heads', { limit: 100, sort: 'name', order: 'asc' }),
  createHead: (input: FeeHeadInput) => api.post<FeeHead>('/admin/fees/heads', input),
  updateHead: (id: number, input: Partial<FeeHeadInput>) =>
    api.patch<FeeHead>(`/admin/fees/heads/${id}`, input),
  removeHead: (id: number) => api.delete<null>(`/admin/fees/heads/${id}`),
  plans: () => api.get<FeePlanSummary[]>('/admin/fees/plans'),
  plan: (classId: number) => api.get<FeePlan>(`/admin/fees/plans/${classId}`),
  setPlan: (classId: number, lines: FeePlanLineInput[]) =>
    api.put<FeePlan>(`/admin/fees/plans/${classId}`, { lines }),
  installments: () => api.get<InstallmentTotal[]>('/admin/fees/installments'),
  generate: (input: GenerateInput) =>
    api.post<GenerateResult>('/admin/fees/invoices/generate', input),
  invoices: (params: InvoiceListParams) =>
    api.get<Paginated<FeeInvoice>>('/admin/fees/invoices', { ...params }),
  invoice: (id: number) => api.get<FeeInvoiceDetail>(`/admin/fees/invoices/${id}`),
  discount: (id: number, discount: number, reason: string | null) =>
    api.patch<FeeInvoiceDetail>(`/admin/fees/invoices/${id}/discount`, { discount, reason }),
  cancel: (id: number, reason?: string) =>
    api.post<FeeInvoiceDetail>(`/admin/fees/invoices/${id}/cancel`, { reason }),
  pay: (id: number, input: PaymentInput) =>
    api.post<FeePayment>(`/admin/fees/invoices/${id}/payments`, input),
  payments: (params: PaymentListParams) =>
    api.get<Paginated<FeePayment>>('/admin/fees/payments', { ...params }),
  paymentSummary: (filters: PaymentFilters) =>
    api.get<PaymentSummary>('/admin/fees/payments/summary', { ...filters }),
  student: (id: number) => api.get<StudentFees>(`/admin/students/${id}/fees`),
}

export function useFeeInsights() {
  return useQuery({ queryKey: feeKeys.insights(), queryFn: feesApi.insights })
}

export function useFeeHeads() {
  return useQuery({ queryKey: feeKeys.heads(), queryFn: feesApi.heads })
}

export function useFeePlans() {
  return useQuery({ queryKey: feeKeys.plans(), queryFn: feesApi.plans })
}

export function useFeePlan(classId: number | undefined) {
  return useQuery({
    queryKey: feeKeys.plan(classId ?? 0),
    queryFn: () => feesApi.plan(classId!),
    enabled: Boolean(classId),
    staleTime: 0,
  })
}

export function useInstallments() {
  return useQuery({ queryKey: feeKeys.installments(), queryFn: feesApi.installments })
}

export function useInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: feeKeys.invoices(params),
    queryFn: () => feesApi.invoices(params),
    placeholderData: keepPreviousData,
  })
}

export function useInvoice(id: number | undefined) {
  return useQuery({
    queryKey: feeKeys.invoice(id ?? 0),
    queryFn: () => feesApi.invoice(id!),
    enabled: Boolean(id),
  })
}

export function usePayments(params: PaymentListParams) {
  return useQuery({
    queryKey: feeKeys.payments(params),
    queryFn: () => feesApi.payments(params),
    placeholderData: keepPreviousData,
  })
}

export function usePaymentSummary(filters: PaymentFilters) {
  return useQuery({
    queryKey: feeKeys.paymentSummary(filters),
    queryFn: () => feesApi.paymentSummary(filters),
    placeholderData: keepPreviousData,
  })
}

export function useStudentFees(id: number, enabled = true) {
  return useQuery({
    queryKey: feeKeys.student(id),
    queryFn: () => feesApi.student(id),
    enabled,
  })
}

export function useFeesMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feeKeys.all })
    },
  })
}
