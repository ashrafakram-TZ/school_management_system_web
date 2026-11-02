import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type InsightTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface Insight {
  key: string
  label: string
  value: number | string
  hint?: string
  icon: LucideIcon
  tone?: InsightTone
  active?: boolean
  onClick?: () => void
}

const tones: Record<InsightTone, { icon: string; ring: string }> = {
  primary: { icon: 'bg-primary/10 text-primary', ring: 'ring-primary/40 border-primary/50' },
  success: { icon: 'bg-success/10 text-success', ring: 'ring-success/40 border-success/50' },
  warning: { icon: 'bg-warning/10 text-warning', ring: 'ring-warning/40 border-warning/50' },
  danger: {
    icon: 'bg-destructive/10 text-destructive',
    ring: 'ring-destructive/40 border-destructive/50',
  },
  info: { icon: 'bg-info/10 text-info', ring: 'ring-info/40 border-info/50' },
  neutral: { icon: 'bg-muted text-muted-foreground', ring: 'ring-ring/40 border-ring/50' },
}

export function InsightCards({ items, loading }: { items: Insight[]; loading?: boolean }) {
  return (
    <div className='grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4'>
      {items.map((item) => {
        const tone = tones[item.tone ?? 'primary']
        const interactive = Boolean(item.onClick)
        const Tag = interactive ? 'button' : 'div'
        return (
          <Tag
            key={item.key}
            type={interactive ? 'button' : undefined}
            onClick={item.onClick}
            aria-pressed={interactive ? Boolean(item.active) : undefined}
            className={cn(
              'group grid gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-[box-shadow,border-color,transform] sm:gap-3 sm:p-5',
              interactive &&
                'cursor-pointer outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40',
              item.active && cn('ring-2', tone.ring)
            )}
          >
            <div className='flex items-start justify-between gap-2'>
              <span className='text-xs leading-snug font-semibold text-muted-foreground'>
                {item.label}
              </span>
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tone.icon)}>
                <item.icon className='size-4' />
              </span>
            </div>
            {loading ? (
              <Skeleton className='h-8 w-16' />
            ) : (
              <span className='tabular text-2xl font-extrabold tracking-tight sm:text-3xl'>
                {item.value}
              </span>
            )}
            {item.hint && (
              <span className='truncate text-xs text-muted-foreground'>
                {item.active ? 'Showing these · click to clear' : item.hint}
              </span>
            )}
          </Tag>
        )
      })}
    </div>
  )
}
