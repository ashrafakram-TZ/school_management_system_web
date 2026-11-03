import { useState } from 'react'
import { PenLine, Plus, Wallet } from 'lucide-react'
import { DataTable, type Column } from '@/components/common/data-table'
import { FilterSelect, ListToolbar, SearchBox } from '@/components/common/list-toolbar'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { useSalaries, type SalaryStaff } from '../api'
import { rupees, staffText } from '../labels'
import type { PayrollSearch, SalaryFilter } from '../search'
import { SalaryModal } from './salary-modal'

const LIMIT = 20

const SALARY_OPTIONS: { value: SalaryFilter; label: string }[] = [
  { value: 'set', label: 'Has salary' },
  { value: 'missing', label: 'No salary' },
]

const notSet = <Badge tone='warning'>Not set</Badge>

export function SalariesTab({
  search,
  canManage,
  onSearchChange,
}: {
  search: PayrollSearch
  canManage: boolean
  onSearchChange: (patch: Partial<PayrollSearch>) => void
}) {
  const page = search.page ?? 1
  const salaries = useSalaries({
    page,
    limit: LIMIT,
    search: search.search,
    has_structure: search.salary ? search.salary === 'set' : undefined,
  })
  const [editing, setEditing] = useState<number | null>(null)
  const filtered = Boolean(search.search || search.salary)
  const total = salaries.data?.total

  useShortcut('app.refresh', () => void salaries.refetch())

  const editButton = (row: SalaryStaff) =>
    canManage && (
      <Button
        variant={row.structure ? 'outline' : 'default'}
        size='sm'
        aria-label={`${row.structure ? 'Edit' : 'Set'} salary for ${row.name}`}
        onClick={(event) => {
          event.stopPropagation()
          setEditing(row.user_id)
        }}
      >
        {row.structure ? <PenLine /> : <Plus />}
        {row.structure ? 'Edit' : 'Set salary'}
      </Button>
    )

  const money = (value: number | undefined) =>
    value === undefined ? notSet : <span className='tabular'>{rupees(value)}</span>

  const columns: Column<SalaryStaff>[] = [
    {
      key: 'staff',
      header: 'Staff',
      cell: (row) => (
        <div className='grid min-w-0'>
          <span className='truncate font-bold'>{row.name}</span>
          <span className='font-mono text-xs text-muted-foreground'>{row.employee_no}</span>
        </div>
      ),
    },
    {
      key: 'designation',
      header: 'Designation',
      cell: (row) => (
        <div className='grid min-w-0'>
          <span className='truncate'>{row.designation}</span>
          {row.department && (
            <span className='truncate text-xs text-muted-foreground'>{row.department}</span>
          )}
        </div>
      ),
    },
    {
      key: 'from',
      header: 'Effective from',
      hideBelow: 'xl',
      cell: (row) =>
        row.structure ? (
          <span className='tabular'>{formatDate(row.structure.effective_from)}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        ),
    },
    {
      key: 'gross',
      header: 'Monthly gross',
      align: 'right',
      cell: (row) => money(row.structure?.monthly_gross),
    },
    {
      key: 'deductions',
      header: 'Deductions',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) =>
        row.structure ? (
          <span className='tabular text-muted-foreground'>
            {rupees(row.structure.monthly_deductions)}
          </span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        ),
    },
    {
      key: 'net',
      header: 'Net pay',
      align: 'right',
      cell: (row) =>
        row.structure ? (
          <span className='tabular font-bold'>{rupees(row.structure.monthly_net)}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        ),
    },
    ...(canManage
      ? [{ key: 'actions', header: '', align: 'right' as const, cell: editButton }]
      : []),
  ]

  return (
    <Card className='overflow-hidden'>
      <ListToolbar
        summary={total !== undefined ? staffText(total) : ''}
        onClear={
          filtered ? () => onSearchChange({ search: undefined, salary: undefined }) : undefined
        }
      >
        <SearchBox
          value={search.search ?? ''}
          onChange={(value) => onSearchChange({ search: value || undefined })}
          placeholder='Search name, employee no, designation'
          label='Search staff salaries'
        />
        <FilterSelect
          id='salary-filter'
          label='Filter by salary'
          allLabel='All staff'
          value={search.salary}
          options={SALARY_OPTIONS}
          onChange={(value) => onSearchChange({ salary: value as SalaryFilter | undefined })}
        />
      </ListToolbar>
      <DataTable
        rows={salaries.data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.user_id}
        loading={salaries.isFetching}
        error={salaries.isError ? salaries.error.message : null}
        onRetry={() => salaries.refetch()}
        empty={
          filtered
            ? {
                icon: Wallet,
                title: 'No staff match',
                description: 'Try a different name or clear the filters.',
              }
            : {
                icon: Wallet,
                title: 'No staff yet',
                description: 'Add staff in the Staff page, then set their salary here.',
              }
        }
        pagination={
          total !== undefined
            ? {
                page,
                limit: LIMIT,
                total,
                label: 'staff',
                onPageChange: (next) => onSearchChange({ page: next }),
              }
            : undefined
        }
        card={(row) => (
          <div className='grid gap-2'>
            <div className='flex items-start justify-between gap-2'>
              <span className='grid min-w-0'>
                <span className='truncate font-bold'>{row.name}</span>
                <span className='truncate text-xs text-muted-foreground'>
                  {row.employee_no} · {row.designation}
                </span>
              </span>
              {row.structure ? (
                <span className='tabular shrink-0 text-right text-sm font-bold'>
                  {rupees(row.structure.monthly_net)}
                  <span className='block text-[11px] font-medium text-muted-foreground'>
                    net a month
                  </span>
                </span>
              ) : (
                notSet
              )}
            </div>
            {row.structure && (
              <span className='tabular text-xs text-muted-foreground'>
                Gross {rupees(row.structure.monthly_gross)} · Deductions{' '}
                {rupees(row.structure.monthly_deductions)}
              </span>
            )}
            {canManage && <div>{editButton(row)}</div>}
          </div>
        )}
      />
      {editing && <SalaryModal userId={editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}
