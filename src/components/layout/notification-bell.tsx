import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useNow } from '@/hooks/use-now'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  useMarkAllRead,
  useMarkRead,
  useMyNotifications,
  useUnreadCount,
} from '@/features/notifications/api'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const now = useNow(30_000)
  const unread = useUnreadCount()
  const list = useMyNotifications(open)
  const markAll = useMarkAllRead()
  const markRead = useMarkRead()
  const count = unread.data?.unread ?? 0
  const items = list.data?.items ?? []

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative'
          aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        >
          <Bell />
          {count > 0 && (
            <span className='tabular absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-bold text-destructive-foreground'>
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-[min(22rem,calc(100vw-2rem))] p-0'>
        <div className='flex items-center justify-between gap-2 border-b px-3 py-2.5'>
          <DropdownMenuLabel className='p-0 text-sm font-bold'>Notifications</DropdownMenuLabel>
          <Button
            variant='ghost'
            size='sm'
            disabled={!count || markAll.isPending}
            onClick={(event) => {
              event.preventDefault()
              markAll.mutate()
            }}
          >
            <CheckCheck />
            Mark all read
          </Button>
        </div>
        {list.isPending ? (
          <div className='grid gap-2 p-3'>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className='h-12' />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className='px-4 py-8 text-center text-sm text-muted-foreground'>
            You are all caught up.
          </p>
        ) : (
          <div className='grid p-1'>
            {items.map((item, index) => (
              <div key={item.id}>
                {index > 0 && <DropdownMenuSeparator className='mx-0' />}
                <DropdownMenuItem
                  className='items-start gap-3 py-2.5'
                  onSelect={(event) => {
                    event.preventDefault()
                    if (!item.is_read) markRead.mutate(item.id)
                  }}
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      item.is_read ? 'bg-transparent' : 'bg-primary'
                    )}
                  />
                  <span className='grid min-w-0 gap-0.5'>
                    <span className={cn('truncate', !item.is_read && 'font-bold')}>
                      {item.title}
                    </span>
                    <span className='line-clamp-2 text-xs font-normal text-muted-foreground'>
                      {item.body}
                    </span>
                    <span className='text-[11px] font-normal text-muted-foreground'>
                      {timeAgo(item.created_at, now)}
                    </span>
                  </span>
                </DropdownMenuItem>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
