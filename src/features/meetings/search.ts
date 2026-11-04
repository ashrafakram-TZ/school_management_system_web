import { z } from 'zod'

export const meetingsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().trim().max(100).optional().catch(undefined),
  status: z
    .enum(['scheduled', 'live', 'completed', 'missed', 'cancelled'])
    .optional()
    .catch(undefined),
  when: z.enum(['today', 'upcoming', 'past']).optional().catch(undefined),
  scheduled_by: z.enum(['teacher', 'parent']).optional().catch(undefined),
  sort: z.enum(['scheduled_at', 'created_at', 'status', 'title']).optional().catch(undefined),
  order: z.enum(['asc', 'desc']).optional().catch(undefined),
  meeting: z.coerce.number().int().min(1).optional().catch(undefined),
})

export type MeetingsSearch = z.infer<typeof meetingsSearchSchema>
