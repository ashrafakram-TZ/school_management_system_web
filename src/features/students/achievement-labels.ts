import type { BadgeTone } from '@/components/ui/badge'
import type {
  AchievementCategory,
  AchievementLevel,
  AchievementResult,
  EventScope,
  Participation,
  VenueType,
} from './records-api'

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  academic: 'Academic',
  sports: 'Sports',
  arts: 'Arts',
  cultural: 'Cultural',
  competition: 'Competition',
  leadership: 'Leadership',
  other: 'Other',
}

export const LEVEL_LABELS: Record<AchievementLevel, string> = {
  class: 'Class',
  school: 'School',
  zone: 'Zone',
  district: 'District',
  state: 'State',
  national: 'National',
  international: 'International',
}

export const LEVEL_TONE: Record<AchievementLevel, BadgeTone> = {
  class: 'neutral',
  school: 'neutral',
  zone: 'info',
  district: 'info',
  state: 'success',
  national: 'success',
  international: 'success',
}

export const RESULT_LABELS: Record<AchievementResult, string> = {
  winner: 'Winner',
  runner_up: 'Runner-up',
  third_place: 'Third place',
  participated: 'Took part, no win',
}

export const RESULT_TONE: Record<AchievementResult, BadgeTone> = {
  winner: 'success',
  runner_up: 'info',
  third_place: 'warning',
  participated: 'neutral',
}

export const SCOPE_LABELS: Record<EventScope, string> = {
  sports_day: 'Sports day',
  in_school: 'In school',
  inter_school: 'Inter-school',
  out_of_school: 'Outside school',
}

export const VENUE_LABELS: Record<VenueType, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
}

export const PARTICIPATION_LABELS: Record<Participation, string> = {
  individual: 'Individual',
  team: 'Team',
}

export const optionsOf = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))
