import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, MapPin, Phone, Siren } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { can, useMe } from '@/features/auth/api'
import { useNow } from '@/hooks/use-now'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { formatDateTime, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAcknowledgeAlert, useActiveSos, type FleetAlert } from '../api'
import { mapLink, telLink } from '../labels'
import { useAlertsLive } from '../live'

export function SosBanner({ className }: { className?: string }) {
  const me = useMe().data
  const allowed = can(me, 'fleet.view')
  const socket = useAlertsLive(allowed)
  const sos = useActiveSos(allowed, !socket.live)
  const items = sos.data?.items ?? []
  if (!allowed || !items.length) return null
  return (
    <section
      role='alert'
      aria-live='assertive'
      aria-label='Active SOS'
      className={cn('grid gap-2', className)}
    >
      {items.map((alert) => (
        <SosRow key={alert.id} alert={alert} canManage={can(me, 'fleet.manage')} />
      ))}
    </section>
  )
}

function SosRow({ alert, canManage }: { alert: FleetAlert; canManage: boolean }) {
  const now = useNow(15_000)
  const acknowledge = useAcknowledgeAlert()
  const call = telLink(alert.raised_by?.mobile)
  const map = mapLink(alert.position)
  const open = alert.status === 'open'
  const bus = alert.vehicle ? `${alert.vehicle.name} · ${alert.vehicle.registration_no}` : 'No bus'

  const take = async () => {
    try {
      await acknowledge.mutateAsync(alert.id)
      alerts.success('SOS acknowledged', {
        description: 'Resolve it from Alerts when it is handled.',
      })
    } catch (error) {
      alerts.error(toApiError(error).message)
    }
  }

  return (
    <div className='flex flex-col gap-3 rounded-xl border-2 border-destructive bg-destructive p-4 text-destructive-foreground shadow-lg ring-4 ring-destructive/25 md:flex-row md:items-center'>
      <span className='relative grid size-11 shrink-0 place-items-center rounded-full bg-white/20'>
        {open && (
          <span className='absolute inset-0 animate-ping rounded-full bg-white/40 motion-reduce:hidden' />
        )}
        <Siren className='relative size-6' />
      </span>
      <div className='grid min-w-0 flex-1 gap-0.5'>
        <p className='text-base font-extrabold tracking-wide uppercase'>
          SOS {open ? '· needs attention now' : '· being handled'}
        </p>
        <p className='font-semibold break-words'>{alert.message}</p>
        <p className='text-sm break-words opacity-90'>
          {bus}
          {alert.route ? ` · ${alert.route.name}` : ''} ·{' '}
          <span title={formatDateTime(alert.raised_at)}>{timeAgo(alert.raised_at, now)}</span>
          {alert.acknowledged_by ? ` · taken by ${alert.acknowledged_by.name}` : ''}
        </p>
      </div>
      <div className='flex flex-wrap gap-2'>
        {call && (
          <Button asChild size='sm' variant='secondary'>
            <a href={call}>
              <Phone />
              Call {alert.raised_by?.mobile}
            </a>
          </Button>
        )}
        {map && (
          <Button asChild size='sm' variant='secondary'>
            <a href={map} target='_blank' rel='noreferrer'>
              <MapPin />
              Map
            </a>
          </Button>
        )}
        {canManage && open && (
          <Button
            size='sm'
            variant='secondary'
            onClick={() => void take()}
            disabled={acknowledge.isPending}
          >
            <Check />
            Acknowledge
          </Button>
        )}
        <Button asChild size='sm' variant='secondary'>
          <Link to='/fleet/alerts' search={{ page: 1, kind: 'sos', active: true }}>
            Alerts
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  )
}
