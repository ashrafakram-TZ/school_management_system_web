import { useQueryClient } from '@tanstack/react-query'
import { useSelectedSchool } from '@/lib/auth/school-context'
import { alerts } from '@/lib/alerts'
import { useLiveEvent, useLiveSubscription } from '@/lib/live/socket'
import { alertKeys, type FleetAlert } from './api'

const where = (alert: FleetAlert) =>
  [
    alert.vehicle ? `${alert.vehicle.name} (${alert.vehicle.registration_no})` : null,
    alert.route?.name,
  ]
    .filter(Boolean)
    .join(' · ')

export function useAlertsLive(enabled = true) {
  const queryClient = useQueryClient()
  const schoolId = useSelectedSchool()
  const socket = useLiveSubscription(
    'fleet.subscribe',
    enabled ? (schoolId ? { school_id: schoolId } : {}) : null
  )

  useLiveEvent('alert.raised', (alert) => {
    if (!enabled) return
    void queryClient.invalidateQueries({ queryKey: alertKeys.all })
    const options = { id: `fleet-alert-${alert.id}`, description: where(alert) || undefined }
    if (alert.kind === 'sos') alerts.error(alert.message, { ...options, duration: 30_000 })
    else alerts.warning(`${alert.kind_label}: ${alert.message}`, options)
  })

  useLiveEvent('alert.updated', () => {
    if (enabled) void queryClient.invalidateQueries({ queryKey: alertKeys.all })
  })

  return socket
}
