import { cn } from '@/lib/utils'
import { progressPercent } from '../labels'

export function MarksProgress({ entered, expected }: { entered: number; expected: number }) {
  const percent = progressPercent(entered, expected)
  const done = expected > 0 && entered >= expected
  return (
    <div className='grid w-full max-w-48 gap-1'>
      <div
        role='progressbar'
        aria-label={`${entered} of ${expected} marks entered`}
        aria-valuenow={entered}
        aria-valuemin={0}
        aria-valuemax={expected}
        className='h-1.5 w-full overflow-hidden rounded-full bg-muted'
      >
        <div
          className={cn('h-full rounded-full', done ? 'bg-success' : 'bg-primary')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className='tabular text-xs text-muted-foreground'>
        {entered} / {expected} · {percent}%
      </span>
    </div>
  )
}
