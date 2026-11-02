import { useState } from 'react'
import { ArrowDown, ArrowUp, BellRing, Coffee, Plus, Save, Trash2, Undo2 } from 'lucide-react'
import { ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import {
  timetableApi,
  useBellSchedule,
  useTimetableMutation,
  type BellPeriod,
  type BellPeriodInput,
} from '../api'

interface Row extends Required<BellPeriodInput> {
  key: number
}

type RowErrors = Record<number, Partial<Record<keyof BellPeriodInput, string>>>

let nextKey = 1

const toRows = (periods: BellPeriod[]): Row[] =>
  periods.map((period) => ({
    key: nextKey++,
    name: period.name,
    start_time: period.start_time,
    end_time: period.end_time,
    is_break: period.is_break,
  }))

const addMinutes = (time: string, minutes: number) => {
  const [hours, mins] = time.split(':').map(Number)
  const total = Math.min(23 * 60 + 59, hours * 60 + mins + minutes)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function BellTab({ canManage }: { canManage: boolean }) {
  const periods = useBellSchedule()

  if (periods.isError && !periods.data)
    return (
      <Card>
        <ErrorState message={periods.error.message} onRetry={() => periods.refetch()} />
      </Card>
    )
  if (!periods.data) return <Skeleton className='h-96 w-full rounded-xl' />
  return <BellEditor periods={periods.data} canManage={canManage} />
}

function BellEditor({ periods, canManage }: { periods: BellPeriod[]; canManage: boolean }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(periods))
  const [baseline, setBaseline] = useState(() => JSON.stringify(toRows(periods).map(strip)))
  const [errors, setErrors] = useState<RowErrors>({})
  const save = useTimetableMutation((items: BellPeriodInput[]) => timetableApi.savePeriods(items))
  const dirty = JSON.stringify(rows.map(strip)) !== baseline

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const move = (index: number, offset: number) =>
    setRows((current) => {
      const next = [...current]
      const [row] = next.splice(index, 1)
      next.splice(index + offset, 0, row)
      return next
    })

  const add = (isBreak: boolean) =>
    setRows((current) => {
      const start = current.at(-1)?.end_time ?? '08:50'
      const teaching = current.filter((row) => !row.is_break).length
      return [
        ...current,
        {
          key: nextKey++,
          name: isBreak ? 'Break' : `Period ${teaching + 1}`,
          start_time: start,
          end_time: addMinutes(start, isBreak ? 15 : 45),
          is_break: isBreak,
        },
      ]
    })

  const reset = () => {
    setRows(toRows(periods))
    setErrors({})
  }

  const submit = async () => {
    const next: RowErrors = {}
    rows.forEach((row, index) => {
      const rowErrors: RowErrors[number] = {}
      if (!row.name.trim()) rowErrors.name = 'Enter a name'
      if (!row.start_time) rowErrors.start_time = 'Enter the start'
      if (!row.end_time) rowErrors.end_time = 'Enter the end'
      else if (row.start_time && row.end_time <= row.start_time)
        rowErrors.end_time = 'Must be after the start'
      if (Object.keys(rowErrors).length) next[index] = rowErrors
    })
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      const saved = await save.mutateAsync(rows.map(strip))
      const fresh = toRows(saved)
      setRows(fresh)
      setBaseline(JSON.stringify(fresh.map(strip)))
      alerts.success('Bell schedule saved')
    } catch (error) {
      const apiError = toApiError(error)
      const fieldErrors: RowErrors = {}
      for (const item of apiError.fieldErrors) {
        const match = /^items\.(\d+)\.(name|start_time|end_time|is_break)$/.exec(item.field)
        if (!match) continue
        const index = Number(match[1])
        fieldErrors[index] = { ...fieldErrors[index], [match[2]]: item.message }
      }
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
      else alerts.error(apiError.message)
    }
  }

  const numbers = periodNumbers(rows)
  const teaching = rows.filter((row) => !row.is_break).length

  return (
    <Card className='overflow-hidden'>
      <div className='flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5'>
        <div className='grid gap-0.5'>
          <h2 className='flex items-center gap-2 font-bold'>
            <BellRing className='size-4 text-primary' />
            Bell schedule
          </h2>
          <p className='text-xs text-muted-foreground'>
            The periods of a school day. Teaching periods are numbered in order; breaks have no
            number.
          </p>
        </div>
        {canManage && (
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' onClick={() => add(false)}>
              <Plus />
              Add period
            </Button>
            <Button variant='outline' size='sm' onClick={() => add(true)}>
              <Coffee />
              Add break
            </Button>
          </div>
        )}
      </div>
      <ol className='grid divide-y'>
        {rows.map((row, index) => {
          const number = numbers[index]
          const rowErrors = errors[index] ?? {}
          return (
            <li
              key={row.key}
              className={cn(
                'grid items-start gap-3 px-4 py-3 sm:px-5 md:grid-cols-[3rem_minmax(0,1fr)_8rem_8rem_auto_auto]',
                row.is_break && 'bg-muted/50'
              )}
            >
              <span className='flex h-9 items-center'>
                {number ? (
                  <Badge tone='info'>P{number}</Badge>
                ) : (
                  <Badge tone='neutral'>
                    <Coffee className='size-3' />
                  </Badge>
                )}
              </span>
              <FormField label='Name' id={`bell-name-${row.key}`} error={rowErrors.name}>
                <Input
                  id={`bell-name-${row.key}`}
                  maxLength={30}
                  disabled={!canManage}
                  value={row.name}
                  aria-invalid={Boolean(rowErrors.name) || undefined}
                  onChange={(event) => update(row.key, { name: event.target.value })}
                />
              </FormField>
              <div className='grid grid-cols-2 gap-3 md:contents'>
                <FormField label='Start' id={`bell-start-${row.key}`} error={rowErrors.start_time}>
                  <Input
                    id={`bell-start-${row.key}`}
                    type='time'
                    disabled={!canManage}
                    value={row.start_time}
                    aria-invalid={Boolean(rowErrors.start_time) || undefined}
                    onChange={(event) => update(row.key, { start_time: event.target.value })}
                  />
                </FormField>
                <FormField label='End' id={`bell-end-${row.key}`} error={rowErrors.end_time}>
                  <Input
                    id={`bell-end-${row.key}`}
                    type='time'
                    disabled={!canManage}
                    value={row.end_time}
                    aria-invalid={Boolean(rowErrors.end_time) || undefined}
                    onChange={(event) => update(row.key, { end_time: event.target.value })}
                  />
                </FormField>
              </div>
              <label className='flex h-9 items-center gap-2 text-xs font-semibold md:mt-5'>
                <Switch
                  checked={row.is_break}
                  disabled={!canManage}
                  aria-label={`Break: ${row.name}`}
                  onCheckedChange={(is_break) => update(row.key, { is_break })}
                />
                Break
              </label>
              {canManage ? (
                <span className='flex items-center gap-0.5 md:mt-5'>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={`Move ${row.name} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={`Move ${row.name} down`}
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={`Remove ${row.name}`}
                    disabled={rows.length === 1}
                    className='text-destructive hover:bg-destructive/10'
                    onClick={() =>
                      setRows((current) => current.filter((item) => item.key !== row.key))
                    }
                  >
                    <Trash2 />
                  </Button>
                </span>
              ) : (
                <span />
              )}
            </li>
          )
        })}
      </ol>
      {canManage && (
        <div className='flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5'>
          <span className='text-xs text-muted-foreground'>
            {dirty ? 'You have unsaved changes' : `${teaching} teaching periods a day`}
          </span>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={reset} disabled={!dirty || save.isPending}>
              <Undo2 />
              Discard
            </Button>
            <Button onClick={() => void submit()} loading={save.isPending} disabled={!dirty}>
              <Save />
              Save bell schedule
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function strip(row: Row): Required<BellPeriodInput> {
  return {
    name: row.name.trim(),
    start_time: row.start_time,
    end_time: row.end_time,
    is_break: row.is_break,
  }
}

function periodNumbers(rows: Row[]) {
  let count = 0
  return rows.map((row) => (row.is_break ? null : ++count))
}
