import { Users } from 'lucide-react'
import { Combobox } from '@/components/common/combobox'
import { EmptyState, ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { SegmentedControl } from '@/components/common/segmented-control'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { CombineMode, CombineOptions } from '../api'

export interface CombineDraft {
  mode: CombineMode
  section_id?: number
  boys_section_id?: number
  girls_section_id?: number
}

export function CombinePanel({
  options,
  loading,
  error,
  onRetry,
  draft,
  errors,
  onChange,
}: {
  options?: CombineOptions
  loading: boolean
  error?: string
  onRetry: () => void
  draft: CombineDraft
  errors: Record<string, string>
  onChange: (patch: Partial<CombineDraft>) => void
}) {
  if (loading) return <Skeleton className='h-40' />
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (!options) return null

  const { students, targets } = options
  const choices = targets.map((target) => ({
    value: String(target.section.id),
    label: target.section.name,
    hint: `${target.subject.name} · ${target.teacher.name} · ${target.students + target.joining} students`,
  }))
  const picker = (field: keyof Omit<CombineDraft, 'mode'>, label: string, placeholder: string) => (
    <FormField id={`combine-${field}`} label={label} required error={errors[field]}>
      <Combobox
        id={`combine-${field}`}
        label={label}
        value={draft[field] ? String(draft[field]) : undefined}
        placeholder={placeholder}
        searchPlaceholder='Search sections'
        options={choices}
        invalid={Boolean(errors[field])}
        onChange={(value) => onChange({ [field]: value ? Number(value) : undefined })}
        className='sm:w-full'
      />
    </FormField>
  )

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm'>
        <Users className='size-4 text-muted-foreground' aria-hidden />
        <span className='font-semibold'>{options.period.section.name}</span>
        <Badge tone='neutral'>{students.total} students</Badge>
        <Badge tone='info'>{students.boys} boys</Badge>
        <Badge tone='success'>{students.girls} girls</Badge>
      </div>
      {targets.length === 0 ? (
        <EmptyState
          icon={Users}
          title='No other section has a class now'
          description='Combining works only with another section of the same class that has a period with a teacher at this time. Assign a proxy teacher instead.'
          className='py-8'
        />
      ) : (
        <>
          <SegmentedControl
            label='How to combine'
            value={draft.mode}
            onChange={(mode) => onChange({ mode })}
            options={[
              { value: 'whole', label: 'Whole class to one section' },
              { value: 'split', label: 'Boys and girls separately' },
            ]}
            className='w-fit'
          />
          {draft.mode === 'whole' ? (
            picker('section_id', 'Sit with section', 'Choose a section')
          ) : (
            <div className='grid gap-4 sm:grid-cols-2'>
              {picker('boys_section_id', `Boys (${students.boys}) go to`, 'Choose a section')}
              {picker('girls_section_id', `Girls (${students.girls}) go to`, 'Choose a section')}
            </div>
          )}
          <p className='text-xs text-muted-foreground'>
            Only sections of the same class with a teacher in this period are listed. Their teachers
            are told in the Staff app.
          </p>
        </>
      )}
    </div>
  )
}
