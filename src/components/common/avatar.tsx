import { cn } from '@/lib/utils'

const TONES = [
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
]

const sizes = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
  lg: 'size-12 text-sm',
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: keyof typeof sizes
  className?: string
}) {
  const tone = TONES[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % TONES.length]
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-bold tracking-wide',
        tone,
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </span>
  )
}
