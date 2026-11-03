import { useMemo, useState } from 'react'
import { AlertTriangle, Search, X } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useClasses } from '@/features/setup/api'
import { useStudents, type StudentListItem } from '@/features/students/api'
import { useDebouncedValue } from '@/hooks/use-debounce'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import { transportApi, useRiders, useTransportMutation, type TransportMode } from '../api'
import { MODE_OPTIONS } from '../labels'

interface Chosen {
  id: number
  name: string
}

const classLabel = (student: StudentListItem) =>
  [student.class?.name, student.section?.name].filter(Boolean).join(' - ')

export function AssignStudentsModal({
  routeId,
  stop,
  seatsLeft,
  onClose,
}: {
  routeId: number
  stop: { id: number; name: string }
  seatsLeft: number | null
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const search = useDebouncedValue(text.trim(), 300)
  const [classId, setClassId] = useState<string>()
  const [chosen, setChosen] = useState<Chosen[]>([])
  const [mode, setMode] = useState<TransportMode>('both')
  const [problem, setProblem] = useState<string | null>(null)
  const classes = useClasses()
  const students = useStudents({
    page: 1,
    limit: 20,
    search: search || undefined,
    class_id: classId ? Number(classId) : undefined,
    status: 'active',
  })
  const here = useRiders({ page: 1, limit: 100, route_id: routeId, stop_id: stop.id })
  const hereIds = useMemo(
    () => new Set((here.data?.items ?? []).map((rider) => rider.student.id)),
    [here.data]
  )
  const assign = useTransportMutation((ids: number[]) =>
    transportApi.assignStop(routeId, stop.id, ids, mode)
  )

  const toggle = (student: StudentListItem) =>
    setChosen((prev) =>
      prev.some((item) => item.id === student.id)
        ? prev.filter((item) => item.id !== student.id)
        : [...prev, { id: student.id, name: student.full_name }]
    )

  const rows = students.data?.items ?? []
  const count = chosen.length

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Add students to ${stop.name}`}
      description='Students who already use another stop are moved here.'
      formId='assign-form'
      submitText={count ? `Add ${count} ${count === 1 ? 'student' : 'students'}` : 'Add students'}
      loading={assign.isPending}
      size='lg'
    >
      <form
        id='assign-form'
        noValidate
        className='grid min-w-0 gap-4'
        onSubmit={async (event) => {
          event.preventDefault()
          setProblem(null)
          if (!count) {
            setProblem('Choose at least one student')
            return
          }
          try {
            const result = await assign.mutateAsync(chosen.map((item) => item.id))
            alerts.success(
              `${result.assigned} ${result.assigned === 1 ? 'student' : 'students'} added to ${stop.name}`,
              result.moved
                ? { description: `${result.moved} moved here from another stop` }
                : undefined
            )
            onClose()
          } catch (error) {
            const apiError = toApiError(error)
            if (apiError.code === 'BUS_FULL' || apiError.fieldErrors.length)
              setProblem(apiError.fieldErrors[0]?.message ?? apiError.message)
            else alerts.error(apiError.message)
          }
        }}
      >
        {problem && (
          <p
            role='alert'
            className='flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive'
          >
            <AlertTriangle className='mt-0.5 size-4 shrink-0' />
            {problem}
          </p>
        )}
        <div className='grid gap-3 sm:grid-cols-[1fr_12rem]'>
          <div className='relative'>
            <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              type='search'
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder='Search by name or admission no.'
              aria-label='Search students to add'
              className='pl-9'
            />
          </div>
          <Combobox
            id='assign-class'
            label='Filter by class'
            value={classId}
            allLabel='All classes'
            placeholder='All classes'
            searchPlaceholder='Search classes'
            options={(classes.data ?? []).map((item) => ({
              value: String(item.id),
              label: item.name,
            }))}
            className='sm:w-full'
            onChange={setClassId}
          />
        </div>

        <div
          role='group'
          aria-label='Students to choose from'
          className='max-h-72 overflow-y-auto overscroll-contain rounded-lg border'
        >
          {students.isPending ? (
            <div className='grid gap-2 p-3'>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className='h-10' />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className='px-3 py-8 text-center text-sm text-muted-foreground'>
              No students match. Try another name or class.
            </p>
          ) : (
            <ul className='divide-y'>
              {rows.map((student) => {
                const already = hereIds.has(student.id)
                const checked = chosen.some((item) => item.id === student.id)
                return (
                  <li key={student.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/60',
                        already && 'cursor-default opacity-60 hover:bg-transparent'
                      )}
                    >
                      <input
                        type='checkbox'
                        className='size-4 shrink-0 accent-[var(--primary)]'
                        checked={checked || already}
                        disabled={already}
                        aria-label={`Choose ${student.full_name}`}
                        onChange={() => toggle(student)}
                      />
                      <span className='grid min-w-0 flex-1'>
                        <span className='truncate text-sm font-semibold'>{student.full_name}</span>
                        <span className='truncate font-mono text-xs text-muted-foreground'>
                          {student.admission_no}
                          {classLabel(student) ? ` · ${classLabel(student)}` : ''}
                        </span>
                      </span>
                      {already && (
                        <span className='shrink-0 text-xs text-muted-foreground'>At this stop</span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {students.data && students.data.total > rows.length && (
          <p className='-mt-2 text-xs text-muted-foreground'>
            Showing {rows.length} of {students.data.total}. Search to find others.
          </p>
        )}

        {count > 0 && (
          <div className='grid gap-2'>
            <span className='text-xs font-semibold'>
              Chosen ({count})
              {seatsLeft !== null && (
                <span
                  className={cn(
                    'ml-2 font-normal text-muted-foreground',
                    count > seatsLeft && 'text-destructive'
                  )}
                >
                  {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left on the bus
                </span>
              )}
            </span>
            <ul className='flex flex-wrap gap-1.5'>
              {chosen.map((item) => (
                <li
                  key={item.id}
                  className='flex items-center gap-1 rounded-full border bg-muted py-0.5 pr-1 pl-2.5 text-xs font-semibold'
                >
                  {item.name}
                  <button
                    type='button'
                    aria-label={`Remove ${item.name} from the list`}
                    className='grid size-5 place-items-center rounded-full hover:bg-background'
                    onClick={() =>
                      setChosen((prev) => prev.filter((entry) => entry.id !== item.id))
                    }
                  >
                    <X className='size-3' />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <FormField id='assign-mode' label='Uses the bus for'>
          <Combobox
            id='assign-mode'
            label='Uses the bus for'
            value={mode}
            options={MODE_OPTIONS}
            placeholder='Choose'
            highlightSelected={false}
            className='sm:w-64'
            onChange={(value) => setMode((value ?? 'both') as TransportMode)}
          />
        </FormField>
      </form>
    </AppModal>
  )
}
