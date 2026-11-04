import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FileText, Upload, X } from 'lucide-react'
import { z } from 'zod'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { today } from '@/features/attendance/labels'
import { useBusOptions, useCrew } from '@/features/transport/api'
import { ROLE_BADGE } from '@/features/transport/labels'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { filesApi } from '@/lib/files'
import { maintenanceApi, useMaintenanceMutation, type FuelEntry, type FuelInput } from '../api'
import { rupees } from '../labels'

const FORM_ID = 'fuel-form'
const BILL_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
const BILL_MAX_BYTES = 5 * 1024 * 1024

const between = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => {
      const number = Number(value)
      return Number.isFinite(number) && number >= min && number <= max
    }, message)

const schema = z.object({
  vehicle_id: z.string().min(1, 'Choose the bus'),
  filled_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date of the fill')
    .refine((value) => value <= today(), 'The date cannot be in the future'),
  litres: between(0.1, 1000, 'Enter the litres, from 0.1 to 1000'),
  amount: between(1, 100_000, 'Enter the amount, from ₹1 to ₹1,00,000'),
  odometer_km: between(0, 2_000_000, 'Enter the odometer, from 0 to 20,00,000 km'),
  station: z.string().trim().max(100, 'Station must be 100 characters or less'),
  filled_by: z.string(),
})

type FormValues = z.infer<typeof schema>

const FIELDS: (keyof FormValues)[] = [
  'vehicle_id',
  'filled_on',
  'litres',
  'amount',
  'odometer_km',
  'station',
  'filled_by',
]

interface Bill {
  id: number
  name: string
}

interface FuelFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: FuelEntry | null
  defaultVehicleId?: number
}

export function FuelFormModal({ open, onOpenChange, entry, defaultVehicleId }: FuelFormModalProps) {
  const save = useMaintenanceMutation((input: FuelInput) =>
    entry ? maintenanceApi.updateFuel(entry.id, input) : maintenanceApi.createFuel(input)
  )
  const [uploading, setUploading] = useState(false)
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? 'Edit fuel entry' : 'Add fuel entry'}
      description='Litres, amount and odometer from the fuel bill. Mileage is worked out from the previous fill.'
      formId={FORM_ID}
      submitText={entry ? 'Save changes' : 'Add entry'}
      loading={save.isPending || uploading}
      size='lg'
    >
      {open && (
        <FuelForm
          key={entry?.id ?? 'new'}
          entry={entry}
          defaultVehicleId={defaultVehicleId}
          onUploadingChange={setUploading}
          onSubmit={async (input) => {
            await save.mutateAsync(input)
            alerts.success(entry ? 'Fuel entry updated' : 'Fuel entry added')
            onOpenChange(false)
          }}
        />
      )}
    </AppModal>
  )
}

