import { Medal, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LEVEL_LABELS, LEVEL_TONE } from '@/features/students/achievement-labels'
import { cn } from '@/lib/utils'
import type { LeaderboardRow } from '../api'

const RANK_TONE: Record<number, string> = {
  1: 'border-warning/50 bg-warning/15 text-warning',
  2: 'border-info/40 bg-info/10 text-info',
  3: 'border-destructive/30 bg-destructive/10 text-destructive',
}

export function ActivityPodium({
  rows,
  title,
  loading,
}: {
  rows: LeaderboardRow[]
  title: string
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className='grid gap-3 sm:grid-cols-3'>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className='h-28' />
        ))}
      </div>
    )
  }
  if (!rows.length) return null
  return (
    <section className='grid gap-2' aria-label={`Top 3 in ${title}`}>
      <h2 className='flex items-center gap-2 text-sm font-bold'>
        <Trophy className='size-4 text-warning' />
        Top 3 · {title}
      </h2>
      <ol className='grid gap-3 sm:grid-cols-3'>
        {rows.map((row) => (
          <li
            key={row.student.id}
            className={cn(
              'grid gap-2 rounded-lg border p-3',
              row.rank === 1 && 'sm:order-2 sm:-translate-y-1 sm:shadow-sm',
              row.rank === 2 && 'sm:order-1',
              row.rank >= 3 && 'sm:order-3'
            )}
          >
            <div className='flex items-center justify-between gap-2'>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-extrabold',
                  RANK_TONE[row.rank] ?? RANK_TONE[3]
                )}
              >
                <Medal className='size-3.5' />
                Rank {row.rank}
              </span>
              <Badge tone={LEVEL_TONE[row.best_level]}>{LEVEL_LABELS[row.best_level]}</Badge>
            </div>
            <div className='grid min-w-0'>
              <span className='truncate font-bold'>{row.student.name}</span>
              <span className='truncate text-xs text-muted-foreground'>
                {[row.student.section, row.student.admission_no].filter(Boolean).join(' · ')}
              </span>
            </div>
            <div className='flex items-end justify-between gap-2'>
              <span className='tabular text-2xl font-extrabold'>{row.points} pts</span>
              <span className='text-xs text-muted-foreground'>
                {row.wins} wins · {row.podiums} top 3
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
