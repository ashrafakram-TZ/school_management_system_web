import { useState } from 'react'
import { CalendarRange, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { setupApi, useAcademicYears, useSetupMutation, type AcademicYear, type Term } from '../api'
import { fieldErrorsOf, run } from '../form-actions'
import { RootError, Section } from './setup-shared'

type RangeForm =
  { kind: 'year'; year?: AcademicYear } | { kind: 'term'; year: AcademicYear; term?: Term }

export function YearsTab({ canManage }: { canManage: boolean }) {
  const years = useAcademicYears()
  const [form, setForm] = useState<RangeForm | null>(null)
  const [removing, setRemoving] = useState<{
    kind: 'year' | 'term'
    id: number
    name: string
  } | null>(null)
  const makeCurrent = useSetupMutation((id: number) =>
    setupApi.updateYear(id, { is_current: true })
  )
  const remove = useSetupMutation((target: { kind: 'year' | 'term'; id: number }) =>
    target.kind === 'year' ? setupApi.removeYear(target.id) : setupApi.removeTerm(target.id)
  )

  if (years.isError)
    return <ErrorState message={years.error.message} onRetry={() => years.refetch()} />
  if (!years.data) return <Skeleton className='h-72' />

  return (
    <Section
      title='Academic years and terms'
      description='Exactly one year is current. Classes, sections and enrolments belong to a year.'
      action={
        canManage && (
          <Button size='sm' onClick={() => setForm({ kind: 'year' })}>
            <Plus />
            Add year
          </Button>
        )
      }
    >
      {years.data.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title='No academic year yet'
          description='Add the current year first, for example 2026-27 from June to April.'
          action={
            canManage && (
              <Button onClick={() => setForm({ kind: 'year' })}>
                <Plus />
                Add year
              </Button>
            )
          }
        />
      ) : (
        <div className='grid gap-4 lg:grid-cols-2'>
          {years.data.map((year) => (
            <article
              key={year.id}
              className={`grid content-start gap-3 rounded-xl border p-4 ${year.is_current ? 'border-primary/50 bg-primary/5' : ''}`}
            >
              <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='grid gap-0.5'>
                  <div className='flex items-center gap-2'>
                    <h3 className='text-lg font-extrabold tracking-tight'>{year.name}</h3>
                    {year.is_current && (
                      <Badge tone='success' dot>
                        Current
                      </Badge>
                    )}
                  </div>
                  <span className='text-xs text-muted-foreground'>
                    {formatDate(year.start_date)} to {formatDate(year.end_date)}
                  </span>
                </div>
                {canManage && (
                  <div className='flex gap-1'>
                    {!year.is_current && (
                      <Button
                        size='sm'
                        variant='outline'
                        loading={makeCurrent.isPending && makeCurrent.variables === year.id}
                        onClick={() =>
                          run(
                            () => makeCurrent.mutateAsync(year.id),
                            `${year.name} is now the current year`
                          )
                        }
                      >
                        <Star />
                        Make current
                      </Button>
                    )}
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label={`Edit ${year.name}`}
                      onClick={() => setForm({ kind: 'year', year })}
                    >
                      <Pencil />
                    </Button>
                    {!year.is_current && (
                      <Button
                        size='icon-sm'
                        variant='ghost'
                        aria-label={`Delete ${year.name}`}
                        className='text-destructive hover:bg-destructive/10'
                        onClick={() => setRemoving({ kind: 'year', id: year.id, name: year.name })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <ul className='grid gap-1.5'>
                {year.terms.map((term) => (
                  <li
                    key={term.id}
                    className='flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm'
                  >
                    <span className='font-semibold'>{term.name}</span>
                    <span className='flex items-center gap-1'>
                      <span className='text-xs text-muted-foreground'>
                        {formatDate(term.start_date)} – {formatDate(term.end_date)}
                      </span>
                      {canManage && (
                        <>
                          <Button
                            size='icon-sm'
                            variant='ghost'
                            aria-label={`Edit ${term.name}`}
                            onClick={() => setForm({ kind: 'term', year, term })}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size='icon-sm'
                            variant='ghost'
                            aria-label={`Delete ${term.name}`}
                            className='text-destructive hover:bg-destructive/10'
                            onClick={() =>
                              setRemoving({ kind: 'term', id: term.id, name: term.name })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
                {year.terms.length === 0 && (
                  <li className='text-xs text-muted-foreground'>No terms yet.</li>
                )}
              </ul>
              {canManage && (
                <Button
                  size='sm'
                  variant='ghost'
                  className='justify-self-start'
                  onClick={() => setForm({ kind: 'term', year })}
                >
                  <Plus />
                  Add term
                </Button>
              )}
            </article>
          ))}
        </div>
      )}

      {form && <RangeModal form={form} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete ${removing?.name ?? ''}?`}
        description={
          removing?.kind === 'year'
            ? 'Only a year with no sections or students can be deleted.'
            : 'The term is removed from this year.'
        }
        confirmText='Delete'
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (removing) await run(() => remove.mutateAsync(removing), `${removing.name} deleted`)
          setRemoving(null)
        }}
      />
    </Section>
  )
}

function RangeModal({ form, onClose }: { form: RangeForm; onClose: () => void }) {
  const existing = form.kind === 'year' ? form.year : form.term
  const [name, setName] = useState(existing?.name ?? '')
  const [start, setStart] = useState(existing?.start_date ?? '')
  const [end, setEnd] = useState(existing?.end_date ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSetupMutation(async () => {
    const input = { name: name.trim(), start_date: start, end_date: end }
    if (form.kind === 'year')
      return form.year ? setupApi.updateYear(form.year.id, input) : setupApi.createYear(input)
    return form.term
      ? setupApi.updateTerm(form.term.id, input)
      : setupApi.addTerm(form.year.id, input)
  })
  const label = form.kind === 'year' ? 'academic year' : `term in ${form.year.name}`

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${existing ? 'Edit' : 'Add'} ${label}`}
      formId='range-form'
      submitText={existing ? 'Save' : 'Add'}
      loading={save.isPending}
    >
      <form
        id='range-form'
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          const next: Record<string, string> = {}
          if (!name.trim())
            next.name =
              form.kind === 'year' ? 'Enter a name like 2026-27' : 'Enter a name like Term 1'
          if (!start) next.start_date = 'Choose the start date'
          if (!end) next.end_date = 'Choose the end date'
          setErrors(next)
          if (Object.keys(next).length) return
          try {
            await save.mutateAsync(undefined)
            onClose()
          } catch (error) {
            setErrors(fieldErrorsOf(error))
          }
        }}
      >
        <RootError message={errors.root} />
        <FormField
          id='range-name'
          label='Name'
          required
          error={errors.name}
          className='sm:col-span-2'
        >
          <Input
            id='range-name'
            autoFocus
            placeholder={form.kind === 'year' ? '2026-27' : 'Term 1'}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField id='range-start' label='Starts' required error={errors.start_date}>
          <Input
            id='range-start'
            type='date'
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </FormField>
        <FormField id='range-end' label='Ends' required error={errors.end_date}>
          <Input
            id='range-end'
            type='date'
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </FormField>
      </form>
    </AppModal>
  )
}
