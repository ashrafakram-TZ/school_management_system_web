import L from 'leaflet'

export const DEFAULT_MAP_CENTER: L.LatLngTuple = [13.0827, 80.2707]

export const MAP_COLORS = {
  primary: '#159053',
  info: '#2563eb',
  warning: '#c27a00',
  danger: '#d92d20',
}

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
