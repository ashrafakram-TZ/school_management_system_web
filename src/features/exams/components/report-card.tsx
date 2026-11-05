import { useState } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { Combobox, type ComboboxOption } from '@/components/common/combobox'
import { EmptyState, ErrorState } from '@/components/common/display'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  reportCardsApi,
  useReportCard,
  type ReportCard as ReportCardData,
  type ReportCardCell,
  type ReportCardParams,
} from '../report-card-api'
import { gradeTone } from '../labels'

const RESULT_TEXT = { pass: 'Passed', fail: 'Not passed', incomplete: 'Incomplete' } as const

const number = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')

const scopeValue = (params: ReportCardParams) =>
  params.exam_id ? `exam:${params.exam_id}` : params.term_id ? `term:${params.term_id}` : 'year'

function scopeParams(value: string | undefined): Pick<ReportCardParams, 'term_id' | 'exam_id'> {
  const [kind, id] = (value ?? 'year').split(':')
  if (kind === 'term') return { term_id: Number(id) }
  if (kind === 'exam') return { exam_id: Number(id) }
  return {}
}

export function ReportCard({ studentId }: { studentId: number }) {
  const [params, setParams] = useState<ReportCardParams>({})
  const [busy, setBusy] = useState<'print' | 'download' | null>(null)
  const card = useReportCard(studentId, params)

  if (card.isError) {
    return (
      <Card>
        <ErrorState message={card.error.message} onRetry={() => card.refetch()} />
      </Card>
    )
  }
  if (card.isPending) return <Skeleton className='h-[32rem] w-full rounded-xl' />

  const data = card.data
  const options = data.options
  const yearOptions: ComboboxOption[] = options.academic_years.map((year) => ({
    value: String(year.id),
    label: year.name,
  }))
  const termName = (termId: number | null) => options.terms.find((term) => term.id === termId)?.name
  const scopeOptions: ComboboxOption[] = [
    { value: 'year', label: 'Whole year', hint: 'Every term side by side' },
    ...options.terms.map((term) => ({ value: `term:${term.id}`, label: term.name, hint: 'Term' })),
    ...options.exams.map((exam) => ({
      value: `exam:${exam.id}`,
      label: exam.name,
      hint: termName(exam.term_id) ?? 'Exam',
    })),
  ]
  const effective: ReportCardParams = { ...params, academic_year_id: data.scope.academic_year.id }
  const fileName = `Report-card-${data.student.admission_no}-${data.scope.exam?.name ?? data.scope.term?.name ?? data.scope.academic_year.name}.pdf`
  const empty = data.columns.length === 0

  const run = async (kind: 'print' | 'download') => {
    setBusy(kind)
    try {
      if (kind === 'print') await reportCardsApi.openPdf(studentId, effective)
      else
        await reportCardsApi.downloadPdf(studentId, effective, fileName.replace(/[^\w.-]+/g, '-'))
    } catch (error) {
      alerts.error(toApiError(error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className='grid gap-4'>
      <Card className='flex-row flex-wrap items-end gap-3 p-3 sm:p-4'>
        <div className='grid gap-1'>
          <span className='text-xs font-medium text-muted-foreground'>Academic year</span>
          <Combobox
            id='report-card-year'
            label='Academic year'
            placeholder='Choose a year'
            value={String(data.scope.academic_year.id)}
            options={yearOptions}
            onChange={(value) => value && setParams({ academic_year_id: Number(value) })}
            className='w-full sm:w-40'
          />
        </div>
        <div className='grid min-w-0 flex-1 gap-1 sm:flex-none'>
          <span className='text-xs font-medium text-muted-foreground'>Report for</span>
          <Combobox
            id='report-card-scope'
            label='Report for'
            placeholder='Whole year'
            value={scopeValue(params)}
            options={scopeOptions}
            onChange={(value) =>
              setParams({ academic_year_id: params.academic_year_id, ...scopeParams(value) })
            }
            className='w-full sm:w-64'
          />
        </div>
        <div className='ml-auto flex flex-wrap gap-2'>
          <Button
            variant='outline'
            disabled={empty}
            loading={busy === 'download'}
            onClick={() => run('download')}
          >
            <Download />
            Download PDF
          </Button>
          <Button disabled={empty} loading={busy === 'print'} onClick={() => run('print')}>
            <Printer />
            Print
          </Button>
        </div>
      </Card>

      {empty ? (
        <Card className='p-4 sm:p-6'>
          <EmptyState
            icon={FileSpreadsheet}
            title='No published results for this period'
            description='The report card fills in as the school publishes exam results.'
          />
        </Card>
      ) : (
        <Sheet data={data} fetching={card.isFetching} />
      )}
    </div>
  )
}

function Sheet({ data, fetching }: { data: ReportCardData; fetching: boolean }) {
  const { school, student, scope } = data
  return (
    <Card
      className={cn('overflow-hidden transition-opacity', fetching && 'opacity-60')}
      aria-label={`${scope.title} of ${student.full_name}`}
    >
      <div className='h-1.5 bg-primary' />
      <header className='flex flex-wrap items-start justify-between gap-4 px-4 pt-4 sm:px-6'>
        <div className='flex min-w-0 items-start gap-3'>
          {school.logo_url && (
            <img
              src={school.logo_url}
              alt=''
              className='size-14 shrink-0 rounded-lg object-contain'
            />
          )}
          <div className='grid min-w-0 gap-0.5'>
            <h2 className='text-xl leading-tight font-extrabold'>{school.name}</h2>
            {school.address && <p className='text-xs text-muted-foreground'>{school.address}</p>}
            <p className='text-xs text-muted-foreground'>
              {[school.phone, school.email].filter(Boolean).join(' · ')}
              {school.board && ` · Affiliated to ${school.board}`}
            </p>
          </div>
        </div>
        <div className='rounded-lg bg-primary/10 px-4 py-2 text-center'>
          <p className='text-sm font-bold tracking-wide text-primary'>PROGRESS REPORT</p>
          <p className='text-xs text-primary'>Academic year {scope.academic_year.name}</p>
        </div>
      </header>

      <div className='mx-4 mt-4 rounded-md bg-primary px-4 py-2 text-center text-sm font-bold text-primary-foreground sm:mx-6'>
        {scope.title}
      </div>

      <div className='flex gap-4 px-4 py-4 sm:px-6'>
        <dl className='grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm lg:grid-cols-4'>
          <Fact label='Student name' value={student.full_name} />
          <Fact label='Admission no.' value={student.admission_no} />
          <Fact
            label='Class & section'
            value={[student.class_name, student.section_name].filter(Boolean).join(' - ')}
          />
          <Fact label='Roll no.' value={student.roll_no === null ? '—' : String(student.roll_no)} />
          <Fact label='Date of birth' value={formatDate(student.dob)} />
          <Fact label='Parent / guardian' value={student.parent_name ?? '—'} />
          <Fact label='Class teacher' value={student.class_teacher ?? '—'} />
          <Fact label='Period' value={`${formatDate(scope.from)} to ${formatDate(scope.to)}`} />
        </dl>
        {student.photo_url && (
          <img
            src={student.photo_url}
            alt={student.full_name}
            className='hidden h-20 w-16 shrink-0 rounded-md border object-cover sm:block'
          />
        )}
      </div>

      <div className='px-4 sm:px-6'>
        <MarksTable data={data} />
      </div>

      <div className='grid grid-cols-2 gap-3 px-4 pt-4 sm:px-6 lg:grid-cols-4'>
        <Summary
          label='Overall percentage'
          value={data.overall.percent === null ? '—' : `${number(data.overall.percent)}%`}
        />
        <Summary label='Overall grade' value={data.overall.grade ?? '—'} />
        <Summary
          label='Result'
          value={RESULT_TEXT[data.overall.result]}
          danger={data.overall.result === 'fail'}
        />
        <Summary
          label='Attendance'
          value={data.attendance.percent === null ? '—' : `${number(data.attendance.percent)}%`}
          hint={
            data.attendance.working_days
              ? `Present ${number(data.attendance.present_days)} of ${data.attendance.working_days} days`
              : 'Not recorded in this period'
          }
        />
      </div>

      <div className='grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_auto]'>
        <div className='rounded-lg border bg-muted/30 p-3'>
          <p className='text-xs font-bold text-primary'>Class teacher's remarks</p>
          <p className='mt-1 text-sm italic'>{data.remarks}</p>
        </div>
        <div>
          <p className='text-xs font-bold text-primary'>Grading scale (%)</p>
          <ul className='mt-1 grid grid-cols-4 gap-x-4 gap-y-1 text-xs'>
            {data.grade_scale.map((step) => (
              <li key={step.grade} className='tabular whitespace-nowrap'>
                <span className='font-bold'>{step.grade}</span>{' '}
                <span className='text-muted-foreground'>
                  {step.min}–{step.max}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className='grid grid-cols-3 gap-4 px-4 pt-8 pb-5 text-center text-xs text-muted-foreground sm:px-6'>
        {['Class teacher', 'Principal', 'Parent / guardian'].map((label) => (
          <div key={label} className='border-t pt-1.5'>
            {label}
          </div>
        ))}
      </div>
    </Card>
  )
}

function MarksTable({ data }: { data: ReportCardData }) {
  const showTerms = data.terms.length > 1 || data.terms[0]?.term_id !== null
  const footer: { label: string; cell: (index: number) => string; overall: string[] }[] = [
    {
      label: 'Total',
      cell: (index) => `${number(data.columns[index]!.total)}/${data.columns[index]!.max_total}`,
      overall: [`${number(data.overall.total)}/${data.overall.max_total}`, '', ''],
    },
    {
      label: 'Percentage',
      cell: (index) => {
        const percent = data.columns[index]!.percent
        return percent === null ? '—' : `${number(percent)}%`
      },
      overall: ['', data.overall.percent === null ? '—' : `${number(data.overall.percent)}%`, ''],
    },
    {
      label: 'Grade',
      cell: (index) => data.columns[index]!.grade ?? '—',
      overall: ['', '', data.overall.grade ?? '—'],
    },
    {
      label: 'Rank in class',
      cell: (index) => {
        const column = data.columns[index]!
        return column.class_rank === null ? '—' : `${column.class_rank} / ${column.class_size}`
      },
      overall: ['', '', ''],
    },
  ]
  return (
    <div className='overflow-x-auto rounded-lg border'>
      <table className='w-full min-w-[640px] border-collapse text-sm'>
        <thead>
          {showTerms && (
            <tr className='bg-primary/90 text-primary-foreground'>
              <th rowSpan={2} className='bg-primary px-3 py-2 text-left font-semibold'>
                Subject
              </th>
              {data.terms.map((term) => (
                <th
                  key={`${term.term_id}-${term.exam_ids[0]}`}
                  colSpan={term.exam_ids.length}
                  className='border-l border-primary-foreground/20 px-2 py-1 text-xs font-semibold'
                >
                  {term.name}
                </th>
              ))}
              <th
                colSpan={3}
                className='border-l border-primary-foreground/20 px-2 py-1 text-xs font-semibold'
              >
                Overall
              </th>
            </tr>
          )}
          <tr className='bg-primary text-primary-foreground'>
            {!showTerms && <th className='px-3 py-2 text-left font-semibold'>Subject</th>}
            {data.columns.map((column) => (
              <th
                key={column.exam_id}
                className='border-l border-primary-foreground/20 px-2 py-2 text-center text-xs font-semibold'
              >
                {column.name}
                {column.common_max && (
                  <span className='block font-normal opacity-80'>out of {column.common_max}</span>
                )}
              </th>
            ))}
            {['Marks', '%', 'Grade'].map((label) => (
              <th
                key={label}
                className='border-l border-primary-foreground/20 px-2 py-2 text-center text-xs font-semibold'
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.subjects.map((subject) => (
            <tr key={subject.subject_id} className='border-t even:bg-muted/40'>
              <th scope='row' className='px-3 py-2 text-left font-medium'>
                {subject.name}
              </th>
              {subject.cells.map((cell, index) => (
                <td
                  key={data.columns[index]!.exam_id}
                  className={cn(
                    'tabular border-l px-2 py-2 text-center',
                    cell?.passed === false && 'font-semibold text-destructive'
                  )}
                >
                  {cellText(cell, data.columns[index]!.common_max)}
                </td>
              ))}
              <td
                className={cn(
                  'tabular border-l px-2 py-2 text-center',
                  subject.passed === false && 'text-destructive'
                )}
              >
                {subject.max_total ? `${number(subject.total)}/${subject.max_total}` : '—'}
              </td>
              <td
                className={cn(
                  'tabular border-l px-2 py-2 text-center',
                  subject.passed === false && 'text-destructive'
                )}
              >
                {subject.percent === null ? '—' : number(subject.percent)}
              </td>
              <td className='border-l px-2 py-2 text-center'>
                {subject.grade ? (
                  <Badge tone={gradeTone(subject.grade)}>{subject.grade}</Badge>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className='font-semibold text-primary'>
          {footer.map((row) => (
            <tr key={row.label} className='border-t bg-primary/5'>
              <th scope='row' className='px-3 py-1.5 text-left'>
                {row.label}
              </th>
              {data.columns.map((column, index) => (
                <td
                  key={column.exam_id}
                  className='tabular border-l px-2 py-1.5 text-center text-xs'
                >
                  {row.cell(index)}
                </td>
              ))}
              {row.overall.map((value, index) => (
                <td key={index} className='tabular border-l px-2 py-1.5 text-center text-xs'>
                  {value}
                </td>
              ))}
            </tr>
          ))}
          <tr className='border-t bg-primary/5'>
            <th scope='row' className='px-3 py-1.5 text-left'>
              Result
            </th>
            {data.columns.map((column) => (
              <td
                key={column.exam_id}
                className={cn(
                  'border-l px-2 py-1.5 text-center text-xs',
                  column.result === 'fail' && 'text-destructive'
                )}
              >
                {RESULT_TEXT[column.result]}
              </td>
            ))}
            <td
              colSpan={3}
              className={cn(
                'border-l px-2 py-1.5 text-center text-xs',
                data.overall.result === 'fail' && 'text-destructive'
              )}
            >
              {RESULT_TEXT[data.overall.result]}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function cellText(cell: ReportCardCell | null, commonMax: number | null) {
  if (!cell) return '—'
  if (cell.passed === null) return '·'
  if (cell.is_absent) return 'AB'
  const marks = number(cell.marks ?? 0)
  return commonMax ? marks : `${marks}/${cell.max_marks}`
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className='grid min-w-0 gap-0.5'>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd className='truncate font-semibold'>{value}</dd>
    </div>
  )
}

function Summary({
  label,
  value,
  hint,
  danger,
}: {
  label: string
  value: string
  hint?: string
  danger?: boolean
}) {
  return (
    <div className='grid gap-0.5 rounded-lg border p-3'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <span
        className={cn('tabular text-lg font-extrabold text-primary', danger && 'text-destructive')}
      >
        {value}
      </span>
      {hint && <span className='text-[11px] text-muted-foreground'>{hint}</span>}
    </div>
  )
}
