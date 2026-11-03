import L from 'leaflet'

export const DEFAULT_MAP_CENTER: L.LatLngTuple = [13.0827, 80.2707]

export const MAP_COLORS = {
  primary: '#159053',
  info: '#2563eb',
  warning: '#c27a00',
  danger: '#d92d20',
}

const SCHOOL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="M18 5v17"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg>'

export const schoolIcon = L.divIcon({
  className: 'route-pin',
  html: `<span class="grid size-8 place-items-center rounded-lg border-2 border-white bg-foreground text-background shadow-md">${SCHOOL_SVG}</span>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

export function createBaseMap(element: HTMLElement, options: L.MapOptions = {}) {
  const map = L.map(element, { zoomControl: true, scrollWheelZoom: false, ...options }).setView(
    DEFAULT_MAP_CENTER,
    12
  )
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  map.on('focus', () => map.scrollWheelZoom.enable())
  map.on('blur', () => map.scrollWheelZoom.disable())
  const observer = new ResizeObserver(() => map.invalidateSize())
  observer.observe(element)
  return {
    map,
    dispose: () => {
      observer.disconnect()
      map.remove()
    },
  }
}
