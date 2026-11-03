import { useState } from 'react'
import { AppModal } from '@/components/common/app-modal'
import { FormField } from '@/components/common/form-field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { alerts } from '@/lib/alerts'
import { feesApi, useFeesMutation, type FeeHead, type FeeHeadInput } from '../api'
import { formErrors } from '../labels'

const FORM_ID = 'fee-head-form'

export function HeadModal({ head, onClose }: { head: FeeHead | null; onClose: () => void }) {
  const [name, setName] = useState(head?.name ?? '')
  const [code, setCode] = useState(head?.code ?? '')
  const [transport, setTransport] = useState(head?.is_transport ?? false)
  const [active, setActive] = useState(head?.is_active ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useFeesMutation((input: FeeHeadInput) =>
    head ? feesApi.updateHead(head.id, input) : feesApi.createHead(input)
  )

  const toggle = (
    id: string,
    label: string,
    hint: string,
    checked: boolean,
    onChange: (value: boolean) => void
  ) => (
    <div className='flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 sm:col-span-2'>
      <span className='grid min-w-0 gap-0.5'>
        <label htmlFor={id} className='text-sm font-semibold'>
          {label}
        </label>
        <span className='text-xs text-muted-foreground'>{hint}</span>
      </span>
      <Switch id={id} aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  )

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={head ? `Edit ${head.name}` : 'Add fee head'}
      description='A fee head is one kind of charge on an invoice, such as tuition or books.'
      formId={FORM_ID}
      submitText={head ? 'Save head' : 'Add head'}
      loading={save.isPending}
    >
      <form
        id={FORM_ID}
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          const next: Record<string, string> = {}
          if (name.trim().length < 2) next.name = 'Enter a name of at least 2 letters'
          if (!/^[A-Za-z0-9_]{2,20}$/.test(code.trim())) {
            next.code = 'Use 2 to 20 letters, digits or underscores'
          }
          setErrors(next)
          if (Object.keys(next).length) return
          try {
            await save.mutateAsync({
              name: name.trim(),
              code: code.trim().toUpperCase(),
              is_transport: transport,
              is_active: active,
            })
            alerts.success(head ? 'Fee head saved' : 'Fee head added')
            onClose()
          } catch (error) {
            setErrors(
              formErrors(error, {
                FEE_HEAD_EXISTS: 'code',
                TRANSPORT_HEAD_EXISTS: 'is_transport',
                FEE_HEAD_IN_USE: 'is_transport',
              })
            )
          }
        }}
      >
        <FormField id='head-name' label='Name' required error={errors.name}>
          <Input
            id='head-name'
            value={name}
            maxLength={60}
            placeholder='Tuition fee'
            aria-invalid={Boolean(errors.name) || undefined}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField id='head-code' label='Code' required error={errors.code}>
          <Input
            id='head-code'
            value={code}
            maxLength={20}
            placeholder='TUITION'
            className='font-mono uppercase'
            aria-invalid={Boolean(errors.code) || undefined}
            onChange={(event) => setCode(event.target.value)}
          />
        </FormField>
        {toggle(
          'head-transport',
          'Transport head',
          'Charged from each student’s bus stop fee, not from the class plan',
          transport,
          setTransport
        )}
        {errors.is_transport && (
          <p role='alert' className='text-xs font-medium text-destructive sm:col-span-2'>
            {errors.is_transport}
          </p>
        )}
        {toggle(
          'head-active',
          'Active',
          'Inactive heads stay on old invoices but cannot be added to plans',
          active,
          setActive
        )}
      </form>
    </AppModal>
  )
}
