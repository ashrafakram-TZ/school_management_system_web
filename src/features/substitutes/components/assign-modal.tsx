import { useState } from 'react'
import { UserRoundSearch } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { EmptyState, ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { SegmentedControl } from '@/components/common/segmented-control'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/input'
import { alerts } from '@/lib/alerts'
import { cn } from '@/lib/utils'
import { fieldErrorsOf } from '@/features/setup/form-actions'
import {
  substitutesApi,
  useCombineOptions,
  useFreeTeachers,
  useSubstituteMutation,
  type AbsentPeriod,
  type AssignInput,
  type CombineInput,
  type FreeTeacher,
} from '../api'
import { countText, periodSummary } from '../labels'
import { CombinePanel, type CombineDraft } from './combine-panel'

const FORM_FIELDS = [
  'substitute_user_id',
  'note',
  'section_id',
  'boys_section_id',
  'girls_section_id',
]

type CoverChoice = 'proxy' | 'combine'

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
  const [choice, setChoice] = useState<CoverChoice>('proxy')
  const free = useFreeTeachers(date, period.slot_id)
  const combineOptions = useCombineOptions(date, period.slot_id, choice === 'combine')
  const [selected, setSelected] = useState<number | null>(null)
  const [combine, setCombine] = useState<CombineDraft>({ mode: 'whole' })
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSubstituteMutation((input: AssignInput) => substitutesApi.assign(input))
  const merge = useSubstituteMutation((input: CombineInput) => substitutesApi.combine(input))
  const teachers = free.data?.teachers ?? []
  const noTargets = choice === 'combine' && combineOptions.data?.targets.length === 0

  const combineErrors = () => {
    const next: Record<string, string> = {}
    if (combine.mode === 'whole' && !combine.section_id)
      next.section_id = 'Choose the section the class joins'
    if (combine.mode === 'split') {
      if (!combine.boys_section_id) next.boys_section_id = 'Choose the section for the boys'
      if (!combine.girls_section_id) next.girls_section_id = 'Choose the section for the girls'
      if (combine.boys_section_id && combine.boys_section_id === combine.girls_section_id)
        next.girls_section_id =
          'Choose a different section for the girls, or send the whole class to one section'
    }
    return next
  }

  const submitCombine = async () => {
    if (noTargets) {
      alerts.error('No other section has a class now. Assign a proxy teacher instead.')
      return
    }
    const next = combineErrors()
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await merge.mutateAsync({
        date,
        slot_id: period.slot_id,
        mode: combine.mode,
        ...(combine.mode === 'whole'
          ? { section_id: combine.section_id }
          : {
              boys_section_id: combine.boys_section_id,
              girls_section_id: combine.girls_section_id,
            }),
        note: note.trim() || null,
      })
      alerts.success(`Period ${period.period_no} of ${period.section.name} combined`)
      onClose()
    } catch (error) {
      const fields = fieldErrorsOf(error)
      const other = Object.keys(fields).find((key) => !FORM_FIELDS.includes(key))
      if (other) alerts.error(fields[other])
      setErrors(fields)
      void combineOptions.refetch()
    }
  }

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title='Cover this period'
      description={`${teacherName} is away · ${periodSummary(period)}`}
      formId='assign-substitute-form'
      submitText={choice === 'proxy' ? 'Assign proxy' : 'Combine class'}
      loading={save.isPending || merge.isPending}
      size='lg'
    >
      <form
        id='assign-substitute-form'
        noValidate
        className='grid min-w-0 gap-4'
        onSubmit={async (event) => {
          event.preventDefault()
          if (choice === 'combine') {
            await submitCombine()
            return
          }
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
        <SegmentedControl
          label='How to cover'
          value={choice}
          onChange={(value) => {
            setChoice(value)
            setErrors({})
          }}
          options={[
            { value: 'proxy', label: 'Proxy teacher' },
            { value: 'combine', label: 'Combine class' },
          ]}
          className='w-fit'
        />
        {choice === 'combine' ? (
          <CombinePanel
            options={combineOptions.data}
            loading={combineOptions.isPending}
            error={combineOptions.isError ? combineOptions.error.message : undefined}
            onRetry={() => void combineOptions.refetch()}
            draft={combine}
            errors={errors}
            onChange={(patch) => {
              setCombine((current) => ({ ...current, ...patch }))
              setErrors({})
            }}
          />
        ) : (
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
        )}
        <FormField
          id='substitute-note'
          label={choice === 'proxy' ? 'Note for the proxy teacher' : 'Note for the teachers'}
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
