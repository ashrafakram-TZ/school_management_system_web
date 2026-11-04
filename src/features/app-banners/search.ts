import { z } from 'zod'

export const appBannersSearchSchema = z.object({
  state: z.enum(['live', 'scheduled', 'ended', 'paused']).optional().catch(undefined),
  audience: z.enum(['all', 'staff', 'parents']).optional().catch(undefined),
  search: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
})

export type AppBannersSearch = z.infer<typeof appBannersSearchSchema>
