import type { SafetyEvent, StopArrival, TrackPoint } from './api'

export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export interface Track {
  points: TrackPoint[]
  times: number[]
  start: number
  duration: number
}

export interface TrackState {
  lat: number
  lng: number
  speed: number | null
  heading: number | null
  index: number
}

export type TimelineItem =
  | { key: string; type: 'stop'; at: number | null; stop: StopArrival }
  | { key: string; type: 'safety'; at: number; event: SafetyEvent }

export function buildTrack(points: TrackPoint[]): Track {
  const times = points.map((point) => new Date(point.at).getTime())
  const start = times[0] ?? 0
  const end = times[times.length - 1] ?? start
  return { points, times, start, duration: Math.max(0, end - start) }
}

const lastAtOrBefore = (times: number[], time: number) => {
  let low = 0
  let high = times.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (times[middle]! <= time) low = middle
    else high = middle - 1
  }
  return low
}

const mix = (from: number | null, to: number | null, ratio: number) => {
  if (from === null) return to
  if (to === null) return from
  return from + (to - from) * ratio
}

export function trackStateAt(track: Track, offset: number): TrackState | null {
  const { points, times } = track
  if (!points.length) return null
  const time = track.start + offset
  const index = lastAtOrBefore(times, time)
  const from = points[index]!
  const to = points[index + 1]
  if (!to) return { ...from, index }
  const span = times[index + 1]! - times[index]!
  const ratio = span > 0 ? Math.min(1, Math.max(0, (time - times[index]!) / span)) : 0
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
    speed: mix(from.speed, to.speed, ratio),
    heading: from.heading ?? to.heading,
    index,
  }
}

const timeOf = (value: string | null) => (value ? new Date(value).getTime() : null)

export function buildTimeline(stops: StopArrival[], events: SafetyEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...stops.map((stop): TimelineItem => ({
      key: `stop-${stop.stop_id}`,
      type: 'stop',
      at: timeOf(stop.arrived_at) ?? timeOf(stop.departed_at),
      stop,
    })),
    ...events.map((event): TimelineItem => ({
      key: `event-${event.id}`,
      type: 'safety',
      at: new Date(event.at).getTime(),
      event,
    })),
  ]
  return items.sort((a, b) => {
    if (a.at === null && b.at === null) return 0
    if (a.at === null) return 1
    if (b.at === null) return -1
    return a.at - b.at
  })
}

export const clockText = (milliseconds: number) => {
  const total = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}
