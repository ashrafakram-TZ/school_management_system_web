import { useState } from 'react'
import { AppModal } from '@/components/common/app-modal'
import { ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { alerts } from '@/lib/alerts'
import { cn } from '@/lib/utils'
import { today } from '@/features/attendance/labels'
import { fieldErrorsOf } from '@/features/setup/form-actions'
import {
  payrollApi,
  usePayrollMutation,
  useSalary,
  type SalaryAmounts,
  type SalaryStaff,
  type SalaryStructureInput,
} from '../api'
import {
  DEDUCTION_FIELDS,
  EARNING_FIELDS,
  ESI_GROSS_LIMIT,
  MAX_AMOUNT,
  PF_WAGE_CEILING,
  previewSalary,
  rupees,
} from '../labels'

type AmountKey = keyof SalaryAmounts
type Amounts = Record<AmountKey, string>

const AMOUNT_KEYS: AmountKey[] = [
  ...EARNING_FIELDS.map((field) => field.key),
  ...DEDUCTION_FIELDS.map((field) => field.key),
]

const FORM_ID = 'salary-form'

const toNumber = (value: string) => {
  const number = Number(value)
  return value.trim() === '' || Number.isNaN(number) ? 0 : number
}

function amountError(value: string, required: boolean, label: string) {
  const text = value.trim()
  if (!text) return required ? `Enter the ${label.toLowerCase()}` : undefined
  const number = Number(text)
  if (Number.isNaN(number) || number < 0) return 'Enter an amount of 0 or more'
  if (number > MAX_AMOUNT) return `Enter an amount up to ${rupees(MAX_AMOUNT)}`
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'Use at most 2 decimal places'
  return undefined
}

function initialAmounts(staff: SalaryStaff): Amounts {
  return Object.fromEntries(
    AMOUNT_KEYS.map((key) => [key, staff.structure ? String(staff.structure[key]) : ''])
  ) as Amounts
}

export function SalaryModal({
  userId,
  successHint,
  onClose,
}: {
  userId: number
  successHint?: string
  onClose: () => void
}) {
  const salary = useSalary(userId)
  const staff = salary.data
  const save = usePayrollMutation((input: SalaryStructureInput) =>
    payrollApi.setSalary(userId, input)
  )

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={staff ? `Salary for ${staff.name}` : 'Salary'}
      description={
        staff
          ? `${staff.employee_no} · ${staff.designation}. Amounts are for a full month.`
          : undefined
      }
      size='xl'
      formId={staff ? FORM_ID : undefined}
      submitText='Save salary'
      loading={save.isPending}
    >
      {salary.isPending ? (
        <div className='grid gap-3'>
          <Skeleton className='h-10' />
          <Skeleton className='h-48' />
        </div>
      ) : salary.isError || !staff ? (
        <ErrorState
          message={salary.error?.message ?? 'Not found'}
          onRetry={() => salary.refetch()}
        />
      ) : (
        <SalaryForm
          staff={staff}
          successHint={successHint}
          save={(input) => save.mutateAsync(input)}
          onClose={onClose}
        />
      )}
    </AppModal>
  )
}

