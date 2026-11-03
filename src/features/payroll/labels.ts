import type { BadgeTone } from '@/components/ui/badge'
import type { RunStatus, SalaryAmounts } from './api'

export const PF_RATE = 0.12
export const PF_WAGE_CEILING = 15000
export const ESI_RATE = 0.0075
export const ESI_GROSS_LIMIT = 21000
export const MAX_AMOUNT = 10000000

export const RUN_STATUS: Record<RunStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'warning' },
  finalized: { label: 'Final', tone: 'success' },
}

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

export const EARNING_FIELDS = [
  { key: 'basic', label: 'Basic pay', required: true },
  { key: 'da', label: 'Dearness allowance (DA)' },
  { key: 'hra', label: 'House rent allowance (HRA)' },
  { key: 'conveyance', label: 'Conveyance' },
  { key: 'special_allowance', label: 'Special allowance' },
  { key: 'other_allowance', label: 'Other allowance' },
] as const satisfies readonly { key: keyof SalaryAmounts; label: string; required?: boolean }[]

export const DEDUCTION_FIELDS = [
  { key: 'professional_tax', label: 'Professional tax' },
  { key: 'tds', label: 'Income tax (TDS)' },
  { key: 'other_deduction', label: 'Other deduction' },
] as const satisfies readonly { key: keyof SalaryAmounts; label: string }[]

const round2 = (value: number) => Math.round(value * 100) / 100

export interface SalaryPreview {
  gross: number
  pf: number
  esi: number
  fixed: number
  deductions: number
  net: number
  capped: boolean
}

export function previewSalary(
  amounts: SalaryAmounts,
  pfEnabled: boolean,
  esiEnabled: boolean
): SalaryPreview {
  const gross = round2(
    amounts.basic +
      amounts.da +
      amounts.hra +
      amounts.conveyance +
      amounts.special_allowance +
      amounts.other_allowance
  )
  const pf = pfEnabled
    ? Math.round(Math.min(amounts.basic + amounts.da, PF_WAGE_CEILING) * PF_RATE)
    : 0
  const esi = esiEnabled && gross <= ESI_GROSS_LIMIT ? Math.ceil(gross * ESI_RATE) : 0
  const fixed = amounts.professional_tax + amounts.tds + amounts.other_deduction
  const uncapped = pf + esi + fixed
  const deductions = round2(Math.min(uncapped, gross))
  return {
    gross,
    pf,
    esi,
    fixed: round2(fixed),
    deductions,
    net: round2(gross - deductions),
    capped: uncapped > gross,
  }
}

export const staffText = (count: number) => `${count} staff`

export const daysText = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`
