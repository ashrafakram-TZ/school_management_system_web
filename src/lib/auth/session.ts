export interface Session {
  accessToken: string
  refreshToken: string
}

type Listener = (session: Session | null) => void

const STORAGE_KEY = 'tz-session'
const listeners = new Set<Listener>()

const read = (): Session | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    return parsed.accessToken && parsed.refreshToken
      ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
      : null
  } catch {
    return null
  }
}

let current = read()

const write = (next: Session | null) => {
  current = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  } finally {
    listeners.forEach((listener) => listener(next))
  }
}

export const session = {
  get: () => current,
  set: (next: Session) => write(next),
  clear: () => {
    if (current) write(null)
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    current = read()
    listeners.forEach((listener) => listener(current))
  })
}
