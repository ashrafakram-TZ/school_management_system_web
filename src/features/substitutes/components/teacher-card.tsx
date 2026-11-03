import { UserRoundPlus, X } from 'lucide-react'
import { Avatar } from '@/components/common/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { AbsentPeriod, AbsentTeacher } from '../api'
import { periodTime, reasonTone } from '../labels'

export function TeacherCard({
  item,
  editable,
  removingId,
  onAssign,
  onRemove,
}: {
  item: AbsentTeacher
  editable: boolean
  removingId: number | null
  onAssign: (period: AbsentPeriod) => void
  onRemove: (period: AbsentPeriod) => void
}) {
  const covered = item.periods.filter((period) => period.substitute).length
  const total = item.periods.length

  return (
    <Card className='overflow-hidden' aria-label={`${item.teacher.name} periods`}>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <Avatar name={item.teacher.name} />
          <div className='grid min-w-0 gap-0.5'>
            <h2 className='truncate font-bold'>{item.teacher.name}</h2>
            <span>
              <Badge tone={reasonTone(item.reason)}>{item.reason}</Badge>
            </span>
          </div>
        </div>
        <Badge tone={total === 0 ? 'neutral' : covered === total ? 'success' : 'warning'}>
          {total === 0 ? 'No classes' : `${covered} of ${total} covered`}
        </Badge>
      </div>
      {total === 0 ? (
        <p className='px-4 py-4 text-sm text-muted-foreground'>
          No classes on this day, so nothing to cover.
        </p>
      ) : (
        <ul className='divide-y'>
          {item.periods.map((period) => (
            <li
              key={period.slot_id}
              className='flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap'
            >
              <div className='flex min-w-0 flex-1 items-center gap-3'>
                <span className='grid w-24 shrink-0 justify-items-center rounded-lg bg-muted px-2 py-1.5'>
                  <span className='text-sm font-extrabold'>P{period.period_no}</span>
                  <span className='tabular text-[11px] whitespace-nowrap text-muted-foreground'>
                    {periodTime(period)}
                  </span>
                </span>
                <div className='grid min-w-0 gap-0.5'>
                  <span className='truncate font-semibold'>
                    {period.section.name} · {period.subject.name}
                  </span>
                  <span className='truncate text-xs text-muted-foreground'>
                    {period.room ?? 'No room set'}
                  </span>
                </div>
              </div>
              <div className='flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:justify-end'>
                {period.substitute ? (
                  <>
                    <span className='grid min-w-0 sm:text-right'>
                      <span className='text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
                        Substitute
                      </span>
                      <span className='truncate font-semibold text-success'>
                        {period.substitute.name}
                      </span>
                      {period.note && (
                        <span className='truncate text-xs text-muted-foreground'>
                          {period.note}
                        </span>
                      )}
                    </span>
                    {editable && period.substitution_id && (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-destructive hover:bg-destructive/10'
                        aria-label={`Remove ${period.substitute.name} from period ${period.period_no}`}
                        loading={removingId === period.substitution_id}
                        onClick={() => onRemove(period)}
                      >
                        <X />
                        Remove
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Badge tone='danger'>Not covered</Badge>
                    {editable && (
                      <Button
                        size='sm'
                        aria-label={`Assign a substitute for period ${period.period_no}`}
                        onClick={() => onAssign(period)}
                      >
                        <UserRoundPlus />
                        Assign
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
