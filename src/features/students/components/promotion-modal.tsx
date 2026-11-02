import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useClasses } from '@/features/setup/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import { useStudentMutation } from '../api'
import { recordsApi, usePromotionPreview, type PromotionInput } from '../records-api'

export function PromotionModal({ onClose }: { onClose: () => void }) {
  const classes = useClasses()
  const [classId, setClassId] = useState<number | null>(null)
  const preview = usePromotionPreview(classId)
  const [target, setTarget] = useState<{
    classId: number | null
    sectionId: number | null
    for: number | null
  }>({
    classId: null,
    sectionId: null,
    for: null,
  })
  const [detained, setDetained] = useState<number[]>([])
  const promote = useStudentMutation((input: PromotionInput) => recordsApi.promote(input))
  const data = preview.data
  const toClassId = target.for === classId ? target.classId : (data?.suggested_class?.id ?? null)
  const toSectionId = target.for === classId ? target.sectionId : null
  const waiting = data?.students.filter((student) => !student.already_moved) ?? []
  const moving = waiting.length - detained.length

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title='Promote to next year'
      description='Moves a class into the next academic year. Students who repeat stay in the same class.'
      size='xl'
      footer={
        <div className='flex w-full flex-wrap justify-end gap-2'>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!data || !toClassId || waiting.length === 0}
            loading={promote.isPending}
            onClick={async () => {
              if (!data || !toClassId) return
              try {
                const result = await promote.mutateAsync({
                  from_class_id: data.from_class.id,
                  to_class_id: toClassId,
                  ...(toSectionId ? { to_section_id: toSectionId } : {}),
                  detained_ids: detained,
                })
                alerts.success(
                  `${result.promoted} promoted${result.detained ? `, ${result.detained} repeating` : ''}${result.skipped ? `, ${result.skipped} already moved` : ''}`
                )
                onClose()
              } catch (error) {
                alerts.error(toApiError(error).message)
              }
            }}
          >
            Promote {Math.max(0, moving)} {moving === 1 ? 'student' : 'students'}
          </Button>
        </div>
      }
    >
      <div className='grid gap-4'>
        <div className='grid gap-4 sm:grid-cols-[1fr_auto_1fr_1fr] sm:items-end'>
          <FormField id='promote-from' label='Class this year'>
            <Combobox
              id='promote-from'
              label='Class this year'
              value={classId ? String(classId) : undefined}
              placeholder='Choose class'
              options={(classes.data ?? []).map((item) => ({
                value: String(item.id),
                label: `Class ${item.name}`,
                hint: String(item.student_count),
              }))}
              onChange={(value) => {
                setClassId(value ? Number(value) : null)
                setDetained([])
              }}
              highlightSelected={false}
              className='sm:w-full'
            />
          </FormField>
          <ArrowRight className='mb-2.5 hidden size-5 text-muted-foreground sm:block' />
          <FormField id='promote-to' label={data ? `Class in ${data.to_year.name}` : 'Next class'}>
            <Combobox
              id='promote-to'
              label='Next class'
              value={toClassId ? String(toClassId) : undefined}
              placeholder='Choose class'
              options={(classes.data ?? []).map((item) => ({
                value: String(item.id),
                label: `Class ${item.name}`,
              }))}
              onChange={(value) =>
                setTarget({ classId: value ? Number(value) : null, sectionId: null, for: classId })
              }
              highlightSelected={false}
              className='sm:w-full'
            />
          </FormField>
          <FormField
            id='promote-section'
            label='Section'
            hint={
              data && !data.to_sections.length
                ? 'Add sections for next year in School setup'
                : undefined
            }
          >
            <Combobox
              id='promote-section'
              label='Section next year'
              value={toSectionId ? String(toSectionId) : undefined}
              placeholder='Allocate later'
              allLabel='Allocate later'
              options={
                toClassId === data?.suggested_class?.id
                  ? (data?.to_sections ?? []).map((item) => ({
                      value: String(item.id),
                      label: `Section ${item.name}`,
                    }))
                  : []
              }
              onChange={(value) =>
                setTarget({
                  classId: toClassId,
                  sectionId: value ? Number(value) : null,
                  for: classId,
                })
              }
              highlightSelected={false}
              className='sm:w-full'
            />
          </FormField>
        </div>

        {!classId ? (
          <p className='rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground'>
            Choose a class to see its students.
          </p>
        ) : preview.isError ? (
          <ErrorState message={preview.error.message} onRetry={() => preview.refetch()} />
        ) : !data ? (
          <Skeleton className='h-48' />
        ) : (
          <>
            <p className='text-sm text-muted-foreground'>
              {data.from_year.name} → {data.to_year.name}. Tick the students who will repeat Class{' '}
              {data.from_class.name}.
            </p>
            <ul className='grid max-h-80 gap-1.5 overflow-auto sm:grid-cols-2'>
              {data.students.map((student) => {
                const repeat = detained.includes(student.student_id)
                return (
                  <li key={student.student_id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-2.5',
                        repeat && 'border-warning/40 bg-warning/5',
                        student.already_moved && 'cursor-default opacity-60'
                      )}
                    >
                      <input
                        type='checkbox'
                        className='size-4 accent-[var(--warning)]'
                        disabled={student.already_moved}
                        checked={repeat}
                        onChange={() =>
                          setDetained((current) =>
                            repeat
                              ? current.filter((id) => id !== student.student_id)
                              : [...current, student.student_id]
                          )
                        }
                      />
                      <span className='grid min-w-0 flex-1'>
                        <span className='truncate font-semibold'>{student.full_name}</span>
                        <span className='text-xs text-muted-foreground'>
                          {student.section_name ? `Section ${student.section_name}` : 'No section'}
                          {student.roll_no ? ` · Roll ${student.roll_no}` : ''}
                        </span>
                      </span>
                      {student.already_moved ? (
                        <Badge tone='info'>Moved</Badge>
                      ) : repeat ? (
                        <Badge tone='warning'>Repeats</Badge>
                      ) : null}
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </AppModal>
  )
}
