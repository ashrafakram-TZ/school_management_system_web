import { useState, type ReactNode } from 'react'
import { Archive, Megaphone, Pencil, Send, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState } from '@/components/common/display'
import { SegmentedControl } from '@/components/common/segmented-control'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { formatDateTime } from '@/lib/format'
import {
  announcementsApi,
  useAnnouncement,
  useAnnouncementAction,
  useAnnouncementReaders,
  type Announcement,
} from '../api'
import { ANNOUNCEMENT_STATUS } from '../labels'

export function AnnouncementSheet({
  announcementId,
  canManage,
  onEdit,
  onClose,
}: {
  announcementId: number | null
  canManage: boolean
  onEdit: (announcement: Announcement) => void
  onClose: () => void
}) {
  const [shownId, setShownId] = useState(announcementId)
  if (announcementId && announcementId !== shownId) setShownId(announcementId)
  const announcement = useAnnouncement(shownId)
  const data = announcement.data
  const [state, setState] = useState<'read' | 'unread'>('read')
  const sent = data?.status === 'published' || data?.status === 'archived'
  const readers = useAnnouncementReaders(sent ? shownId : null, state)
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const publish = useAnnouncementAction((id: number) => announcementsApi.publish(id))
  const archive = useAnnouncementAction((id: number) => announcementsApi.archive(id))
  const remove = useAnnouncementAction((id: number) => announcementsApi.remove(id))

  const run = async (action: () => Promise<unknown>, message: string, close = false) => {
    try {
      await action()
      alerts.success(message)
      setConfirm(null)
      if (close) onClose()
    } catch (error) {
      alerts.error(toApiError(error).message)
    }
  }

  return (
    <Sheet open={Boolean(announcementId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {announcement.isError && !data ? (
          <ErrorState message={announcement.error.message} onRetry={() => announcement.refetch()} />
        ) : !data ? (
          <div className='grid gap-4 p-6'>
            <Skeleton className='h-16' />
            <Skeleton className='h-48' />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className='flex items-center gap-3'>
                <span className='grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary'>
                  <Megaphone className='size-5' />
                </span>
                <div className='grid min-w-0 gap-0.5'>
                  <SheetTitle className='break-words'>{data.title}</SheetTitle>
                  <SheetDescription>{data.audience_label}</SheetDescription>
                  <div className='mt-1 flex flex-wrap gap-1.5'>
                    <Badge tone={ANNOUNCEMENT_STATUS[data.status].tone} dot>
                      {ANNOUNCEMENT_STATUS[data.status].label}
                    </Badge>
                    {data.priority === 'urgent' && <Badge tone='danger'>Urgent</Badge>}
                  </div>
                </div>
              </div>
            </SheetHeader>
            <SheetBody className='grid content-start gap-6'>
              {canManage && data.status !== 'archived' && (
                <div className='flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3'>
                  {(data.status === 'draft' || data.status === 'scheduled') && (
                    <>
                      <Button
                        size='sm'
                        loading={publish.isPending}
                        onClick={() => run(() => publish.mutateAsync(data.id), 'Announcement sent')}
                      >
                        <Send />
                        Send now
                      </Button>
                      <Button size='sm' variant='outline' onClick={() => onEdit(data)}>
                        <Pencil />
                        Edit
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='text-destructive'
                        onClick={() => setConfirm('delete')}
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </>
                  )}
                  {data.status === 'published' && (
                    <Button size='sm' variant='outline' onClick={() => setConfirm('archive')}>
                      <Archive />
                      Archive
                    </Button>
                  )}
                </div>
              )}

              <Block title='Announcement'>
                <p className='rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-line'>
                  {data.body}
                </p>
              </Block>

              <Block title='Delivery'>
                <dl className='grid gap-x-6 gap-y-3 rounded-lg border p-3 sm:grid-cols-2'>
                  {[
                    ['Written by', data.author.name],
                    ['Saved', formatDateTime(data.created_at)],
                    ['Send at', formatDateTime(data.publish_at)],
                    ['Sent', formatDateTime(data.published_at)],
                    ['Leaves the feed', formatDateTime(data.expires_at)],
                    ['Academic year', data.academic_year.name],
                    ['Recipients', String(data.recipient_count)],
                    ['Read', `${data.read_count} (${data.read_percent}%)`],
                  ].map(([label, value]) => (
                    <div key={label} className='grid gap-0.5'>
                      <dt className='text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
                        {label}
                      </dt>
                      <dd className='text-sm font-semibold break-words'>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div
                  className='h-2 overflow-hidden rounded-full bg-muted'
                  role='progressbar'
                  aria-label='Read'
                  aria-valuenow={data.read_percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className='h-full rounded-full bg-primary'
                    style={{ width: `${data.read_percent}%` }}
                  />
                </div>
              </Block>

              {sent && (
                <Block
                  title='Recipients'
                  action={
                    <SegmentedControl
                      label='Show read or unread'
                      value={state}
                      onChange={setState}
                      options={[
                        { value: 'read', label: 'Read' },
                        { value: 'unread', label: 'Not read' },
                      ]}
                    />
                  }
                >
                  {readers.isPending ? (
                    <Skeleton className='h-24' />
                  ) : (readers.data?.items.length ?? 0) === 0 ? (
                    <p className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
                      {state === 'read' ? 'Nobody has read it yet.' : 'Everyone has read it.'}
                    </p>
                  ) : (
                    <ul className='grid gap-2'>
                      {readers.data?.items.map((row) => (
                        <li
                          key={row.user.id}
                          className='flex items-center justify-between gap-3 rounded-lg border p-3'
                        >
                          <span className='grid min-w-0'>
                            <span className='truncate font-semibold'>{row.user.name}</span>
                            <span className='tabular text-xs text-muted-foreground'>
                              {row.segment === 'parent' ? 'Parent' : 'Staff'} · +91 {row.mobile}
                            </span>
                          </span>
                          <span className='tabular text-xs text-muted-foreground'>
                            {row.read_at ? formatDateTime(row.read_at) : 'Not read'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(readers.data?.total ?? 0) > (readers.data?.items.length ?? 0) && (
                    <p className='text-xs text-muted-foreground'>
                      Showing {readers.data?.items.length} of {readers.data?.total}.
                    </p>
                  )}
                </Block>
              )}
            </SheetBody>
            <ConfirmDialog
              open={confirm !== null}
              onOpenChange={(open) => !open && setConfirm(null)}
              title={
                confirm === 'delete' ? 'Delete this announcement?' : 'Archive this announcement?'
              }
              description={
                confirm === 'delete'
                  ? 'It has not been sent, so nobody will notice.'
                  : 'It leaves every feed. The read counts stay here.'
              }
              confirmText={confirm === 'delete' ? 'Delete' : 'Archive'}
              destructive={confirm === 'delete'}
              loading={archive.isPending || remove.isPending}
              onConfirm={() =>
                confirm === 'delete'
                  ? run(() => remove.mutateAsync(data.id), 'Announcement deleted', true)
                  : run(() => archive.mutateAsync(data.id), 'Announcement archived')
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Block({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className='grid gap-3'>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='text-xs font-bold tracking-wider text-muted-foreground uppercase'>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}
