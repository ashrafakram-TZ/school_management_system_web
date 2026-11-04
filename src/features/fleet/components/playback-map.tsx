import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { Maximize2 } from 'lucide-react'
import { MAP_COLORS, createBaseMap, schoolIcon } from '@/components/common/base-map'
import { cn } from '@/lib/utils'
import type { LatLng, SafetyEvent, StopArrival, TrackPoint } from '../api'
import { SAFETY_KIND, SEVERITY, STOP_STATUS } from '../labels'
import type { TrackState } from '../playback'

interface PlaybackMapProps {
  path: LatLng[]
  points: TrackPoint[]
  stops: StopArrival[]
  events: SafetyEvent[]
  school: LatLng | null
  bus: TrackState | null
  busLabel: string
  onEventSelect: (event: SafetyEvent) => void
  className?: string
}

const BUS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>'

const busIcon = L.divIcon({
  className: 'route-pin',
  html: `<span class="relative grid size-9 place-items-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/30">${BUS_SVG}</span>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const stopIcon = (stop: StopArrival) =>
  L.divIcon({
    className: 'route-pin',
    html: `<span class="grid size-7 place-items-center rounded-full border-2 border-white text-xs font-extrabold text-white shadow-md ${STOP_STATUS[stop.status].pin}">${stop.sequence}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

const toTuple = (point: LatLng): L.LatLngTuple => [point.lat, point.lng]

const fit = (map: L.Map, points: L.LatLngTuple[]) => {
  if (points.length === 1) map.setView(points[0]!, 15)
  else if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 })
}

export function PlaybackMap({
  path,
  points,
  stops,
  events,
  school,
  bus,
  busLabel,
  onEventSelect,
  className,
}: PlaybackMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const progressRef = useRef<L.Polyline | null>(null)
  const busRef = useRef<L.Marker | null>(null)
  const boundsRef = useRef<L.LatLngTuple[]>([])
  const onSelectRef = useRef(onEventSelect)

  useEffect(() => {
    onSelectRef.current = onEventSelect
  })

  useEffect(() => {
    if (!containerRef.current) return
    const { map, dispose } = createBaseMap(containerRef.current)
    containerRef.current.setAttribute('aria-label', 'Trip replay map')
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      dispose()
      mapRef.current = null
      layerRef.current = null
      progressRef.current = null
      busRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const planned = path.map(toTuple)
    const driven = points.map(toTuple)
    L.polyline(planned, {
      color: MAP_COLORS.info,
      weight: 4,
      opacity: 0.6,
      dashArray: '1 8',
      lineCap: 'round',
      interactive: false,
    }).addTo(layer)
    L.polyline(driven, {
      color: MAP_COLORS.primary,
      weight: 4,
      opacity: 0.3,
      interactive: false,
    }).addTo(layer)
    progressRef.current = L.polyline([], {
      color: MAP_COLORS.primary,
      weight: 5,
      opacity: 0.9,
      interactive: false,
    }).addTo(layer)

    stops.forEach((stop) => {
      const label = `Stop ${stop.sequence}: ${stop.name}, ${STOP_STATUS[stop.status].label}`
      const marker = L.marker([stop.lat, stop.lng], {
        icon: stopIcon(stop),
        keyboard: true,
        title: label,
      })
        .bindTooltip(`${stop.name} · ${STOP_STATUS[stop.status].label}`, {
          direction: 'top',
          offset: [0, -14],
        })
        .addTo(layer)
      marker.getElement()?.setAttribute('aria-label', label)
    })

    events.forEach((event) => {
      L.circleMarker([event.lat, event.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: SEVERITY[event.severity].color,
        fillOpacity: 1,
      })
        .bindTooltip(`${SAFETY_KIND[event.kind]} · ${event.message}`, {
          direction: 'top',
          offset: [0, -6],
        })
        .on('click', () => onSelectRef.current(event))
        .addTo(layer)
    })

    if (school) {
      L.marker([school.lat, school.lng], {
        icon: schoolIcon,
        title: 'School',
        keyboard: false,
        zIndexOffset: 500,
      })
        .bindTooltip('School', { direction: 'top', offset: [0, -16] })
        .addTo(layer)
    }

    boundsRef.current = [...planned, ...driven]
    fit(map, boundsRef.current)
  }, [path, points, stops, events, school])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!bus) {
      busRef.current?.remove()
      busRef.current = null
      progressRef.current?.setLatLngs([])
      return
    }
    const latLng: L.LatLngTuple = [bus.lat, bus.lng]
    progressRef.current?.setLatLngs([...points.slice(0, bus.index + 1).map(toTuple), latLng])
    if (busRef.current) {
      busRef.current.setLatLng(latLng)
      return
    }
    busRef.current = L.marker(latLng, {
      icon: busIcon,
      title: busLabel,
      keyboard: false,
      zIndexOffset: 2000,
    })
      .bindTooltip(busLabel, { direction: 'top', offset: [0, -18] })
      .addTo(map)
  }, [bus, points, busLabel])

  return (
    <div className={cn('relative isolate overflow-hidden rounded-xl border', className)}>
      <div ref={containerRef} className='size-full' />
      <div className='pointer-events-none absolute top-3 right-3 z-[500] grid gap-1 rounded-md border bg-card/95 px-2.5 py-2 text-[11px] font-semibold shadow-sm'>
        <span className='flex items-center gap-2'>
          <span className='h-0.5 w-5 border-t-2 border-dotted border-info' />
          Planned route
        </span>
        <span className='flex items-center gap-2'>
          <span className='h-1 w-5 rounded-full bg-primary' />
          Driven
        </span>
      </div>
      <button
        type='button'
        onClick={() => mapRef.current && fit(mapRef.current, boundsRef.current)}
        aria-label='Show the whole trip'
        title='Show the whole trip'
        className='absolute right-3 bottom-6 z-[500] grid size-9 place-items-center rounded-md border bg-card shadow-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40'
      >
        <Maximize2 className='size-4' />
      </button>
    </div>
  )
}
