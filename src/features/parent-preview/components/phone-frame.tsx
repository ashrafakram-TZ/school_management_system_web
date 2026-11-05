import { useEffect, useRef, type ReactNode } from 'react'
import {
  ArrowLeft,
  BatteryFull,
  Bell,
  GraduationCap,
  SignalHigh,
  Wifi,
  type LucideIcon,
} from 'lucide-react'
import { useNow } from '@/hooks/use-now'
import { config } from '@/config/env'
import { cn } from '@/lib/utils'

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: config.timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const PHONE_FONT =
  "'Manrope Variable', 'Noto Sans Tamil', 'Nirmala UI', 'Latha', 'Tamil Sangam MN', ui-sans-serif, system-ui, sans-serif"

export interface PhoneScreen<T extends string> {
  id: T
  label: string
  title: string
  icon: LucideIcon
}

interface PhoneFrameProps<T extends string> {
  app: string
  nav: PhoneScreen<T>[]
  tab: T
  onTab: (tab: T) => void
  title: string
  subtitle: string
  logoUrl: string | null
  schoolName: string
  unread: number
  onBell: () => void
  onBack?: () => void
  children: ReactNode
}

export function PhoneFrame<T extends string>({
  app,
  nav,
  tab,
  onTab,
  title,
  subtitle,
  logoUrl,
  schoolName,
  unread,
  onBell,
  onBack,
  children,
}: PhoneFrameProps<T>) {
  const now = useNow(30_000)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [tab])

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border bg-background shadow-sm',
        'sm:h-[min(844px,calc(100dvh-6.5rem))] sm:min-h-[640px] sm:w-[390px] sm:shrink-0 sm:rounded-[3.25rem] sm:border-[12px] sm:border-sidebar sm:shadow-2xl sm:ring-1 sm:ring-border dark:sm:ring-2 dark:sm:ring-muted-foreground/40'
      )}
      style={{ fontFamily: PHONE_FONT }}
    >
      <div className='flex h-[min(780px,calc(100dvh-12rem))] min-h-[560px] flex-col sm:h-full sm:min-h-0'>
        <div className='relative hidden h-11 shrink-0 items-center justify-between bg-card px-7 text-xs font-bold sm:flex'>
          <span className='tabular'>{clock.format(now)}</span>
          <span
            aria-hidden
            className='absolute top-2 left-1/2 h-7 w-28 -translate-x-1/2 rounded-full bg-sidebar'
          />
          <span className='flex items-center gap-1'>
            <SignalHigh className='size-3.5' />
            <Wifi className='size-3.5' />
            <BatteryFull className='size-4' />
          </span>
        </div>

        <header className='flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3'>
          {onBack ? (
            <button
              type='button'
              aria-label='Back'
              onClick={onBack}
              className='grid size-10 shrink-0 place-items-center rounded-full hover:bg-muted'
            >
              <ArrowLeft className='size-5' />
            </button>
          ) : logoUrl ? (
            <img
              src={logoUrl}
              alt={`${schoolName} logo`}
              className='size-10 shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-border'
            />
          ) : (
            <span className='grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground'>
              <GraduationCap className='size-5' />
            </span>
          )}
          <div className='grid min-w-0 flex-1'>
            <span className='truncate text-base leading-tight font-extrabold'>{title}</span>
            <span className='truncate text-xs text-muted-foreground'>{subtitle}</span>
          </div>
          <button
            type='button'
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            onClick={onBell}
            className='relative grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted'
          >
            <Bell className='size-5' />
            {unread > 0 && (
              <span className='tabular absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground'>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </header>

        <div
          ref={scroller}
          className='min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-background p-4'
        >
          {children}
        </div>

        <nav
          aria-label={`${app} tabs`}
          className='grid shrink-0 border-t bg-card px-1 pt-1 pb-2 sm:pb-5'
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          {nav.map((item) => {
            const active = item.id === tab
            return (
              <button
                key={item.id}
                type='button'
                aria-current={active ? 'page' : undefined}
                onClick={() => onTab(item.id)}
                className={cn(
                  'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'grid h-7 w-11 max-w-full place-items-center rounded-full',
                    active && 'bg-primary/12'
                  )}
                >
                  <item.icon className='size-5' />
                </span>
                <span className='max-w-full truncate'>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
