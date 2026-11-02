import { useMemo, useState } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, BookOpen, Save, Undo2, UserRoundX, UsersRound } from 'lucide-react'
import { Combobox } from '@/components/common/combobox'
import { EmptyState, ErrorState } from '@/components/common/display'
import { FilterSelect } from '@/components/common/list-toolbar'
import { Page, PageHeader } from '@/components/common/page'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { can, useMe } from '@/features/auth/api'
import { useClasses } from '@/features/setup/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import {
  staffApi,
  useAssignments,
  useStaffMutation,
  type AssignmentItem,
  type MatrixCell,
  type MatrixRow,
  type MatrixTeacher,
} from '../api'
import { LoadBar } from '../components/load-bar'
import { loadTone } from '../labels'

const route = getRouteApi('/_app/staff/assignments')
const DEFAULT_PERIODS = 5

interface Edit {
  section_id: number
  subject_id: number
  teacher_user_id: number | null
  periods_per_week: number | null
  original_teacher: number | null
  original_periods: number | null
}

type Edits = Record<string, Edit>

const cellKey = (sectionId: number, subjectId: number) => `${sectionId}:${subjectId}`
const periodsOf = (edit: Edit) => edit.periods_per_week ?? edit.original_periods ?? DEFAULT_PERIODS

