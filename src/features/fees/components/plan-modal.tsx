import { useState } from 'react'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { alerts } from '@/lib/alerts'
import {
  feesApi,
  useFeesMutation,
  useFeePlan,
  type FeeHead,
  type FeePlan,
  type FeePlanLineInput,
} from '../api'
import { MAX_AMOUNT, amountError, formErrors, round2, rupees } from '../labels'

const FORM_ID = 'fee-plan-form'

interface InstallmentDraft {
  key: number
  name: string
  due_date: string
  amounts: Record<number, string>
}

const amountOf = (value: string | undefined) => {
  const number = Number(value)
  return !value?.trim() || Number.isNaN(number) ? 0 : number
}

function draftsOf(plan: FeePlan): InstallmentDraft[] {
  const groups = new Map<string, InstallmentDraft>()
  for (const line of plan.lines) {
    const draft = groups.get(line.installment) ?? {
      key: groups.size + 1,
      name: line.installment,
      due_date: line.due_date,
      amounts: {},
    }
    draft.amounts[line.fee_head_id] = String(line.amount)
    groups.set(line.installment, draft)
  }
  const drafts = [...groups.values()].sort((a, b) => a.due_date.localeCompare(b.due_date))
  return drafts.length ? drafts : [{ key: 1, name: 'Term 1', due_date: '', amounts: {} }]
}

