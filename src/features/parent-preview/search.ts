import { z } from 'zod'

export const PHONE_TAB_IDS = [
  'home',
  'attendance',
  'bus',
  'results',
  'fees',
  'achievements',
  'notifications',
] as const

export type PhoneTab = (typeof PHONE_TAB_IDS)[number]

export const parentPreviewSearchSchema = z.object({
  student: z.coerce.number().int().min(1).optional().catch(undefined),
  tab: z.enum(PHONE_TAB_IDS).optional().catch(undefined),
})
