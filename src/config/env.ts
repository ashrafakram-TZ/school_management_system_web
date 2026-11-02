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
  mqttUrl: text(env.VITE_MQTT_URL, 'mqtt://broker.hivemq.com:1883'),
  mqttTopicFilter: text(env.VITE_MQTT_TOPIC_FILTER, 'telematics/+/telemetry'),
  timeZone: text(env.VITE_TIMEZONE, 'Asia/Kolkata'),
  onlineWindowMs: number(env.VITE_ONLINE_WINDOW_SECONDS, 120) * 1000,
  refreshIntervalMs: number(env.VITE_REFRESH_INTERVAL_SECONDS, 10) * 1000,
} as const
