import { useState } from 'react'
import { X } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { ErrorState } from '@/components/common/display'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { RootError } from '@/features/setup/components/setup-shared'
import { fieldErrorsOf } from '@/features/setup/form-actions'
import { useSubjects } from '@/features/setup/api'
import { alerts } from '@/lib/alerts'
import { examsApi, useExam, useExamMutation, type ExamDetail, type PaperInput } from '../api'

interface PaperDraft {
  class_id: number
  class_name: string
  subject_id: number
  subject_name: string
  subject_code: string
  max_marks: string
  pass_marks: string
  exam_date: string
  marks_entered: number
}

export function PapersModal({
  examId,
  examName,
  onClose,
}: {
  examId: number
  examName: string
  onClose: () => void
}) {
  const exam = useExam(examId)
  return (
    <AppModal
      open
      onOpenChange={(next) => !next && onClose()}
      title={`Subjects of ${examName}`}
      description='Max marks, pass marks and the exam date of each subject, class by class.'
      formId='papers-form'
      submitText='Save subjects'
      size='xl'
    >
      {exam.isError ? (
        <ErrorState message={exam.error.message} onRetry={() => exam.refetch()} />
      ) : !exam.data || exam.data.id !== examId ? (
        <Skeleton className='h-64 w-full' />
      ) : (
        <PapersForm key={exam.dataUpdatedAt} exam={exam.data} onClose={onClose} />
      )}
    </AppModal>
  )
}

