import type { ReactNode } from 'react'
import { CalendarOff, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Notice({
  tone = 'warning',
  children,
  className,
}: {
  tone?: 'warning' | 'info'
  children: ReactNode
  className?: string
}) {
  const Icon = tone === 'warning' ? CalendarOff : Info
  return (
    <div
      role='status'
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium',
        tone === 'warning'
          ? 'border-warning/30 bg-warning/10 text-warning'
          : 'border-info/30 bg-info/10 text-info',
        className
      )}
    >
      <Icon className='mt-0.5 size-4 shrink-0' />
      <div className='min-w-0'>{children}</div>
    </div>
  )
}
