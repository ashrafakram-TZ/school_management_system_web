import { config } from '@/config/env'

const dateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: config.timeZone,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

const time = new Intl.DateTimeFormat('en-IN', {
  timeZone: config.timeZone,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? '—' : dateOnly.format(date)
}

const toDate = (value: string | number | Date) => (value instanceof Date ? value : new Date(value))

export function formatDateTime(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined) return '—'
  const date = toDate(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)
}

export function formatTime(value: string | number | Date) {
  return time.format(toDate(value))
}

export function timeAgo(value: string | null | undefined, now = Date.now()) {
  if (!value) return 'Never'
  const seconds = Math.round((now - new Date(value).getTime()) / 1000)
  if (seconds < 5) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatNumber(value: number | null | undefined, digits = 0, unit = '') {
  if (value === null || value === undefined) return '—'
  const text = value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return unit ? `${text} ${unit}` : text
}

export function formatBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

export function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000)
}