function PapersForm({ exam, onClose }: { exam: ExamDetail; onClose: () => void }) {
  const subjects = useSubjects()
  const [rows, setRows] = useState<PaperDraft[]>(() =>
    exam.class_details.flatMap((item) =>
      item.subjects.map((paper) => ({
        class_id: item.id,
        class_name: item.name,
        subject_id: paper.subject_id,
        subject_name: paper.subject_name,
        subject_code: paper.subject_code,
        max_marks: String(paper.max_marks),
        pass_marks: String(paper.pass_marks),
        exam_date: paper.exam_date ?? '',
        marks_entered: paper.marks_entered,
      }))
    )
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useExamMutation((items: PaperInput[]) => examsApi.setSubjects(exam.id, items))

  const update = (index: number, patch: Partial<PaperDraft>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const validate = () => {
    const next: Record<string, string> = {}
    rows.forEach((row, index) => {
      const max = Number(row.max_marks)
      const pass = Number(row.pass_marks)
      if (!row.max_marks || !Number.isInteger(max) || max < 1 || max > 500) {
        next[`items.${index}.max_marks`] = 'Max marks: 1 to 500'
      }
      if (!row.pass_marks || !Number.isInteger(pass) || pass < 0) {
        next[`items.${index}.pass_marks`] = 'Enter pass marks'
      } else if (pass > max) {
        next[`items.${index}.pass_marks`] = 'Cannot be more than max marks'
      }
      if (row.exam_date && (row.exam_date < exam.start_date || row.exam_date > exam.end_date)) {
        next[`items.${index}.exam_date`] = 'Must be within the exam dates'
      }
    })
    return next
  }

  return (
    <form
      id='papers-form'
      noValidate
      className='grid max-h-[65vh] gap-5 overflow-y-auto pr-1'
      onSubmit={async (event) => {
        event.preventDefault()
        const next = validate()
        setErrors(next)
        if (Object.keys(next).length) return
        try {
          await save.mutateAsync(
            rows.map((row) => ({
              class_id: row.class_id,
              subject_id: row.subject_id,
              max_marks: Number(row.max_marks),
              pass_marks: Number(row.pass_marks),
              exam_date: row.exam_date || null,
            }))
          )
          alerts.success('Subjects saved')
          onClose()
        } catch (error) {
          setErrors(fieldErrorsOf(error))
        }
      }}
    >
      <RootError message={errors.root} />
      {exam.class_details.map((schoolClass) => {
        const own = rows
          .map((row, index) => ({ row, index }))
          .filter((item) => item.row.class_id === schoolClass.id)
        const available = (subjects.data?.items ?? [])
          .filter((subject) => !own.some((item) => item.row.subject_id === subject.id))
          .map((subject) => ({
            value: String(subject.id),
            label: subject.name,
            hint: subject.code,
          }))
        return (
          <section key={schoolClass.id} className='grid gap-2'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <h3 className='font-bold'>Class {schoolClass.name}</h3>
              <Combobox
                id={`add-subject-${schoolClass.id}`}
                label={`Add a subject to class ${schoolClass.name}`}
                options={available}
                placeholder='Add subject'
                searchPlaceholder='Search subjects'
                highlightSelected={false}
                onChange={(value) => {
                  const subject = subjects.data?.items.find((item) => String(item.id) === value)
                  if (!subject) return
                  setRows((current) => [
                    ...current,
                    {
                      class_id: schoolClass.id,
                      class_name: schoolClass.name,
                      subject_id: subject.id,
                      subject_name: subject.name,
                      subject_code: subject.code,
                      max_marks: '100',
                      pass_marks: '35',
                      exam_date: '',
                      marks_entered: 0,
                    },
                  ])
                }}
              />
            </div>
            <div className='hidden grid-cols-[minmax(0,1fr)_6rem_6rem_10rem_2rem] gap-2 px-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase md:grid'>
              <span>Subject</span>
              <span>Max marks</span>
              <span>Pass marks</span>
              <span>Exam date</span>
              <span />
            </div>
            <ul className='grid gap-2'>
              {own.map(({ row, index }) => (
                <li
                  key={`${row.class_id}-${row.subject_id}`}
                  className='relative grid grid-cols-2 items-start gap-2 rounded-lg border p-2 pr-10 md:grid-cols-[minmax(0,1fr)_6rem_6rem_10rem_2rem] md:border-0 md:p-0 md:pr-0'
                >
                  <div className='col-span-2 flex min-w-0 items-center gap-1.5 self-center md:col-span-1'>
                    <span className='font-mono text-[11px] font-bold text-primary'>
                      {row.subject_code}
                    </span>
                    <span className='truncate text-sm font-semibold'>{row.subject_name}</span>
                    {row.marks_entered > 0 && (
                      <span className='shrink-0 text-xs text-muted-foreground'>
                        · {row.marks_entered} marked
                      </span>
                    )}
                  </div>
                  <PaperInputField
                    id={`paper-${index}-max`}
                    caption='Max marks'
                    label={`Max marks for ${row.subject_name}, class ${row.class_name}`}
                    value={row.max_marks}
                    error={errors[`items.${index}.max_marks`]}
                    onChange={(value) => update(index, { max_marks: value })}
                  />
                  <PaperInputField
                    id={`paper-${index}-pass`}
                    caption='Pass marks'
                    label={`Pass marks for ${row.subject_name}, class ${row.class_name}`}
                    value={row.pass_marks}
                    error={errors[`items.${index}.pass_marks`]}
                    onChange={(value) => update(index, { pass_marks: value })}
                  />
                  <div className='col-span-2 grid gap-1 md:col-span-1'>
                    <span className='text-[11px] text-muted-foreground md:hidden'>Exam date</span>
                    <Input
                      id={`paper-${index}-date`}
                      type='date'
                      aria-label={`Exam date for ${row.subject_name}, class ${row.class_name}`}
                      value={row.exam_date}
                      min={exam.start_date}
                      max={exam.end_date}
                      aria-invalid={Boolean(errors[`items.${index}.exam_date`])}
                      onChange={(event) => update(index, { exam_date: event.target.value })}
                    />
                    {errors[`items.${index}.exam_date`] && (
                      <p role='alert' className='text-xs font-medium text-destructive'>
                        {errors[`items.${index}.exam_date`]}
                      </p>
                    )}
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    className='absolute top-1 right-1 md:static'
                    aria-label={`Remove ${row.subject_name} from class ${row.class_name}`}
                    disabled={row.marks_entered > 0}
                    title={row.marks_entered > 0 ? 'Has marks; clear them first' : undefined}
                    onClick={() => setRows((current) => current.filter((_item, i) => i !== index))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
              {!own.length && (
                <li className='rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground'>
                  No subjects. Add one, or the class leaves this exam when you save.
                </li>
              )}
            </ul>
          </section>
        )
      })}
    </form>
  )
}

function PaperInputField({
  id,
  caption,
  label,
  value,
  error,
  onChange,
}: {
  id: string
  caption: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div className='grid gap-1'>
      <span className='text-[11px] text-muted-foreground md:hidden'>{caption}</span>
      <Input
        id={id}
        type='number'
        inputMode='numeric'
        min={0}
        max={500}
        aria-label={label}
        aria-invalid={Boolean(error)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='tabular'
      />
      {error && (
        <p role='alert' className='text-xs font-medium text-destructive'>
          {error}
        </p>
      )}
    </div>
  )
}
