import { z } from 'zod'

export const PAYROLL_TABS = ['runs', 'salaries'] as const
export type PayrollTab = (typeof PAYROLL_TABS)[number]

export const SALARY_FILTERS = ['set', 'missing'] as const
export type SalaryFilter = (typeof SALARY_FILTERS)[number]

export const payrollSearchSchema = z.object({
  tab: z.enum(PAYROLL_TABS).catch('runs'),
  run_id: z.coerce.number().int().min(1).optional().catch(undefined),
  search: z.string().optional().catch(undefined),
  salary: z.enum(SALARY_FILTERS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})

export type PayrollSearch = z.infer<typeof payrollSearchSchema>
