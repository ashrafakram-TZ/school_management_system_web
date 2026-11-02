import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BookOpen, CircleCheck, LayoutGrid } from 'lucide-react'
import { Combobox } from '@/components/common/combobox'
import { EmptyState, ErrorState } from '@/components/common/display'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSections } from '@/features/setup/api'
import { cn } from '@/lib/utils'
import { useSectionTimetable, type SectionTimetable, type SubjectPlan } from '../api'
import { SlotModal, type SlotTarget } from './slot-modal'
import { SlotContent, WeekGrid } from './week-grid'

export function BuilderTab({
  sectionId,
  canManage,
  onSectionChange,
}: {
  sectionId?: number
  canManage: boolean
  onSectionChange: (sectionId: number | undefined) => void
}) {
  const sections = useSections()
  const chosen = sectionId ?? sections.data?.[0]?.id
  const timetable = useSectionTimetable(chosen)
  const [target, setTarget] = useState<SlotTarget | null>(null)
  const data = timetable.data

  useShortcut('app.refresh', () => void timetable.refetch())

  const options = (sections.data ?? []).map((section) => ({
    value: String(section.id),
    label: `${section.class_name} - ${section.name}`,
    hint: section.room ?? undefined,
  }))

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <Combobox
          id='timetable-section'
          label='Section'
          value={chosen ? String(chosen) : undefined}
          placeholder='Choose section'
          searchPlaceholder='Search sections'
          options={options}
          onChange={(value) => value && onSectionChange(Number(value))}
          highlightSelected={false}
        />
        {data?.room && <Badge tone='neutral'>Room {data.room}</Badge>}
        {!canManage && <Badge tone='neutral'>View only</Badge>}
      </div>

      {sections.data && sections.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={LayoutGrid}
            title='No sections this year'
            description='Add classes and sections in School setup first.'
          />
        </Card>
      ) : timetable.isError && !data ? (
        <Card>
          <ErrorState message={timetable.error.message} onRetry={() => timetable.refetch()} />
        </Card>
      ) : !data ? (
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]'>
          <Skeleton className='h-[28rem] w-full rounded-xl' />
          <Skeleton className='h-80 w-full rounded-xl' />
        </div>
      ) : (
        <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]'>
          <Card
            className={cn(
              'min-w-0 overflow-hidden transition-opacity',
              timetable.isFetching && 'opacity-70'
            )}
          >
            <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3'>
              <h2 className='font-bold'>Class {data.section.name}</h2>
              <span className='text-xs text-muted-foreground'>
                {canManage
                  ? 'Click a period to set the subject'
                  : `${data.slots.length} periods a week`}
              </span>
            </div>
            <WeekGrid
              label={`Timetable of ${data.section.name}`}
              periods={data.periods}
              days={data.days}
              slots={data.slots}
              renderSlot={(slot) => (
                <SlotContent
                  code={slot.subject.code}
                  title={slot.subject.name}
                  lines={[
                    slot.teacher?.name ?? 'No teacher',
                    slot.room !== data.room ? slot.room : null,
                  ]}
                />
              )}
              onCellClick={
                canManage ? (day, period, slot) => setTarget({ day, period, slot }) : undefined
              }
            />
          </Card>
          <PlanPanel timetable={data} />
        </div>
      )}
      {target && data && (
        <SlotModal timetable={data} target={target} onClose={() => setTarget(null)} />
      )}
    </div>
  )
}

function PlanPanel({ timetable }: { timetable: SectionTimetable }) {
  const short = timetable.plan.reduce(
    (total, item) => total + Math.max(0, item.required - item.scheduled),
    0
  )
  return (
    <Card className='overflow-hidden lg:sticky lg:top-20'>
      <div className='flex items-center justify-between gap-2 border-b px-4 py-3'>
        <h2 className='flex items-center gap-2 font-bold'>
          <BookOpen className='size-4 text-primary' />
          Subject plan
        </h2>
        {short > 0 ? (
          <Badge tone='warning'>{short} to place</Badge>
        ) : (
          timetable.plan.length > 0 && (
            <Badge tone='success'>
              <CircleCheck className='size-3' />
              All placed
            </Badge>
          )
        )}
      </div>
      {timetable.plan.length === 0 ? (
        <p className='px-4 py-5 text-sm text-muted-foreground'>
          No subjects chosen for this class yet. Pick them with the book icon in{' '}
          <Link
            to='/setup'
            search={{ tab: 'classes' }}
            className='font-semibold text-primary underline-offset-4 hover:underline'
          >
            School setup → Classes and sections
          </Link>
          . You can still place any school subject in a period.
        </p>
      ) : (
        <ul className='grid divide-y'>
          {timetable.plan.map((item) => (
            <PlanRow key={item.subject.id} item={item} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function PlanRow({ item }: { item: SubjectPlan }) {
  const missing = item.required - item.scheduled
  const percent =
    item.required > 0 ? Math.min(100, Math.round((item.scheduled / item.required) * 100)) : 100
  const tone = missing > 0 ? 'warning' : missing < 0 ? 'danger' : 'success'
  return (
    <li className={cn('grid gap-1.5 px-4 py-2.5', missing > 0 && 'bg-warning/5')}>
      <div className='flex items-center justify-between gap-2'>
        <span className='flex min-w-0 items-center gap-1.5'>
          <span className='font-mono text-[11px] font-bold text-primary'>{item.subject.code}</span>
          <span className='truncate text-sm font-semibold'>{item.subject.name}</span>
        </span>
        <span
          className={cn(
            'tabular shrink-0 text-xs font-semibold',
            tone === 'warning' && 'text-warning',
            tone === 'danger' && 'text-destructive'
          )}
        >
          {item.scheduled} / {item.required}
        </span>
      </div>
      <div
        role='progressbar'
        aria-label={`${item.subject.name}: ${item.scheduled} of ${item.required} periods placed`}
        aria-valuenow={item.scheduled}
        aria-valuemin={0}
        aria-valuemax={item.required}
        className='h-1.5 w-full overflow-hidden rounded-full bg-muted'
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-destructive'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
        <span className='truncate'>{item.teacher?.name ?? 'No teacher assigned'}</span>
        {missing > 0 && <span className='shrink-0 text-warning'>{missing} short</span>}
        {missing < 0 && <span className='shrink-0 text-destructive'>{-missing} extra</span>}
      </span>
    </li>
  )
}
