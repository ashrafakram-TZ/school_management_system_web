import { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Avatar } from '@/components/common/avatar'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounce'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import { RoleBadges } from '@/features/users/components/role-badges'
import { useUsers, type UserListItem } from '@/features/users/api'
import { useSendTest } from '../api'

const FORM_ID = 'send-test-form'

export function SendTestModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<UserListItem | null>(null)
  const search = useDebouncedValue(query.trim(), 300)
  const users = useUsers({ page: 1, limit: 6, search: search || undefined, status: 'active' })
  const send = useSendTest()

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setQuery('')
      setSelected(null)
    }
  }

  return (
    <AppModal
      open={open}
      onOpenChange={close}
      title='Send a test notification'
      description='Goes through the real pipeline: in-app, push to registered phones, and SMS if push does not reach them.'
      formId={FORM_ID}
      submitText='Send test'
      loading={send.isPending}
    >
      <form
        id={FORM_ID}
        noValidate
        className='grid gap-3'
        onSubmit={async (event) => {
          event.preventDefault()
          if (!selected) {
            alerts.warning('Choose who should receive the test')
            return
          }
          try {
            await send.mutateAsync(selected.id)
            alerts.success(`Test sent to ${selected.name}`, {
              description: 'Delivery status appears in the outbox within a few seconds.',
            })
            close(false)
          } catch (error) {
            alerts.error(toApiError(error).message)
          }
        }}
      >
        <div className='relative'>
          <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            autoFocus
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search name or mobile'
            aria-label='Search recipient'
            className='pl-9'
          />
        </div>
        <div className='grid max-h-80 gap-1 overflow-y-auto' role='listbox' aria-label='Recipients'>
          {users.isPending ? (
            Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className='h-14' />)
          ) : (users.data?.items ?? []).length === 0 ? (
            <p className='py-6 text-center text-sm text-muted-foreground'>
              No active user matches.
            </p>
          ) : (
            users.data?.items.map((user) => {
              const active = selected?.id === user.id
              return (
                <button
                  key={user.id}
                  type='button'
                  role='option'
                  aria-selected={active}
                  onClick={() => setSelected(user)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
                    active ? 'border-primary/60 bg-primary/5' : 'border-transparent hover:bg-muted'
                  )}
                >
                  <Avatar name={user.name} size='sm' />
                  <span className='grid min-w-0 flex-1 gap-1'>
                    <span className='flex items-center gap-2'>
                      <span className='truncate text-sm font-semibold'>{user.name}</span>
                      <span className='tabular text-xs text-muted-foreground'>{user.mobile}</span>
                      <span className='text-[11px] text-muted-foreground uppercase'>
                        {user.language}
                      </span>
                    </span>
                    <RoleBadges roles={user.roles} max={2} />
                  </span>
                  {active && <Check className='size-4 text-primary' />}
                </button>
              )
            })
          )}
        </div>
      </form>
    </AppModal>
  )
}
