import { z } from 'zod'

export const TIMETABLE_TABS = ['builder', 'teachers', 'workload', 'bells'] as const
export type TimetableTab = (typeof TIMETABLE_TABS)[number]

const id = z.coerce.number().int().min(1).optional().catch(undefined)

export const timetableSearchSchema = z.object({
  tab: z.enum(TIMETABLE_TABS).catch('builder'),
  section_id: id,
  teacher_id: id,
})

export type TimetableSearch = z.infer<typeof timetableSearchSchema>
