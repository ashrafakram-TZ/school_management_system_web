import { useState } from 'react'
import { CalendarCheck, Clock, Palmtree, PenLine, UserRoundX, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/common/avatar'
import { DataTable, type Column } from '@/components/common/data-table'
import { InsightCards, type Insight } from '@/components/common/insight-cards'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useStaffBoard, type StaffBoardRow } from '../api'
import { SOURCE_LABELS, STAFF_DAY_STATUS, clockTime } from '../labels'
import { CorrectModal } from './correct-modal'
import { DateStepper } from './date-stepper'

const timeText = (value: string | null) => clockTime(value) || '—'

export function StaffTab({
  date,
  canManage,
  onDateChange,
}: {
  date: string
  canManage: boolean
  onDateChange: (date: string) => void
}) {
  const board = useStaffBoard(date)
  const data = board.data
  const [correcting, setCorrecting] = useState<StaffBoardRow | null>(null)

  useShortcut('app.refresh', () => void board.refetch())

  const cards: Insight[] = [
    {
      key: 'present',
      label: 'Present',
      value: data?.present ?? 0,
      hint: `of ${data?.total ?? 0} staff`,
      icon: CalendarCheck,
      tone: 'success',
    },
    {
      key: 'late',
      label: 'Late',
      value: data?.late ?? 0,
      hint: data ? `After ${data.reporting_time}` : 'After reporting time',
      icon: Clock,
      tone: data?.late ? 'warning' : 'neutral',
    },
    {
      key: 'leave',
      label: 'On leave',
      value: data?.on_leave ?? 0,
      hint: 'Approved leave today',
      icon: Palmtree,
      tone: 'info',
    },
    {
      key: 'not-in',
      label: 'Not checked in',
      value: data?.not_checked_in ?? 0,
      hint: 'No check-in yet',
      icon: UserRoundX,
      tone: data?.not_checked_in ? 'danger' : 'success',
    },
  ]

  const correctButton = (row: StaffBoardRow) =>
    canManage && (
      <Button
        variant='outline'
        size='sm'
        aria-label={`Correct attendance for ${row.name}`}
        onClick={(event) => {
          event.stopPropagation()
          setCorrecting(row)
        }}
      >
        <PenLine />
        Correct
      </Button>
    )

  const columns: Column<StaffBoardRow>[] = [
    {
      key: 'name',
      header: 'Staff',
      cell: (row) => (
        <div className='flex items-center gap-3'>
          <Avatar name={row.name} />
          <div className='grid min-w-0'>
            <span className='truncate font-bold'>{row.name}</span>
            <span className='truncate text-xs text-muted-foreground'>
              {row.designation}
              {row.department ? ` · ${row.department}` : ''}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge tone={STAFF_DAY_STATUS[row.status].tone}>{STAFF_DAY_STATUS[row.status].label}</Badge>
      ),
    },
    {
      key: 'in',
      header: 'Check-in',
      cell: (row) => <span className='tabular'>{timeText(row.check_in_at)}</span>,
    },
    {
      key: 'out',
      header: 'Check-out',
      cell: (row) => <span className='tabular'>{timeText(row.check_out_at)}</span>,
    },
    {
      key: 'distance',
      header: 'Distance',
      hideBelow: 'lg',
      cell: (row) =>
        row.check_in_distance_m !== null ? (
          <span className='tabular'>{row.check_in_distance_m} m</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        ),
    },
    {
      key: 'source',
      header: 'Source',
      hideBelow: 'lg',
      cell: (row) =>
        row.source ? (
          <span className='grid'>
            <span>{SOURCE_LABELS[row.source]}</span>
            {row.remarks && (
              <span className='max-w-48 truncate text-xs text-muted-foreground'>{row.remarks}</span>
            )}
          </span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            cell: correctButton,
          },
        ]
      : []),
  ]

  return (
    <div className='grid gap-4'>
      <DateStepper id='staff-attendance-date' value={date} onChange={onDateChange} />
      <InsightCards items={cards} loading={board.isPending} />
      <Card className='overflow-hidden'>
        <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3'>
          <h2 className='font-bold'>Staff check-ins</h2>
          {data && (
            <span className='text-xs text-muted-foreground'>
              Reporting time {data.reporting_time}
            </span>
          )}
        </div>
        <DataTable
          rows={data?.staff ?? []}
          columns={columns}
          rowKey={(row) => row.user_id}
          loading={board.isFetching}
          error={board.isError ? board.error.message : null}
          onRetry={() => board.refetch()}
          empty={{
            icon: UsersRound,
            title: 'No staff yet',
            description: 'Add staff in the Staff page so they can check in.',
          }}
          card={(row) => (
            <div className='flex items-start gap-3'>
              <Avatar name={row.name} />
              <div className='grid min-w-0 flex-1 gap-1.5'>
                <div className='flex items-start justify-between gap-2'>
                  <span className='grid min-w-0'>
                    <span className='truncate font-bold'>{row.name}</span>
                    <span className='truncate text-xs text-muted-foreground'>
                      {row.designation}
                    </span>
                  </span>
                  <Badge tone={STAFF_DAY_STATUS[row.status].tone}>
                    {STAFF_DAY_STATUS[row.status].label}
                  </Badge>
                </div>
                <span className='tabular text-xs text-muted-foreground'>
                  In {timeText(row.check_in_at)} · Out {timeText(row.check_out_at)}
                  {row.check_in_distance_m !== null && ` · ${row.check_in_distance_m} m`}
                  {row.source && ` · ${SOURCE_LABELS[row.source]}`}
                </span>
                {canManage && <div>{correctButton(row)}</div>}
              </div>
            </div>
          )}
        />
      </Card>
      {correcting && <CorrectModal row={correcting} onClose={() => setCorrecting(null)} />}
    </div>
  )
}
