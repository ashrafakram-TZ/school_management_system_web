import { useState } from 'react'
import { Check } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Input } from '@/components/ui/input'
import { RootError } from '@/features/setup/components/setup-shared'
import { fieldErrorsOf } from '@/features/setup/form-actions'
import { useAcademicYears, useClasses } from '@/features/setup/api'
import { alerts } from '@/lib/alerts'
import { cn } from '@/lib/utils'
import { examsApi, useExamMutation, type Exam, type ExamInput } from '../api'
import { studentsText } from '../labels'

export function ExamModal({
  open,
  exam,
  onClose,
  onCreated,
}: {
  open: boolean
  exam?: Exam
  onClose: () => void
  onCreated: (exam: Exam) => void
}) {
  return (
    <AppModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={exam ? `Edit ${exam.name}` : 'New exam'}
      description={
        exam
          ? 'Rename, move the dates or change the classes. A class that already has marks cannot be removed.'
          : 'Each class gets its subjects with max 100 and pass 35. You can change them next.'
      }
      formId='exam-form'
      submitText={exam ? 'Save' : 'Create exam'}
      size='lg'
    >
      {open && <ExamForm exam={exam} onClose={onClose} onCreated={onCreated} />}
    </AppModal>
  )
}

function ExamForm({
  exam,
  onClose,
  onCreated,
}: {
  exam?: Exam
  onClose: () => void
  onCreated: (exam: Exam) => void
}) {
  const years = useAcademicYears()
  const classes = useClasses()
  const [name, setName] = useState(exam?.name ?? '')
  const [termId, setTermId] = useState<string | undefined>(
    exam?.term ? String(exam.term.id) : undefined
  )
  const [start, setStart] = useState(exam?.start_date ?? '')
  const [end, setEnd] = useState(exam?.end_date ?? '')
  const [classIds, setClassIds] = useState<number[]>(exam?.classes.map((item) => item.id) ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useExamMutation((input: ExamInput) =>
    exam ? examsApi.update(exam.id, input) : examsApi.create(input)
  )

  const year = (years.data ?? []).find((item) =>
    exam ? item.id === exam.academic_year.id : item.is_current
  )
  const termOptions = (year?.terms ?? []).map((term) => ({
    value: String(term.id),
    label: term.name,
    hint: `${term.start_date} to ${term.end_date}`,
  }))
  const toggle = (id: number) =>
    setClassIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )

  return (
    <form
      id='exam-form'
      noValidate
      className='grid gap-4 sm:grid-cols-2'
      onSubmit={async (event) => {
        event.preventDefault()
        const next: Record<string, string> = {}
        if (name.trim().length < 2) next.name = 'Enter the exam name'
        if (!start) next.start_date = 'Choose the first day'
        if (!end) next.end_date = 'Choose the last day'
        if (start && end && end < start) next.end_date = 'Must be on or after the first day'
        if (!classIds.length) next.class_ids = 'Pick at least one class'
        setErrors(next)
        if (Object.keys(next).length) return
        try {
          const saved = await save.mutateAsync({
            name: name.trim(),
            term_id: termId ? Number(termId) : null,
            start_date: start,
            end_date: end,
            class_ids: classIds,
          })
          if (exam) {
            alerts.success(`${saved.name} saved`)
            onClose()
          } else {
            alerts.success(`${saved.name} created`, {
              description: 'Check the subjects and max marks next.',
            })
            onCreated(saved)
          }
        } catch (error) {
          setErrors(fieldErrorsOf(error))
        }
      }}
    >
      <RootError message={errors.root} />
      <FormField id='exam-name' label='Exam name' required error={errors.name}>
        <Input
          id='exam-name'
          autoFocus
          placeholder='Quarterly exam'
          value={name}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <FormField
        id='exam-term'
        label='Term'
        error={errors.term_id}
        hint={year ? `Academic year ${year.name}` : undefined}
      >
        <Combobox
          id='exam-term'
          label='Term'
          value={termId}
          options={termOptions}
          allLabel='No term'
          placeholder='No term'
          searchPlaceholder='Search terms'
          emptyText='No terms in this year'
          onChange={setTermId}
          className='sm:w-full'
        />
      </FormField>
      <FormField id='exam-start' label='First day' required error={errors.start_date}>
        <Input
          id='exam-start'
          type='date'
          value={start}
          min={year?.start_date}
          max={year?.end_date}
          aria-invalid={Boolean(errors.start_date)}
          onChange={(event) => setStart(event.target.value)}
        />
      </FormField>
      <FormField id='exam-end' label='Last day' required error={errors.end_date}>
        <Input
          id='exam-end'
          type='date'
          value={end}
          min={start || year?.start_date}
          max={year?.end_date}
          aria-invalid={Boolean(errors.end_date)}
          onChange={(event) => setEnd(event.target.value)}
        />
      </FormField>
      <div className='grid gap-1.5 sm:col-span-2'>
        <span className='text-sm font-medium'>
          Classes<span className='ml-0.5 text-destructive'>*</span>
        </span>
        <div role='group' aria-label='Classes writing this exam' className='flex flex-wrap gap-1.5'>
          {(classes.data ?? []).map((item) => {
            const selected = classIds.includes(item.id)
            return (
              <button
                key={item.id}
                type='button'
                aria-pressed={selected}
                title={studentsText(item.student_count)}
                onClick={() => toggle(item.id)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                  selected
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {selected && <Check className='size-3.5' />}
                Class {item.name}
                <span className='tabular font-normal opacity-70'>{item.student_count}</span>
              </button>
            )
          })}
        </div>
        {errors.class_ids ? (
          <p role='alert' className='text-xs font-medium text-destructive'>
            {errors.class_ids}
          </p>
        ) : (
          <p className='text-xs text-muted-foreground'>
            {classIds.length
              ? `${classIds.length} ${classIds.length === 1 ? 'class' : 'classes'} selected`
              : 'The number is the students in each class'}
          </p>
        )}
      </div>
    </form>
  )
}
