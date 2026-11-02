import type { ReactNode } from 'react'
import { Coffee, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BellPeriod, Slot } from '../api'
import { DAYS, slotKey } from '../labels'

export function WeekGrid({
  periods,
  days = DAYS.map((day) => day.value),
  slots,
  label,
  renderSlot,
  onCellClick,
}: {
  periods: BellPeriod[]
  days?: number[]
  slots: Slot[]
  label: string
  renderSlot: (slot: Slot) => ReactNode
  onCellClick?: (day: number, period: BellPeriod, slot: Slot | undefined) => void
}) {
  const byKey = new Map(slots.map((slot) => [slotKey(slot.day_of_week, slot.period_no), slot]))
  const columns = DAYS.filter((day) => days.includes(day.value))

  return (
    <div className='overflow-x-auto'>
      <table
        aria-label={label}
        className='w-full min-w-[760px] border-separate border-spacing-0 text-sm'
      >
        <thead>
          <tr>
            <th className='sticky left-0 z-10 w-28 border-b bg-card px-3 py-2 text-left text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
              Period
            </th>
            {columns.map((day) => (
              <th
                key={day.value}
                scope='col'
                className='border-b px-2 py-2 text-left text-[11px] font-bold tracking-wider text-muted-foreground uppercase'
              >
                <span className='hidden xl:inline'>{day.label}</span>
                <span className='xl:hidden'>{day.short}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) =>
            period.is_break || period.period_no === null ? (
              <tr key={period.id}>
                <th
                  scope='row'
                  className='sticky left-0 z-10 border-b bg-muted px-3 py-1 text-left text-xs font-semibold text-muted-foreground'
                >
                  <span className='tabular'>{period.start_time}</span>
                </th>
                <td colSpan={columns.length} className='border-b bg-muted px-3 py-1'>
                  <span className='flex items-center gap-1.5 text-xs font-semibold text-muted-foreground'>
                    <Coffee className='size-3' />
                    {period.name} · {period.start_time} to {period.end_time}
                  </span>
                </td>
              </tr>
            ) : (
              <tr key={period.id}>
                <th
                  scope='row'
                  className='sticky left-0 z-10 border-b bg-card px-3 py-2 text-left align-top'
                >
                  <span className='grid'>
                    <span className='text-xs font-bold'>{period.name}</span>
                    <span className='tabular text-[11px] font-normal text-muted-foreground'>
                      {period.start_time} to {period.end_time}
                    </span>
                  </span>
                </th>
                {columns.map((day) => {
                  const slot = byKey.get(slotKey(day.value, period.period_no!))
                  const content = slot ? (
                    renderSlot(slot)
                  ) : (
                    <span className='flex h-full items-center gap-1 text-xs text-muted-foreground'>
                      {onCellClick ? (
                        <>
                          <Plus className='size-3' />
                          Add
                        </>
                      ) : (
                        'Free'
                      )}
                    </span>
                  )
                  return (
                    <td key={day.value} className='border-b p-1 align-top'>
                      {onCellClick ? (
                        <button
                          type='button'
                          aria-label={`${day.label} ${period.name}${slot ? `: ${slot.subject.name}` : ', empty'}`}
                          onClick={() => onCellClick(day.value, period, slot)}
                          className={cn(
                            'grid h-full min-h-16 w-full content-start rounded-md border px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                            slot
                              ? 'border-primary/25 bg-primary/5 hover:bg-primary/10'
                              : 'border-dashed hover:bg-muted'
                          )}
                        >
                          {content}
                        </button>
                      ) : (
                        <div
                          className={cn(
                            'grid h-full min-h-16 content-start rounded-md border px-2 py-1.5',
                            slot ? 'border-primary/25 bg-primary/5' : 'border-dashed'
                          )}
                        >
                          {content}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

export function SlotContent({
  title,
  code,
  lines,
}: {
  title: string
  code: string
  lines: (string | null)[]
}) {
  return (
    <span className='grid min-w-0 gap-0.5'>
      <span className='flex min-w-0 items-center gap-1.5'>
        <span className='font-mono text-[11px] font-bold text-primary'>{code}</span>
        <span className='truncate text-xs font-semibold'>{title}</span>
      </span>
      {lines.map(
        (line, index) =>
          line && (
            <span key={index} className='truncate text-[11px] text-muted-foreground'>
              {line}
            </span>
          )
      )}
    </span>
  )
}
