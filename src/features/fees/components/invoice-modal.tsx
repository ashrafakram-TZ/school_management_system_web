import { useState } from 'react'
import { Ban, BadgePercent, FileDown, IndianRupee } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { alerts } from '@/lib/alerts'
import { formatDate } from '@/lib/format'
import {
  feesApi,
  useFeesMutation,
  useInvoice,
  type FeeInvoice,
  type FeeInvoiceDetail,
} from '../api'
import {
  INVOICE_STATUS,
  PAYMENT_MODES,
  amountError,
  formErrors,
  openReceipt,
  round2,
  rupees,
} from '../labels'

export function InvoiceStatusBadge({ invoice }: { invoice: FeeInvoice }) {
  if (invoice.is_overdue) {
    return (
      <Badge tone='danger'>
        Overdue {invoice.days_overdue} {invoice.days_overdue === 1 ? 'day' : 'days'}
      </Badge>
    )
  }
  const status = INVOICE_STATUS[invoice.status]
  return <Badge tone={status.tone}>{status.label}</Badge>
}

export function InvoiceModal({
  invoiceId,
  canManage,
  onClose,
  onRecordPayment,
}: {
  invoiceId: number
  canManage: boolean
  onClose: () => void
  onRecordPayment: (invoice: FeeInvoice) => void
}) {
  const invoice = useInvoice(invoiceId)
  const [editingDiscount, setEditingDiscount] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const cancel = useFeesMutation(() => feesApi.cancel(invoiceId))
  const data = invoice.data
  const open = canManage && data && data.status !== 'cancelled'

  const footer = open ? (
    <DialogFooter className='flex-wrap gap-2'>
      {data.paid === 0 && (
        <Button
          variant='ghost'
          className='text-destructive hover:bg-destructive/10'
          onClick={() => setCancelling(true)}
        >
          <Ban />
          Cancel invoice
        </Button>
      )}
      <Button variant='outline' onClick={() => setEditingDiscount(true)}>
        <BadgePercent />
        Discount
      </Button>
      {data.balance > 0 && (
        <Button onClick={() => onRecordPayment(data)}>
          <IndianRupee />
          Record payment
        </Button>
      )}
    </DialogFooter>
  ) : undefined

  return (
    <AppModal
      open
      onOpenChange={(next) => !next && onClose()}
      title={data ? `Invoice ${data.invoice_no}` : 'Invoice'}
      description={
        data
          ? `${data.student.full_name} · ${data.student.admission_no}${data.student.class_section ? ` · Class ${data.student.class_section}` : ''}`
          : undefined
      }
      size='lg'
      footer={footer ?? <span />}
    >
      {invoice.isPending ? (
        <div className='grid gap-3'>
          <Skeleton className='h-16' />
          <Skeleton className='h-40' />
        </div>
      ) : invoice.isError || !data ? (
        <ErrorState
          message={invoice.error?.message ?? 'Not found'}
          onRetry={() => invoice.refetch()}
        />
      ) : (
        <div className='grid min-w-0 gap-5'>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2 text-sm'>
            <InvoiceStatusBadge invoice={data} />
            <span>
              <span className='text-muted-foreground'>Installment </span>
              <span className='font-semibold'>{data.installment}</span>
            </span>
            <span>
              <span className='text-muted-foreground'>Due </span>
              <span className='tabular font-semibold'>{formatDate(data.due_date)}</span>
            </span>
          </div>
          {data.status === 'cancelled' && (
            <p className='rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground'>
              Cancelled{data.cancel_reason ? `: ${data.cancel_reason}` : ''}
            </p>
          )}
          <InvoiceLines invoice={data} />
          {editingDiscount && (
            <DiscountForm invoice={data} onDone={() => setEditingDiscount(false)} />
          )}
          <section className='grid gap-2'>
            <h3 className='text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
              Payments
            </h3>
            {data.payments.length ? (
              <ul className='divide-y rounded-lg border'>
                {data.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className='flex flex-wrap items-center justify-between gap-2 px-3 py-2.5'
                  >
                    <span className='grid min-w-0'>
                      <span className='tabular font-semibold'>
                        {rupees(payment.amount)}{' '}
                        <span className='font-normal text-muted-foreground'>
                          · {PAYMENT_MODES[payment.mode]}
                        </span>
                      </span>
                      <span className='truncate text-xs text-muted-foreground'>
                        {formatDate(payment.paid_on)} · {payment.receipt_no}
                        {payment.reference ? ` · ${payment.reference}` : ''}
                      </span>
                    </span>
                    <Button
                      size='sm'
                      variant='outline'
                      aria-label={`Receipt ${payment.receipt_no}`}
                      onClick={() => openReceipt(payment.id)}
                    >
                      <FileDown />
                      Receipt
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-sm text-muted-foreground'>No payments yet.</p>
            )}
          </section>
        </div>
      )}
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title='Cancel this invoice?'
        description={
          data
            ? `${data.invoice_no} for ${data.student.full_name} (${rupees(data.total)}) will no longer be due. You can raise the installment again later.`
            : ''
        }
        confirmText='Cancel invoice'
        destructive
        loading={cancel.isPending}
        onConfirm={async () => {
          try {
            await cancel.mutateAsync(undefined)
            alerts.success('Invoice cancelled')
            setCancelling(false)
          } catch (error) {
            formErrors(error)
            setCancelling(false)
          }
        }}
      />
    </AppModal>
  )
}

export function InvoiceLines({ invoice }: { invoice: FeeInvoiceDetail }) {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <table className='w-full text-sm'>
        <tbody className='divide-y'>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td className='px-3 py-2'>
                <span className='font-semibold'>{line.head_name}</span>
                {line.description && (
                  <span className='block text-xs text-muted-foreground'>{line.description}</span>
                )}
              </td>
              <td className='tabular px-3 py-2 text-right align-top'>{rupees(line.amount)}</td>
            </tr>
          ))}
          {invoice.discount > 0 && (
            <tr>
              <td className='px-3 py-2'>
                <span className='font-semibold'>Discount</span>
                {invoice.discount_reason && (
                  <span className='block text-xs text-muted-foreground'>
                    {invoice.discount_reason}
                  </span>
                )}
              </td>
              <td className='tabular px-3 py-2 text-right align-top text-success'>
                − {rupees(invoice.discount)}
              </td>
            </tr>
          )}
          <tr className='bg-muted/40 font-bold'>
            <td className='px-3 py-2'>Total</td>
            <td className='tabular px-3 py-2 text-right'>{rupees(invoice.total)}</td>
          </tr>
          <tr>
            <td className='px-3 py-2 text-muted-foreground'>Paid</td>
            <td className='tabular px-3 py-2 text-right'>{rupees(invoice.paid)}</td>
          </tr>
          <tr className='font-bold'>
            <td className='px-3 py-2'>Balance</td>
            <td className='tabular px-3 py-2 text-right'>{rupees(invoice.balance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function DiscountForm({ invoice, onDone }: { invoice: FeeInvoiceDetail; onDone: () => void }) {
  const [amount, setAmount] = useState(String(invoice.discount || ''))
  const [reason, setReason] = useState(invoice.discount_reason ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const max = round2(invoice.gross - invoice.paid)
  const save = useFeesMutation(() =>
    feesApi.discount(invoice.id, Number(amount || 0), reason.trim() || null)
  )

  return (
    <form
      noValidate
      className='grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start'
      onSubmit={async (event) => {
        event.preventDefault()
        const next: Record<string, string> = {}
        const message = amount.trim() ? amountError(amount, max, 'discount') : undefined
        if (message) next.discount = message
        if (Number(amount) > 0 && reason.trim().length < 3) next.reason = 'Give the reason'
        setErrors(next)
        if (Object.keys(next).length) return
        try {
          await save.mutateAsync(undefined)
          alerts.success(Number(amount) > 0 ? 'Discount saved' : 'Discount removed')
          onDone()
        } catch (error) {
          setErrors(formErrors(error, { DISCOUNT_TOO_HIGH: 'discount' }))
        }
      }}
    >
      <FormField id='discount-amount' label='Discount' error={errors.discount}>
        <Input
          id='discount-amount'
          type='number'
          inputMode='decimal'
          min={0}
          step='0.01'
          className='tabular'
          value={amount}
          placeholder='0'
          aria-invalid={Boolean(errors.discount) || undefined}
          onChange={(event) => setAmount(event.target.value)}
        />
      </FormField>
      <FormField id='discount-reason' label='Reason' error={errors.reason}>
        <Input
          id='discount-reason'
          value={reason}
          maxLength={200}
          placeholder='For example: sibling concession'
          aria-invalid={Boolean(errors.reason) || undefined}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      <div className='flex gap-2 sm:pt-6'>
        <Button type='button' variant='ghost' onClick={onDone}>
          Close
        </Button>
        <Button type='submit' loading={save.isPending}>
          Save
        </Button>
      </div>
      <p className='text-xs text-muted-foreground sm:col-span-3'>
        Up to {rupees(max)}. Enter 0 to remove the discount.
      </p>
    </form>
  )
}