export function AssignmentsPage() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/staff/assignments' })
  const canManage = can(useMe().data, 'staff.manage')
  const classes = useClasses()
  const matrix = useAssignments({ class_id: search.class_id })
  const [edits, setEdits] = useState<Edits>({})
  const save = useStaffMutation((items: AssignmentItem[]) =>
    staffApi.saveAssignments({ academic_year_id: matrix.data?.academic_year.id, items })
  )

  useShortcut('app.refresh', () => void matrix.refetch())

  const teachers = useMemo(() => {
    const loads = new Map(
      (matrix.data?.teachers ?? []).map((teacher) => [teacher.user_id, teacher.load_periods])
    )
    for (const edit of Object.values(edits)) {
      if (edit.original_teacher !== null)
        loads.set(
          edit.original_teacher,
          (loads.get(edit.original_teacher) ?? 0) - (edit.original_periods ?? 0)
        )
      if (edit.teacher_user_id !== null)
        loads.set(edit.teacher_user_id, (loads.get(edit.teacher_user_id) ?? 0) + periodsOf(edit))
    }
    return (matrix.data?.teachers ?? []).map((teacher) => ({
      ...teacher,
      load_periods: loads.get(teacher.user_id) ?? teacher.load_periods,
    }))
  }, [matrix.data, edits])

  const teacherOptions = teachers.map((teacher) => ({
    value: String(teacher.user_id),
    label: teacher.name,
    hint: `${teacher.load_periods}/${teacher.max_periods_per_week}`,
  }))

  const rows = matrix.data?.rows ?? []
  const unassigned = rows.reduce(
    (count, row) =>
      count +
      row.cells.filter((cell) => {
        const edit = edits[cellKey(row.section_id, cell.subject_id)]
        return (edit ? edit.teacher_user_id : cell.teacher_user_id) === null
      }).length,
    0
  )
  const changes = Object.keys(edits).length

  const change = (
    row: MatrixRow,
    cell: MatrixCell,
    patch: Partial<Pick<Edit, 'teacher_user_id' | 'periods_per_week'>>
  ) => {
    const key = cellKey(row.section_id, cell.subject_id)
    setEdits((current) => {
      const base: Edit = current[key] ?? {
        section_id: row.section_id,
        subject_id: cell.subject_id,
        teacher_user_id: cell.teacher_user_id,
        periods_per_week: cell.periods_per_week,
        original_teacher: cell.teacher_user_id,
        original_periods: cell.periods_per_week,
      }
      const next = { ...base, ...patch }
      const unchanged =
        next.teacher_user_id === next.original_teacher &&
        (next.teacher_user_id === null ||
          periodsOf(next) === (next.original_periods ?? DEFAULT_PERIODS))
      const { [key]: _removed, ...rest } = current
      return unchanged ? rest : { ...current, [key]: next }
    })
  }

  const submit = async () => {
    const items: AssignmentItem[] = Object.values(edits).map((edit) => ({
      section_id: edit.section_id,
      subject_id: edit.subject_id,
      teacher_user_id: edit.teacher_user_id,
      ...(edit.teacher_user_id !== null ? { periods_per_week: periodsOf(edit) } : {}),
    }))
    try {
      await save.mutateAsync(items)
      alerts.success(`${items.length} ${items.length === 1 ? 'change' : 'changes'} saved`)
      setEdits({})
    } catch (error) {
      alerts.error(toApiError(error).message)
    }
  }

  return (
    <Page className={cn(changes > 0 && 'pb-28')}>
      <Link
        to='/staff'
        search={{ page: 1 }}
        className='inline-flex items-center gap-1.5 self-start text-sm font-semibold text-muted-foreground hover:text-foreground'
      >
        <ArrowLeft className='size-4' />
        All staff
      </Link>
      <PageHeader
        eyebrow='People'
        title='Teacher assignments'
        description={`Who teaches each subject in each section${matrix.data ? ` in ${matrix.data.academic_year.name}` : ' this year'}. Pick a teacher and the periods a week, then save all changes at once.`}
      />

      <div className='flex flex-wrap items-center gap-2'>
        <FilterSelect
          id='class-filter'
          label='Filter by class'
          allLabel='All classes'
          value={search.class_id ? String(search.class_id) : undefined}
          options={(classes.data ?? []).map((item) => ({
            value: String(item.id),
            label: `Class ${item.name}`,
          }))}
          onChange={(value) =>
            navigate({ search: { class_id: value ? Number(value) : undefined }, replace: true })
          }
        />
        {matrix.data && (
          <Badge tone={unassigned ? 'warning' : 'success'}>
            {unassigned ? (
              <>
                <UserRoundX className='size-3' />
                {unassigned} {unassigned === 1 ? 'subject has' : 'subjects have'} no teacher
              </>
            ) : (
              'Every subject has a teacher'
            )}
          </Badge>
        )}
        {!canManage && <Badge tone='neutral'>View only</Badge>}
      </div>

      {matrix.isPending ? (
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'>
          <div className='grid gap-4'>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className='h-48 w-full rounded-xl' />
            ))}
          </div>
          <Skeleton className='h-80 w-full rounded-xl' />
        </div>
      ) : matrix.isError ? (
        <Card>
          <ErrorState message={matrix.error.message} onRetry={() => matrix.refetch()} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title='No sections this year'
            description='Add classes and sections in School setup first.'
          />
        </Card>
      ) : (
        <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'>
          <div className='grid gap-4'>
            {rows.map((row) => (
              <SectionCard
                key={row.section_id}
                row={row}
                edits={edits}
                canManage={canManage}
                teacherOptions={teacherOptions}
                onChange={change}
              />
            ))}
          </div>
          <TeachersPanel teachers={teachers} />
        </div>
      )}

      {changes > 0 && (
        <div className='fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6 lg:px-8'>
          <Card className='mx-auto flex max-w-3xl flex-row flex-wrap items-center justify-between gap-3 p-3 shadow-lg sm:px-4'>
            <span className='text-sm font-semibold'>
              {changes} unsaved {changes === 1 ? 'change' : 'changes'}
            </span>
            <div className='flex gap-2'>
              <Button variant='outline' onClick={() => setEdits({})} disabled={save.isPending}>
                <Undo2 />
                Discard
              </Button>
              <Button onClick={() => void submit()} loading={save.isPending}>
                <Save />
                Save {changes} {changes === 1 ? 'change' : 'changes'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Page>
  )
}

function SectionCard({
  row,
  edits,
  canManage,
  teacherOptions,
  onChange,
}: {
  row: MatrixRow
  edits: Edits
  canManage: boolean
  teacherOptions: { value: string; label: string; hint: string }[]
  onChange: (
    row: MatrixRow,
    cell: MatrixCell,
    patch: Partial<Pick<Edit, 'teacher_user_id' | 'periods_per_week'>>
  ) => void
}) {
  return (
    <Card className='overflow-hidden'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3'>
        <h2 className='font-bold'>
          Class {row.class_name} - {row.section_name}
        </h2>
        <span className='text-xs text-muted-foreground'>
          Class teacher:{' '}
          <span
            className={cn('font-semibold', row.class_teacher ? 'text-foreground' : 'text-warning')}
          >
            {row.class_teacher ?? 'Not set'}
          </span>
        </span>
      </div>
      {row.cells.length === 0 ? (
        <p className='px-4 py-5 text-sm text-muted-foreground'>
          No subjects set for this class. Add them in School setup.
        </p>
      ) : (
        <ul className='grid gap-px bg-border sm:grid-cols-2 2xl:grid-cols-3'>
          {row.cells.map((cell) => {
            const edit = edits[cellKey(row.section_id, cell.subject_id)]
            const teacherId = edit ? edit.teacher_user_id : cell.teacher_user_id
            const periods = edit ? edit.periods_per_week : cell.periods_per_week
            const teacherName = teacherOptions.find(
              (option) => option.value === String(teacherId)
            )?.label
            const id = `cell-${row.section_id}-${cell.subject_id}`
            return (
              <li
                key={cell.subject_id}
                className={cn('grid gap-2 bg-card p-3', edit && 'bg-primary/5')}
              >
                <div className='flex items-center justify-between gap-2'>
                  <span className='truncate text-sm font-semibold'>{cell.subject_name}</span>
                  <span className='flex shrink-0 items-center gap-1.5'>
                    {edit && <Badge tone='info'>Changed</Badge>}
                    <span className='font-mono text-[11px] text-muted-foreground'>
                      {cell.subject_code}
                    </span>
                  </span>
                </div>
                {canManage ? (
                  <div className='flex items-center gap-2'>
                    <Combobox
                      id={id}
                      label={`Teacher for ${cell.subject_name}, ${row.class_name} - ${row.section_name}`}
                      value={teacherId ? String(teacherId) : undefined}
                      placeholder='No teacher'
                      allLabel='No teacher'
                      searchPlaceholder='Search teachers'
                      options={teacherOptions}
                      onChange={(value) =>
                        onChange(row, cell, { teacher_user_id: value ? Number(value) : null })
                      }
                      highlightSelected={false}
                      className={cn('min-w-0 flex-1 sm:w-full', !teacherId && 'text-warning')}
                    />
                    <Input
                      type='number'
                      inputMode='numeric'
                      min={1}
                      max={15}
                      aria-label={`Periods a week for ${cell.subject_name}`}
                      title='Periods a week'
                      disabled={!teacherId}
                      placeholder={String(DEFAULT_PERIODS)}
                      className='tabular w-16 shrink-0 text-center'
                      value={teacherId && periods !== null ? String(periods) : ''}
                      onChange={(event) => {
                        const value = Number(event.target.value)
                        onChange(row, cell, {
                          periods_per_week: event.target.value
                            ? Math.min(15, Math.max(1, Math.round(value)))
                            : null,
                        })
                      }}
                    />
                  </div>
                ) : (
                  <div className='flex items-center justify-between gap-2 text-sm'>
                    <span className={cn('truncate', !teacherId && 'text-warning')}>
                      {teacherName ?? cell.teacher_name ?? 'No teacher'}
                    </span>
                    {teacherId && periods !== null && (
                      <span className='tabular shrink-0 text-xs text-muted-foreground'>
                        {periods} a week
                      </span>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function TeachersPanel({ teachers }: { teachers: MatrixTeacher[] }) {
  const over = teachers.filter(
    (teacher) => loadTone(teacher.load_periods, teacher.max_periods_per_week) === 'danger'
  ).length
  return (
    <Card className='overflow-hidden lg:sticky lg:top-20'>
      <div className='flex items-center justify-between gap-2 border-b px-4 py-3'>
        <h2 className='flex items-center gap-2 font-bold'>
          <UsersRound className='size-4 text-primary' />
          Teachers
        </h2>
        {over > 0 && <Badge tone='danger'>{over} over limit</Badge>}
      </div>
      {teachers.length === 0 ? (
        <p className='px-4 py-5 text-sm text-muted-foreground'>
          No teaching staff yet. Add teachers in Staff.
        </p>
      ) : (
        <ul className='grid divide-y lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto'>
          {teachers.map((teacher) => (
            <li key={teacher.user_id} className='grid gap-1.5 px-4 py-2.5'>
              <div className='flex items-baseline justify-between gap-2'>
                <span className='truncate text-sm font-semibold'>{teacher.name}</span>
                <span className='truncate text-xs text-muted-foreground'>
                  {teacher.department ?? ''}
                </span>
              </div>
              <LoadBar load={teacher.load_periods} max={teacher.max_periods_per_week} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
