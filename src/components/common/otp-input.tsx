import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus,
}: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, index) => value[index] ?? '')

  const focus = (index: number) => inputs.current[Math.max(0, Math.min(length - 1, index))]?.focus()

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
    return clean
  }

  const setDigit = (index: number, digit: string) => {
    const position = Math.min(index, value.length)
    commit(value.slice(0, position) + digit + value.slice(position + 1))
  }

  return (
    <div className='flex justify-between gap-2' role='group' aria-label='One-time code'>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputs.current[index] = node
          }}
          id={index === 0 ? 'otp' : undefined}
          inputMode='numeric'
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={invalid || undefined}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, '')
            if (!typed) return
            if (typed.length > 1) {
              const filled = commit((value.slice(0, index) + typed).slice(0, length))
              focus(filled.length)
              return
            }
            setDigit(index, typed)
            focus(index + 1)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace') {
              event.preventDefault()
              if (digit) setDigit(index, '')
              else if (index > 0) {
                setDigit(index - 1, '')
                focus(index - 1)
              }
            }
            if (event.key === 'ArrowLeft') focus(index - 1)
            if (event.key === 'ArrowRight') focus(index + 1)
          }}
          onPaste={(event) => {
            event.preventDefault()
            const filled = commit(event.clipboardData.getData('text'))
            focus(filled.length)
          }}
          className={cn(
            'tabular size-12 min-w-0 flex-1 rounded-lg border border-input bg-card text-center text-xl font-bold shadow-xs transition-[color,box-shadow,border-color] outline-none sm:size-13',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
            'disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            digit && 'border-primary/50'
          )}
        />
      ))}
    </div>
  )
}
