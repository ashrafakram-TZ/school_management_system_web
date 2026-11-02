import { useState } from 'react'
import { Bus, CircleOff, MapPin, Navigation, PauseCircle, WifiOff } from 'lucide-react'
import { DataTable, type Column } from '@/components/common/data-table'
import { EmptyState, ErrorState } from '@/components/common/display'
import { FleetMap } from '@/components/common/fleet-map'
import { InsightCards, type Insight } from '@/components/common/insight-cards'
import { Page, PageHeader } from '@/components/common/page'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useNow } from '@/hooks/use-now'
import { formatDateTime, formatNumber, timeAgo } from '@/lib/format'
import { usePositions, useFleetLive, VEHICLE_STATE, type Vehicle, type VehicleState } from '../api'

type Filter = 'all' | 'moving' | 'idle' | 'offline'

const matches = (vehicle: Vehicle, filter: Filter) =>
  filter === 'all' ||
  vehicle.state === filter ||
  (filter === 'offline' && (vehicle.state === 'offline' || vehicle.state === 'no_data'))

export function FleetPage() {
  const live = useFleetLive()
  const now = useNow()
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const data = live.data
  const vehicles = (data?.vehicles ?? []).filter((vehicle) => matches(vehicle, filter))
  const open = data?.vehicles.find((vehicle) => vehicle.id === openId) ?? null
  const toggle = (next: Filter) => setFilter((current) => (current === next ? 'all' : next))

  const cards: Insight[] = [
    {
      key: 'all',
      label: 'Buses',
      value: data?.total ?? 0,
      hint: 'With a tracker',
      icon: Bus,
      tone: 'primary',
      active: filter === 'all',
      onClick: () => setFilter('all'),
    },
    {
      key: 'moving',
      label: 'Moving now',
      value: data?.moving ?? 0,
      hint: 'On the road',
      icon: Navigation,
      tone: 'success',
      active: filter === 'moving',
      onClick: () => toggle('moving'),
    },
    {
      key: 'idle',
      label: 'Stopped',
      value: data?.idle ?? 0,
      hint: 'Engine on or parked',
      icon: PauseCircle,
      tone: 'warning',
      active: filter === 'idle',
      onClick: () => toggle('idle'),
    },
    {
      key: 'offline',
      label: 'Offline',
      value: data?.offline ?? 0,
      hint: 'No signal in the last 2 minutes',
      icon: WifiOff,
      tone: 'neutral',
      active: filter === 'offline',
      onClick: () => toggle('offline'),
    },
  ]

  const columns: Column<Vehicle>[] = [
    {
      key: 'bus',
      header: 'Bus',
      cell: (vehicle) => (
        <div className='grid'>
          <span className='font-bold'>{vehicle.name}</span>
          <span className='font-mono text-xs text-muted-foreground'>
            {vehicle.vehicle_no ?? vehicle.imei}
          </span>
        </div>
      ),
    },
    { key: 'state', header: 'Status', cell: (vehicle) => <StateBadge state={vehicle.state} /> },
    {
      key: 'speed',
      header: 'Speed',
      cell: (vehicle) => (
        <span className='tabular'>{formatNumber(vehicle.position?.speed, 0, ' km/h')}</span>
      ),
    },
    {
      key: 'seen',
      header: 'Last signal',
      hideBelow: 'lg',
      cell: (vehicle) => (
        <span className='text-muted-foreground'>
          {vehicle.last_seen_at ? timeAgo(vehicle.last_seen_at, now) : 'Never'}
        </span>
      ),
    },
    {
      key: 'where',
      header: 'Location',
      hideBelow: 'xl',
      cell: (vehicle) =>
        vehicle.position ? (
          <span className='tabular text-xs text-muted-foreground'>
            {vehicle.position.lat.toFixed(5)}, {vehicle.position.lng.toFixed(5)}
          </span>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <Page>
      <PageHeader
        eyebrow='Fleet'
        title='Bus tracking'
        description='Where every bus is right now and whether it is moving. Updates every few seconds.'
      />
      {live.isError && !data ? (
        <Card className='p-6'>
          <ErrorState message={live.error.message} onRetry={() => live.refetch()} />
        </Card>
      ) : (
        <>
          <InsightCards items={cards} loading={live.isPending} />
          <div className='grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'>
            <Card className='overflow-hidden'>
              {live.isPending ? (
                <Skeleton className='h-[420px] rounded-none' />
              ) : (
                <FleetMap
                  className='h-[420px]'
                  emptyText='No bus has sent its position yet'
                  onSelect={setOpenId}
                  points={vehicles
                    .filter((vehicle) => vehicle.position)
                    .map((vehicle) => ({
                      id: vehicle.id,
                      lat: vehicle.position!.lat,
                      lng: vehicle.position!.lng,
                      label: vehicle.name,
                      sublabel: `${VEHICLE_STATE[vehicle.state].label} · ${formatNumber(vehicle.position!.speed, 0, ' km/h')}`,
                      color: VEHICLE_STATE[vehicle.state].color,
                    }))}
                />
              )}
            </Card>
            <Card className='overflow-hidden'>
              <DataTable
                rows={vehicles}
                columns={columns}
                rowKey={(vehicle) => vehicle.id}
                loading={live.isPending}
                error={null}
                onRowClick={(vehicle) => setOpenId(vehicle.id)}
                empty={{
                  icon: filter === 'all' ? Bus : CircleOff,
                  title: filter === 'all' ? 'No buses yet' : 'No bus in this state',
                  description:
                    filter === 'all'
                      ? 'Trackers are registered in the Telematics service. They appear here once added.'
                      : 'Click the card again to see every bus.',
                }}
                card={(vehicle) => (
                  <div className='flex items-center justify-between gap-3'>
                    <div className='grid'>
                      <span className='font-bold'>{vehicle.name}</span>
                      <span className='text-xs text-muted-foreground'>
                        {vehicle.vehicle_no ?? vehicle.imei} ·{' '}
                        {vehicle.last_seen_at
                          ? timeAgo(vehicle.last_seen_at, now)
                          : 'No signal yet'}
                      </span>
                    </div>
                    <StateBadge state={vehicle.state} />
                  </div>
                )}
              />
            </Card>
          </div>
        </>
      )}
      <VehicleSheet vehicle={open} onClose={() => setOpenId(null)} />
    </Page>
  )
}

function StateBadge({ state }: { state: VehicleState }) {
  return (
    <Badge tone={VEHICLE_STATE[state].tone} dot pulse={state === 'moving'}>
      {VEHICLE_STATE[state].label}
    </Badge>
  )
}

function VehicleSheet({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: () => void }) {
  const positions = usePositions(vehicle?.id ?? null)
  return (
    <Sheet open={Boolean(vehicle)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {vehicle && (
          <>
            <SheetHeader>
              <SheetTitle>{vehicle.name}</SheetTitle>
              <SheetDescription className='flex flex-wrap items-center gap-2'>
                <span className='font-mono text-xs'>{vehicle.vehicle_no ?? vehicle.imei}</span>
                <StateBadge state={vehicle.state} />
              </SheetDescription>
            </SheetHeader>
            <SheetBody className='grid content-start gap-5'>
              {vehicle.position ? (
                <dl className='grid grid-cols-2 gap-3 rounded-lg border p-3'>
                  {[
                    ['Speed', formatNumber(vehicle.position.speed, 0, ' km/h')],
                    [
                      'Ignition',
                      vehicle.position.ignition === null
                        ? '—'
                        : vehicle.position.ignition
                          ? 'On'
                          : 'Off',
                    ],
                    ['Fuel', formatNumber(vehicle.position.fuel, 0, '%')],
                    ['Last signal', formatDateTime(vehicle.position.recorded_at)],
                  ].map(([label, value]) => (
                    <div key={label} className='grid gap-0.5'>
                      <dt className='text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
                        {label}
                      </dt>
                      <dd className='text-sm font-semibold'>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <EmptyState
                  icon={MapPin}
                  title='No position yet'
                  description='The tracker has not sent any data.'
                />
              )}
              <section className='grid gap-2'>
                <h3 className='text-xs font-bold tracking-wider text-muted-foreground uppercase'>
                  Recent positions
                </h3>
                {positions.isError ? (
                  <ErrorState
                    message={positions.error.message}
                    onRetry={() => positions.refetch()}
                  />
                ) : !positions.data ? (
                  <Skeleton className='h-40' />
                ) : positions.data.items.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>Nothing recorded yet.</p>
                ) : (
                  <ul className='grid overflow-hidden rounded-lg border'>
                    {positions.data.items.map((row) => (
                      <li
                        key={row.id}
                        className='flex items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-0'
                      >
                        <span className='tabular text-muted-foreground'>
                          {formatDateTime(row.recorded_at)}
                        </span>
                        <span className='tabular font-semibold'>
                          {formatNumber(row.speed, 0, ' km/h')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
