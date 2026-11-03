import { z } from 'zod'

export const substitutesSearchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
})

export type SubstitutesSearch = z.infer<typeof substitutesSearchSchema>
