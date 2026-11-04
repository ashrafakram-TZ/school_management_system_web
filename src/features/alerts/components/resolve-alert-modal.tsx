import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppModal } from '@/components/common/app-modal'
import { FormField } from '@/components/common/form-field'
import { Textarea } from '@/components/ui/input'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { useResolveAlert, type FleetAlert } from '../api'

const FORM_ID = 'resolve-alert-form'
const NOTE_NEEDED = 'Write what was done to resolve this alert (at least 3 characters)'

const schema = z.object({
  resolution_note: z
    .string()
    .trim()
    .min(3, NOTE_NEEDED)
    .max(500, 'Keep the note to 500 characters or less'),
})

type FormValues = z.infer<typeof schema>

interface ResolveAlertModalProps {
  alert: FleetAlert | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResolveAlertModal({ alert, open, onOpenChange }: ResolveAlertModalProps) {
  const resolve = useResolveAlert()
  return (
    <AppModal
      open={open && Boolean(alert)}
      onOpenChange={onOpenChange}
      title='Resolve alert'
      description={alert ? `${alert.kind_label} · ${alert.message}` : undefined}
      formId={FORM_ID}
      submitText='Mark as resolved'
      loading={resolve.isPending}
    >
      {open && alert && (
        <ResolveForm
          key={alert.id}
          onSubmit={async (note) => {
            await resolve.mutateAsync({ id: alert.id, resolution_note: note })
            alerts.success('Alert resolved')
            onOpenChange(false)
          }}
        />
      )}
    </AppModal>
  )
}

function ResolveForm({ onSubmit }: { onSubmit: (note: string) => Promise<void> }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { resolution_note: '' },
  })

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values.resolution_note)
    } catch (error) {
      const apiError = toApiError(error)
      const fieldError = apiError.fieldError('resolution_note')
      if (fieldError) {
        setError('resolution_note', { message: fieldError }, { shouldFocus: true })
        return
      }
      setError('root', {
        message:
          apiError.code === 'ALERT_ALREADY_RESOLVED'
            ? 'Someone has already resolved this alert. Refresh the list to see it.'
            : apiError.message,
      })
    }
  })

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className='grid gap-4'>
      {errors.root?.message && (
        <p
          role='alert'
          className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive'
        >
          {errors.root.message}
        </p>
      )}
      <FormField
        id='resolution-note'
        label='What was done'
        required
        error={errors.resolution_note?.message}
        hint='Saved with the alert so everyone can see how it was handled.'
      >
        <Textarea
          id='resolution-note'
          rows={4}
          maxLength={500}
          autoFocus
          placeholder='Called the driver. The child felt unwell; the parent picked her up at Anna Nagar.'
          aria-invalid={Boolean(errors.resolution_note) || undefined}
          aria-describedby={errors.resolution_note ? 'resolution-note-error' : undefined}
          {...register('resolution_note')}
        />
      </FormField>
    </form>
  )
}
