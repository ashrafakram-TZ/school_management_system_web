import { z } from 'zod'

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

export const MAINTENANCE_TABS = ['tickets', 'fuel'] as const
export type MaintenanceTab = (typeof MAINTENANCE_TABS)[number]

export const maintenanceSearchSchema = z.object({
  tab: z.enum(MAINTENANCE_TABS).catch('tickets'),
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().trim().max(100).optional().catch(undefined),
  vehicle_id: z.coerce.number().int().min(1).optional().catch(undefined),
  status: z.enum(['open', 'in_progress', 'done']).optional().catch(undefined),
  source: z.enum(['obd', 'manual']).optional().catch(undefined),
  from: date,
  to: date,
  sort: z
    .enum(['opened_at', 'closed_at', 'cost', 'status', 'filled_on', 'amount', 'litres'])
    .optional()
    .catch(undefined),
  order: z.enum(['asc', 'desc']).optional().catch(undefined),
})

export type MaintenanceSearch = z.infer<typeof maintenanceSearchSchema>
