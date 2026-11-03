import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import type { ExpiryState } from '../api'
import { EXPIRY_TONE, SHORT_KIND, expiryText, worstFirst } from '../labels'

export function ExpiryBadge({ item, withKind = true }: { item: ExpiryState; withKind?: boolean }) {
  return (
    <Badge
      tone={EXPIRY_TONE[item.state]}
      title={item.date ? `${item.label} ends ${formatDate(item.date)}` : `${item.label} not set`}
    >
      {withKind && <span className='font-bold'>{SHORT_KIND[item.kind]}</span>}
      {expiryText(item)}
    </Badge>
  )
}

export function ExpiryBadges({ items }: { items: ExpiryState[] }) {
  return (
    <span className='flex flex-wrap gap-1'>
      {worstFirst(items).map((item) => (
        <ExpiryBadge key={item.kind} item={item} />
      ))}
    </span>
  )
}
