import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { Maximize2 } from 'lucide-react'
import { MAP_COLORS, createBaseMap, schoolIcon } from '@/components/common/base-map'
import type { LivePosition } from '@/lib/live/socket'
import { cn } from '@/lib/utils'
import type { TripKind, TripStop } from '../api'
import { STOP_STATUS } from '../labels'

interface TripMapProps {
  stops: TripStop[]
  school: { lat: number; lng: number } | null
  kind: TripKind
  position: LivePosition | null
  busLabel: string
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

const stopIcon = (number: number, stop: TripStop) =>
  L.divIcon({
    className: 'route-pin',
    html: `<span class="grid size-7 place-items-center rounded-full border-2 border-white text-xs font-extrabold text-white shadow-md dark:text-background ${STOP_STATUS[stop.status].pin}">${number}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

const pathOf = (stops: TripStop[], school: TripMapProps['school'], kind: TripKind) => {
  const points: L.LatLngTuple[] = stops.map((stop) => [stop.lat, stop.lng])
  if (!school) return points
  return kind === 'pickup'
    ? [...points, [school.lat, school.lng] as L.LatLngTuple]
    : [[school.lat, school.lng] as L.LatLngTuple, ...points]
}

const fitTrip = (map: L.Map, points: L.LatLngTuple[]) => {
  if (points.length === 1) map.setView(points[0]!, 15)
  else if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 })
}

export function TripMap({ stops, school, kind, position, busLabel, className }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const busRef = useRef<L.Marker | null>(null)
  const fittedRef = useRef(false)
  const pointsRef = useRef<L.LatLngTuple[]>([])

  useEffect(() => {
    if (!containerRef.current) return
    const { map, dispose } = createBaseMap(containerRef.current)
    containerRef.current.setAttribute('aria-label', 'Trip map')
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      dispose()
      mapRef.current = null
      layerRef.current = null
      busRef.current = null
      fittedRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const path = pathOf(stops, school, kind)
    pointsRef.current = path
    L.polyline(path, {
      color: MAP_COLORS.primary,
      weight: 4,
      opacity: 0.75,
      dashArray: '1 8',
      lineCap: 'round',
      interactive: false,
    }).addTo(layer)

    stops.forEach((stop, index) => {
      const label = `Stop ${index + 1}: ${stop.name}, ${STOP_STATUS[stop.status].label}`
      const marker = L.marker([stop.lat, stop.lng], {
        icon: stopIcon(index + 1, stop),
        keyboard: true,
        title: label,
        zIndexOffset: stop.status === 'approaching' ? 800 : 0,
      })
        .bindTooltip(`${stop.name} · ${STOP_STATUS[stop.status].label}`, {
          direction: 'top',
          offset: [0, -14],
        })
        .addTo(layer)
      marker.getElement()?.setAttribute('aria-label', label)
    })

    if (school) {
      const marker = L.marker([school.lat, school.lng], {
        icon: schoolIcon,
        title: 'School',
        keyboard: false,
        zIndexOffset: 500,
      })
        .bindTooltip('School', { direction: 'top', offset: [0, -16] })
        .addTo(layer)
      marker.getElement()?.setAttribute('aria-label', 'School')
    }

    if (!fittedRef.current && path.length) {
      fittedRef.current = true
      fitTrip(map, path)
    }
  }, [stops, school, kind])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!position) {
      busRef.current?.remove()
      busRef.current = null
      return
    }
    const latLng: L.LatLngTuple = [position.lat, position.lng]
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
    busRef.current.getElement()?.setAttribute('aria-label', `${busLabel} live position`)
  }, [position, busLabel])

  return (
    <div className={cn('relative isolate overflow-hidden rounded-xl border', className)}>
      <div ref={containerRef} className='size-full' />
      <button
        type='button'
        onClick={() => {
          const map = mapRef.current
          if (!map) return
          const points = [...pointsRef.current]
          if (position) points.push([position.lat, position.lng])
          fitTrip(map, points)
        }}
        aria-label='Show the whole trip'
        title='Show the whole trip'
        className='absolute right-3 bottom-6 z-[500] grid size-9 place-items-center rounded-md border bg-card shadow-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40'
      >
        <Maximize2 className='size-4' />
      </button>
    </div>
  )
}
