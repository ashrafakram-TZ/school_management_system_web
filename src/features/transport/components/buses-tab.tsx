import { useState } from 'react'
import { Bus as BusIcon, CircleOff, Pencil, Plus, Radio, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable, type Column } from '@/components/common/data-table'
import { ListToolbar, SearchBox } from '@/components/common/list-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { run } from '@/features/setup/form-actions'
import { cn } from '@/lib/utils'
import { transportApi, useBuses, useTransportMutation, type Bus } from '../api'
import { BusFormModal } from './bus-form-modal'
import { ExpiryBadges } from './expiry-badges'

const LIMIT = 20

function Seats({ bus }: { bus: Bus }) {
  const full = bus.students >= bus.capacity
  return (
    <span className={cn('tabular font-semibold', full && 'text-destructive')}>
      {bus.students}/{bus.capacity}
      <span className='font-normal text-muted-foreground'> seats used</span>
    </span>
  )
}

function Tracker({ bus }: { bus: Bus }) {
  return bus.device ? (
    <span className='flex items-center gap-1.5 font-mono text-xs'>
      <Radio className='size-3.5 text-success' />
      {bus.device.imei ?? `Tracker ${bus.device.id}`}
    </span>
  ) : (
    <span className='text-xs text-muted-foreground'>No tracker</span>
  )
}

const person = (value: Bus['driver']) =>
  value ? (
    <span className='grid'>
      <span className='font-semibold'>{value.name}</span>
      <span className='tabular text-xs text-muted-foreground'>{value.mobile}</span>
    </span>
  ) : (
    <span className='text-muted-foreground'>Not assigned</span>
  )

export function BusesTab({
  search,
  page,
  canManage,
  onSearch,
  onPage,
}: {
  search?: string
  page: number
  canManage: boolean
  onSearch: (search: string | undefined) => void
  onPage: (page: number) => void
}) {
  const buses = useBuses({ page, limit: LIMIT, search })
  const [editing, setEditing] = useState<Bus | 'new' | null>(null)
  const [removing, setRemoving] = useState<Bus | null>(null)
  const remove = useTransportMutation((id: number) => transportApi.removeBus(id))
  const rows = buses.data?.items ?? []

  const actions = (bus: Bus) =>
    canManage && (
      <span className='flex justify-end'>
        <Button
          size='icon-sm'
          variant='ghost'
          aria-label={`Edit ${bus.registration_no}`}
          onClick={() => setEditing(bus)}
        >
          <Pencil />
        </Button>
        <Button
          size='icon-sm'
          variant='ghost'
          aria-label={`Delete ${bus.registration_no}`}
          className='text-destructive hover:bg-destructive/10'
          onClick={() => setRemoving(bus)}
        >
          <Trash2 />
        </Button>
      </span>
    )

  const columns: Column<Bus>[] = [
    {
      key: 'bus',
      header: 'Bus',
      cell: (bus) => (
        <span className='grid'>
          <span className='flex items-center gap-1.5 font-mono font-bold'>
            {bus.registration_no}
            {bus.status === 'inactive' && <Badge>Off the road</Badge>}
          </span>
          <span className='text-xs text-muted-foreground'>
            {bus.name}
            {bus.make_model ? ` · ${bus.make_model}` : ''}
          </span>
        </span>
      ),
    },
    { key: 'seats', header: 'Students', cell: (bus) => <Seats bus={bus} /> },
    { key: 'tracker', header: 'Tracker', cell: (bus) => <Tracker bus={bus} /> },
    { key: 'driver', header: 'Driver', cell: (bus) => person(bus.driver), hideBelow: 'lg' },
    {
      key: 'attendant',
      header: 'Attendant',
      cell: (bus) => person(bus.attendant),
      hideBelow: 'xl',
    },
    {
      key: 'documents',
      header: 'Documents',
      cell: (bus) => <ExpiryBadges items={bus.expiries} />,
      className: 'max-w-72',
    },
    { key: 'actions', header: '', align: 'right', cell: actions },
  ]

  return (
    <Card className='overflow-hidden'>
      <ListToolbar summary={buses.data ? `${buses.data.total} buses` : ''}>
        <SearchBox
          value={search ?? ''}
          onChange={(value) => onSearch(value || undefined)}
          placeholder='Registration, name or model'
          label='Search buses'
        />
        {canManage && (
          <Button onClick={() => setEditing('new')}>
            <Plus />
            Add bus
          </Button>
        )}
      </ListToolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(bus) => bus.id}
        loading={buses.isFetching}
        error={buses.isError ? buses.error.message : null}
        onRetry={() => buses.refetch()}
        empty={{
          icon: search ? CircleOff : BusIcon,
          title: search ? 'No buses match this search' : 'No buses yet',
          description: search
            ? 'Try another registration or name.'
            : 'Add the school buses with their seats, tracker, driver and documents.',
          action: !search && canManage && (
            <Button onClick={() => setEditing('new')}>
              <Plus />
              Add bus
            </Button>
          ),
        }}
        card={(bus) => (
          <div className='grid gap-2'>
            <div className='flex items-start justify-between gap-2'>
              <span className='grid min-w-0'>
                <span className='font-mono font-bold'>{bus.registration_no}</span>
                <span className='truncate text-xs text-muted-foreground'>
                  {bus.name}
                  {bus.make_model ? ` · ${bus.make_model}` : ''}
                </span>
              </span>
              {actions(bus)}
            </div>
            <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
              <Seats bus={bus} />
              <Tracker bus={bus} />
            </div>
            <span className='text-xs text-muted-foreground'>
              Driver{' '}
              <span className='font-semibold text-foreground'>
                {bus.driver?.name ?? 'Not assigned'}
              </span>{' '}
              · Attendant{' '}
              <span className='font-semibold text-foreground'>
                {bus.attendant?.name ?? 'Not assigned'}
              </span>
            </span>
            <ExpiryBadges items={bus.expiries} />
          </div>
        )}
        pagination={{
          page,
          limit: LIMIT,
          total: buses.data?.total ?? 0,
          label: 'buses',
          onPageChange: onPage,
        }}
      />
      {editing && (
        <BusFormModal
          bus={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete ${removing?.registration_no ?? ''}?`}
        description='The bus is removed. Its routes and their students stay, without a bus.'
        confirmText='Delete bus'
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (removing)
            await run(() => remove.mutateAsync(removing.id), `${removing.registration_no} deleted`)
          setRemoving(null)
        }}
      />
    </Card>
  )
}
