import { z } from 'zod'

export const outboxSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().trim().max(100).optional().catch(undefined),
  channel: z.enum(['in_app', 'push', 'sms']).optional().catch(undefined),
  status: z
    .enum(['queued', 'sent', 'delivered', 'read', 'failed', 'skipped'])
    .optional()
    .catch(undefined),
  sort: z.enum(['created_at', 'status', 'channel']).optional().catch(undefined),
  order: z.enum(['asc', 'desc']).optional().catch(undefined),
})

export type OutboxSearch = z.infer<typeof outboxSearchSchema>