export function PlanModal({
  classId,
  className,
  heads,
  onClose,
}: {
  classId: number
  className: string
  heads: FeeHead[]
  onClose: () => void
}) {
  const plan = useFeePlan(classId)
  const save = useFeesMutation((lines: FeePlanLineInput[]) => feesApi.setPlan(classId, lines))

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Fee plan for class ${className}`}
      description={
        plan.data
          ? `${plan.data.academic_year}. Amounts per student for each installment. Transport is added from each student’s bus stop when invoices are raised.`
          : undefined
      }
      size='xl'
      formId={plan.data ? FORM_ID : undefined}
      submitText='Save plan'
      loading={save.isPending}
    >
      {plan.isPending ? (
        <div className='grid gap-3'>
          <Skeleton className='h-10' />
          <Skeleton className='h-40' />
        </div>
      ) : plan.isError || !plan.data ? (
        <ErrorState message={plan.error?.message ?? 'Not found'} onRetry={() => plan.refetch()} />
      ) : (
        <PlanForm
          plan={plan.data}
          heads={heads}
          save={(lines) => save.mutateAsync(lines)}
          onClose={onClose}
        />
      )}
    </AppModal>
  )
}

function PlanForm({
  plan,
  heads,
  save,
  onClose,
}: {
  plan: FeePlan
  heads: FeeHead[]
  save: (lines: FeePlanLineInput[]) => Promise<FeePlan>
  onClose: () => void
}) {
  const [drafts, setDrafts] = useState<InstallmentDraft[]>(() => draftsOf(plan))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const planHeadIds = new Set(plan.lines.map((line) => line.fee_head_id))
  const columns = heads.filter(
    (head) => !head.is_transport && (head.is_active || planHeadIds.has(head.id))
  )

  const update = (key: number, patch: Partial<InstallmentDraft>) =>
    setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)))
  const subtotal = (draft: InstallmentDraft) =>
    round2(columns.reduce((sum, head) => sum + amountOf(draft.amounts[head.id]), 0))
  const total = round2(drafts.reduce((sum, draft) => sum + subtotal(draft), 0))

  return (
    <form
      id={FORM_ID}
      noValidate
      className='grid min-w-0 gap-4'
      onSubmit={async (event) => {
        event.preventDefault()
        const next: Record<string, string> = {}
        const names = new Set<string>()
        for (const draft of drafts) {
          const name = draft.name.trim()
          if (!name) next[`${draft.key}.name`] = 'Enter the installment name'
          else if (names.has(name.toLowerCase())) next[`${draft.key}.name`] = 'Name used twice'
          names.add(name.toLowerCase())
          if (!draft.due_date) next[`${draft.key}.due_date`] = 'Choose the due date'
          for (const head of columns) {
            const value = draft.amounts[head.id] ?? ''
            const message = value.trim() ? amountError(value, MAX_AMOUNT) : undefined
            if (message) next[`${draft.key}.${head.id}`] = message
          }
        }
        setErrors(next)
        if (Object.keys(next).length) return
        const lines = drafts.flatMap((draft) =>
          columns
            .filter((head) => amountOf(draft.amounts[head.id]) > 0)
            .map((head) => ({
              fee_head_id: head.id,
              installment: draft.name.trim(),
              amount: amountOf(draft.amounts[head.id]),
              due_date: draft.due_date,
            }))
        )
        try {
          await save(lines)
          alerts.success('Fee plan saved', {
            description: `${drafts.length} installments · ${rupees(total)} a year`,
          })
          onClose()
        } catch (error) {
          const fields = formErrors(error)
          const mapped: Record<string, string> = {}
          for (const [field, message] of Object.entries(fields)) {
            const match = /^lines\.(\d+)\.(\w+)$/.exec(field)
            const line = match ? lines[Number(match[1])] : undefined
            const draft = line && drafts.find((item) => item.name.trim() === line.installment)
            if (!draft || !line) continue
            mapped[
              match![2] === 'fee_head_id' || match![2] === 'amount'
                ? `${draft.key}.${line.fee_head_id}`
                : `${draft.key}.${match![2] === 'installment' ? 'name' : 'due_date'}`
            ] = message
          }
          setErrors(mapped)
          if (!Object.keys(mapped).length && Object.keys(fields).length) {
            alerts.error(Object.values(fields)[0]!)
          }
        }
      }}
    >
      {!columns.length && (
        <p className='rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground'>
          Add a fee head such as tuition first.
        </p>
      )}
      {drafts.map((draft) => (
        <fieldset key={draft.key} className='grid min-w-0 gap-3 rounded-xl border p-3 sm:p-4'>
          <legend className='sr-only'>{draft.name || 'Installment'}</legend>
          <div className='grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-start'>
            <FormField
              id={`plan-${draft.key}-name`}
              label='Installment'
              required
              error={errors[`${draft.key}.name`]}
            >
              <Input
                id={`plan-${draft.key}-name`}
                value={draft.name}
                maxLength={40}
                placeholder='Term 1'
                aria-invalid={Boolean(errors[`${draft.key}.name`]) || undefined}
                onChange={(event) => update(draft.key, { name: event.target.value })}
              />
            </FormField>
            <FormField
              id={`plan-${draft.key}-due`}
              label='Due date'
              required
              error={errors[`${draft.key}.due_date`]}
            >
              <Input
                id={`plan-${draft.key}-due`}
                type='date'
                value={draft.due_date}
                aria-invalid={Boolean(errors[`${draft.key}.due_date`]) || undefined}
                onChange={(event) => update(draft.key, { due_date: event.target.value })}
              />
            </FormField>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-destructive hover:bg-destructive/10 sm:mt-6'
              disabled={drafts.length === 1}
              aria-label={`Remove ${draft.name || 'installment'}`}
              onClick={() => setDrafts((prev) => prev.filter((item) => item.key !== draft.key))}
            >
              <Trash2 />
              Remove
            </Button>
          </div>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {columns.map((head) => {
              const id = `plan-${draft.key}-${head.id}`
              return (
                <FormField
                  key={head.id}
                  id={id}
                  label={head.is_active ? head.name : `${head.name} (switched off)`}
                  error={errors[`${draft.key}.${head.id}`]}
                >
                  <div className='relative'>
                    <span className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground'>
                      ₹
                    </span>
                    <Input
                      id={id}
                      type='number'
                      inputMode='decimal'
                      min={0}
                      step='0.01'
                      placeholder='0'
                      className='tabular pl-7'
                      value={draft.amounts[head.id] ?? ''}
                      aria-invalid={Boolean(errors[`${draft.key}.${head.id}`]) || undefined}
                      onChange={(event) =>
                        update(draft.key, {
                          amounts: { ...draft.amounts, [head.id]: event.target.value },
                        })
                      }
                    />
                  </div>
                </FormField>
              )
            })}
          </div>
          <div className='flex justify-end text-sm'>
            <span className='text-muted-foreground'>
              {draft.name.trim() || 'Installment'} total{' '}
              <span className='tabular font-bold text-foreground'>{rupees(subtotal(draft))}</span>
            </span>
          </div>
        </fieldset>
      ))}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Button
          type='button'
          variant='outline'
          onClick={() =>
            setDrafts((prev) => [
              ...prev,
              {
                key: Math.max(0, ...prev.map((item) => item.key)) + 1,
                name: `Term ${prev.length + 1}`,
                due_date: '',
                amounts: {},
              },
            ])
          }
        >
          <CalendarPlus />
          Add installment
        </Button>
        <span className='text-sm text-muted-foreground'>
          Year total{' '}
          <span className='tabular text-base font-extrabold text-foreground'>{rupees(total)}</span>
        </span>
      </div>
    </form>
  )
}
