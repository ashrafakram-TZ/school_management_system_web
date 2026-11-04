import { z } from 'zod'

export const diarySearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(['pending_review', 'published', 'rejected', 'hidden']).optional().catch(undefined),
  type: z.enum(['homework', 'remark', 'feedback', 'note']).optional().catch(undefined),
  sort: z.enum(['created_at', 'published_at', 'status', 'type']).optional().catch(undefined),
  order: z.enum(['asc', 'desc']).optional().catch(undefined),
  entry: z.coerce.number().int().min(1).optional().catch(undefined),
})

export type DiarySearch = z.infer<typeof diarySearchSchema>
