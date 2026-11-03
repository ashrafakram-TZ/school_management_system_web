import { Link } from '@tanstack/react-router'
import { ArrowRight, Medal, Trophy } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/common/display'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useLatestToppers } from '../api'
import { podiumTone, studentsText } from '../labels'

export function TopRankHoldersCard() {
  const latest = useLatestToppers()
  const data = latest.data
  const classes = (data?.classes ?? []).filter((item) => item.toppers.length)
  return (
    <Card className='overflow-hidden'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5'>
        <div className='grid'>
          <h2 className='flex items-center gap-2 font-bold'>
            <Trophy className='size-4 text-warning' />
            Top rank holders
          </h2>
          <p className='text-xs text-muted-foreground'>
            {data
              ? `${data.exam.name} · published ${formatDate(data.exam.published_at)}`
              : 'Latest published exam, top 3 of each class'}
          </p>
        </div>
        {data && (
          <Link
            to='/exams'
            search={{ tab: 'results', exam_id: data.exam.id }}
            className='inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline'
          >
            View results
            <ArrowRight className='size-3.5' />
          </Link>
        )}
      </div>
      {latest.isError ? (
        <ErrorState message={latest.error.message} onRetry={() => latest.refetch()} />
      ) : latest.isPending ? (
        <div className='grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3'>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className='h-32 w-full rounded-lg' />
          ))}
        </div>
      ) : !classes.length ? (
        <EmptyState
          icon={Trophy}
          title='No results published yet'
          description='When an exam is published, its top 3 students of each class show here.'
        />
      ) : (
        <div className='grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3'>
          {classes.map((item) => (
            <section key={item.class_id} className='grid content-start gap-2 rounded-lg border p-3'>
              <h3 className='flex items-center justify-between gap-2 text-sm font-bold'>
                Class {item.class_name}
                <span className='text-xs font-normal text-muted-foreground'>
                  {studentsText(item.students)}
                </span>
              </h3>
              <ol
                className='grid gap-1.5'
                aria-label={`Top rank holders of class ${item.class_name}`}
              >
                {item.toppers.map((topper) => (
                  <li key={topper.student_id} className='flex items-center gap-2 text-sm'>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-extrabold',
                        podiumTone(topper.rank)
                      )}
                    >
                      <Medal className='size-3' />
                      {topper.rank}
                    </span>
                    <span className='min-w-0 flex-1 truncate font-semibold'>
                      {topper.full_name}
                      <span className='font-normal text-muted-foreground'>
                        {' '}
                        · {topper.section_name}
                      </span>
                    </span>
                    <span className='tabular shrink-0 text-xs font-bold'>{topper.percent}%</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}
