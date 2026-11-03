import { Bell, CheckCircle2, School, Users } from 'lucide-react'
import { EmptyState } from '@/components/common/display'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TripDetail, TripEventRow, TripStop } from '../api'
import { STOP_STATUS, TRIP_KIND, clock, etaText, eventTitle, peopleTold } from '../labels'

const remaining = (eta: number | null, elapsed: number) =>
  eta === null ? null : Math.max(0, eta - elapsed)

function StopTimes({ stop }: { stop: TripStop }) {
  const parts = [
    stop.approached_at && `Coming up ${clock(stop.approached_at)}`,
    stop.arrived_at && `Reached ${clock(stop.arrived_at)}`,
    stop.departed_at && `Left ${clock(stop.departed_at)}`,
  ].filter(Boolean)
  if (!parts.length) return null
  return <span className='tabular text-xs text-muted-foreground'>{parts.join(' · ')}</span>
}

export function StopTimeline({ trip, elapsed }: { trip: TripDetail; elapsed: number }) {
  const active = trip.status === 'active'
  const schoolRow = (
    <li className='relative grid grid-cols-[1.75rem_1fr] gap-3 pb-1'>
      <span className='z-10 grid size-7 place-items-center rounded-lg bg-foreground text-background'>
        <School className='size-3.5' />
      </span>
      <div className='grid gap-0.5 pt-0.5'>
        <span className='font-semibold'>School</span>
        <span className='text-xs text-muted-foreground'>
          {trip.kind === 'pickup'
            ? trip.status === 'ended'
              ? `Trip ended ${clock(trip.ended_at)}`
              : trip.destination_eta_seconds !== null
                ? `In ${etaText(remaining(trip.destination_eta_seconds, elapsed))}`
                : 'Last stop of the trip'
            : `Trip started ${clock(trip.started_at)}`}
        </span>
      </div>
    </li>
  )

  return (
    <ol aria-label='Stops in travel order' className='relative grid gap-4'>
      <span
        aria-hidden
        className='absolute top-3 bottom-3 left-[0.8125rem] w-0.5 rounded-full bg-border'
      />
      {trip.kind === 'drop' && schoolRow}
      {trip.stop_list.map((stop, index) => {
        const status = STOP_STATUS[stop.status]
        const eta =
          active && (stop.status === 'pending' || stop.status === 'approaching')
            ? remaining(stop.eta_seconds, elapsed)
            : null
        return (
          <li
            key={stop.stop_id}
            className={cn(
              'relative grid grid-cols-[1.75rem_1fr] gap-3',
              stop.status === 'approaching' && 'rounded-lg'
            )}
          >
            <span
              className={cn(
                'z-10 grid size-7 place-items-center rounded-full border-2 border-card text-xs font-extrabold text-white',
                status.pin,
                stop.status === 'approaching' && 'ring-4 ring-warning/30'
              )}
            >
              {index + 1}
            </span>
            <div className='grid min-w-0 gap-1 pt-0.5'>
              <div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-1'>
                <span className='min-w-0 font-semibold break-words'>{stop.name}</span>
                <Badge tone={status.tone} dot={stop.status === 'approaching'} pulse>
                  {status.label}
                </Badge>
              </div>
              <span className='tabular flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
                <span>
                  Planned{' '}
                  <span className='font-semibold text-foreground'>{stop.planned_time ?? '—'}</span>
                </span>
                <span>
                  <span className='font-semibold text-foreground'>{stop.riders}</span>{' '}
                  {stop.riders === 1 ? 'rider' : 'riders'}
                </span>
                {eta !== null && (
                  <span>
                    ETA <span className='font-semibold text-warning'>{etaText(eta)}</span>
                  </span>
                )}
              </span>
              <StopTimes stop={stop} />
            </div>
          </li>
        )
      })}
      {trip.kind === 'pickup' && schoolRow}
    </ol>
  )
}

export function EventLog({ trip }: { trip: TripDetail }) {
  if (!trip.events.length) {
    return (
      <EmptyState
        icon={Bell}
        title='Nothing has happened yet'
        description='Stop arrivals and alerts sent to parents appear here.'
        className='py-8'
      />
    )
  }
  return (
    <ol aria-label='Trip events' className='grid'>
      {[...trip.events].reverse().map((event: TripEventRow) => {
        const told = peopleTold(event.type, event.notified)
        return (
          <li
            key={event.id}
            className='flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm last:border-0'
          >
            <span className='grid min-w-0 gap-0.5'>
              <span className='font-semibold'>
                {eventTitle(event.type, event.stop?.name ?? null, event.eta_seconds, trip.kind)}
              </span>
              {told && (
                <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                  <Bell className='size-3' />
                  {told}
                </span>
              )}
            </span>
            <span className='tabular text-xs text-muted-foreground'>
              {clock(event.occurred_at)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function NotBoarded({ trip }: { trip: TripDetail }) {
  const stopName = new Map(trip.stop_list.map((stop) => [stop.stop_id, stop.name]))
  const boarded = trip.riders.filter((rider) => rider.boarded).length
  const away = trip.riders.filter((rider) => rider.away_today).length
  return (
    <div className='grid'>
      <p className='tabular flex flex-wrap gap-x-3 gap-y-1 border-b px-4 py-2.5 text-xs text-muted-foreground'>
        <span className='flex items-center gap-1'>
          <Users className='size-3.5' />
          <span className='font-semibold text-foreground'>{trip.riders.length}</span> expected on
          the {TRIP_KIND[trip.kind].toLowerCase()}
        </span>
        <span>
          <span className='font-semibold text-foreground'>{boarded}</span> boarded
        </span>
        {away > 0 && (
          <span>
            <span className='font-semibold text-foreground'>{away}</span> away today
          </span>
        )}
      </p>
      {trip.not_boarded.length === 0 ? (
        <EmptyState icon={CheckCircle2} title='Everyone expected has boarded' className='py-8' />
      ) : (
        <ul aria-label='Not boarded' className='grid'>
          {trip.not_boarded.map((rider) => (
            <li
              key={rider.student_id}
              className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm last:border-0'
            >
              <span className='grid min-w-0 gap-0.5'>
                <span className='font-semibold break-words'>{rider.full_name}</span>
                <span className='text-xs text-muted-foreground'>
                  {stopName.get(rider.stop_id) ?? 'Stop not on this trip'}
                </span>
              </span>
              <Badge tone='neutral'>{rider.class_section ?? 'No class'}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
