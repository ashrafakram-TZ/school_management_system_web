import { CalendarCheck, ClipboardX, Inbox, LayoutGrid, UserRoundX, UsersRound } from 'lucide-react'
import { DataTable, type Column } from '@/components/common/data-table'
import { InsightCards, type Insight } from '@/components/common/insight-cards'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/format'
import { useAttendanceBoard, type BoardSection } from '../api'
import { dayOffText, percentLabel, percentTone, studentsText } from '../labels'
import { DateStepper } from './date-stepper'
import { Notice } from './notice'
import { SectionSheet } from './section-sheet'

export function StudentsTab({
  date,
  sectionId,
  canManage,
  onDateChange,
  onOpenSection,
  onOpenLeave,
}: {
  date: string
  sectionId?: number
  canManage: boolean
  onDateChange: (date: string) => void
  onOpenSection: (sectionId: number | undefined) => void
  onOpenLeave: () => void
}) {
  const board = useAttendanceBoard(date)
  const data = board.data
  const summary = data?.summary
  const rows = data?.sections ?? []
  const open = rows.find((row) => row.section_id === sectionId)

  useShortcut('app.refresh', () => void board.refetch())

  const cards: Insight[] = [
    {
      key: 'present',
      label: 'Present',
      value: summary?.present ?? 0,
      hint: summary?.percent != null ? `${summary.percent}% attendance` : 'Nothing marked yet',
      icon: CalendarCheck,
      tone: 'success',
    },
    {
      key: 'absent',
      label: 'Absent',
      value: summary?.absent ?? 0,
      hint: `${summary?.late ?? 0} late · ${summary?.half_day ?? 0} half day`,
      icon: UserRoundX,
      tone: summary?.absent ? 'danger' : 'neutral',
    },
    {
      key: 'not-marked',
      label: 'Sections not marked',
      value: data?.sections_not_marked ?? 0,
      hint: `of ${data?.sections_total ?? 0} sections`,
      icon: ClipboardX,
      tone: data?.sections_not_marked ? 'warning' : 'success',
    },
    {
      key: 'leave',
      label: 'Leave requests waiting',
      value: data?.leave_pending ?? 0,
      hint: data?.below_75
        ? `${studentsText(data.below_75)} below 75% this month`
        : 'From parents in the app',
      icon: Inbox,
      tone: data?.leave_pending ? 'info' : 'neutral',
      onClick: onOpenLeave,
    },
  ]

  const columns: Column<BoardSection>[] = [
    {
      key: 'name',
      header: 'Section',
      cell: (row) => (
        <div className='grid min-w-0'>
          <span className='font-bold'>Class {row.name}</span>
          <span className='truncate text-xs text-muted-foreground'>
            {row.class_teacher ?? 'No class teacher'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <MarkedBadge row={row} />,
    },
    {
      key: 'counts',
      header: 'Present / absent / late',
      cell: (row) =>
        row.marked ? (
          <span className='tabular text-sm'>
            <span className='font-semibold text-success'>{row.present}</span>
            {' / '}
            <span className='font-semibold text-destructive'>{row.absent}</span>
            {' / '}
            <span className='font-semibold text-warning'>{row.late}</span>
            <span className='text-muted-foreground'> of {row.total}</span>
          </span>
        ) : (
          <span className='tabular text-sm text-muted-foreground'>{studentsText(row.total)}</span>
        ),
    },
    {
      key: 'percent',
      header: 'Attendance',
      cell: (row) => <Badge tone={percentTone(row.percent)}>{percentLabel(row.percent)}</Badge>,
    },
    {
      key: 'taken',
      header: 'Taken by',
      hideBelow: 'lg',
      cell: (row) =>
        row.taken_by ? (
          <div className='grid'>
            <span className='text-sm'>{row.taken_by}</span>
            <span className='text-xs text-muted-foreground'>{formatDateTime(row.taken_at)}</span>
          </div>
        ) : (
          <span className='text-muted-foreground'>—</span>
        ),
    },
  ]

  return (
    <div className='grid gap-4'>
      <DateStepper id='attendance-date' value={date} onChange={onDateChange} />
      {data && !data.working_day && <Notice>{dayOffText(data.holiday)}</Notice>}
      <InsightCards items={cards} loading={board.isPending} />
      <Card className='overflow-hidden'>
        <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3'>
          <h2 className='font-bold'>Sections</h2>
          <span className='text-xs text-muted-foreground'>
            Click a section to {canManage ? 'mark or view' : 'view'} attendance
          </span>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.section_id}
          loading={board.isFetching}
          error={board.isError ? board.error.message : null}
          onRetry={() => board.refetch()}
          onRowClick={(row) => onOpenSection(row.section_id)}
          empty={{
            icon: LayoutGrid,
            title: 'No sections this year',
            description: 'Add classes and sections in School setup first.',
          }}
          card={(row) => (
            <div className='grid gap-1.5'>
              <div className='flex items-start justify-between gap-2'>
                <span className='grid min-w-0'>
                  <span className='font-bold'>Class {row.name}</span>
                  <span className='truncate text-xs text-muted-foreground'>
                    {row.class_teacher ?? 'No class teacher'}
                  </span>
                </span>
                <MarkedBadge row={row} />
              </div>
              <span className='flex items-center gap-2 text-xs text-muted-foreground'>
                <UsersRound className='size-3' />
                {row.marked
                  ? `${row.present} present · ${row.absent} absent · ${row.late} late`
                  : studentsText(row.total)}
                {row.percent !== null && (
                  <Badge tone={percentTone(row.percent)}>{percentLabel(row.percent)}</Badge>
                )}
              </span>
            </div>
          )}
        />
      </Card>
      <SectionSheet
        sectionId={sectionId ?? null}
        sectionName={open?.name ?? ''}
        date={date}
        canManage={canManage}
        onClose={() => onOpenSection(undefined)}
      />
    </div>
  )
}

function MarkedBadge({ row }: { row: BoardSection }) {
  if (row.total === 0) return <Badge tone='neutral'>No students</Badge>
  return (
    <Badge tone={row.marked ? 'success' : 'warning'} dot>
      {row.marked ? 'Marked' : 'Not marked'}
    </Badge>
  )
}