function SalaryForm({
  staff,
  successHint,
  save,
  onClose,
}: {
  staff: SalaryStaff
  successHint?: string
  save: (input: SalaryStructureInput) => Promise<SalaryStaff>
  onClose: () => void
}) {
  const [effectiveFrom, setEffectiveFrom] = useState(
    staff.structure?.effective_from ?? `${today().slice(0, 7)}-01`
  )
  const [amounts, setAmounts] = useState<Amounts>(() => initialAmounts(staff))
  const [pfEnabled, setPfEnabled] = useState(staff.structure?.pf_enabled ?? true)
  const [esiEnabled, setEsiEnabled] = useState(staff.structure?.esi_enabled ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const numbers = Object.fromEntries(
    AMOUNT_KEYS.map((key) => [key, toNumber(amounts[key])])
  ) as unknown as SalaryAmounts
  const preview = previewSalary(numbers, pfEnabled, esiEnabled)
  const esiApplies = preview.gross <= ESI_GROSS_LIMIT

  const setAmount = (key: AmountKey, value: string) => {
    setAmounts((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const amountField = (field: { key: AmountKey; label: string; required?: boolean }) => (
    <FormField
      key={field.key}
      id={`salary-${field.key}`}
      label={field.label}
      required={field.required}
      error={errors[field.key]}
    >
      <div className='relative'>
        <span className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground'>
          ₹
        </span>
        <Input
          id={`salary-${field.key}`}
          type='number'
          inputMode='decimal'
          min={0}
          step='0.01'
          placeholder='0'
          className='tabular pl-7'
          value={amounts[field.key]}
          aria-invalid={Boolean(errors[field.key]) || undefined}
          onChange={(event) => setAmount(field.key, event.target.value)}
        />
      </div>
    </FormField>
  )

  const switchRow = (
    id: string,
    label: string,
    hint: string,
    checked: boolean,
    onChange: (value: boolean) => void,
    amount: number
  ) => (
    <div className='flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 sm:col-span-2'>
      <span className='grid min-w-0 gap-0.5'>
        <label htmlFor={id} className='text-sm font-semibold'>
          {label}
        </label>
        <span className='text-xs text-muted-foreground'>{hint}</span>
      </span>
      <span className='flex shrink-0 items-center gap-3'>
        <span className='tabular text-sm font-semibold'>{checked ? rupees(amount) : 'Off'}</span>
        <Switch id={id} aria-label={label} checked={checked} onCheckedChange={onChange} />
      </span>
    </div>
  )

  return (
    <form
      id={FORM_ID}
      noValidate
      className='grid min-w-0 gap-5 lg:grid-cols-[1fr_16rem]'
      onSubmit={async (event) => {
        event.preventDefault()
        const next: Record<string, string> = {}
        if (!effectiveFrom) next.effective_from = 'Choose the date this salary starts'
        for (const field of [...EARNING_FIELDS, ...DEDUCTION_FIELDS]) {
          const message = amountError(
            amounts[field.key],
            'required' in field && field.required,
            field.label
          )
          if (message) next[field.key] = message
        }
        setErrors(next)
        if (Object.keys(next).length) return
        try {
          await save({
            effective_from: effectiveFrom,
            ...numbers,
            pf_enabled: pfEnabled,
            esi_enabled: esiEnabled,
          })
          alerts.success(`Salary saved for ${staff.name}`, { description: successHint })
          onClose()
        } catch (error) {
          const fields = fieldErrorsOf(error)
          if (fields.root) alerts.error(fields.root)
          else setErrors(fields)
        }
      }}
    >
      <div className='grid min-w-0 gap-5'>
        <FormField
          id='salary-effective-from'
          label='Effective from'
          required
          error={errors.effective_from}
          className='sm:max-w-56'
        >
          <Input
            id='salary-effective-from'
            type='date'
            value={effectiveFrom}
            aria-invalid={Boolean(errors.effective_from) || undefined}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </FormField>
        <fieldset className='grid gap-3'>
          <legend className='mb-3 text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
            Earnings
          </legend>
          <div className='grid gap-3 sm:grid-cols-2'>{EARNING_FIELDS.map(amountField)}</div>
        </fieldset>
        <fieldset className='grid gap-3'>
          <legend className='mb-3 text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
            Deductions
          </legend>
          <div className='grid gap-3 sm:grid-cols-2'>
            {switchRow(
              'salary-pf',
              'Provident fund (PF)',
              `12% of basic + DA, wage capped at ${rupees(PF_WAGE_CEILING)}`,
              pfEnabled,
              setPfEnabled,
              preview.pf
            )}
            {switchRow(
              'salary-esi',
              'Employee State Insurance (ESI)',
              esiApplies
                ? `0.75% of gross while gross is ${rupees(ESI_GROSS_LIMIT)} or less`
                : `Not charged: gross is above ${rupees(ESI_GROSS_LIMIT)}`,
              esiEnabled,
              setEsiEnabled,
              preview.esi
            )}
            {DEDUCTION_FIELDS.map(amountField)}
          </div>
        </fieldset>
      </div>
      <aside
        aria-label='Monthly pay preview'
        className='grid content-start gap-3 rounded-xl border bg-muted/40 p-4 lg:sticky lg:top-0'
      >
        <span className='text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
          Full month preview
        </span>
        <PreviewRow label='Monthly gross' value={rupees(preview.gross)} />
        <PreviewRow label='PF' value={rupees(preview.pf)} muted />
        <PreviewRow label='ESI' value={rupees(preview.esi)} muted />
        <PreviewRow label='PT, TDS and other' value={rupees(preview.fixed)} muted />
        <PreviewRow label='Deductions' value={rupees(preview.deductions)} />
        <div className='border-t pt-3'>
          <PreviewRow label='Net pay' value={rupees(preview.net)} strong />
        </div>
        {preview.capped && (
          <p className='text-xs font-medium text-warning'>
            Deductions are more than the gross, so they are capped at the gross.
          </p>
        )}
        <p className='text-xs text-muted-foreground'>
          Payroll scales earnings by paid days and works out PF and ESI on the earned amount.
        </p>
      </aside>
    </form>
  )
}

function PreviewRow({
  label,
  value,
  muted,
  strong,
}: {
  label: string
  value: string
  muted?: boolean
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 text-sm',
        muted && 'pl-3 text-xs text-muted-foreground'
      )}
    >
      <span>{label}</span>
      <span className={cn('tabular font-semibold', strong && 'text-lg font-extrabold')}>
        {value}
      </span>
    </div>
  )
}
