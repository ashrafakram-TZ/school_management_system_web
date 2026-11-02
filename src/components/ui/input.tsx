import * as React from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20'

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input type={type} data-slot='input' className={cn(fieldBase, 'h-9', className)} {...props} />
  )
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot='textarea'
      className={cn(fieldBase, 'min-h-20 py-2 leading-relaxed', className)}
      {...props}
    />
  )
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot='label'
      className={cn('text-xs font-semibold text-foreground select-none', className)}
      {...props}
    />
  )
}
