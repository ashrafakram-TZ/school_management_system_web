import { useState, type ReactNode } from 'react'
import { BookOpenCheck, Check, CheckCheck, Eye, EyeOff, Paperclip, Undo2 } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Avatar } from '@/components/common/avatar'
import { ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
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
import { formatDate, formatDateTime } from '@/lib/format'
import { diaryApi, useDiaryAction, useDiaryEntry, type DiaryDetail } from '../api'
import { DIARY_STATUS, DIARY_TYPE } from '../labels'

type ReasonAction = 'reject' | 'hide'

export function DiarySheet({
  entryId,
  canModerate,
  onClose,
}: {
  entryId: number | null
  canModerate: boolean
  onClose: () => void
}) {
  const [shownId, setShownId] = useState(entryId)
  if (entryId && entryId !== shownId) setShownId(entryId)
  const entry = useDiaryEntry(shownId)
  const data = entry.data
  const [reason, setReason] = useState<ReasonAction | null>(null)
  const approve = useDiaryAction((id: number) => diaryApi.approve(id))
  const restore = useDiaryAction((id: number) => diaryApi.restore(id))

  const act = async (run: () => Promise<unknown>, message: string) => {
    try {
      await run()
      alerts.success(message)
    } catch (error) {
      alerts.error(toApiError(error).message)
    }
  }

  return (
    <Sheet open={Boolean(entryId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {entry.isError && !data ? (
          <ErrorState message={entry.error.message} onRetry={() => entry.refetch()} />
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
                  <BookOpenCheck className='size-5' />
                </span>
                <div className='grid min-w-0 gap-0.5'>
                  <SheetTitle className='truncate'>{data.title}</SheetTitle>
                  <SheetDescription>
                    {data.author.name} · to {data.target_label}
                  </SheetDescription>
                  <div className='mt-1 flex flex-wrap gap-1.5'>
                    <Badge tone={DIARY_STATUS[data.status].tone} dot>
                      {DIARY_STATUS[data.status].label}
                    </Badge>
                    <Badge tone={DIARY_TYPE[data.type].tone}>{DIARY_TYPE[data.type].label}</Badge>
                    {data.subject && <Badge tone='neutral'>{data.subject.name}</Badge>}
                  </div>
                </div>
              </div>
            </SheetHeader>
            <SheetBody className='grid content-start gap-6'>
              {canModerate && (
                <Actions
                  data={data}
                  onReason={setReason}
                  approve={approve}
                  restore={restore}
                  act={act}
                />
              )}

              <Block title='Message'>
                <p className='rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-line'>
                  {data.body}
                </p>
                {data.due_date && (
                  <p className='text-sm'>
                    Due on <span className='font-semibold'>{formatDate(data.due_date)}</span>
                  </p>
                )}
                {data.attachments.length > 0 && (
                  <ul className='grid gap-1.5'>
                    {data.attachments.map((file) => (
                      <li key={file.id}>
                        <a
                          href={file.url}
                          target='_blank'
                          rel='noreferrer'
                          className='inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline'
                        >
                          <Paperclip className='size-4' />
                          {file.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>

              <Block title='Review'>
                <dl className='grid gap-x-6 gap-y-3 rounded-lg border p-3 sm:grid-cols-2'>
                  {[
                    ['Posted', formatDateTime(data.created_at)],
                    ['Published', formatDateTime(data.published_at)],
                    ['Reviewed by', data.review.by?.name ?? '—'],
                    ['Reviewed', formatDateTime(data.review.at)],
                    ['Note', data.review.note ?? '—'],
                    ['Academic year', data.academic_year.name],
                  ].map(([label, value]) => (
                    <div key={label} className='grid gap-0.5'>
                      <dt className='text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
                        {label}
                      </dt>
                      <dd className='text-sm font-semibold break-words'>{value}</dd>
                    </div>
                  ))}
                </dl>
              </Block>

              <Block title={`Seen by parents · ${data.seen_count} of ${data.recipient_count}`}>
                <ul className='grid gap-2'>
                  {data.recipients.map((row) => (
                    <li
                      key={row.student.id}
                      className='flex items-center gap-3 rounded-lg border p-3'
                    >
                      <Avatar name={row.student.name} size='sm' />
                      <span className='grid min-w-0 flex-1'>
                        <span className='truncate font-semibold'>{row.student.name}</span>
                        <span className='text-xs text-muted-foreground'>
                          {row.class_section ?? 'Not placed'}
                        </span>
                      </span>
                      {row.seen_at ? (
                        <Badge tone='success' dot>
                          <CheckCheck className='size-3' />
                          {row.seen_by?.name ?? 'Seen'} · {formatDateTime(row.seen_at)}
                        </Badge>
                      ) : (
                        <Badge tone='neutral'>Not seen</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </Block>
            </SheetBody>
            {reason && (
              <ReasonModal
                action={reason}
                entry={data}
                onOpenChange={(open) => !open && setReason(null)}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Actions({
  data,
  onReason,
  approve,
  restore,
  act,
}: {
  data: DiaryDetail
  onReason: (action: ReasonAction) => void
  approve: ReturnType<typeof useDiaryAction<number>>
  restore: ReturnType<typeof useDiaryAction<number>>
  act: (run: () => Promise<unknown>, message: string) => Promise<void>
}) {
  if (data.status === 'rejected') return null
  return (
    <div className='flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3'>
      {data.status === 'pending_review' && (
        <>
          <Button
            size='sm'
            loading={approve.isPending}
            onClick={() => act(() => approve.mutateAsync(data.id), 'Published to parents')}
          >
            <Check />
            Approve and publish
          </Button>
          <Button size='sm' variant='outline' onClick={() => onReason('reject')}>
            <Undo2 />
            Send back
          </Button>
        </>
      )}
      {data.status === 'published' && (
        <Button size='sm' variant='outline' onClick={() => onReason('hide')}>
          <EyeOff />
          Hide from parents
        </Button>
      )}
      {data.status === 'hidden' && (
        <Button
          size='sm'
          variant='outline'
          loading={restore.isPending}
          onClick={() => act(() => restore.mutateAsync(data.id), 'Shown to parents again')}
        >
          <Eye />
          Show again
        </Button>
      )}
    </div>
  )
}

function ReasonModal({
  action,
  entry,
  onOpenChange,
}: {
  action: ReasonAction
  entry: DiaryDetail
  onOpenChange: (open: boolean) => void
}) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const save = useDiaryAction((text: string) =>
    action === 'reject' ? diaryApi.reject(entry.id, text) : diaryApi.hide(entry.id, text || null)
  )
  const reject = action === 'reject'

  return (
    <AppModal
      open
      onOpenChange={onOpenChange}
      title={reject ? 'Send back to the teacher' : 'Hide from parents'}
      description={
        reject
          ? `${entry.author.name} gets your reason and can edit the post.`
          : 'The post leaves the parent feed. You can show it again later.'
      }
      formId='diary-reason-form'
      submitText={reject ? 'Send back' : 'Hide'}
      loading={save.isPending}
    >
      <form
        id='diary-reason-form'
        noValidate
        className='grid gap-3'
        onSubmit={async (event) => {
          event.preventDefault()
          if (reject && !note.trim()) return setError('Give the teacher a reason')
          try {
            await save.mutateAsync(note.trim())
            alerts.success(reject ? 'Sent back to the teacher' : 'Hidden from parents')
            onOpenChange(false)
          } catch (caught) {
            const apiError = toApiError(caught)
            setError(apiError.fieldErrors[0]?.message ?? apiError.message)
          }
        }}
      >
        <FormField
          id='diary-reason'
          label={reject ? 'Reason' : 'Note (optional)'}
          required={reject}
          error={error}
        >
          <Textarea
            id='diary-reason'
            value={note}
            maxLength={255}
            placeholder={
              reject ? 'For example: please write this more kindly' : 'For example: posted twice'
            }
            onChange={(event) => {
              setNote(event.target.value)
              setError('')
            }}
          />
        </FormField>
      </form>
    </AppModal>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='grid gap-3'>
      <h3 className='text-xs font-bold tracking-wider text-muted-foreground uppercase'>{title}</h3>
      {children}
    </section>
  )
}
