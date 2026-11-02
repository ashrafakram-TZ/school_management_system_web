import { useState, type FormEvent } from 'react'
import { AppModal } from '@/components/common/app-modal'
import { FormField } from '@/components/common/form-field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { RootError } from '@/features/setup/components/setup-shared'
import { fieldErrorsOf } from '@/features/setup/form-actions'
import { alerts } from '@/lib/alerts'
import {
  staffApi,
  useStaffBank,
  useStaffMutation,
  type BankDetails,
  type BankInput,
  type QualificationInput,
  type StaffDetail,
} from '../api'
import {
  toQualificationDrafts,
  toQualificationInputs,
  validateQualifications,
  type QualificationDraft,
} from '../qualification-draft'
import { QualificationsEditor } from './qualifications-editor'

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/
const ACCOUNT_NO = /^\d{9,18}$/
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/

export function QualificationsModal({
  staff,
  open,
  onOpenChange,
}: {
  staff: StaffDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useStaffMutation((items: QualificationInput[]) =>
    staffApi.qualifications(staff.id, items)
  )
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title='Edit qualifications'
      description='Degrees and certificates, newest first. Empty rows are skipped.'
      formId='qualifications-form'
      size='lg'
      loading={save.isPending}
    >
      {open && (
        <QualificationsForm
          staff={staff}
          save={save.mutateAsync}
          onDone={() => onOpenChange(false)}
        />
      )}
    </AppModal>
  )
}

function QualificationsForm({
  staff,
  save,
  onDone,
}: {
  staff: StaffDetail
  save: (items: QualificationInput[]) => Promise<StaffDetail>
  onDone: () => void
}) {
  const [rows, setRows] = useState<QualificationDraft[]>(() =>
    toQualificationDrafts(staff.qualifications)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next = validateQualifications(rows, 'items')
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await save(toQualificationInputs(rows))
      alerts.success('Qualifications saved')
      onDone()
    } catch (error) {
      setErrors(fieldErrorsOf(error))
    }
  }

  return (
    <form id='qualifications-form' onSubmit={submit} noValidate className='grid gap-4'>
      <RootError message={errors.root} />
      <QualificationsEditor
        value={rows}
        prefix='items'
        errors={errors}
        onChange={(next) => {
          setRows(next)
          setErrors({})
        }}
      />
    </form>
  )
}

export function BankModal({
  staff,
  open,
  onOpenChange,
}: {
  staff: StaffDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const current = useStaffBank(staff.id, open && staff.bank.complete)
  const save = useStaffMutation((input: BankInput) => staffApi.saveBank(staff.id, input))
  const loading = staff.bank.complete && current.isPending
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={staff.bank.complete ? 'Edit bank details' : 'Add bank details'}
      description='Used for salary. Account and PAN numbers are stored encrypted.'
      formId='bank-form'
      loading={save.isPending}
    >
      {open &&
        (loading ? (
          <div className='grid gap-3'>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className='h-14' />
            ))}
          </div>
        ) : (
          <BankForm
            initial={current.data}
            fallbackName={staff.name}
            save={save.mutateAsync}
            onDone={() => onOpenChange(false)}
          />
        ))}
    </AppModal>
  )
}

function BankForm({
  initial,
  fallbackName,
  save,
  onDone,
}: {
  initial?: BankDetails
  fallbackName: string
  save: (input: BankInput) => Promise<StaffDetail>
  onDone: () => void
}) {
  const [draft, setDraft] = useState({
    account_holder: initial?.account_holder ?? fallbackName,
    bank_name: initial?.bank_name ?? '',
    ifsc: initial?.ifsc ?? '',
    account_no: initial?.account_no ?? '',
    pan: initial?.pan ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (field: keyof typeof draft, value: string) => {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: '', root: '' }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (draft.account_holder.trim().length < 2)
      next.account_holder = 'Enter the account holder name'
    if (draft.bank_name.trim().length < 2) next.bank_name = 'Enter the bank name'
    if (!IFSC.test(draft.ifsc)) next.ifsc = 'IFSC must be 11 characters like IDIB000T012'
    if (!ACCOUNT_NO.test(draft.account_no))
      next.account_no = 'Account number must be 9 to 18 digits'
    if (draft.pan && !PAN.test(draft.pan)) next.pan = 'PAN must look like ABCPV1234K'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await save({
        account_holder: draft.account_holder.trim(),
        bank_name: draft.bank_name.trim(),
        ifsc: draft.ifsc,
        account_no: draft.account_no,
        pan: draft.pan || null,
      })
      alerts.success('Bank details saved')
      onDone()
    } catch (error) {
      setErrors(fieldErrorsOf(error))
    }
  }

  const upper = (value: string) => value.replace(/\s/g, '').toUpperCase()

  return (
    <form id='bank-form' onSubmit={submit} noValidate className='grid gap-3 sm:grid-cols-2'>
      <RootError message={errors.root} />
      <FormField
        id='account_holder'
        label='Account holder'
        required
        error={errors.account_holder}
        className='sm:col-span-2'
      >
        <Input
          id='account_holder'
          autoFocus
          maxLength={120}
          value={draft.account_holder}
          onChange={(event) => set('account_holder', event.target.value)}
        />
      </FormField>
      <FormField id='bank_name' label='Bank' required error={errors.bank_name}>
        <Input
          id='bank_name'
          placeholder='Indian Bank'
          maxLength={80}
          value={draft.bank_name}
          onChange={(event) => set('bank_name', event.target.value)}
        />
      </FormField>
      <FormField id='ifsc' label='IFSC' required error={errors.ifsc}>
        <Input
          id='ifsc'
          placeholder='IDIB000T012'
          maxLength={11}
          className='font-mono uppercase'
          value={draft.ifsc}
          onChange={(event) => set('ifsc', upper(event.target.value))}
        />
      </FormField>
      <FormField id='account_no' label='Account number' required error={errors.account_no}>
        <Input
          id='account_no'
          inputMode='numeric'
          autoComplete='off'
          maxLength={18}
          className='font-mono'
          value={draft.account_no}
          onChange={(event) => set('account_no', event.target.value.replace(/\D/g, ''))}
        />
      </FormField>
      <FormField id='pan' label='PAN' error={errors.pan} hint='Optional'>
        <Input
          id='pan'
          placeholder='ABCPV1234K'
          autoComplete='off'
          maxLength={10}
          className='font-mono uppercase'
          value={draft.pan}
          onChange={(event) => set('pan', upper(event.target.value))}
        />
      </FormField>
    </form>
  )
}
