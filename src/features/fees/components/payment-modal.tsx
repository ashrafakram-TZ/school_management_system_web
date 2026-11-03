import { useState } from 'react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Input } from '@/components/ui/input'
import { alerts } from '@/lib/alerts'
import { today } from '@/features/attendance/labels'
import {
  feesApi,
  useFeesMutation,
  type FeeInvoice,
  type FeePayment,
  type PaymentMode,
} from '../api'
import { MODE_OPTIONS, amountError, formErrors, rupees } from '../labels'

const FORM_ID = 'fee-payment-form'

export function PaymentModal({
  invoice,
  onClose,
  onPaid,
}: {
  invoice: FeeInvoice
  onClose: () => void
  onPaid: (payment: FeePayment) => void
}) {
  const [amount, setAmount] = useState(String(invoice.balance))
  const [mode, setMode] = useState<PaymentMode | undefined>('cash')
  const [reference, setReference] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const pay = useFeesMutation(() =>
    feesApi.pay(invoice.id, {
      amount: Number(amount),
      mode: mode!,
      reference: reference.trim() || undefined,
      paid_on: paidOn,
      notes: notes.trim() || undefined,
    })
  )

  const clear = (field: string) => errors[field] && setErrors((prev) => ({ ...prev, [field]: '' }))

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title='Record payment'
      description={`${invoice.student.full_name} · ${invoice.invoice_no} · ${invoice.installment}. Balance ${rupees(invoice.balance)}.`}
      formId={FORM_ID}
      submitText='Record payment'
      loading={pay.isPending}
    >
      <form
        id={FORM_ID}
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          const next: Record<string, string> = {}
          const amountMessage = amountError(amount, invoice.balance)
          if (amountMessage) next.amount = amountMessage
          else if (Number(amount) <= 0) next.amount = 'Enter an amount more than 0'
          if (!mode) next.mode = 'Choose how it was paid'
          if (!paidOn) next.paid_on = 'Choose the payment date'
          else if (paidOn > today()) next.paid_on = 'Payment date cannot be in the future'
          if (mode && mode !== 'cash' && !reference.trim()) {
            next.reference = 'Enter the transaction, card or cheque reference'
          }
          setErrors(next)
          if (Object.keys(next).length) return
          try {
            const payment = await pay.mutateAsync(undefined)
            alerts.success(`Payment of ${rupees(payment.amount)} recorded`, {
              description: `Receipt ${payment.receipt_no} · balance ${rupees(payment.invoice_balance)}`,
            })
            onPaid(payment)
          } catch (error) {
            setErrors(
              formErrors(error, { PAYMENT_EXCEEDS_BALANCE: 'amount', INVOICE_PAID: 'amount' })
            )
          }
        }}
      >
        <FormField id='payment-amount' label='Amount' required error={errors.amount}>
          <div className='relative'>
            <span className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground'>
              ₹
            </span>
            <Input
              id='payment-amount'
              type='number'
              inputMode='decimal'
              min={0}
              step='0.01'
              className='tabular pl-7'
              value={amount}
              aria-invalid={Boolean(errors.amount) || undefined}
              onChange={(event) => {
                setAmount(event.target.value)
                clear('amount')
              }}
            />
          </div>
        </FormField>
        <FormField id='payment-mode' label='Paid by' required error={errors.mode}>
          <Combobox
            id='payment-mode'
            label='Paid by'
            value={mode}
            options={MODE_OPTIONS}
            placeholder='Choose how it was paid'
            searchPlaceholder='Search payment modes'
            invalid={Boolean(errors.mode)}
            highlightSelected={false}
            className='sm:w-full'
            onChange={(value) => {
              setMode(value as PaymentMode | undefined)
              clear('mode')
              clear('reference')
            }}
          />
        </FormField>
        <FormField
          id='payment-reference'
          label='Reference'
          required={Boolean(mode && mode !== 'cash')}
          error={errors.reference}
          hint='UPI transaction ID, card slip or cheque number'
        >
          <Input
            id='payment-reference'
            value={reference}
            maxLength={60}
            aria-invalid={Boolean(errors.reference) || undefined}
            onChange={(event) => {
              setReference(event.target.value)
              clear('reference')
            }}
          />
        </FormField>
        <FormField id='payment-date' label='Payment date' required error={errors.paid_on}>
          <Input
            id='payment-date'
            type='date'
            value={paidOn}
            max={today()}
            aria-invalid={Boolean(errors.paid_on) || undefined}
            onChange={(event) => {
              setPaidOn(event.target.value)
              clear('paid_on')
            }}
          />
        </FormField>
        <FormField id='payment-notes' label='Notes' error={errors.notes} className='sm:col-span-2'>
          <Input
            id='payment-notes'
            value={notes}
            maxLength={300}
            placeholder='Optional, for example who paid'
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </form>
    </AppModal>
  )
}
