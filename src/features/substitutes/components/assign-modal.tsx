import { useState } from 'react'
import { UserRoundSearch } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { EmptyState, ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/input'
import { alerts } from '@/lib/alerts'
import { cn } from '@/lib/utils'
import { fieldErrorsOf } from '@/features/setup/form-actions'
import {
  substitutesApi,
  useFreeTeachers,
  useSubstituteMutation,
  type AbsentPeriod,
  type AssignInput,
  type FreeTeacher,
} from '../api'
import { countText, periodSummary } from '../labels'

const FORM_FIELDS = ['substitute_user_id', 'note']

function TeacherOption({
  item,
  best,
  checked,
  onSelect,
}: {
  item: FreeTeacher
  best: boolean
  checked: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60',
        checked && 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
      )}
    >
      <input
        type='radio'
        name='substitute-teacher'
        value={item.teacher.id}
        checked={checked}
        onChange={onSelect}
        className='mt-1 size-4 shrink-0 accent-primary'
      />
      <span className='grid min-w-0 flex-1 gap-1.5'>
        <span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
          <span className='font-bold'>{item.teacher.name}</span>
          {best && <Badge tone='success'>Best match</Badge>}
        </span>
        {item.department && (
          <span className='text-xs text-muted-foreground'>{item.department}</span>
        )}
        <span className='flex flex-wrap gap-1.5'>
          {item.same_subject && <Badge tone='success'>Same subject</Badge>}
          {item.knows_section && <Badge tone='info'>Knows class</Badge>}
          <Badge tone='neutral'>{countText(item.periods_today, 'period', 'periods')} today</Badge>
          <Badge tone={item.substitutions_this_week ? 'warning' : 'neutral'}>
            {countText(item.substitutions_this_week, 'proxy', 'proxies')} this week
          </Badge>
        </span>
      </span>
    </label>
  )
}

export function AssignModal({
  date,
  teacherName,
  period,
  onClose,
}: {
  date: string
  teacherName: string
  period: AbsentPeriod
  onClose: () => void
}) {
  const free = useFreeTeachers(date, period.slot_id)
  const [selected, setSelected] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSubstituteMutation((input: AssignInput) => substitutesApi.assign(input))
  const teachers = free.data?.teachers ?? []

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title='Assign a proxy'
      description={`${teacherName} is away · ${periodSummary(period)}`}
      formId='assign-substitute-form'
      submitText='Assign proxy'
      loading={save.isPending}
      size='lg'
    >
      <form
        id='assign-substitute-form'
        noValidate
        className='grid min-w-0 gap-4'
        onSubmit={async (event) => {
          event.preventDefault()
          if (!selected) {
            setErrors({ substitute_user_id: 'Choose a teacher to take this period' })
            return
          }
          setErrors({})
          try {
            await save.mutateAsync({
              date,
              slot_id: period.slot_id,
              substitute_user_id: selected,
              note: note.trim() || null,
            })
            const name = teachers.find((item) => item.teacher.id === selected)?.teacher.name
            alerts.success(`${name ?? 'Proxy'} will take period ${period.period_no}`)
            onClose()
          } catch (error) {
            const fields = fieldErrorsOf(error)
            const other = Object.keys(fields).find((key) => !FORM_FIELDS.includes(key))
            if (other) alerts.error(fields[other])
            setErrors(fields)
            if (fields.root || other) void free.refetch()
          }
        }}
      >
        <FormField
          id='substitute-teacher'
          label='Free teachers, best match first'
          required
          error={errors.substitute_user_id}
        >
          {free.isPending ? (
            <div className='grid gap-2'>
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className='h-20' />
              ))}
            </div>
          ) : free.isError ? (
            <ErrorState message={free.error.message} onRetry={() => free.refetch()} />
          ) : teachers.length === 0 ? (
            <EmptyState
              icon={UserRoundSearch}
              title='No teacher is free in this period'
              description='Every teacher is teaching, away or already covering another class at this time.'
              className='py-8'
            />
          ) : (
            <div
              id='substitute-teacher'
              role='radiogroup'
              aria-label='Free teachers'
              className='grid max-h-80 gap-2 overflow-y-auto overscroll-contain pr-1'
            >
              {teachers.map((item, index) => (
                <TeacherOption
                  key={item.teacher.id}
                  item={item}
                  best={index === 0}
                  checked={selected === item.teacher.id}
                  onSelect={() => {
                    setSelected(item.teacher.id)
                    setErrors((prev) => ({ ...prev, substitute_user_id: '' }))
                  }}
                />
              ))}
            </div>
          )}
        </FormField>
        <FormField
          id='substitute-note'
          label='Note for the proxy teacher'
          error={errors.note}
          hint='Optional. Shown to the teacher in the Staff app.'
        >
          <Textarea
            id='substitute-note'
            maxLength={255}
            placeholder='Revise chapter 4'
            value={note}
            aria-invalid={Boolean(errors.note) || undefined}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </form>
    </AppModal>
  )
}
