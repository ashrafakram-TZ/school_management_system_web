const env = import.meta.env

const text = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

const number = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  appName: text(env.VITE_APP_NAME, 'Tamilzorous School'),
  apiUrl: text(env.VITE_API_URL, '/api/v1').replace(/\/$/, ''),
  timeZone: text(env.VITE_TIMEZONE, 'Asia/Kolkata'),
  refreshIntervalMs: number(env.VITE_REFRESH_INTERVAL_SECONDS, 10) * 1000,
} as const
