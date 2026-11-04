import { z } from 'zod'

export const alertsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().trim().max(100).optional().catch(undefined),
  kind: z
    .enum([
      'sos',
      'overspeed',
      'harsh_braking',
      'idle',
      'route_deviation',
      'vehicle_fault',
      'other',
    ])
    .optional()
    .catch(undefined),
  status: z.enum(['open', 'acknowledged', 'resolved']).optional().catch(undefined),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().catch(undefined),
  active: z.literal(true).optional().catch(undefined),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  sort: z.enum(['raised_at', 'kind', 'status', 'severity']).optional().catch(undefined),
  order: z.enum(['asc', 'desc']).optional().catch(undefined),
})

export type AlertsSearch = z.infer<typeof alertsSearchSchema>
