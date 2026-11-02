import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { shiftDate, today, weekdayOf } from '../labels'

export function DateStepper({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const now = today()
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <div className='flex items-center gap-1'>
        <Button
          variant='outline'
          size='icon'
          aria-label='Previous day'
          onClick={() => onChange(shiftDate(value, -1))}
        >
          <ChevronLeft />
        </Button>
        <Input
          id={id}
          type='date'
          aria-label='Date'
          value={value}
          max={now}
          onChange={(event) => event.target.value && onChange(event.target.value)}
          className='w-40'
        />
        <Button
          variant='outline'
          size='icon'
          aria-label='Next day'
          disabled={value >= now}
          onClick={() => onChange(shiftDate(value, 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      {value !== now && (
        <Button variant='ghost' size='sm' onClick={() => onChange(now)}>
          Today
        </Button>
      )}
      <span className='text-sm font-semibold text-muted-foreground'>{weekdayOf(value)}</span>
    </div>
  )
}
