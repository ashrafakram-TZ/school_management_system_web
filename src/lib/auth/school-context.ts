import { useSyncExternalStore } from 'react'

type Listener = () => void

const STORAGE_KEY = 'tz-school-id'
const listeners = new Set<Listener>()

const read = (): number | null => {
  try {
    const id = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

let current = read()

export const schoolContext = {
  get: () => current,
  set: (id: number | null) => {
    if (id === current) return
    current = id
    try {
      if (id) localStorage.setItem(STORAGE_KEY, String(id))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      return
    } finally {
      listeners.forEach((listener) => listener())
    }
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useSelectedSchool() {
  return useSyncExternalStore(schoolContext.subscribe, schoolContext.get)
}
