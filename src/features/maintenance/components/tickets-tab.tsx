import { useState } from 'react'
import {
  CheckCircle2,
  CircleDot,
  CircleOff,
  Cpu,
  IndianRupee,
  Pencil,
  Plus,
  Timer,
  Wrench,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/common/data-table'
import { InsightCards, type Insight } from '@/components/common/insight-cards'
import { FilterSelect, ListToolbar, SearchBox } from '@/components/common/list-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SEVERITY } from '@/features/fleet/labels'
import { useBusOptions } from '@/features/transport/api'
import { formatDate, formatNumber } from '@/lib/format'
import { useTicketInsights, useTickets, type Ticket, type TicketListParams } from '../api'
import {
  TICKET_SOURCE,
  TICKET_SOURCE_OPTIONS,
  TICKET_STATUS,
  TICKET_STATUS_OPTIONS,
  rupees,
} from '../labels'
import type { MaintenanceSearch } from '../search'
import { CloseTicketModal } from './close-ticket-modal'
import { TicketFormModal } from './ticket-form-modal'

const LIMIT = 20
const SORTS = ['opened_at', 'closed_at', 'cost', 'status'] as const

interface TicketsTabProps {
  search: MaintenanceSearch
  setSearch: (patch: Partial<MaintenanceSearch>) => void
  onPageChange: (page: number) => void
  onClear: () => void
  canManage: boolean
  adding: boolean
  onAddingChange: (open: boolean) => void
}

function TicketBadges({ ticket }: { ticket: Ticket }) {
  return (
    <span className='flex flex-wrap gap-1'>
      <Badge tone={TICKET_SOURCE[ticket.source].tone}>{TICKET_SOURCE[ticket.source].label}</Badge>
      {ticket.severity && (
        <Badge tone={SEVERITY[ticket.severity].tone}>{SEVERITY[ticket.severity].label}</Badge>
      )}
    </span>
  )
}

function StatusBadge({ ticket }: { ticket: Ticket }) {
  const status = TICKET_STATUS[ticket.status]
  return (
    <Badge tone={status.tone} dot>
      {status.label}
    </Badge>
  )
}

export function TicketsTab({
  search,
  setSearch,
  onPageChange,
  onClear,
  canManage,
  adding,
  onAddingChange,
}: TicketsTabProps) {
  const busOptions = useBusOptions()
  const [editing, setEditing] = useState<Ticket | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [closing, setClosing] = useState<Ticket | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  if (adding && !editOpen && editing) setEditing(null)

  const openEdit = (ticket: Ticket) => {
    setEditing(ticket)
    setEditOpen(true)
  }
  const sort = SORTS.find((item) => item === search.sort)
  const params: TicketListParams = {
    page: search.page,
    limit: LIMIT,
    search: search.search,
    sort,
    order: sort ? search.order : undefined,
    status: search.status,
    source: search.source,
    vehicle_id: search.vehicle_id,
  }
  const tickets = useTickets(params)
  const insights = useTicketInsights(search.vehicle_id)
  const data = insights.data
  const rows = tickets.data?.items ?? []

  const only = (patch: Partial<MaintenanceSearch>) => {
    const active = Object.entries(patch).every(
      ([key, value]) => search[key as keyof MaintenanceSearch] === value
    )
    const cleared = { status: undefined, source: undefined }
    setSearch(active ? cleared : { ...cleared, ...patch })
  }

  const cards: Insight[] = [
    {
      key: 'open',
      label: 'Open',
      value: data?.open ?? 0,
      hint: `${data?.total ?? 0} tickets in all`,
      icon: CircleDot,
      tone: 'danger',
      active: search.status === 'open' && !search.source,
      onClick: () => only({ status: 'open', source: undefined }),
    },
    {
      key: 'in_progress',
      label: 'In progress',
      value: data?.in_progress ?? 0,
      hint: 'At the garage',
      icon: Timer,
      tone: 'warning',
      active: search.status === 'in_progress' && !search.source,
      onClick: () => only({ status: 'in_progress', source: undefined }),
    },
    {
      key: 'done',
      label: 'Done',
      value: data?.done ?? 0,
      hint: 'Closed tickets',
      icon: CheckCircle2,
      tone: 'success',
      active: search.status === 'done' && !search.source,
      onClick: () => only({ status: 'done', source: undefined }),
    },
    {
      key: 'obd',
      label: 'From OBD (open)',
      value: data?.obd_open ?? 0,
      hint: 'Raised by engine fault codes',
      icon: Cpu,
      tone: 'info',
      active: search.status === 'open' && search.source === 'obd',
      onClick: () => only({ status: 'open', source: 'obd' }),
    },
    {
      key: 'cost',
      label: 'Cost this month',
      value: rupees(data?.cost_this_month ?? 0),
      hint: 'Closed this month',
      icon: IndianRupee,
      tone: 'primary',
    },
  ]

  const actions = (ticket: Ticket) =>
    canManage && (
      <div className='inline-flex gap-1'>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={`Edit ${ticket.title}`}
          onClick={(event) => {
            event.stopPropagation()
            openEdit(ticket)
          }}
        >
          <Pencil />
        </Button>
        {ticket.status !== 'done' && (
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={`Close ${ticket.title}`}
            title='Close ticket'
            className='text-success hover:bg-success/10'
            onClick={(event) => {
              event.stopPropagation()
              setClosing(ticket)
              setCloseOpen(true)
            }}
          >
            <CheckCircle2 />
          </Button>
        )}
      </div>
    )

  const columns: Column<Ticket>[] = [
    {
      key: 'title',
      header: 'Ticket',
      cell: (ticket) => (
        <div className='grid min-w-0 gap-1'>
          <span className='flex flex-wrap items-center gap-1.5'>
            <span className='font-bold'>{ticket.title}</span>
            {ticket.fault_code && (
              <span className='font-mono text-xs font-semibold text-destructive'>
                {ticket.fault_code}
              </span>
            )}
          </span>
          {ticket.description && (
            <span className='line-clamp-1 text-xs text-muted-foreground'>{ticket.description}</span>
          )}
        </div>
      ),
    },
    {
      key: 'bus',
      header: 'Bus',
      cell: (ticket) => (
        <div className='grid'>
          <span className='font-semibold'>{ticket.vehicle.name}</span>
          <span className='font-mono text-xs text-muted-foreground'>
            {ticket.vehicle.registration_no}
          </span>
        </div>
      ),
    },
    { key: 'source', header: 'Source', cell: (ticket) => <TicketBadges ticket={ticket} /> },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      cell: (ticket) => <StatusBadge ticket={ticket} />,
    },
    {
      key: 'opened_at',
      header: 'Opened',
      sortKey: 'opened_at',
      cell: (ticket) => <span className='tabular'>{formatDate(ticket.opened_at)}</span>,
    },
    {
      key: 'closed_at',
      header: 'Closed',
      sortKey: 'closed_at',
      hideBelow: 'xl',
      cell: (ticket) => <span className='tabular'>{formatDate(ticket.closed_at)}</span>,
    },
    {
      key: 'cost',
      header: 'Cost',
      sortKey: 'cost',
      hideBelow: 'lg',
      cell: (ticket) => (
        <div className='grid'>
          <span className='tabular font-semibold'>{rupees(ticket.cost)}</span>
          {ticket.vendor && (
            <span className='truncate text-xs text-muted-foreground'>{ticket.vendor}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className='sr-only'>Actions</span>,
      align: 'right',
      className: 'w-24',
      cell: actions,
    },
  ]

  const filtered = Boolean(search.search || search.status || search.source || search.vehicle_id)

  return (
    <>
      <InsightCards items={cards} loading={insights.isPending} />
      <Card className='overflow-hidden'>
        <ListToolbar
          summary={
            tickets.data
              ? `${tickets.data.total} ${tickets.data.total === 1 ? 'ticket' : 'tickets'}`
              : ''
          }
          onClear={filtered ? onClear : undefined}
        >
          <SearchBox
            value={search.search ?? ''}
            onChange={(value) => setSearch({ search: value || undefined })}
            placeholder='Search title, fault code or vendor'
            label='Search tickets'
          />
          <FilterSelect
            id='ticket-status-filter'
            label='Filter by status'
            allLabel='All statuses'
            value={search.status}
            options={TICKET_STATUS_OPTIONS}
            onChange={(value) => setSearch({ status: value as MaintenanceSearch['status'] })}
          />
          <FilterSelect
            id='ticket-source-filter'
            label='Filter by source'
            allLabel='All sources'
            value={search.source}
            options={TICKET_SOURCE_OPTIONS}
            onChange={(value) => setSearch({ source: value as MaintenanceSearch['source'] })}
          />
          <FilterSelect
            id='ticket-bus-filter'
            label='Filter by bus'
            allLabel='All buses'
            value={search.vehicle_id ? String(search.vehicle_id) : undefined}
            options={busOptions}
            onChange={(value) => setSearch({ vehicle_id: value ? Number(value) : undefined })}
          />
        </ListToolbar>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(ticket) => ticket.id}
          loading={tickets.isFetching}
          error={tickets.isError ? tickets.error.message : null}
          onRetry={() => tickets.refetch()}
          onRowClick={canManage ? openEdit : undefined}
          sort={{ sort, order: search.order ?? 'desc' }}
          onSortChange={(next) => setSearch(next as Partial<MaintenanceSearch>)}
          empty={{
            icon: filtered ? CircleOff : Wrench,
            title: filtered ? 'No tickets match these filters' : 'No maintenance tickets yet',
            description: filtered
              ? 'Try another bus or status, or clear the filters.'
              : 'Tickets are raised automatically from engine fault codes, or you can add one by hand.',
            action: !filtered && canManage && (
              <Button onClick={() => onAddingChange(true)}>
                <Plus />
                Add ticket
              </Button>
            ),
          }}
          card={(ticket) => (
            <div className='grid gap-1.5'>
              <div className='flex items-start justify-between gap-2'>
                <div className='grid min-w-0'>
                  <span className='font-bold'>{ticket.title}</span>
                  <span className='truncate text-xs text-muted-foreground'>
                    {ticket.vehicle.name} · {ticket.vehicle.registration_no}
                    {ticket.fault_code ? ` · ${ticket.fault_code}` : ''}
                  </span>
                </div>
                <StatusBadge ticket={ticket} />
              </div>
              <TicketBadges ticket={ticket} />
              <span className='tabular text-xs text-muted-foreground'>
                Opened {formatDate(ticket.opened_at)}
                {ticket.closed_at ? ` · closed ${formatDate(ticket.closed_at)}` : ''}
                {ticket.cost !== null ? ` · ${rupees(ticket.cost)}` : ''}
                {ticket.odometer_km !== null
                  ? ` · ${formatNumber(ticket.odometer_km, 0, 'km')}`
                  : ''}
              </span>
              {canManage && ticket.status !== 'done' && (
                <span className='text-xs font-semibold text-primary'>
                  Tap to edit or change the status
                </span>
              )}
            </div>
          )}
          pagination={{
            page: search.page,
            limit: LIMIT,
            total: tickets.data?.total ?? 0,
            label: 'tickets',
            onPageChange,
          }}
        />
      </Card>
      <TicketFormModal
        open={adding || editOpen}
        onOpenChange={(open) => {
          if (open) return
          onAddingChange(false)
          setEditOpen(false)
        }}
        ticket={editing}
        defaultVehicleId={search.vehicle_id}
      />
      <CloseTicketModal ticket={closing} open={closeOpen} onOpenChange={setCloseOpen} />
    </>
  )
}
