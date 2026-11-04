import { useState } from 'react'
import {
  CalendarDays,
  CircleOff,
  Droplets,
  FileText,
  Fuel,
  Gauge,
  IndianRupee,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable, type Column } from '@/components/common/data-table'
import { InsightCards, type Insight } from '@/components/common/insight-cards'
import { FilterSelect, ListToolbar, SearchBox } from '@/components/common/list-toolbar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBusOptions } from '@/features/transport/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { openFile } from '@/lib/files'
import { formatDate, formatNumber } from '@/lib/format'
import {
  maintenanceApi,
  useFuelInsights,
  useFuelLog,
  useMaintenanceMutation,
  type FuelEntry,
  type FuelListParams,
} from '../api'
import { rupees } from '../labels'
import type { MaintenanceSearch } from '../search'
import { FuelFormModal } from './fuel-form-modal'

const LIMIT = 20
const SORTS = ['filled_on', 'amount', 'litres'] as const

interface FuelTabProps {
  search: MaintenanceSearch
  setSearch: (patch: Partial<MaintenanceSearch>) => void
  onPageChange: (page: number) => void
  onClear: () => void
  canManage: boolean
  adding: boolean
  onAddingChange: (open: boolean) => void
}

const openBill = (entry: FuelEntry) => {
  if (!entry.bill_file) return
  void openFile(`/files/${entry.bill_file.id}/content`).catch((error: unknown) =>
    alerts.error(toApiError(error).message)
  )
}

