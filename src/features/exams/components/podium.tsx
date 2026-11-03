import { Medal, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ClassToppers } from '../api'
import { gradeTone, podiumTone } from '../labels'

export function Podium({ data, loading }: { data?: ClassToppers; loading?: boolean }) {
  return (
    <Card className='overflow-hidden'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3'>
        <h2 className='flex items-center gap-2 font-bold'>
          <Trophy className='size-4 text-warning' />
          Top rank holders{data ? ` · Class ${data.class_name}` : ''}
        </h2>
        {data && (
          <span className='text-xs text-muted-foreground'>
            Ranked on total across {data.students} students in every section
          </span>
        )}
      </div>
      {loading && !data ? (
        <div className='grid gap-3 p-4 sm:grid-cols-3'>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className='h-28 w-full rounded-lg' />
          ))}
        </div>
      ) : !data?.toppers.length ? (
        <p className='px-4 py-6 text-center text-sm text-muted-foreground'>
          No ranks yet. Students are ranked once every subject has marks.
        </p>
      ) : (
        <ol className='grid gap-3 p-4 sm:grid-cols-3' aria-label='Top rank holders'>
          {data.toppers.map((topper) => (
            <li
              key={topper.student_id}
              className={cn(
                'grid gap-2 rounded-lg border p-3',
                topper.rank === 1 && 'sm:order-2 sm:-translate-y-1 sm:shadow-sm',
                topper.rank === 2 && 'sm:order-1',
                topper.rank >= 3 && 'sm:order-3'
              )}
            >
              <div className='flex items-center justify-between gap-2'>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-extrabold',
                    podiumTone(topper.rank)
                  )}
                >
                  <Medal className='size-3.5' />
                  Rank {topper.rank}
                </span>
                <Badge tone={gradeTone(topper.grade)}>{topper.grade}</Badge>
              </div>
              <div className='grid min-w-0'>
                <span className='truncate font-bold'>{topper.full_name}</span>
                <span className='truncate text-xs text-muted-foreground'>
                  Section {topper.section_name} · {topper.admission_no}
                </span>
              </div>
              <div className='flex items-baseline justify-between gap-2'>
                <span className='tabular text-2xl font-extrabold tracking-tight'>
                  {topper.percent}%
                </span>
                <span className='tabular text-xs text-muted-foreground'>
                  {topper.total} / {topper.max_total}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
