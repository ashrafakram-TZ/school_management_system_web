import { Link } from '@tanstack/react-router'
import { ArrowRight, Trophy } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/common/display'
import { Card } from '@/components/ui/card'
import { useLeaderboard } from '../api'
import { ActivityPodium } from './activity-podium'

export function SportsStarsCard() {
  const board = useLeaderboard({ category: 'sports', limit: 3 })
  return (
    <Card className='overflow-hidden'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5'>
        <div className='grid'>
          <h2 className='flex items-center gap-2 font-bold'>
            <Trophy className='size-4 text-warning' />
            Sports stars
          </h2>
          <p className='text-xs text-muted-foreground'>
            Top 3 in sports this academic year, by points
          </p>
        </div>
        <Link
          to='/activities'
          search={{ tab: 'leaderboard', category: 'sports', page: 1 }}
          className='inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline'
        >
          View leaderboard
          <ArrowRight className='size-3.5' />
        </Link>
      </div>
      {board.isError ? (
        <ErrorState message={board.error.message} onRetry={() => board.refetch()} />
      ) : board.data && !board.data.rows.length ? (
        <EmptyState
          icon={Trophy}
          title='No sports achievements yet'
          description='Add sports results from a student’s Achievements tab or the Staff app.'
        />
      ) : (
        <div className='p-4'>
          <ActivityPodium
            rows={(board.data?.rows ?? []).slice(0, 3)}
            title='Sports'
            loading={board.isPending}
          />
        </div>
      )}
    </Card>
  )
}
