import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Input, Textarea } from '@/components/ui/input'
import { useBusOptions } from '@/features/transport/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import {
  maintenanceApi,
  useMaintenanceMutation,
  type Ticket,
  type TicketInput,
  type TicketSeverity,
  type TicketStatus,
} from '../api'
import { SEVERITY_OPTIONS, TICKET_STATUS_OPTIONS, numberText, optionalNumber } from '../labels'

const FORM_ID = 'ticket-form'
const FAULT_CODE = /^[PCBU][0-9A-F]{4}$/

const schema = z.object({
  vehicle_id: z.string().min(1, 'Choose the bus'),
  title: z
    .string()
    .trim()
    .min(3, 'Enter at least 3 characters')
    .max(150, 'Title must be 150 characters or less'),
  description: z.string().trim().max(1000, 'Description must be 1000 characters or less'),
  fault_code: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || FAULT_CODE.test(value.toUpperCase()),
      'Enter a fault code like P0301'
    ),
  severity: z.string(),
  status: z.enum(['open', 'in_progress', 'done']),
  odometer_km: numberText(0, 2_000_000, 'Enter the odometer, from 0 to 20,00,000 km'),
  vendor: z.string().trim().max(100, 'Vendor must be 100 characters or less'),
  cost: numberText(0, 1_000_000, 'Enter the cost, from ₹0 to ₹10,00,000'),
  notes: z.string().trim().max(1000, 'Notes must be 1000 characters or less'),
})

type FormValues = z.infer<typeof schema>

const FIELDS: (keyof FormValues)[] = [
  'vehicle_id',
  'title',
  'description',
  'fault_code',
  'severity',
  'status',
  'odometer_km',
  'vendor',
  'cost',
  'notes',
]

interface TicketFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: Ticket | null
  defaultVehicleId?: number
}

export function TicketFormModal({
  open,
  onOpenChange,
  ticket,
  defaultVehicleId,
}: TicketFormModalProps) {
  const save = useMaintenanceMutation((input: TicketInput) =>
    ticket ? maintenanceApi.updateTicket(ticket.id, input) : maintenanceApi.createTicket(input)
  )
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={ticket ? 'Edit ticket' : 'Add maintenance ticket'}
      description={
        ticket
          ? `${ticket.vehicle.registration_no} · ${ticket.vehicle.name}`
          : 'Log a repair or service job for a bus.'
      }
      formId={FORM_ID}
      submitText={ticket ? 'Save changes' : 'Add ticket'}
      loading={save.isPending}
      size='lg'
    >
      {open && (
        <TicketForm
          key={ticket?.id ?? 'new'}
          ticket={ticket}
          defaultVehicleId={defaultVehicleId}
          onSubmit={async (input) => {
            await save.mutateAsync(input)
            alerts.success(ticket ? 'Ticket updated' : 'Ticket added')
            onOpenChange(false)
          }}
        />
      )}
    </AppModal>
  )
}

