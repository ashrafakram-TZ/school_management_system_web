import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { Maximize2, MousePointerClick } from 'lucide-react'
import { MAP_COLORS, createBaseMap, schoolIcon } from '@/components/common/base-map'
import { cn } from '@/lib/utils'

export interface MapStop {
  key: string
  name: string
  lat: number
  lng: number
  radius: number
}

interface RouteMapProps {
  stops: MapStop[]
  school: { lat: number; lng: number } | null
  selectedKey?: string
  editable: boolean
  fitKey: string
  onAdd: (lat: number, lng: number) => void
  onMove: (key: string, lat: number, lng: number) => void
  onSelect: (key: string) => void
  className?: string
}

const stopIcon = (number: number, selected: boolean) =>
  L.divIcon({
    className: 'route-pin',
    html: `<span class="grid size-7 place-items-center rounded-full border-2 border-white text-xs font-extrabold text-white shadow-md ${selected ? 'bg-info ring-4 ring-info/35' : 'bg-primary'}">${number}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

const fitRoute = (map: L.Map, stops: MapStop[], school: RouteMapProps['school']) => {
  const points: L.LatLngTuple[] = stops.map((stop) => [stop.lat, stop.lng])
  if (school) points.push([school.lat, school.lng])
  if (points.length === 1) map.setView(points[0]!, 15)
  else if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 })
}

export function RouteMap({
  stops,
  school,
  selectedKey,
  editable,
  fitKey,
  onAdd,
  onMove,
  onSelect,
  className,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const fittedRef = useRef('')
  const handlers = useRef({ onAdd, onMove, onSelect, editable })

  useEffect(() => {
    handlers.current = { onAdd, onMove, onSelect, editable }
  })

  useEffect(() => {
    if (!containerRef.current) return
    const { map, dispose } = createBaseMap(containerRef.current)
    containerRef.current.setAttribute('aria-label', 'Route map')
    layerRef.current = L.layerGroup().addTo(map)
    map.on('click', (event: L.LeafletMouseEvent) => {
      if (handlers.current.editable) handlers.current.onAdd(event.latlng.lat, event.latlng.lng)
    })
    mapRef.current = map
    return () => {
      dispose()
      mapRef.current = null
      layerRef.current = null
      fittedRef.current = ''
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const path: L.LatLngTuple[] = stops.map((stop) => [stop.lat, stop.lng])
    if (school) path.push([school.lat, school.lng])
    const line = L.polyline(path, {
      color: MAP_COLORS.primary,
      weight: 4,
      opacity: 0.75,
      dashArray: '1 8',
      lineCap: 'round',
      interactive: false,
    }).addTo(layer)

    stops.forEach((stop, index) => {
      const circle = L.circle([stop.lat, stop.lng], {
        radius: stop.radius,
        color: stop.key === selectedKey ? MAP_COLORS.info : MAP_COLORS.primary,
        weight: 1.5,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(layer)
      const label = `Stop ${index + 1}: ${stop.name}`
      const marker = L.marker([stop.lat, stop.lng], {
        icon: stopIcon(index + 1, stop.key === selectedKey),
        draggable: editable,
        keyboard: true,
        title: label,
        zIndexOffset: stop.key === selectedKey ? 1000 : 0,
      })
        .bindTooltip(stop.name, { direction: 'top', offset: [0, -14] })
        .on('click', () => handlers.current.onSelect(stop.key))
        .on('drag', (event) => {
          const position = (event.target as L.Marker).getLatLng()
          circle.setLatLng(position)
          path[index] = [position.lat, position.lng]
          line.setLatLngs(path)
        })
        .on('dragend', (event) => {
          const position = (event.target as L.Marker).getLatLng()
          handlers.current.onMove(stop.key, position.lat, position.lng)
        })
        .addTo(layer)
      marker.getElement()?.setAttribute('aria-label', editable ? `${label}. Drag to move` : label)
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

    if (fitKey && fittedRef.current !== fitKey) {
      fittedRef.current = fitKey
      fitRoute(map, stops, school)
    }
  }, [stops, school, selectedKey, editable, fitKey])

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-xl border',
        editable && '[&_.leaflet-container]:cursor-crosshair',
        className
      )}
    >
      <div ref={containerRef} className='size-full' />
      {editable && (
        <span className='pointer-events-none absolute top-3 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card/95 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-sm'>
          <MousePointerClick className='size-3.5 text-primary' />
          Click the map to add a stop
        </span>
      )}
      <button
        type='button'
        onClick={() => mapRef.current && fitRoute(mapRef.current, stops, school)}
        aria-label='Show the whole route'
        title='Show the whole route'
        className='absolute right-3 bottom-6 z-[500] grid size-9 place-items-center rounded-md border bg-card shadow-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40'
      >
        <Maximize2 className='size-4' />
      </button>
    </div>
  )
}
