import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  BellRing,
  CircleOff,
  Inbox,
  MessageSquareText,
  Send,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/common/data-table'
import { InsightCards, type Insight } from '@/components/common/insight-cards'
import { FilterSelect, ListToolbar, SearchBox } from '@/components/common/list-toolbar'
import { Page, PageHeader } from '@/components/common/page'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { can, useMe } from '@/features/auth/api'
import { useNow } from '@/hooks/use-now'
import { formatDateTime, timeAgo } from '@/lib/format'
import {
  useOutbox,
  useOutboxInsights,
  type Channel,
  type NotificationStatus,
  type OutboxItem,
} from '../api'
import { SendTestModal } from '../components/send-test-modal'
import type { OutboxSearch } from '../search'

const route = getRouteApi('/_app/notifications')
const LIMIT = 20

const CHANNELS: Record<Channel, { label: string; icon: LucideIcon }> = {
  in_app: { label: 'In-app', icon: Inbox },
  push: { label: 'Push', icon: Smartphone },
  sms: { label: 'SMS', icon: MessageSquareText },
}

const STATUS: Record<NotificationStatus, { label: string; tone: BadgeTone }> = {
  queued: { label: 'Queued', tone: 'info' },
  sent: { label: 'Sent', tone: 'success' },
  delivered: { label: 'Delivered', tone: 'success' },
  read: { label: 'Read', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Not sent', tone: 'warning' },
}

function ChannelLabel({ channel }: { channel: Channel }) {
  const Icon = CHANNELS[channel].icon
  return (
    <span className='inline-flex items-center gap-1.5 text-sm font-medium'>
      <Icon className='size-4 text-muted-foreground' />
      {CHANNELS[channel].label}
    </span>
  )
}

function StatusBadge({ status }: { status: NotificationStatus }) {
  return (
    <Badge tone={STATUS[status].tone} dot pulse={status === 'queued'}>
      {STATUS[status].label}
    </Badge>
  )
}

export function NotificationsPage() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/notifications' })
  const now = useNow(15_000)
  const me = useMe().data
  const [testOpen, setTestOpen] = useState(false)
  const outbox = useOutbox({ ...search, limit: LIMIT })
  const insights = useOutboxInsights()
  const rows = outbox.data?.items ?? []

  const setSearch = (patch: Partial<OutboxSearch>) =>
    navigate({ search: (prev) => ({ ...prev, page: 1, ...patch }), replace: true })

  const pick = (channel: Channel, status?: NotificationStatus) => {
    const active = search.channel === channel && search.status === status
    setSearch(active ? { channel: undefined, status: undefined } : { channel, status })
  }

  useShortcut('app.refresh', () => {
    void outbox.refetch()
    void insights.refetch()
  })

  const data = insights.data
  const cards: Insight[] = [
    {
      key: 'all',
      label: 'Messages, last 24 hours',
      value: data?.last_24h ?? 0,
      hint: 'In-app, push and SMS together',
      icon: BellRing,
      tone: 'primary',
      active: !search.channel && !search.status,
      onClick: () => setSearch({ channel: undefined, status: undefined }),
    },
    {
      key: 'push',
      label: 'Push delivered',
      value: data?.push.sent ?? 0,
      hint: `${(data?.push.skipped ?? 0) + (data?.push.failed ?? 0)} did not reach a phone`,
      icon: Smartphone,
      tone: 'success',
      active: search.channel === 'push' && search.status === 'sent',
      onClick: () => pick('push', 'sent'),
    },
    {
      key: 'sms',
      label: 'SMS not sent',
      value: (data?.sms.skipped ?? 0) + (data?.sms.failed ?? 0),
      hint: `${data?.sms.sent ?? 0} SMS sent`,
      icon: MessageSquareText,
      tone: 'warning',
      active: search.channel === 'sms' && search.status === 'skipped',
      onClick: () => pick('sms', 'skipped'),
    },
    {
      key: 'unread',
      label: 'Unread in the app',
      value: data?.unread_in_app ?? 0,
      hint: 'Waiting in notification centres',
      icon: Inbox,
      tone: 'info',
      active: search.channel === 'in_app' && search.status === 'delivered',
      onClick: () => pick('in_app', 'delivered'),
    },
  ]

  const columns: Column<OutboxItem>[] = [
    {
      key: 'message',
      header: 'Message',
      cell: (item) => (
        <div className='grid max-w-md min-w-0 gap-0.5'>
          <span className='truncate font-bold'>{item.title}</span>
          <span className='line-clamp-1 text-xs text-muted-foreground'>{item.body}</span>
        </div>
      ),
    },
    {
      key: 'recipient',
      header: 'Recipient',
      cell: (item) => (
        <div className='grid'>
          <span className='font-medium'>{item.user?.name ?? 'Unknown'}</span>
          <span className='tabular text-xs text-muted-foreground'>
            {item.recipient ?? item.user?.mobile}
          </span>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      sortKey: 'channel',
      cell: (item) => <ChannelLabel channel={item.channel} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      cell: (item) => (
        <div className='grid justify-items-start gap-1'>
          <StatusBadge status={item.status} />
          {item.error && (
            <span
              className='max-w-56 truncate text-[11px] text-muted-foreground'
              title={item.error}
            >
              {item.error}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'template',
      header: 'Template',
      hideBelow: 'xl',
      cell: (item) => (
        <span className='font-mono text-xs text-muted-foreground'>{item.template_code ?? '—'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortKey: 'created_at',
      hideBelow: 'lg',
      cell: (item) => (
        <span className='text-muted-foreground' title={formatDateTime(item.created_at)}>
          {timeAgo(item.created_at, now)}
        </span>
      ),
    },
  ]

  const filtered = Boolean(search.search || search.channel || search.status)

  return (
    <Page>
      <PageHeader
        eyebrow='Communication'
        title='Notifications'
        description='Every message the school sends, on every channel, with its delivery status. SMS that are waiting for DLT approval show here as not sent.'
        actions={
          can(me, 'notifications.send') && (
            <Button onClick={() => setTestOpen(true)}>
              <Send />
              Send test
            </Button>
          )
        }
      />

      <InsightCards items={cards} loading={insights.isPending} />

      <Card className='overflow-hidden'>
        <ListToolbar
          summary={outbox.data ? `${outbox.data.total} messages` : ''}
          onClear={filtered ? () => navigate({ search: { page: 1 }, replace: true }) : undefined}
        >
          <SearchBox
            value={search.search ?? ''}
            onChange={(value) => setSearch({ search: value || undefined })}
            placeholder='Search message, name or number'
            label='Search notifications'
          />
          <FilterSelect
            id='channel-filter'
            label='Filter by channel'
            allLabel='All channels'
            value={search.channel}
            options={Object.entries(CHANNELS).map(([value, item]) => ({
              value,
              label: item.label,
            }))}
            onChange={(channel) => setSearch({ channel: channel as Channel | undefined })}
          />
          <FilterSelect
            id='status-filter'
            label='Filter by status'
            allLabel='All statuses'
            value={search.status}
            options={Object.entries(STATUS).map(([value, item]) => ({ value, label: item.label }))}
            onChange={(status) => setSearch({ status: status as NotificationStatus | undefined })}
          />
        </ListToolbar>

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(item) => item.id}
          loading={outbox.isFetching && !outbox.data}
          error={outbox.isError ? outbox.error.message : null}
          onRetry={() => outbox.refetch()}
          sort={{ sort: search.sort, order: search.order ?? 'desc' }}
          onSortChange={(next) => setSearch(next as Partial<OutboxSearch>)}
          empty={{
            icon: filtered ? CircleOff : BellRing,
            title: filtered ? 'No messages match these filters' : 'Nothing sent yet',
            description: filtered
              ? 'Try another search or clear the filters.'
              : 'Send a test notification to see the delivery pipeline at work.',
          }}
          card={(item) => (
            <div className='grid gap-2'>
              <div className='flex items-start justify-between gap-3'>
                <span className='font-bold'>{item.title}</span>
                <StatusBadge status={item.status} />
              </div>
              <p className='line-clamp-2 text-sm text-muted-foreground'>{item.body}</p>
              <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                <ChannelLabel channel={item.channel} />
                <span>{item.user?.name}</span>
                <span>{timeAgo(item.created_at, now)}</span>
              </div>
              {item.error && <p className='text-xs text-muted-foreground'>{item.error}</p>}
            </div>
          )}
          pagination={{
            page: search.page,
            limit: LIMIT,
            total: outbox.data?.total ?? 0,
            label: 'messages',
            onPageChange: (page) => navigate({ search: (prev) => ({ ...prev, page }) }),
          }}
        />
      </Card>

      <SendTestModal open={testOpen} onOpenChange={setTestOpen} />
    </Page>
  )
}
