import type { BadgeTone } from '@/components/ui/badge'
import type { BannerAudience, BannerState } from './api'

export const AUDIENCE_LABELS: Record<BannerAudience, string> = {
  all: 'Staff and parents',
  staff: 'Staff app',
  parents: 'Parent app',
}

export const STATE_LABELS: Record<BannerState, string> = {
  live: 'Live now',
  scheduled: 'Scheduled',
  ended: 'Ended',
  paused: 'Paused',
}

export const STATE_TONE: Record<BannerState, BadgeTone> = {
  live: 'success',
  scheduled: 'info',
  ended: 'neutral',
  paused: 'warning',
}
