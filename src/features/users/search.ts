import { z } from 'zod'

export const usersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().trim().max(100).optional().catch(undefined),
  role: z
    .string()
    .regex(/^[A-Z_]+$/)
    .optional()
    .catch(undefined),
  app: z.enum(['admin', 'staff', 'parent', 'driver']).optional().catch(undefined),
  status: z.enum(['active', 'inactive']).optional().catch(undefined),
  never_signed_in: z.boolean().optional().catch(undefined),
  language: z.enum(['en', 'ta']).optional().catch(undefined),
  sort: z.enum(['created_at', 'name', 'last_login_at']).optional().catch(undefined),
  order: z.enum(['asc', 'desc']).optional().catch(undefined),
})

export type UsersSearch = z.infer<typeof usersSearchSchema>
