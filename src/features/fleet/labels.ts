import type { BadgeTone } from '@/components/ui/badge'
import { config } from '@/config/env'
import { alerts } from '@/lib/alerts'
import type { TripEventMessage, TripPositionMessage } from '@/lib/live/socket'
import type { StopStatus, TripDetail, TripKind, TripStatus, TripStop } from './api'

export const TRIP_KIND: Record<TripKind, string> = {
  pickup: 'Morning pickup',
  drop: 'Evening drop',
}

export const TRIP_KIND_OPTIONS = (Object.keys(TRIP_KIND) as TripKind[]).map((value) => ({
  value,
  label: TRIP_KIND[value],
  hint: value === 'pickup' ? 'Stops to school' : 'School to stops',
}))

export const TRIP_STATUS: Record<TripStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'On the road', tone: 'success' },
  ended: { label: 'Ended', tone: 'neutral' },
}

export const STOP_STATUS: Record<StopStatus, { label: string; tone: BadgeTone; pin: string }> = {
  pending: { label: 'Not reached', tone: 'neutral', pin: 'bg-muted-foreground' },
  approaching: { label: 'Coming up', tone: 'warning', pin: 'bg-warning' },
  arrived: { label: 'At the stop', tone: 'info', pin: 'bg-info' },
  departed: { label: 'Done', tone: 'success', pin: 'bg-success' },
  skipped: { label: 'Skipped', tone: 'danger', pin: 'bg-destructive' },
}

export const END_REASON: Record<string, string> = {
  arrived_school: 'Reached school',
  route_complete: 'Last stop done',
  driver: 'Ended by the driver',
  admin: 'Ended from the office',
  timeout: 'Ended automatically',
}

const clockFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: config.timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

export const clock = (value: string | null | undefined) =>
  value ? clockFormat.format(new Date(value)) : '—'

export const minutesFrom = (seconds: number | null) => Math.max(1, Math.round((seconds ?? 60) / 60))

export const etaText = (seconds: number | null) => {
  if (seconds === null) return '—'
  if (seconds <= 30) return 'Due now'
  const minutes = minutesFrom(seconds)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export const secondsAgo = (value: string | null | undefined, now: number) => {
  if (!value) return null
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000))
  if (seconds < 60) return `${seconds} s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
}

export const destinationLabel = (kind: TripKind) => (kind === 'pickup' ? 'School' : 'Last stop')

export const peopleTold = (type: TripEventMessage['type'], count: number) => {
  if (!count) return null
  const who = type === 'trip.ended' ? 'class teacher' : 'parent'
  return `Told ${count} ${count === 1 ? who : `${who}s`}`
}

export const eventTitle = (
  type: TripEventMessage['type'],
  stop: string | null,
  eta: number | null,
  kind?: TripKind
) => {
  switch (type) {
    case 'trip.started':
      return kind ? `${TRIP_KIND[kind]} started` : 'Trip started'
    case 'stop.approaching':
      return `${minutesFrom(eta)} min from ${stop ?? 'the next stop'}`
    case 'stop.arrived':
      return `Reached ${stop ?? 'a stop'}`
    case 'stop.departed':
      return `Left ${stop ?? 'a stop'}`
    case 'trip.ended':
      return 'Trip ended'
  }
}

export function showTripToast(
  message: TripEventMessage,
  bus: string,
  kind: TripKind | undefined,
  includeDeparted = false
) {
  const stop = message.stop?.name ?? null
  const told = peopleTold(message.type, message.notified) ?? undefined
  const options = { id: `trip-${message.trip_id}`, description: told }
  const trip = kind ? TRIP_KIND[kind].toLowerCase() : 'trip'
  switch (message.type) {
    case 'trip.started':
      alerts.info(`${bus} started the ${trip}`, options)
      return
    case 'stop.approaching':
      alerts.warning(
        `${bus} is ${minutesFrom(message.eta_seconds)} min from ${stop ?? 'the next stop'}`,
        options
      )
      return
    case 'stop.arrived':
      alerts.info(`${bus} reached ${stop ?? 'a stop'}`, options)
      return
    case 'stop.departed':
      if (includeDeparted) alerts.info(`${bus} left ${stop ?? 'a stop'}`, options)
      return
    case 'trip.ended':
      alerts.success(`${bus} finished the ${trip}`, {
        ...options,
        description:
          [message.end_reason ? END_REASON[message.end_reason] : null, told]
            .filter(Boolean)
            .join(' · ') || undefined,
      })
  }
}

const EVENT_STATUS: Partial<Record<TripEventMessage['type'], StopStatus>> = {
  'stop.approaching': 'approaching',
  'stop.arrived': 'arrived',
  'stop.departed': 'departed',
}

const RANK: Record<StopStatus, number> = {
  pending: 0,
  approaching: 1,
  arrived: 2,
  departed: 3,
  skipped: 3,
}

const applyStop = (stops: TripStop[], message: TripEventMessage) => {
  const status = EVENT_STATUS[message.type]
  const index = stops.findIndex((stop) => stop.stop_id === message.stop?.id)
  if (!status || index < 0) return stops
  return stops.map((stop, position): TripStop => {
    if (position < index && RANK[stop.status] < 2 && status !== 'approaching') {
      return { ...stop, status: 'skipped', eta_seconds: null }
    }
    if (position !== index || RANK[status] < RANK[stop.status]) return stop
    return {
      ...stop,
      status,
      eta_seconds: status === 'approaching' ? message.eta_seconds : status === 'arrived' ? 0 : null,
      approached_at: status === 'approaching' ? message.at : stop.approached_at,
      arrived_at: status === 'arrived' ? message.at : stop.arrived_at,
      departed_at: status === 'departed' ? message.at : stop.departed_at,
    }
  })
}

export const applyPosition = (
  detail: TripDetail | undefined,
  message: TripPositionMessage
): TripDetail | undefined => (detail ? { ...detail, position: message.position } : detail)

export const applyEvent = (
  detail: TripDetail | undefined,
  message: TripEventMessage
): TripDetail | undefined => {
  if (!detail) return detail
  const stop_list = applyStop(detail.stop_list, message)
  const ended = message.type === 'trip.ended'
  return {
    ...detail,
    stop_list,
    position: message.position ?? detail.position,
    stops_done: stop_list.filter((stop) => RANK[stop.status] === 3).length,
    ...(ended
      ? {
          status: 'ended' as const,
          ended_at: message.at,
          end_reason: message.end_reason ?? detail.end_reason,
        }
      : {}),
  }
}
