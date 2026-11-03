import type { BadgeTone } from '@/components/ui/badge'
import { toApiError } from '@/lib/api/errors'
import { alerts } from '@/lib/alerts'
import { openFile } from '@/lib/files'
import { receiptUrl, type InvoiceStatus, type PaymentMode, type StudentFeeStatus } from './api'

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: BadgeTone }> = {
  unpaid: { label: 'Unpaid', tone: 'warning' },
  partly_paid: { label: 'Partly paid', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const STUDENT_FEE_STATUS: Record<StudentFeeStatus, { label: string; tone: BadgeTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partly_paid: { label: 'Partly paid', tone: 'info' },
  due: { label: 'Due', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'danger' },
}

export const PAYMENT_MODES: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
}

export const MODE_OPTIONS = (Object.keys(PAYMENT_MODES) as PaymentMode[]).map((mode) => ({
  value: mode,
  label: PAYMENT_MODES[mode],
}))

export const STATUS_OPTIONS = (Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map((status) => ({
  value: status,
  label: INVOICE_STATUS[status].label,
}))

export const MAX_AMOUNT = 10000000

const rupeeFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const wholeRupeeFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export const rupees = (value: number) => rupeeFormat.format(value)

export const wholeRupees = (value: number) => wholeRupeeFormat.format(Math.round(value))

export const round2 = (value: number) => Math.round(value * 100) / 100

export function amountError(text: string, max: number, label = 'amount') {
  const value = text.trim()
  if (!value) return `Enter the ${label}`
  const number = Number(value)
  if (Number.isNaN(number) || number < 0) return 'Enter an amount of 0 or more'
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'Use at most 2 decimal places'
  if (number > max) return `Enter an amount up to ${rupees(max)}`
  return undefined
}

export function formErrors(error: unknown, codeFields: Record<string, string> = {}) {
  const apiError = toApiError(error)
  const fields: Record<string, string> = Object.fromEntries(
    apiError.fieldErrors.map((item) => [item.field, item.message])
  )
  const field = codeFields[apiError.code]
  if (field) fields[field] = apiError.message
  if (!Object.keys(fields).length) alerts.error(apiError.message)
  return fields
}

export const invoicesText = (count: number) => `${count} ${count === 1 ? 'invoice' : 'invoices'}`

export function openReceipt(paymentId: number) {
  void openFile(receiptUrl(paymentId)).catch((error: unknown) =>
    alerts.error(error instanceof Error ? error.message : 'Could not open the receipt')
  )
}
