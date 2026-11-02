import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className='overflow-hidden'>
      <div className='flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5'>
        <div className='grid gap-0.5'>
          <h2 className='font-bold'>{title}</h2>
          {description && <p className='text-xs text-muted-foreground'>{description}</p>}
        </div>
        {action && <div className='flex flex-wrap gap-2'>{action}</div>}
      </div>
      <div className='p-4 sm:p-5'>{children}</div>
    </Card>
  )
}

export function RootError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p
      role='alert'
      className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive sm:col-span-2'
    >
      {message}
    </p>
  )
}
