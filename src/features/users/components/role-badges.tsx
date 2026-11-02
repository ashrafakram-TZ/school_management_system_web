import { Badge, type BadgeTone } from '@/components/ui/badge'
import type { AppSection, RoleSummary } from '@/features/auth/api'

const APP_TONES: Record<AppSection, BadgeTone> = {
  admin: 'info',
  staff: 'success',
  parent: 'warning',
  driver: 'neutral',
}

export function RoleBadges({ roles, max = 3 }: { roles: RoleSummary[]; max?: number }) {
  if (!roles.length) return <span className='text-xs text-muted-foreground'>No role</span>
  const shown = roles.slice(0, max)
  return (
    <span className='flex flex-wrap gap-1'>
      {shown.map((role) => (
        <Badge key={role.code} tone={APP_TONES[role.app]}>
          {role.name}
        </Badge>
      ))}
      {roles.length > max && <Badge tone='neutral'>+{roles.length - max}</Badge>}
    </span>
  )
}
