import { useRouterState } from '@tanstack/react-router'
import { Keyboard, Menu, PanelLeft } from 'lucide-react'
import { useShortcutHelp } from '@/components/shortcuts/shortcut-context'
import { Kbd } from '@/components/shortcuts/kbd'
import { Button } from '@/components/ui/button'
import { NAV_GROUPS } from '@/config/nav'
import type { Me } from '@/features/auth/api'
import { NotificationBell } from './notification-bell'
import { UserMenu } from './user-menu'

interface AppHeaderProps {
  me: Me
  onToggleSidebar: () => void
  onOpenMobile: () => void
}

const findCurrent = (pathname: string) => {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) =>
      entry.to === '/' ? pathname === '/' : pathname.startsWith(entry.to)
    )
    if (item) return { group: group.label, item }
  }
  return { group: NAV_GROUPS[0].label, item: NAV_GROUPS[0].items[0] }
}

export function AppHeader({ me, onToggleSidebar, onOpenMobile }: AppHeaderProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { setHelpOpen } = useShortcutHelp()
  const current = findCurrent(pathname)

  return (
    <header className='sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6'>
      <Button
        variant='ghost'
        size='icon'
        onClick={onOpenMobile}
        className='md:hidden'
        aria-label='Open menu'
      >
        <Menu />
      </Button>
      <Button
        variant='ghost'
        size='icon'
        onClick={onToggleSidebar}
        className='hidden md:inline-flex'
        aria-label='Collapse or expand sidebar'
        title='Collapse or expand sidebar'
      >
        <PanelLeft />
      </Button>

      <div className='flex min-w-0 items-center gap-2 text-sm'>
        <span className='hidden text-muted-foreground sm:inline'>{current.group}</span>
        <span className='hidden text-muted-foreground/60 sm:inline'>/</span>
        <span className='truncate font-bold'>{current.item.label}</span>
      </div>

      <div className='ml-auto flex items-center gap-1'>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => setHelpOpen(true)}
          aria-label='Keyboard shortcuts'
          className='hidden gap-2 sm:inline-flex'
        >
          <Keyboard />
          <Kbd id='app.help' />
        </Button>
        <NotificationBell />
        <UserMenu me={me} />
      </div>
    </header>
  )
}