function FuelForm({
  entry,
  defaultVehicleId,
  onUploadingChange,
  onSubmit,
}: {
  entry: FuelEntry | null
  defaultVehicleId?: number
  onUploadingChange: (uploading: boolean) => void
  onSubmit: (input: FuelInput) => Promise<void>
}) {
  const busOptions = useBusOptions()
  const crew = useCrew()
  const [bill, setBill] = useState<Bill | null>(
    entry?.bill_file ? { id: entry.bill_file.id, name: entry.bill_file.name } : null
  )
  const [billError, setBillError] = useState('')
  const [uploading, setUploading] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: String(entry?.vehicle.id ?? defaultVehicleId ?? ''),
      filled_on: entry?.filled_on ?? today(),
      litres: entry?.litres.toString() ?? '',
      amount: entry?.amount.toString() ?? '',
      odometer_km: entry?.odometer_km.toString() ?? '',
      station: entry?.station ?? '',
      filled_by: entry?.filled_by ? String(entry.filled_by.id) : '',
    },
  })

  const crewOptions = (crew.data ?? []).map((person) => ({
    value: String(person.user_id),
    label: person.name,
    hint: ROLE_BADGE[person.role].label,
  }))
  if (
    entry?.filled_by &&
    !crewOptions.some((option) => option.value === String(entry.filled_by!.id))
  ) {
    crewOptions.unshift({
      value: String(entry.filled_by.id),
      label: entry.filled_by.name,
      hint: '',
    })
  }

  const litres = Number(useWatch({ control, name: 'litres' }))
  const amount = Number(useWatch({ control, name: 'amount' }))
  const pricePerLitre = litres > 0 && amount > 0 ? amount / litres : null

  const uploadBill = async (file: File | undefined) => {
    if (!file) return
    setBillError('')
    if (!BILL_TYPES.includes(file.type)) return setBillError('Choose a photo or a PDF of the bill')
    if (file.size > BILL_MAX_BYTES) return setBillError('The bill must be 5 MB or smaller')
    setUploading(true)
    onUploadingChange(true)
    try {
      const uploaded = await filesApi.upload(file, 'fuel_bill')
      setBill({ id: uploaded.id, name: uploaded.name })
    } catch (error) {
      setBillError(toApiError(error).message)
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }

  const submit = handleSubmit(async (values) => {
    const input: FuelInput = {
      vehicle_id: Number(values.vehicle_id),
      filled_on: values.filled_on,
      litres: Number(values.litres),
      amount: Number(values.amount),
      odometer_km: Number(values.odometer_km),
      station: values.station || (entry ? null : undefined),
      filled_by: values.filled_by ? Number(values.filled_by) : entry ? null : undefined,
      bill_file_id: bill ? bill.id : entry?.bill_file ? null : undefined,
    }
    try {
      await onSubmit(input)
    } catch (error) {
      const apiError = toApiError(error)
      let mapped = false
      apiError.fieldErrors.forEach((fieldError) => {
        if (fieldError.field === 'bill_file_id') {
          setBillError(fieldError.message)
          mapped = true
          return
        }
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
      <FormField id='fuel-bus' label='Bus' required error={errors.vehicle_id?.message}>
        <Controller
          control={control}
          name='vehicle_id'
          render={({ field }) => (
            <Combobox
              id='fuel-bus'
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
      <FormField id='fuel-date' label='Date' required error={errors.filled_on?.message}>
        <Input
          id='fuel-date'
          type='date'
          max={today()}
          aria-invalid={Boolean(errors.filled_on) || undefined}
          {...register('filled_on')}
        />
      </FormField>
      <FormField id='fuel-litres' label='Litres' required error={errors.litres?.message}>
        <Input
          id='fuel-litres'
          type='number'
          inputMode='decimal'
          min={0.1}
          max={1000}
          step='0.01'
          placeholder='60.5'
          aria-invalid={Boolean(errors.litres) || undefined}
          {...register('litres')}
        />
      </FormField>
      <FormField
        id='fuel-amount'
        label='Amount (₹)'
        required
        error={errors.amount?.message}
        hint={pricePerLitre ? `${rupees(Number(pricePerLitre.toFixed(2)))} per litre` : undefined}
      >
        <Input
          id='fuel-amount'
          type='number'
          inputMode='decimal'
          min={1}
          max={100_000}
          step='0.01'
          placeholder='5800'
          aria-invalid={Boolean(errors.amount) || undefined}
          {...register('amount')}
        />
      </FormField>
      <FormField
        id='fuel-odometer'
        label='Odometer (km)'
        required
        error={errors.odometer_km?.message}
        hint='Reading on the dashboard at the pump'
      >
        <Input
          id='fuel-odometer'
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
      <FormField id='fuel-station' label='Fuel station' error={errors.station?.message}>
        <Input
          id='fuel-station'
          maxLength={100}
          placeholder='Indian Oil, Anna Nagar'
          aria-invalid={Boolean(errors.station) || undefined}
          {...register('station')}
        />
      </FormField>
      <FormField id='fuel-filled-by' label='Filled by' error={errors.filled_by?.message}>
        <Controller
          control={control}
          name='filled_by'
          render={({ field }) => (
            <Combobox
              id='fuel-filled-by'
              label='Filled by'
              value={field.value || undefined}
              options={crewOptions}
              allLabel='Not recorded'
              placeholder='Not recorded'
              searchPlaceholder='Search drivers'
              emptyText='No drivers or attendants yet'
              highlightSelected={false}
              className='sm:w-full'
              invalid={Boolean(errors.filled_by)}
              onChange={(value) => field.onChange(value ?? '')}
            />
          )}
        />
      </FormField>
      <FormField id='fuel-bill' label='Bill' error={billError} hint='Photo or PDF, up to 5 MB'>
        {bill ? (
          <div className='flex h-9 min-w-0 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm'>
            <FileText className='size-4 shrink-0 text-muted-foreground' />
            <span className='min-w-0 flex-1 truncate'>{bill.name}</span>
            <button
              type='button'
              onClick={() => setBill(null)}
              aria-label='Remove bill'
              className='grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
            >
              <X className='size-3.5' />
            </button>
          </div>
        ) : (
          <Button asChild variant='outline' disabled={uploading} className='justify-start'>
            <label htmlFor='fuel-bill' className='cursor-pointer'>
              <Upload />
              {uploading ? 'Uploading…' : 'Upload bill'}
              <input
                id='fuel-bill'
                type='file'
                accept={BILL_TYPES.join(',')}
                className='sr-only'
                disabled={uploading}
                onChange={(event) => {
                  void uploadBill(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </label>
          </Button>
        )}
      </FormField>
    </form>
  )
}