function TicketForm({
  ticket,
  defaultVehicleId,
  onSubmit,
}: {
  ticket: Ticket | null
  defaultVehicleId?: number
  onSubmit: (input: TicketInput) => Promise<void>
}) {
  const busOptions = useBusOptions()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: String(ticket?.vehicle.id ?? defaultVehicleId ?? ''),
      title: ticket?.title ?? '',
      description: ticket?.description ?? '',
      fault_code: ticket?.fault_code ?? '',
      severity: ticket?.severity ?? '',
      status: ticket?.status ?? 'open',
      odometer_km: ticket?.odometer_km?.toString() ?? '',
      vendor: ticket?.vendor ?? '',
      cost: ticket?.cost?.toString() ?? '',
      notes: ticket?.notes ?? '',
    },
  })

  const submit = handleSubmit(async (values) => {
    const clear = ticket ? null : undefined
    const input: TicketInput = {
      title: values.title,
      description: values.description || clear,
      fault_code: values.fault_code.toUpperCase() || clear,
      severity: (values.severity || clear) as TicketSeverity | null | undefined,
      odometer_km: optionalNumber(values.odometer_km) ?? clear,
      vendor: values.vendor || clear,
      cost: optionalNumber(values.cost) ?? clear,
      notes: values.notes || clear,
    }
    if (ticket) input.status = values.status
    else input.vehicle_id = Number(values.vehicle_id)
    try {
      await onSubmit(input)
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
      if (apiError.code === 'VEHICLE_NOT_FOUND') {
        setError('vehicle_id', { message: apiError.message })
      } else if (!mapped) {
        setError('root', { message: apiError.message })
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
      {ticket ? (
        <FormField id='ticket-status' label='Status' error={errors.status?.message}>
          <Controller
            control={control}
            name='status'
            render={({ field }) => (
              <Combobox
                id='ticket-status'
                label='Status'
                value={field.value}
                options={TICKET_STATUS_OPTIONS}
                placeholder='Choose status'
                searchPlaceholder='Search status'
                highlightSelected={false}
                className='sm:w-full'
                invalid={Boolean(errors.status)}
                onChange={(value) => field.onChange((value ?? 'open') as TicketStatus)}
              />
            )}
          />
        </FormField>
      ) : (
        <FormField id='ticket-bus' label='Bus' required error={errors.vehicle_id?.message}>
          <Controller
            control={control}
            name='vehicle_id'
            render={({ field }) => (
              <Combobox
                id='ticket-bus'
                label='Bus'
                value={field.value || undefined}
                options={busOptions}
                placeholder='Choose a bus'
                searchPlaceholder='Search buses'
                emptyText='No buses yet'
                highlightSelected={false}
                className='sm:w-full'
                invalid={Boolean(errors.vehicle_id)}
                onChange={(value) => field.onChange(value ?? '')}
              />
            )}
          />
        </FormField>
      )}
      <FormField id='ticket-severity' label='Severity' error={errors.severity?.message}>
        <Controller
          control={control}
          name='severity'
          render={({ field }) => (
            <Combobox
              id='ticket-severity'
              label='Severity'
              value={field.value || undefined}
              options={SEVERITY_OPTIONS}
              allLabel='Not set'
              placeholder='Not set'
              searchPlaceholder='Search severity'
              highlightSelected={false}
              className='sm:w-full'
              onChange={(value) => field.onChange(value ?? '')}
            />
          )}
        />
      </FormField>
      <FormField
        id='ticket-title'
        label='Title'
        required
        error={errors.title?.message}
        className='sm:col-span-2'
      >
        <Input
          id='ticket-title'
          autoFocus
          maxLength={150}
          placeholder='Replace front brake pads'
          aria-invalid={Boolean(errors.title) || undefined}
          {...register('title')}
        />
      </FormField>
      <FormField
        id='ticket-description'
        label='Description'
        error={errors.description?.message}
        className='sm:col-span-2'
      >
        <Textarea
          id='ticket-description'
          rows={3}
          maxLength={1000}
          placeholder='What is wrong and what needs doing'
          aria-invalid={Boolean(errors.description) || undefined}
          {...register('description')}
        />
      </FormField>
      <FormField
        id='ticket-fault'
        label='Fault code'
        error={errors.fault_code?.message}
        hint='OBD code, like P0301'
      >
        <Input
          id='ticket-fault'
          maxLength={5}
          placeholder='P0301'
          className='font-mono uppercase'
          aria-invalid={Boolean(errors.fault_code) || undefined}
          {...register('fault_code')}
        />
      </FormField>
      <FormField id='ticket-odometer' label='Odometer (km)' error={errors.odometer_km?.message}>
        <Input
          id='ticket-odometer'
          type='number'
          inputMode='decimal'
          min={0}
          max={2_000_000}
          step='0.1'
          placeholder='48213'
          aria-invalid={Boolean(errors.odometer_km) || undefined}
          {...register('odometer_km')}
        />
      </FormField>
      <FormField id='ticket-vendor' label='Vendor or garage' error={errors.vendor?.message}>
        <Input
          id='ticket-vendor'
          maxLength={100}
          placeholder='Sri Murugan Motors'
          aria-invalid={Boolean(errors.vendor) || undefined}
          {...register('vendor')}
        />
      </FormField>
      <FormField id='ticket-cost' label='Cost (₹)' error={errors.cost?.message}>
        <Input
          id='ticket-cost'
          type='number'
          inputMode='decimal'
          min={0}
          max={1_000_000}
          step='0.01'
          placeholder='4500'
          aria-invalid={Boolean(errors.cost) || undefined}
          {...register('cost')}
        />
      </FormField>
      <FormField
        id='ticket-notes'
        label='Notes'
        error={errors.notes?.message}
        className='sm:col-span-2'
      >
        <Textarea
          id='ticket-notes'
          rows={2}
          maxLength={1000}
          aria-invalid={Boolean(errors.notes) || undefined}
          {...register('notes')}
        />
      </FormField>
    </form>
  )
}
