import type { BadgeTone } from '@/components/ui/badge'
import type { MeetingParty, MeetingStatus } from './api'

export const MEETING_STATUS: Record<MeetingStatus, { label: string; tone: BadgeTone }> = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  live: { label: 'Live now', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  missed: { label: 'Missed', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export const PARTY_LABEL: Record<MeetingParty, string> = {
  teacher: 'Teacher',
  parent: 'Parent',
}

export function durationLabel(minutes: number | null) {
  if (minutes === null) return '—'
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}
