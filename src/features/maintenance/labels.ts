import { z } from 'zod'
import type { BadgeTone } from '@/components/ui/badge'
import { SEVERITY } from '@/features/fleet/labels'
import type { TicketSeverity, TicketSource, TicketStatus } from './api'

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Open', tone: 'danger' },
  in_progress: { label: 'In progress', tone: 'warning' },
  done: { label: 'Done', tone: 'success' },
}

export const TICKET_SOURCE: Record<TicketSource, { label: string; tone: BadgeTone }> = {
  obd: { label: 'OBD', tone: 'info' },
  manual: { label: 'Manual', tone: 'neutral' },
}

export const TICKET_STATUS_OPTIONS = (Object.keys(TICKET_STATUS) as TicketStatus[]).map(
  (value) => ({ value, label: TICKET_STATUS[value].label })
)

export const TICKET_SOURCE_OPTIONS = [
  { value: 'obd', label: 'From OBD' },
  { value: 'manual', label: 'Added by hand' },
]

export const SEVERITY_OPTIONS = (Object.keys(SEVERITY) as TicketSeverity[]).map((value) => ({
  value,
  label: SEVERITY[value].label,
}))

export const rupees = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export const optionalNumber = (value: string) => {
  const text = value.trim()
  return text === '' ? undefined : Number(text)
}

export const numberText = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (value === '') return true
      const number = Number(value)
      return Number.isFinite(number) && number >= min && number <= max
    }, message)
