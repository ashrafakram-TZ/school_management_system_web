import { z } from 'zod'

export const TEACHER_TAB_IDS = ['home', 'diary', 'meetings', 'chat', 'news'] as const

export type TeacherTab = (typeof TEACHER_TAB_IDS)[number]

export const teacherPreviewSearchSchema = z.object({
  staff: z.coerce.number().int().min(1).optional().catch(undefined),
  tab: z.enum(TEACHER_TAB_IDS).optional().catch(undefined),
})
