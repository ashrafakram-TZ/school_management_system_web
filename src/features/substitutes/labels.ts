import type { BadgeTone } from '@/components/ui/badge'
import type { AbsentPeriod, CombinedInto, MergeGroup } from './api'

export const reasonTone = (reason: string): BadgeTone =>
  reason.toLowerCase() === 'absent' ? 'danger' : 'info'

export const periodTime = (period: Pick<AbsentPeriod, 'start_time' | 'end_time'>) =>
  `${period.start_time}–${period.end_time}`

export const periodSummary = (period: AbsentPeriod) =>
  [
    `Period ${period.period_no}`,
    periodTime(period),
    period.section.name,
    period.subject.name,
    period.room,
  ]
    .filter(Boolean)
    .join(' · ')

export const GROUP_LABELS: Record<MergeGroup, string> = {
  all: 'Whole class',
  boys: 'Boys',
  girls: 'Girls',
}

export const combinedText = (item: CombinedInto) =>
  `${GROUP_LABELS[item.group]} (${item.students}) → ${item.section.name}${item.teacher ? ` with ${item.teacher.name}` : ''}`

export const countText = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

export const dayOffText = (holiday: string | null) =>
  holiday
    ? `Holiday: ${holiday}. There are no classes to cover on this date.`
    : 'Not a school day. There are no classes to cover on this date.'