export function FuelTab({
  search,
  setSearch,
  onPageChange,
  onClear,
  canManage,
  adding,
  onAddingChange,
}: FuelTabProps) {
  const busOptions = useBusOptions()
  const [editing, setEditing] = useState<FuelEntry | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState<FuelEntry | null>(null)
  if (adding && !editOpen && editing) setEditing(null)
  const remove = useMaintenanceMutation((id: number) => maintenanceApi.removeFuel(id))

  const sort = SORTS.find((item) => item === search.sort)
  const params: FuelListParams = {
    page: search.page,
    limit: LIMIT,
    search: search.search,
    sort,
    order: sort ? search.order : undefined,
    vehicle_id: search.vehicle_id,
    from: search.from,
    to: search.to,
  }
  const fuel = useFuelLog(params)
  const insights = useFuelInsights(search.vehicle_id)
  const data = insights.data
  const rows = fuel.data?.items ?? []

  const openEdit = (entry: FuelEntry) => {
    setEditing(entry)
    setEditOpen(true)
  }

  const cards: Insight[] = [
    {
      key: 'entries',
      label: 'Fills this month',
      value: data?.entries_this_month ?? 0,
      hint: 'Fuel bills logged',
      icon: CalendarDays,
      tone: 'primary',
    },
    {
      key: 'litres',
      label: 'Litres this month',
      value: formatNumber(data?.litres_this_month ?? 0, 1),
      hint: 'Diesel filled',
      icon: Droplets,
      tone: 'info',
    },
    {
      key: 'amount',
      label: 'Spent this month',
      value: rupees(data?.amount_this_month ?? 0),
      hint: 'Total of fuel bills',
      icon: IndianRupee,
      tone: 'warning',
    },
    {
      key: 'mileage',
      label: 'Average mileage',
      value: formatNumber(data?.avg_km_per_litre, 1, 'km/l'),
      hint: 'Between fills',
      icon: Gauge,
      tone: 'success',
    },
  ]

  const actions = (entry: FuelEntry) => (
    <div className='inline-flex gap-1'>
      {entry.bill_file && (
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={`Open the bill for ${formatDate(entry.filled_on)}`}
          title='Open bill'
          onClick={(event) => {
            event.stopPropagation()
            openBill(entry)
          }}
        >
          <FileText />
        </Button>
      )}
      {canManage && (
        <>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={`Edit fuel entry of ${formatDate(entry.filled_on)}`}
            onClick={(event) => {
              event.stopPropagation()
              openEdit(entry)
            }}
          >
            <Pencil />
          </Button>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={`Delete fuel entry of ${formatDate(entry.filled_on)}`}
            className='text-destructive hover:bg-destructive/10'
            onClick={(event) => {
              event.stopPropagation()
              setDeleting(entry)
            }}
          >
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  )

  const columns: Column<FuelEntry>[] = [
    {
      key: 'filled_on',
      header: 'Date',
      sortKey: 'filled_on',
      cell: (entry) => <span className='tabular font-semibold'>{formatDate(entry.filled_on)}</span>,
    },
    {
      key: 'bus',
      header: 'Bus',
      cell: (entry) => (
        <div className='grid'>
          <span className='font-semibold'>{entry.vehicle.name}</span>
          <span className='font-mono text-xs text-muted-foreground'>
            {entry.vehicle.registration_no}
          </span>
        </div>
      ),
    },
    {
      key: 'litres',
      header: 'Litres',
      sortKey: 'litres',
      align: 'right',
      cell: (entry) => <span className='tabular'>{formatNumber(entry.litres, 1)}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortKey: 'amount',
      align: 'right',
      cell: (entry) => <span className='tabular font-semibold'>{rupees(entry.amount)}</span>,
    },
    {
      key: 'price',
      header: '₹/litre',
      align: 'right',
      hideBelow: 'lg',
      cell: (entry) => <span className='tabular'>{formatNumber(entry.price_per_litre, 2)}</span>,
    },
    {
      key: 'odometer',
      header: 'Odometer',
      align: 'right',
      hideBelow: 'lg',
      cell: (entry) => <span className='tabular'>{formatNumber(entry.odometer_km, 0, 'km')}</span>,
    },
    {
      key: 'km_since_last',
      header: 'Km since last',
      align: 'right',
      hideBelow: 'xl',
      cell: (entry) => <span className='tabular'>{formatNumber(entry.km_since_last, 0)}</span>,
    },
    {
      key: 'km_per_litre',
      header: 'km/l',
      align: 'right',
      cell: (entry) => (
        <span className='tabular font-semibold'>{formatNumber(entry.km_per_litre, 2)}</span>
      ),
    },
    {
      key: 'station',
      header: 'Station',
      hideBelow: 'xl',
      cell: (entry) => <span className='text-muted-foreground'>{entry.station ?? '—'}</span>,
    },
    {
      key: 'filled_by',
      header: 'Filled by',
      hideBelow: 'xl',
      cell: (entry) => <span>{entry.filled_by?.name ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: <span className='sr-only'>Actions</span>,
      align: 'right',
      className: 'w-32',
      cell: actions,
    },
  ]

  const filtered = Boolean(search.search || search.vehicle_id || search.from || search.to)

  return (
    <>
      <InsightCards items={cards} loading={insights.isPending} />
      <Card className='overflow-hidden'>
        <ListToolbar
          summary={
            fuel.data ? `${fuel.data.total} ${fuel.data.total === 1 ? 'entry' : 'entries'}` : ''
          }
          onClear={filtered ? onClear : undefined}
        >
          <SearchBox
            value={search.search ?? ''}
            onChange={(value) => setSearch({ search: value || undefined })}
            placeholder='Search station or bus'
            label='Search fuel log'
          />
          <FilterSelect
            id='fuel-bus-filter'
            label='Filter by bus'
            allLabel='All buses'
            value={search.vehicle_id ? String(search.vehicle_id) : undefined}
            options={busOptions}
            onChange={(value) => setSearch({ vehicle_id: value ? Number(value) : undefined })}
          />
          <Input
            type='date'
            aria-label='From date'
            value={search.from ?? ''}
            max={search.to}
            onChange={(event) => setSearch({ from: event.target.value || undefined })}
            className='w-full sm:w-40'
          />
          <Input
            type='date'
            aria-label='To date'
            value={search.to ?? ''}
            min={search.from}
            onChange={(event) => setSearch({ to: event.target.value || undefined })}
            className='w-full sm:w-40'
          />
        </ListToolbar>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(entry) => entry.id}
          loading={fuel.isFetching}
          error={fuel.isError ? fuel.error.message : null}
          onRetry={() => fuel.refetch()}
          onRowClick={canManage ? openEdit : undefined}
          sort={{ sort, order: search.order ?? 'desc' }}
          onSortChange={(next) => setSearch(next as Partial<MaintenanceSearch>)}
          empty={{
            icon: filtered ? CircleOff : Fuel,
            title: filtered ? 'No fuel entries match these filters' : 'No fuel entries yet',
            description: filtered
              ? 'Try another bus or dates, or clear the filters.'
              : 'Log each fill from the fuel bill to track spend and mileage.',
            action: !filtered && canManage && (
              <Button onClick={() => onAddingChange(true)}>
                <Plus />
                Add fuel entry
              </Button>
            ),
          }}
          card={(entry) => (
            <div className='grid gap-1.5'>
              <div className='flex items-start justify-between gap-2'>
                <div className='grid min-w-0'>
                  <span className='font-bold'>{formatDate(entry.filled_on)}</span>
                  <span className='truncate text-xs text-muted-foreground'>
                    {entry.vehicle.name} · {entry.vehicle.registration_no}
                  </span>
                </div>
                <span className='tabular font-bold'>{rupees(entry.amount)}</span>
              </div>
              <div className='tabular grid grid-cols-3 gap-2 text-xs'>
                <span>{formatNumber(entry.litres, 1, 'L')}</span>
                <span>{formatNumber(entry.km_per_litre, 2, 'km/l')}</span>
                <span>{formatNumber(entry.odometer_km, 0, 'km')}</span>
              </div>
              <span className='truncate text-xs text-muted-foreground'>
                {[entry.station, entry.filled_by?.name, entry.bill_file ? 'Bill attached' : null]
                  .filter(Boolean)
                  .join(' · ') || 'No station or bill'}
              </span>
            </div>
          )}
          pagination={{
            page: search.page,
            limit: LIMIT,
            total: fuel.data?.total ?? 0,
            label: 'entries',
            onPageChange,
          }}
        />
      </Card>
      <FuelFormModal
        open={adding || editOpen}
        onOpenChange={(open) => {
          if (open) return
          onAddingChange(false)
          setEditOpen(false)
        }}
        entry={editing}
        defaultVehicleId={search.vehicle_id}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title='Delete this fuel entry?'
        description={
          deleting
            ? `${formatDate(deleting.filled_on)} · ${deleting.vehicle.name} · ${formatNumber(deleting.litres, 1)} L for ${rupees(deleting.amount)}. Mileage of the next fill is worked out again.`
            : ''
        }
        confirmText='Delete entry'
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            alerts.success('Fuel entry deleted')
            setDeleting(null)
          } catch (error) {
            alerts.error(toApiError(error).message)
          }
        }}
      />
    </>
  )
}
