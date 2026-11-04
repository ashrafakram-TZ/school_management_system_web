import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppModal } from '@/components/common/app-modal'
import { FormField } from '@/components/common/form-field'
import { Input, Textarea } from '@/components/ui/input'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { maintenanceApi, useMaintenanceMutation, type CloseTicketInput, type Ticket } from '../api'
import { numberText, optionalNumber } from '../labels'

const FORM_ID = 'close-ticket-form'

const schema = z.object({
  cost: numberText(0, 1_000_000, 'Enter the cost, from ₹0 to ₹10,00,000'),
  vendor: z.string().trim().max(100, 'Vendor must be 100 characters or less'),
  odometer_km: numberText(0, 2_000_000, 'Enter the odometer, from 0 to 20,00,000 km'),
  notes: z.string().trim().max(1000, 'Notes must be 1000 characters or less'),
})

type FormValues = z.infer<typeof schema>
const FIELDS: (keyof FormValues)[] = ['cost', 'vendor', 'odometer_km', 'notes']

interface CloseTicketModalProps {
  ticket: Ticket | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CloseTicketModal({ ticket, open, onOpenChange }: CloseTicketModalProps) {
  const close = useMaintenanceMutation((input: CloseTicketInput) =>
    maintenanceApi.closeTicket(ticket!.id, input)
  )
  return (
    <AppModal
      open={open && Boolean(ticket)}
      onOpenChange={onOpenChange}
      title='Close ticket'
      description={ticket ? `${ticket.title} · ${ticket.vehicle.registration_no}` : undefined}
      formId={FORM_ID}
      submitText='Mark as done'
      loading={close.isPending}
    >
      {open && ticket && (
        <CloseForm
          key={ticket.id}
          ticket={ticket}
          onSubmit={async (input) => {
            await close.mutateAsync(input)
            alerts.success('Ticket closed')
            onOpenChange(false)
          }}
        />
      )}
    </AppModal>
  )
}

function CloseForm({
  ticket,
  onSubmit,
}: {
  ticket: Ticket
  onSubmit: (input: CloseTicketInput) => Promise<void>
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cost: ticket.cost?.toString() ?? '',
      vendor: ticket.vendor ?? '',
      odometer_km: ticket.odometer_km?.toString() ?? '',
      notes: ticket.notes ?? '',
    },
  })

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({
        cost: optionalNumber(values.cost),
        vendor: values.vendor || undefined,
        odometer_km: optionalNumber(values.odometer_km),
        notes: values.notes || undefined,
      })
    } catch (error) {
      const apiError = toApiError(error)
      let mapped = false
      apiError.fieldErrors.forEach((fieldError) => {
        const field = FIELDS.find((name) => name === fieldError.field)
        if (field) {
          setError(field, { message: fieldError.message }, { shouldFocus: !mapped })
          mapped = true
        }
      })
      if (!mapped) {
        setError('root', {
          message:
            apiError.code === 'TICKET_CLOSED'
              ? 'This ticket is already closed. Refresh the list to see it.'
              : apiError.message,
        })
      }
    }
  })

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className='grid gap-4 sm:grid-cols-2'>
      {errors.root?.message && (
        <p
          role='alert'
          className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive sm:col-span-2'
        >
          {errors.root.message}
        </p>
      )}
      <FormField id='close-cost' label='Final cost (₹)' error={errors.cost?.message}>
        <Input
          id='close-cost'
          type='number'
          inputMode='decimal'
          autoFocus
          min={0}
          max={1_000_000}
          step='0.01'
          placeholder='4500'
          aria-invalid={Boolean(errors.cost) || undefined}
          {...register('cost')}
        />
      </FormField>
      <FormField id='close-odometer' label='Odometer (km)' error={errors.odometer_km?.message}>
        <Input
          id='close-odometer'
          type='number'
          inputMode='decimal'
          min={0}
          max={2_000_000}
          step='0.1'
          aria-invalid={Boolean(errors.odometer_km) || undefined}
          {...register('odometer_km')}
        />
      </FormField>
      <FormField
        id='close-vendor'
        label='Vendor or garage'
        error={errors.vendor?.message}
        className='sm:col-span-2'
      >
        <Input
          id='close-vendor'
          maxLength={100}
          placeholder='Sri Murugan Motors'
          aria-invalid={Boolean(errors.vendor) || undefined}
          {...register('vendor')}
        />
      </FormField>
      <FormField
        id='close-notes'
        label='Work done'
        error={errors.notes?.message}
        className='sm:col-span-2'
      >
        <Textarea
          id='close-notes'
          rows={3}
          maxLength={1000}
          placeholder='Replaced the thermostat and topped up coolant'
          aria-invalid={Boolean(errors.notes) || undefined}
          {...register('notes')}
        />
      </FormField>
    </form>
  )
}
