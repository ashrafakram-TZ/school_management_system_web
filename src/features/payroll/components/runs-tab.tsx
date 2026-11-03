import { useState } from 'react'
import { Calculator, ReceiptIndianRupee } from 'lucide-react'
import { Combobox } from '@/components/common/combobox'
import { DataTable, type Column } from '@/components/common/data-table'
import { FormField } from '@/components/common/form-field'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { alerts } from '@/lib/alerts'
import { recentMonths } from '@/features/attendance/labels'
import { fieldErrorsOf } from '@/features/setup/form-actions'
import { payrollApi, usePayrollMutation, usePayrollRuns, type PayrollRun } from '../api'
import { RUN_STATUS, daysText, rupees, staffText } from '../labels'
import { RunDetail } from './run-detail'

const LIMIT = 20

export function RunsTab({
  runId,
  page,
  canManage,
  onOpenRun,
  onPageChange,
  onOpenSalaries,
}: {
  runId?: number
  page: number
  canManage: boolean
  onOpenRun: (runId: number | undefined) => void
  onPageChange: (page: number) => void
  onOpenSalaries: () => void
}) {
  const months = recentMonths(12)
  const [month, setMonth] = useState<string | undefined>(months[1]?.value)
  const [monthError, setMonthError] = useState('')
  const runs = usePayrollRuns({ page, limit: LIMIT })
  const runMonth = usePayrollMutation((value: string) => payrollApi.runMonth(value))
  const total = runs.data?.total

  useShortcut('app.refresh', () => void runs.refetch(), { enabled: !runId })

  const startRun = async () => {
    if (!month) {
      setMonthError('Choose a month')
      return
    }
    setMonthError('')
    try {
      const result = await runMonth.mutateAsync(month)
      alerts.success(`${result.month_label} payroll calculated`, {
        description: `${staffText(result.staff_count)} · net ${rupees(result.total_net)}`,
      })
      onOpenRun(result.id)
    } catch (error) {
      const fields = fieldErrorsOf(error)
      if (fields.month) setMonthError(fields.month)
      else alerts.error(fields.root ?? Object.values(fields)[0])
    }
  }

  const statusBadge = (run: PayrollRun) => (
    <Badge tone={RUN_STATUS[run.status].tone}>{RUN_STATUS[run.status].label}</Badge>
  )

  const columns: Column<PayrollRun>[] = [
    {
      key: 'month',
      header: 'Month',
      cell: (run) => <span className='font-bold'>{run.month_label}</span>,
    },
    { key: 'status', header: 'Status', cell: statusBadge },
    {
      key: 'staff',
      header: 'Staff',
      align: 'right',
      cell: (run) => <span className='tabular'>{run.staff_count}</span>,
    },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      hideBelow: 'lg',
      cell: (run) => <span className='tabular'>{rupees(run.total_gross)}</span>,
    },
    {
      key: 'deductions',
      header: 'Deductions',
      align: 'right',
      hideBelow: 'lg',
      cell: (run) => (
        <span className='tabular text-muted-foreground'>{rupees(run.total_deductions)}</span>
      ),
    },
    {
      key: 'net',
      header: 'Net pay',
      align: 'right',
      cell: (run) => <span className='tabular font-bold'>{rupees(run.total_net)}</span>,
    },
    {
      key: 'days',
      header: 'Working days',
      align: 'right',
      cell: (run) => <span className='tabular'>{run.working_days}</span>,
    },
  ]

  return (
    <div className='grid gap-4'>
      {canManage && (
        <Card className='p-4'>
          <div className='flex flex-wrap items-end gap-3'>
            <FormField
              id='payroll-month'
              label='Month'
              required
              error={monthError}
              className='w-full sm:w-56'
            >
              <Combobox
                id='payroll-month'
                label='Month'
                value={month}
                placeholder='Choose a month'
                searchPlaceholder='Search month'
                options={months}
                invalid={Boolean(monthError)}
                highlightSelected={false}
                onChange={(value) => {
                  setMonth(value)
                  if (value) setMonthError('')
                }}
                className='sm:w-full'
              />
            </FormField>
            <Button onClick={() => void startRun()} loading={runMonth.isPending}>
              <Calculator />
              Run payroll
            </Button>
            <p className='basis-full text-xs text-muted-foreground'>
              Running a month again recalculates its draft. Sundays and holidays are not working
              days; unpaid leave and absent days are loss of pay.
            </p>
          </div>
        </Card>
      )}
      {runId ? (
        <RunDetail
          runId={runId}
          canManage={canManage}
          onBack={() => onOpenRun(undefined)}
          onOpenSalaries={onOpenSalaries}
        />
      ) : (
        <Card className='overflow-hidden'>
          <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3'>
            <h2 className='font-bold'>Payroll runs</h2>
            {total !== undefined && (
              <span className='tabular text-xs text-muted-foreground'>
                {total} {total === 1 ? 'run' : 'runs'}
              </span>
            )}
          </div>
          <DataTable
            rows={runs.data?.items ?? []}
            columns={columns}
            rowKey={(run) => run.id}
            loading={runs.isFetching}
            error={runs.isError ? runs.error.message : null}
            onRetry={() => runs.refetch()}
            onRowClick={(run) => onOpenRun(run.id)}
            empty={{
              icon: ReceiptIndianRupee,
              title: 'No payroll runs yet',
              description: canManage
                ? 'Choose a month and run payroll to work out every payslip.'
                : 'Payroll has not been run for any month yet.',
            }}
            pagination={
              total !== undefined
                ? { page, limit: LIMIT, total, label: 'runs', onPageChange }
                : undefined
            }
            card={(run) => (
              <div className='grid gap-1.5'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-bold'>{run.month_label}</span>
                  {statusBadge(run)}
                </div>
                <span className='tabular text-sm font-bold'>{rupees(run.total_net)} net</span>
                <span className='tabular text-xs text-muted-foreground'>
                  {staffText(run.staff_count)} · {daysText(run.working_days)} · Gross{' '}
                  {rupees(run.total_gross)}
                </span>
              </div>
            )}
          />
        </Card>
      )}
    </div>
  )
}
