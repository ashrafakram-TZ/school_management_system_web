import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/utils'

export function AppCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl border bg-card p-4 text-card-foreground shadow-xs', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className='flex items-center justify-between gap-2 px-1 pt-1'>
      <h3 className='text-[13px] font-bold tracking-wide text-muted-foreground uppercase'>
        {children}
      </h3>
      {action}
    </div>
  )
}

export function ScreenLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className='grid gap-3' aria-busy='true' aria-label='Loading'>
      <Skeleton className='h-28 rounded-2xl' />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className='h-16 rounded-2xl' />
      ))}
    </div>
  )
}

export function ScreenEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description?: string
}) {
  return (
    <div className='flex flex-col items-center gap-3 px-4 py-14 text-center'>
      <span className='grid size-14 place-items-center rounded-full bg-muted text-muted-foreground'>
        <Icon className='size-6' />
      </span>
      <p className='text-base font-bold'>{title}</p>
      {description && <p className='text-sm text-muted-foreground'>{description}</p>}
    </div>
  )
}

export function ScreenError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className='flex flex-col items-center gap-3 px-4 py-14 text-center'>
      <span className='grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive'>
        <AlertTriangle className='size-6' />
      </span>
      <p className='text-base font-bold'>Could not load this</p>
      <p className='text-sm text-muted-foreground'>{getErrorMessage(error)}</p>
      <button
        type='button'
        onClick={onRetry}
        className='h-11 rounded-full border px-5 text-sm font-semibold hover:bg-muted'
      >
        Try again
      </button>
    </div>
  )
}

export function QueryView<T>({
  query,
  rows,
  children,
}: {
  query: UseQueryResult<T>
  rows?: number
  children: (data: T) => ReactNode
}) {
  if (query.isPending) return <ScreenLoading rows={rows} />
  if (query.isError) return <ScreenError error={query.error} onRetry={() => void query.refetch()} />
  return <>{children(query.data)}</>
}

export function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: ReactNode
  tone?: 'success' | 'warning' | 'danger'
}) {
  return (
    <div className='min-w-0 rounded-xl bg-muted/60 px-3 py-2.5'>
      <div className='truncate text-[11px] font-semibold text-muted-foreground'>{label}</div>
      <div
        className={cn(
          'tabular truncate text-lg font-extrabold',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-destructive'
        )}
      >
        {value}
      </div>
    </div>
  )
}
