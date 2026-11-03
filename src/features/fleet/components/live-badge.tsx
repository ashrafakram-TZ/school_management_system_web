import { Badge } from '@/components/ui/badge'
import type { LiveStatus, SubscriptionState } from '@/lib/live/socket'

export function LiveBadge({
  status,
  state,
  className,
}: {
  status: LiveStatus
  state: SubscriptionState
  className?: string
}) {
  if (status === 'live' && state === 'live') {
    return (
      <Badge
        tone='success'
        dot
        pulse
        role='status'
        aria-label='Live updates on'
        className={className}
      >
        Live
      </Badge>
    )
  }
  if ((status === 'connecting' || status === 'live') && state !== 'denied') {
    return (
      <Badge
        tone='warning'
        dot
        role='status'
        aria-label='Live updates connecting'
        className={className}
      >
        Connecting
      </Badge>
    )
  }
  return (
    <Badge
      dot
      role='status'
      aria-label='Live updates paused'
      title='Live updates are paused. The page still refreshes every few seconds.'
      className={className}
    >
      Not live
    </Badge>
  )
}
