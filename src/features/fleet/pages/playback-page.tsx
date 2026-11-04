import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Gauge,
  History,
  MapPin,
  Pause,
  Play,
  Route as RouteIcon,
  RotateCcw,
  Timer,
} from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/common/display'
import { Page, PageHeader } from '@/components/common/page'
import { SegmentedControl } from '@/components/common/segmented-control'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatNumber, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePlayback, type SafetyEvent, type TripPlayback } from '../api'
import { PlaybackMap } from '../components/playback-map'
import { TripStatusBadge } from '../components/trips-panel'
import { SAFETY_KIND, SEVERITY, STOP_STATUS, TRIP_KIND, durationText } from '../labels'
import {
  PLAYBACK_SPEEDS,
  buildTimeline,
  buildTrack,
  clockText,
  trackStateAt,
  type PlaybackSpeed,
  type TimelineItem,
} from '../playback'

const route = getRouteApi('/_app/fleet/trips/$tripId/playback')

function Tile({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='grid min-w-0 content-start gap-1 rounded-lg border bg-card p-3'>
      <span className='flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
        <Icon className='size-3.5' />
        {label}
      </span>
      <div className='tabular min-w-0 text-sm font-semibold break-words'>{children}</div>
    </div>
  )
}

const Timeline = memo(function Timeline({
  items,
  activeKey,
  onSeek,
}: {
  items: TimelineItem[]
  activeKey: string | null
  onSeek: (at: number) => void
}) {
  if (!items.length) {
    return (
      <EmptyState
        icon={History}
        title='Nothing to show'
        description='No stops or safety events for this trip.'
      />
    )
  }
  return (
    <ol className='grid' aria-label='Trip timeline'>
      {items.map((item) => {
        const active = item.key === activeKey
        const time = item.at === null ? '—' : formatTime(item.at)
        const content =
          item.type === 'stop' ? (
            <>
              <span
                className={cn(
                  'mt-1 size-2.5 shrink-0 rounded-full',
                  STOP_STATUS[item.stop.status].pin
                )}
              />
              <span className='grid min-w-0 flex-1 gap-0.5'>
                <span className='truncate font-semibold'>
                  {item.stop.sequence}. {item.stop.name}
                </span>
                <span className='text-xs text-muted-foreground'>
                  {item.at === null
                    ? STOP_STATUS[item.stop.status].label
                    : `Arrived ${time}${item.stop.departed_at ? ` · left ${formatTime(item.stop.departed_at)}` : ''}`}
                  {item.stop.planned_time ? ` · planned ${item.stop.planned_time}` : ''}
                </span>
              </span>
            </>
          ) : (
            <>
              <AlertTriangle
                className='mt-0.5 size-4 shrink-0'
                style={{ color: SEVERITY[item.event.severity].color }}
              />
              <span className='grid min-w-0 flex-1 gap-0.5'>
                <span className='flex flex-wrap items-center gap-1.5 font-semibold'>
                  {SAFETY_KIND[item.event.kind]}
                  <Badge tone={SEVERITY[item.event.severity].tone}>
                    {SEVERITY[item.event.severity].label}
                  </Badge>
                </span>
                <span className='text-xs text-muted-foreground'>
                  {time} · {item.event.message}
                </span>
              </span>
            </>
          )
        return (
          <li key={item.key} className='border-b last:border-0'>
            {item.at === null ? (
              <div className='flex items-start gap-3 px-4 py-2.5 text-sm opacity-70'>{content}</div>
            ) : (
              <button
                type='button'
                onClick={() => onSeek(item.at!)}
                aria-current={active || undefined}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-accent/60',
                  active && 'bg-primary/5'
                )}
              >
                {content}
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
})

export function PlaybackPage() {
  const { tripId } = route.useParams()
  const playback = usePlayback(tripId)
  const data = playback.data

  const back = (
    <Button variant='outline' asChild>
      <Link to='/fleet/history' search={{ page: 1 }}>
        <ArrowLeft />
        Trip history
      </Link>
    </Button>
  )

  if (playback.isError) {
    const error = playback.error
    const missingTrack = error.code === 'TRACK_NOT_FOUND'
    return (
      <Page>
        <PageHeader eyebrow='Trip replay' title='Trip replay' actions={back} />
        <Card className='p-6'>
          {missingTrack || error.code === 'TRIP_NOT_FOUND' ? (
            <EmptyState
              icon={MapPin}
              title={missingTrack ? 'No GPS track for this trip' : 'This trip does not exist'}
              description={
                missingTrack
                  ? 'The tracker did not send positions for this trip, so there is nothing to replay.'
                  : 'It may have been removed. Pick another trip from the history.'
              }
            />
          ) : (
            <ErrorState message={error.message} onRetry={() => playback.refetch()} />
          )}
        </Card>
      </Page>
    )
  }

  return (
    <Page className='gap-4'>
      <PageHeader
        eyebrow='Trip replay'
        title={
          data ? (
            <span className='min-w-0 break-words'>{data.trip.route.name}</span>
          ) : (
            <span className='inline-block h-8 w-64 max-w-full animate-pulse rounded-md bg-muted' />
          )
        }
        description={
          data ? (
            <span className='flex flex-wrap items-center gap-2'>
              <span>
                {data.trip.vehicle.name} ·{' '}
                <span className='font-mono text-xs'>{data.trip.vehicle.registration_no}</span> ·{' '}
                {TRIP_KIND[data.trip.kind]} · {formatDate(data.trip.trip_date)}
              </span>
              <TripStatusBadge trip={data.trip} />
            </span>
          ) : undefined
        }
        actions={
          <>
            {back}
            <Button variant='outline' asChild>
              <Link to='/fleet/trips/$tripId' params={{ tripId }}>
                <RouteIcon />
                Trip details
              </Link>
            </Button>
          </>
        }
      />
      {data ? (
        <Player key={tripId} data={data} />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 lg:grid-cols-4'>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className='h-20' />
            ))}
          </div>
          <Skeleton className='h-[50vh] min-h-72 rounded-xl' />
        </>
      )}
    </Page>
  )
}

function Player({ data }: { data: TripPlayback }) {
  const track = useMemo(() => buildTrack(data.points), [data.points])
  const timeline = useMemo(
    () => buildTimeline(data.stop_arrivals, data.safety_events),
    [data.stop_arrivals, data.safety_events]
  )
  const [offset, setOffset] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(8)
  const offsetRef = useRef(0)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const next = Math.min(track.duration, offsetRef.current + (now - last) * speed)
      last = now
      offsetRef.current = next
      setOffset(next)
      if (next >= track.duration) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, track.duration])

  const seek = useCallback(
    (value: number) => {
      const next = Math.min(track.duration, Math.max(0, value))
      offsetRef.current = next
      setOffset(next)
    },
    [track.duration]
  )
  const seekTo = useCallback((at: number) => seek(at - track.start), [seek, track.start])

  const togglePlay = () => {
    if (!playing && offsetRef.current >= track.duration) seek(0)
    setPlaying((current) => !current)
  }

  const bus = trackStateAt(track, offset)
  const now = track.start + offset
  const activeKey =
    timeline.filter((item) => item.at !== null && item.at <= now).at(-1)?.key ?? null
  const hasTrack = data.points.length > 0
  const highEvents = data.safety_events.filter((event) => event.severity === 'high').length

  const onEventSelect = (event: SafetyEvent) => seekTo(new Date(event.at).getTime())

  return (
    <>
      <div className='grid grid-cols-2 gap-2 lg:grid-cols-4'>
        <Tile icon={RouteIcon} label='Distance'>
          {formatNumber(data.distance_km, 1, 'km')}
        </Tile>
        <Tile icon={Timer} label='Duration'>
          {durationText(data.duration_seconds)}
        </Tile>
        <Tile icon={Gauge} label='Max / avg speed'>
          {formatNumber(data.max_speed, 0)} / {formatNumber(data.avg_speed, 1, 'km/h')}
        </Tile>
        <Tile icon={AlertTriangle} label='Safety events'>
          {data.safety_events.length}
          {highEvents > 0 && (
            <span className='ml-1 text-xs font-normal text-destructive'>{highEvents} high</span>
          )}
        </Tile>
      </div>

      <div className='grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]'>
        <div className='grid min-w-0 content-start gap-3'>
          <PlaybackMap
            path={data.path}
            points={data.points}
            stops={data.stop_arrivals}
            events={data.safety_events}
            school={data.school}
            bus={bus}
            busLabel={data.trip.vehicle.name}
            onEventSelect={onEventSelect}
            className='h-[50vh] min-h-72 lg:h-[calc(100vh-22rem)] lg:min-h-[26rem]'
          />
          <Card className='grid gap-3 p-3 sm:p-4'>
            {hasTrack ? (
              <>
                <div className='flex flex-wrap items-center gap-3'>
                  <Button
                    size='icon'
                    onClick={togglePlay}
                    aria-label={playing ? 'Pause' : 'Play'}
                    title={playing ? 'Pause' : 'Play'}
                  >
                    {playing ? <Pause /> : <Play />}
                  </Button>
                  <Button
                    size='icon'
                    variant='outline'
                    onClick={() => seek(0)}
                    aria-label='Back to start'
                    title='Back to start'
                  >
                    <RotateCcw />
                  </Button>
                  <SegmentedControl
                    label='Playback speed'
                    value={speed}
                    onChange={setSpeed}
                    options={PLAYBACK_SPEEDS.map((value) => ({ value, label: `${value}x` }))}
                  />
                  <div className='tabular ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
                    <span className='flex items-center gap-1.5'>
                      <Clock className='size-3.5 text-muted-foreground' />
                      <span className='font-semibold'>{formatTime(now)}</span>
                    </span>
                    <span className='flex items-center gap-1.5'>
                      <Gauge className='size-3.5 text-muted-foreground' />
                      <span className='font-semibold'>{formatNumber(bus?.speed, 0, 'km/h')}</span>
                    </span>
                  </div>
                </div>
                <div className='grid gap-1'>
                  <input
                    type='range'
                    min={0}
                    max={Math.max(1, track.duration)}
                    step={1000}
                    value={offset}
                    onChange={(event) => seek(Number(event.target.value))}
                    aria-label='Trip time'
                    aria-valuetext={formatTime(now)}
                    className='w-full accent-primary'
                  />
                  <div className='tabular flex justify-between text-xs text-muted-foreground'>
                    <span>{clockText(offset)}</span>
                    <span>{clockText(track.duration)}</span>
                  </div>
                </div>
                {data.sampled && (
                  <p className='text-xs text-muted-foreground'>
                    Showing {data.points.length} of {data.total_points} recorded positions.
                  </p>
                )}
              </>
            ) : (
              <p className='flex items-center gap-2 text-sm text-muted-foreground'>
                <MapPin className='size-4' />
                No positions were recorded for this trip, so only the planned route is shown.
              </p>
            )}
          </Card>
        </div>
        <Card className='min-w-0 overflow-hidden lg:h-[calc(100vh-13.5rem)] lg:min-h-[34rem]'>
          <h2 className='flex items-center gap-2 border-b px-4 py-3 font-bold'>
            <History className='size-4 text-primary' />
            Timeline
          </h2>
          <div className='min-h-0 flex-1 overflow-y-auto'>
            <Timeline items={timeline} activeKey={activeKey} onSeek={seekTo} />
          </div>
        </Card>
      </div>
    </>
  )
}
