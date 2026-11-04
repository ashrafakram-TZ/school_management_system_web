import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  BatteryMedium,
  Cpu,
  Fuel,
  Gauge,
  HeartPulse,
  Route,
  Thermometer,
  Wrench,
} from 'lucide-react'
import { ErrorState } from '@/components/common/display'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useBusHealth, type VehicleHealth } from '../api'
import { HEALTH_STATUS, SEVERITY } from '../labels'
import { ObdLogModal } from './obd-log-modal'

function Reading({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: typeof Fuel
  label: string
  value: string
  alert?: boolean
}) {
  return (
    <div className='grid min-w-0 content-start gap-1 rounded-lg border p-2.5'>
      <span className='flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
        <Icon className='size-3.5' />
        {label}
      </span>
      <span className={cn('tabular text-sm font-semibold', alert && 'text-destructive')}>
        {value}
      </span>
    </div>
  )
}

function Readings({ health }: { health: VehicleHealth }) {
  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
      <Reading
        icon={BatteryMedium}
        label='Battery'
        value={formatNumber(health.battery_v, 1, 'V')}
        alert={health.battery_v !== null && health.battery_v < 11.8}
      />
      <Reading
        icon={Thermometer}
        label='Coolant'
        value={formatNumber(health.coolant_c, 0, '°C')}
        alert={(health.coolant_c ?? 0) > 105}
      />
      <Reading icon={Gauge} label='Engine' value={formatNumber(health.rpm, 0, 'rpm')} />
      <Reading
        icon={Fuel}
        label='Fuel'
        value={formatNumber(health.fuel_pct, 0, '%')}
        alert={health.fuel_pct !== null && health.fuel_pct < 15}
      />
      <Reading icon={Route} label='Odometer' value={formatNumber(health.odometer_km, 0, 'km')} />
      <Reading
        icon={Cpu}
        label='Engine load'
        value={formatNumber(health.engine_load_pct, 0, '%')}
      />
    </div>
  )
}

export function VehicleHealthCard({ busId, busName }: { busId: number; busName: string }) {
  const query = useBusHealth(busId)
  const [obdOpen, setObdOpen] = useState(false)
  const data = query.data
  const health = data?.health ?? null
  const status = HEALTH_STATUS[health?.status ?? 'unknown']

  return (
    <section className='grid gap-3' aria-labelledby={`health-${busId}`}>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3
          id={`health-${busId}`}
          className='flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase'
        >
          <HeartPulse className='size-3.5' />
          Vehicle health
        </h3>
        {data && (
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        )}
      </div>

      {query.isError && !data ? (
        <ErrorState
          message={
            query.error.code === 'TELEMATICS_UNAVAILABLE'
              ? 'Engine health cannot be loaded now because the bus tracking service is not reachable.'
              : query.error.message
          }
          onRetry={() => query.refetch()}
          className='py-4'
        />
      ) : !data ? (
        <Skeleton className='h-40' />
      ) : (
        <>
          {!data.has_tracker ? (
            <p className='rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground'>
              No tracker is fitted to this bus, so there is no engine data. Fit a tracker in Buses
              and routes.
            </p>
          ) : !health ? (
            <p className='rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground'>
              The tracker has not sent engine readings yet.
            </p>
          ) : (
            <>
              {health.reasons.length > 0 && (
                <ul className='flex flex-wrap gap-1'>
                  {health.reasons.map((reason) => (
                    <li key={reason}>
                      <Badge tone={health.status === 'critical' ? 'danger' : 'warning'}>
                        {reason}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Readings health={health} />
              {health.faults.length > 0 && (
                <ul className='grid overflow-hidden rounded-lg border' aria-label='Active faults'>
                  {health.faults.map((fault) => (
                    <li
                      key={fault.code}
                      className='flex items-start justify-between gap-3 border-b px-3 py-2 text-sm last:border-0'
                    >
                      <span className='grid min-w-0 gap-0.5'>
                        <span className='font-mono text-xs font-bold'>{fault.code}</span>
                        <span className='text-muted-foreground'>{fault.description}</span>
                        {fault.first_seen_at && (
                          <span className='text-xs text-muted-foreground'>
                            Since {formatDateTime(fault.first_seen_at)}
                          </span>
                        )}
                      </span>
                      <Badge tone={SEVERITY[fault.severity].tone}>
                        {SEVERITY[fault.severity].label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <span className='text-xs text-muted-foreground'>
                Reading at {formatDateTime(health.reading_at)}
              </span>
            </>
          )}
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link
                to='/fleet/maintenance'
                search={{ tab: 'tickets', page: 1, vehicle_id: busId }}
                aria-label={`Maintenance tickets for ${busName}`}
              >
                <Wrench />
                {data.open_tickets
                  ? `${data.open_tickets} open ${data.open_tickets === 1 ? 'ticket' : 'tickets'}`
                  : 'Maintenance'}
              </Link>
            </Button>
            {data.has_tracker && (
              <Button variant='outline' size='sm' onClick={() => setObdOpen(true)}>
                <Activity />
                OBD log
              </Button>
            )}
          </div>
        </>
      )}
      <ObdLogModal busId={busId} busName={busName} open={obdOpen} onOpenChange={setObdOpen} />
    </section>
  )
}
