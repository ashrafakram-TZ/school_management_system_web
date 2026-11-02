import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AttentionReason } from '../api'
import { ATTENTION, roleLabel } from '../labels'

export function AttentionBadges({ reasons }: { reasons: AttentionReason[] }) {
  if (!reasons.length)
    return (
      <Badge tone='success'>
        <CheckCircle2 className='size-3' />
        All good
      </Badge>
    )
  return (
    <span className='flex flex-wrap gap-1'>
      {reasons.map((reason) => (
        <Badge key={reason} tone={ATTENTION[reason].tone}>
          {ATTENTION[reason].label}
        </Badge>
      ))}
    </span>
  )
}

export function StaffRoleBadges({
  roles,
  max = 3,
}: {
  roles: { code: string; name: string }[]
  max?: number
}) {
  const staffRoles = roles.filter((role) => role.code !== 'PARENT')
  const shown = staffRoles.slice(0, max)
  return (
    <span className='flex flex-wrap gap-1'>
      {shown.map((role) => (
        <Badge key={role.code} tone={role.code === 'ADMIN' ? 'info' : 'neutral'}>
          {roleLabel(role)}
        </Badge>
      ))}
      {staffRoles.length > max && <Badge tone='neutral'>+{staffRoles.length - max}</Badge>}
    </span>
  )
}
