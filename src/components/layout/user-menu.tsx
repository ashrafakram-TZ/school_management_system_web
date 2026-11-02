import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, LogOut, Moon, School, Sun } from 'lucide-react'
import { Avatar } from '@/components/common/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authApi, type Me } from '@/features/auth/api'
import { session } from '@/lib/auth/session'
import { useTheme } from '@/providers/theme-context'

export function UserMenu({ me }: { me: Me }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolvedTheme, toggleTheme } = useTheme()
  const primaryRole = me.roles.find((role) => role.app === 'admin') ?? me.roles[0]

  const signOut = async () => {
    await authApi.logout().catch(() => null)
    session.clear()
    queryClient.clear()
    await navigate({ to: '/login', replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-10 gap-2 px-1.5 sm:px-2' aria-label='Account menu'>
          <Avatar name={me.name} size='sm' />
          <span className='hidden max-w-36 truncate text-sm font-semibold md:inline'>
            {me.name}
          </span>
          <ChevronDown className='hidden text-muted-foreground md:block' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-64'>
        <DropdownMenuLabel className='flex items-center gap-3'>
          <Avatar name={me.name} />
          <span className='grid min-w-0'>
            <span className='truncate text-sm font-bold'>{me.name}</span>
            <span className='truncate text-xs font-normal text-muted-foreground'>
              {primaryRole?.name ?? 'User'} · +91 {me.mobile}
            </span>
          </span>
        </DropdownMenuLabel>
        {me.school && (
          <div className='mx-2.5 mb-2 flex items-center gap-2 rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground'>
            <School className='size-3.5' />
            <span className='truncate'>{me.school.name}</span>
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            toggleTheme()
          }}
        >
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
          {resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
