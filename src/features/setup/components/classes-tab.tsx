import { useState } from 'react'
import { BookOpen, Check, LayoutGrid, Pencil, Plus, Trash2, UserRound, Wand2 } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  setupApi,
  useClasses,
  useClassSubjects,
  useSetupMutation,
  useSubjects,
  useTeachers,
  type SchoolClass,
  type Section as SectionRow,
  type SectionInput,
} from '../api'
import { fieldErrorsOf, run } from '../form-actions'
import { RootError, Section } from './setup-shared'

export function ClassesTab({ canManage }: { canManage: boolean }) {
  const classes = useClasses()
  const [sectionForm, setSectionForm] = useState<{
    schoolClass: SchoolClass
    section?: SectionRow
  } | null>(null)
  const [classForm, setClassForm] = useState(false)
  const [subjectsFor, setSubjectsFor] = useState<SchoolClass | null>(null)
  const [removing, setRemoving] = useState<{
    kind: 'class' | 'section'
    id: number
    name: string
  } | null>(null)
  const standard = useSetupMutation(() => setupApi.standardClasses())
  const remove = useSetupMutation((target: { kind: 'class' | 'section'; id: number }) =>
    target.kind === 'class' ? setupApi.removeClass(target.id) : setupApi.removeSection(target.id)
  )

  if (classes.isError) {
    return <ErrorState message={classes.error.message} onRetry={() => classes.refetch()} />
  }
  if (!classes.data) return <Skeleton className='h-96' />

  return (
    <Section
      title='Classes and sections'
      description='Sections, rooms and class teachers for the current academic year.'
      action={
        canManage && (
          <>
            <Button size='sm' variant='outline' onClick={() => setClassForm(true)}>
              <Plus />
              Add class
            </Button>
            <Button
              size='sm'
              variant='outline'
              loading={standard.isPending}
              onClick={() => run(() => standard.mutateAsync(undefined), 'LKG to 12 are ready')}
            >
              <Wand2 />
              Add LKG to 12
            </Button>
          </>
        )
      }
    >
      {classes.data.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title='No classes yet'
          description='Add LKG, UKG and classes 1 to 12 in one click, then add sections to each.'
          action={
            canManage && (
              <Button
                loading={standard.isPending}
                onClick={() => run(() => standard.mutateAsync(undefined), 'LKG to 12 are ready')}
              >
                <Wand2 />
                Add LKG to 12
              </Button>
            )
          }
        />
      ) : (
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
          {classes.data.map((schoolClass) => (
            <article
              key={schoolClass.id}
              className='grid content-start gap-3 rounded-xl border p-4'
            >
              <div className='flex items-start justify-between gap-2'>
                <div className='grid'>
                  <h3 className='text-base font-extrabold tracking-tight'>
                    Class {schoolClass.name}
                  </h3>
                  <span className='text-xs text-muted-foreground'>
                    {schoolClass.student_count} students · {schoolClass.sections.length}{' '}
                    {schoolClass.sections.length === 1 ? 'section' : 'sections'}
                  </span>
                </div>
                <div className='flex gap-1'>
                  <Button
                    size='icon-sm'
                    variant='ghost'
                    aria-label={`Subjects of class ${schoolClass.name}`}
                    title='Subjects'
                    onClick={() => setSubjectsFor(schoolClass)}
                  >
                    <BookOpen />
                  </Button>
                  {canManage && schoolClass.sections.length === 0 && (
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label={`Delete class ${schoolClass.name}`}
                      className='text-destructive hover:bg-destructive/10'
                      onClick={() =>
                        setRemoving({
                          kind: 'class',
                          id: schoolClass.id,
                          name: `Class ${schoolClass.name}`,
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
              <ul className='grid gap-1.5'>
                {schoolClass.sections.map((section) => {
                  const full = section.student_count / section.capacity
                  return (
                    <li key={section.id} className='grid gap-1.5 rounded-lg bg-muted/60 px-3 py-2'>
                      <div className='flex items-center justify-between gap-2'>
                        <span className='flex items-center gap-2'>
                          <span className='grid size-7 place-items-center rounded-md bg-card text-sm font-extrabold shadow-xs'>
                            {section.name}
                          </span>
                          <span className='grid'>
                            <span className='flex items-center gap-1 text-xs font-semibold'>
                              <UserRound className='size-3 text-muted-foreground' />
                              {section.class_teacher?.name ?? (
                                <span className='text-warning'>No class teacher</span>
                              )}
                            </span>
                            {section.room && (
                              <span className='text-[11px] text-muted-foreground'>
                                {section.room}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className='flex items-center gap-1'>
                          <span className='tabular text-xs font-semibold'>
                            {section.student_count}/{section.capacity}
                          </span>
                          {canManage && (
                            <>
                              <Button
                                size='icon-sm'
                                variant='ghost'
                                aria-label={`Edit section ${section.name}`}
                                onClick={() => setSectionForm({ schoolClass, section })}
                              >
                                <Pencil />
                              </Button>
                              {section.student_count === 0 && (
                                <Button
                                  size='icon-sm'
                                  variant='ghost'
                                  aria-label={`Delete section ${section.name}`}
                                  className='text-destructive hover:bg-destructive/10'
                                  onClick={() =>
                                    setRemoving({
                                      kind: 'section',
                                      id: section.id,
                                      name: `${schoolClass.name} - ${section.name}`,
                                    })
                                  }
                                >
                                  <Trash2 />
                                </Button>
                              )}
                            </>
                          )}
                        </span>
                      </div>
                      <span className='h-1 overflow-hidden rounded-full bg-border'>
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            full >= 1
                              ? 'bg-destructive'
                              : full >= 0.85
                                ? 'bg-warning'
                                : 'bg-primary'
                          )}
                          style={{ width: `${Math.min(100, Math.round(full * 100))}%` }}
                        />
                      </span>
                    </li>
                  )
                })}
              </ul>
              {canManage && (
                <Button
                  size='sm'
                  variant='ghost'
                  className='justify-self-start'
                  onClick={() => setSectionForm({ schoolClass })}
                >
                  <Plus />
                  Add section
                </Button>
              )}
            </article>
          ))}
        </div>
      )}

      {sectionForm && (
        <SectionModal
          schoolClass={sectionForm.schoolClass}
          section={sectionForm.section}
          onClose={() => setSectionForm(null)}
        />
      )}
      {classForm && <ClassModal onClose={() => setClassForm(false)} />}
      {subjectsFor && (
        <ClassSubjectsModal
          schoolClass={subjectsFor}
          canManage={canManage}
          onClose={() => setSubjectsFor(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete ${removing?.name ?? ''}?`}
        description='Only empty classes and sections can be deleted.'
        confirmText='Delete'
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (removing) await run(() => remove.mutateAsync(removing), `${removing.name} deleted`)
          setRemoving(null)
        }}
      />
    </Section>
  )
}

function SectionModal({
  schoolClass,
  section,
  onClose,
}: {
  schoolClass: SchoolClass
  section?: SectionRow
  onClose: () => void
}) {
  const teachers = useTeachers()
  const [name, setName] = useState(section?.name ?? '')
  const [room, setRoom] = useState(section?.room ?? '')
  const [capacity, setCapacity] = useState(String(section?.capacity ?? 40))
  const [teacher, setTeacher] = useState(
    section?.class_teacher ? String(section.class_teacher.id) : ''
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSetupMutation(() => {
    const input: SectionInput = {
      class_id: schoolClass.id,
      name: name.trim().toUpperCase(),
      room: room.trim() || null,
      capacity: Number(capacity) || 40,
      class_teacher_user_id: teacher ? Number(teacher) : null,
    }
    return section ? setupApi.updateSection(section.id, input) : setupApi.createSection(input)
  })

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={
        section
          ? `Edit section ${schoolClass.name} - ${section.name}`
          : `Add a section to class ${schoolClass.name}`
      }
      formId='section-form'
      submitText={section ? 'Save' : 'Add section'}
      loading={save.isPending}
    >
      <form
        id='section-form'
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          if (!/^[A-Za-z0-9]{1,10}$/.test(name.trim())) {
            setErrors({ name: 'Use a short name like A' })
            return
          }
          try {
            await save.mutateAsync(undefined)
            onClose()
          } catch (error) {
            setErrors(fieldErrorsOf(error))
          }
        }}
      >
        <RootError message={errors.root} />
        <FormField id='section-name' label='Section' required error={errors.name}>
          <Input
            id='section-name'
            autoFocus
            placeholder='A'
            maxLength={10}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField id='section-capacity' label='Capacity' error={errors.capacity}>
          <Input
            id='section-capacity'
            inputMode='numeric'
            value={capacity}
            onChange={(event) => setCapacity(event.target.value.replace(/\D/g, ''))}
          />
        </FormField>
        <FormField id='section-room' label='Room' error={errors.room}>
          <Input
            id='section-room'
            placeholder='Block B · 204'
            value={room}
            onChange={(event) => setRoom(event.target.value)}
          />
        </FormField>
        <FormField id='section-teacher' label='Class teacher' error={errors.class_teacher_user_id}>
          <Combobox
            id='section-teacher'
            label='Class teacher'
            value={teacher || undefined}
            placeholder='No class teacher'
            allLabel='No class teacher'
            searchPlaceholder='Search teachers'
            options={(teachers.data ?? []).map((item) => ({
              value: String(item.id),
              label: item.name,
            }))}
            onChange={(value) => setTeacher(value ?? '')}
            highlightSelected={false}
            className='sm:w-full'
          />
        </FormField>
      </form>
    </AppModal>
  )
}

function ClassModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSetupMutation(() =>
    setupApi.createClass({ name: name.trim(), grade_level: Number(grade) })
  )
  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title='Add class'
      formId='class-form'
      submitText='Add class'
      loading={save.isPending}
    >
      <form
        id='class-form'
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          if (!name.trim() || grade === '' || Number.isNaN(Number(grade))) {
            setErrors({
              name: !name.trim() ? 'Enter a name' : '',
              grade_level: 'Enter the order, for example 6',
            })
            return
          }
          try {
            await save.mutateAsync(undefined)
            onClose()
          } catch (error) {
            setErrors(fieldErrorsOf(error))
          }
        }}
      >
        <RootError message={errors.root} />
        <FormField id='class-name' label='Name' required error={errors.name}>
          <Input
            id='class-name'
            autoFocus
            placeholder='Pre-KG'
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField
          id='class-grade'
          label='Order'
          required
          error={errors.grade_level}
          hint='LKG -1, UKG 0, then 1 to 12'
        >
          <Input
            id='class-grade'
            inputMode='numeric'
            value={grade}
            onChange={(event) => setGrade(event.target.value.replace(/[^\d-]/g, ''))}
          />
        </FormField>
      </form>
    </AppModal>
  )
}

function ClassSubjectsModal({
  schoolClass,
  canManage,
  onClose,
}: {
  schoolClass: SchoolClass
  canManage: boolean
  onClose: () => void
}) {
  const subjects = useSubjects()
  const current = useClassSubjects(schoolClass.id)
  const [picked, setPicked] = useState<Map<number, { periods: number; optional: boolean }> | null>(
    null
  )
  const save = useSetupMutation(() =>
    setupApi.setClassSubjects(
      schoolClass.id,
      [...(picked ?? new Map()).entries()].map(([subjectId, value]) => ({
        subject_id: subjectId,
        periods_per_week: value.periods,
        is_optional: value.optional,
      }))
    )
  )
  const selection =
    picked ??
    new Map(
      (current.data ?? []).map((item) => [
        item.subject_id,
        { periods: item.periods_per_week, optional: item.is_optional },
      ])
    )
  const update = (next: Map<number, { periods: number; optional: boolean }>) =>
    setPicked(new Map(next))
  const totalPeriods = [...selection.values()].reduce((sum, item) => sum + item.periods, 0)

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Subjects for class ${schoolClass.name}`}
      description={`${selection.size} subjects · ${totalPeriods} periods a week`}
      formId={canManage ? 'class-subjects-form' : undefined}
      submitText='Save subjects'
      loading={save.isPending}
      size='lg'
    >
      <form
        id='class-subjects-form'
        noValidate
        onSubmit={async (event) => {
          event.preventDefault()
          if (
            await run(
              () => save.mutateAsync(undefined),
              `Subjects for class ${schoolClass.name} saved`
            )
          )
            onClose()
        }}
      >
        {!subjects.data || !current.data ? (
          <Skeleton className='h-60' />
        ) : subjects.data.items.length === 0 ? (
          <p className='text-sm text-muted-foreground'>Add subjects in the Subjects tab first.</p>
        ) : (
          <ul className='grid max-h-[55dvh] gap-1.5 overflow-y-auto pr-1'>
            {subjects.data.items.map((subject) => {
              const item = selection.get(subject.id)
              return (
                <li
                  key={subject.id}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-lg border p-2.5',
                    item && 'border-primary/50 bg-primary/5'
                  )}
                >
                  <button
                    type='button'
                    disabled={!canManage}
                    onClick={() => {
                      const next = new Map(selection)
                      if (item) next.delete(subject.id)
                      else next.set(subject.id, { periods: 4, optional: false })
                      update(next)
                    }}
                    className='flex flex-1 items-center gap-3 text-left'
                  >
                    <span
                      className={cn(
                        'grid size-4 place-items-center rounded border',
                        item
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-card'
                      )}
                    >
                      {item && <Check className='size-3' strokeWidth={3} />}
                    </span>
                    <span className='grid'>
                      <span className='text-sm font-semibold'>{subject.name}</span>
                      <span className='font-mono text-[11px] text-muted-foreground'>
                        {subject.code}
                      </span>
                    </span>
                  </button>
                  {item && (
                    <span className='flex items-center gap-2'>
                      <Input
                        aria-label={`Periods a week for ${subject.name}`}
                        inputMode='numeric'
                        disabled={!canManage}
                        className='h-8 w-14 text-center'
                        value={String(item.periods)}
                        onChange={(event) => {
                          const next = new Map(selection)
                          next.set(subject.id, {
                            ...item,
                            periods: Math.min(
                              20,
                              Number(event.target.value.replace(/\D/g, '')) || 0
                            ),
                          })
                          update(next)
                        }}
                      />
                      <span className='text-xs text-muted-foreground'>/ week</span>
                      <button
                        type='button'
                        disabled={!canManage}
                        onClick={() => {
                          const next = new Map(selection)
                          next.set(subject.id, { ...item, optional: !item.optional })
                          update(next)
                        }}
                      >
                        <Badge tone={item.optional ? 'warning' : 'neutral'}>
                          {item.optional ? 'Optional' : 'Required'}
                        </Badge>
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </form>
    </AppModal>
  )
}
