import { useEffect, useRef, useSyncExternalStore } from 'react'
import { io, type Socket } from 'socket.io-client'
import { config } from '@/config/env'
import { refreshAccessToken } from '@/lib/api/client'
import { session } from '@/lib/auth/session'

export type LiveStatus = 'idle' | 'connecting' | 'live' | 'offline'
export type SubscriptionState = 'pending' | 'live' | 'denied'
export type LiveRoom = 'fleet.subscribe' | 'trip.subscribe'

export interface LivePosition {
  lat: number
  lng: number
  speed: number | null
  heading: number | null
  recorded_at: string
  source: string | null
}

export type LiveTripEventType =
  'trip.started' | 'stop.approaching' | 'stop.arrived' | 'stop.departed' | 'trip.ended'

export interface TripPositionMessage {
  trip_id: number
  route_id: number
  vehicle_id: number
  position: LivePosition
  at: string
}

export interface TripEventMessage {
  trip_id: number
  route_id: number
  vehicle_id: number
  type: LiveTripEventType
  at: string
  stop: { id: number | null; name: string; sequence: number } | null
  eta_seconds: number | null
  position: LivePosition | null
  end_reason: string | null
  notified: number
}

export interface LiveMessages {
  'trip.position': TripPositionMessage
  'trip.event': TripEventMessage
}

type LiveEventName = keyof LiveMessages
type Ack = { ok: true; room: string } | { ok: false; error: string; message: string }

interface Subscription {
  room: LiveRoom
  payload: object
  users: number
  state: SubscriptionState
  message: string | null
}

const IDLE_CLOSE_MS = 5000
const ACK_TIMEOUT_MS = 8000
const SUBSCRIBE_RETRIES = 3
const MAX_RECOVERIES = 3
const TOKEN_ERRORS = ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'TOKEN_MISSING']
const LEAVE: Partial<Record<LiveRoom, string>> = { 'trip.subscribe': 'trip.unsubscribe' }

let socket: Socket | null = null
let users = 0
let closeTimer: number | undefined
let status: LiveStatus = 'idle'
let recovering = false
let recoveries = 0
const changeListeners = new Set<() => void>()
const subscriptions = new Map<string, Subscription>()
const eventListeners: { [K in LiveEventName]: Set<(message: LiveMessages[K]) => void> } = {
  'trip.position': new Set(),
  'trip.event': new Set(),
}

const notify = () => changeListeners.forEach((listener) => listener())

const onChange = (listener: () => void) => {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

const setStatus = (next: LiveStatus) => {
  if (status === next) return
  status = next
  notify()
}

const setState = (sub: Subscription, state: SubscriptionState, message: string | null = null) => {
  if (sub.state === state && sub.message === message) return
  sub.state = state
  sub.message = message
  notify()
}

const liveUrl = () => {
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  try {
    return `${new URL(config.apiUrl, origin).origin}/live`
  } catch {
    return `${origin}/live`
  }
}

const join = (sub: Subscription, attempt = 0) => {
  const current = socket
  if (!current?.connected) return
  current.timeout(ACK_TIMEOUT_MS).emit(sub.room, sub.payload, (error: Error | null, ack?: Ack) => {
    if (current !== socket || !current.connected || sub.users <= 0) return
    if (error || !ack) {
      setState(sub, 'pending')
      return
    }
    if (ack.ok) {
      recoveries = 0
      setState(sub, 'live')
      return
    }
    if (attempt < SUBSCRIBE_RETRIES) {
      window.setTimeout(() => join(sub, attempt + 1), 700 * (attempt + 1))
      return
    }
    setState(sub, 'denied', ack.message)
  })
}

const recover = async (payload: { error?: string } | undefined) => {
  if (recovering || recoveries >= MAX_RECOVERIES) return
  if (payload?.error && !TOKEN_ERRORS.includes(payload.error)) return
  recovering = true
  recoveries += 1
  const token = await refreshAccessToken()
  recovering = false
  if (token && socket && !socket.connected) socket.connect()
}

const open = () => {
  if (socket || !session.get()) return
  setStatus('connecting')
  const next = io(liveUrl(), {
    auth: (callback) => callback({ token: session.get()?.accessToken ?? '' }),
    transports: ['websocket'],
    reconnectionDelayMax: 10000,
  })
  next.on('connect', () => {
    setStatus('live')
    subscriptions.forEach((sub) => join(sub))
  })
  next.on('disconnect', (reason) => {
    subscriptions.forEach((sub) => setState(sub, 'pending'))
    setStatus(reason === 'io client disconnect' ? 'idle' : 'offline')
  })
  next.on('connect_error', () => setStatus('offline'))
  next.on('error', (payload: { error?: string } | undefined) => void recover(payload))
  next.on('trip.position', (message: TripPositionMessage) =>
    eventListeners['trip.position'].forEach((listener) => listener(message))
  )
  next.on('trip.event', (message: TripEventMessage) =>
    eventListeners['trip.event'].forEach((listener) => listener(message))
  )
  socket = next
}

const close = () => {
  window.clearTimeout(closeTimer)
  const current = socket
  socket = null
  current?.removeAllListeners()
  current?.disconnect()
  subscriptions.forEach((sub) => setState(sub, 'pending'))
  setStatus('idle')
}

const acquire = () => {
  users += 1
  window.clearTimeout(closeTimer)
  open()
}

const release = () => {
  users = Math.max(0, users - 1)
  if (users === 0) closeTimer = window.setTimeout(close, IDLE_CLOSE_MS)
}

const addSubscription = (key: string, room: LiveRoom, payload: object) => {
  const existing = subscriptions.get(key)
  if (existing) {
    existing.users += 1
    return
  }
  const sub: Subscription = { room, payload, users: 1, state: 'pending', message: null }
  subscriptions.set(key, sub)
  join(sub)
  notify()
}

const removeSubscription = (key: string) => {
  const sub = subscriptions.get(key)
  if (!sub) return
  sub.users -= 1
  if (sub.users > 0) return
  subscriptions.delete(key)
  const leave = LEAVE[sub.room]
  if (leave && socket?.connected) socket.emit(leave, sub.payload)
  notify()
}

session.subscribe((next) => {
  if (!next) close()
})

export function useLiveSocket() {
  useEffect(() => {
    acquire()
    return release
  }, [])
  const current = useSyncExternalStore(onChange, () => status)
  return { status: current, socket }
}

export function useLiveSubscription(room: LiveRoom, payload: object | null) {
  const key = payload ? `${room}:${JSON.stringify(payload)}` : null
  useEffect(() => {
    if (!key) return
    acquire()
    addSubscription(key, room, JSON.parse(key.slice(room.length + 1)) as object)
    return () => {
      removeSubscription(key)
      release()
    }
  }, [key, room])
  const state = useSyncExternalStore(onChange, () =>
    key ? (subscriptions.get(key)?.state ?? 'pending') : 'pending'
  )
  const message = useSyncExternalStore(onChange, () =>
    key ? (subscriptions.get(key)?.message ?? null) : null
  )
  const connection = useSyncExternalStore(onChange, () => status)
  return { live: connection === 'live' && state === 'live', status: connection, state, message }
}

export function useLiveEvent<K extends LiveEventName>(
  name: K,
  handler: (message: LiveMessages[K]) => void
) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  useEffect(() => {
    const listener = (message: LiveMessages[K]) => handlerRef.current(message)
    const listeners = eventListeners[name] as Set<(message: LiveMessages[K]) => void>
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [name])
}
