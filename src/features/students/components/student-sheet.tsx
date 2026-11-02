import { useState, type ReactNode } from 'react'
import { Link2, Pencil, Phone, Plus, Smartphone, Star, X } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Avatar } from '@/components/common/avatar'
import { Combobox } from '@/components/common/combobox'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useClasses, useSections } from '@/features/setup/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { formatDate } from '@/lib/format'
import { studentsApi, useStudent, useStudentMutation, type StudentDetail } from '../api'
import { GENDER_LABELS, RELATION_LABELS, STUDENT_STATUS, classSection, yearsLabel } from '../labels'
import { emptyGuardian, type GuardianDraft } from '../guardian-draft'
import { GuardianFields } from './guardian-fields'

interface StudentSheetProps {
  studentId: number | null
  canManage: boolean
  onClose: () => void
  onOpenStudent: (id: number) => void
}

export function StudentSheet({ studentId, canManage, onClose, onOpenStudent }: StudentSheetProps) {
  const student = useStudent(studentId)
  const [placing, setPlacing] = useState(false)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState<{ id: number; name: string } | null>(null)
  const unlink = useStudentMutation((guardianId: number) =>
    studentsApi.removeGuardian(studentId!, guardianId)
  )
  const makeMain = useStudentMutation((guardianId: number) =>
    studentsApi.updateGuardianLink(studentId!, guardianId, { is_primary: true })
  )
  const data = student.data

  return (
    <Sheet open={Boolean(studentId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {student.isError && !data ? (
          <ErrorState message={student.error.message} onRetry={() => student.refetch()} />
        ) : !data ? (
          <div className='grid gap-4 p-6'>
            <Skeleton className='h-16' />
            <Skeleton className='h-40' />
            <Skeleton className='h-40' />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className='flex items-center gap-3'>
                <Avatar name={data.full_name} size='lg' />
                <div className='grid min-w-0 gap-0.5'>
                  <SheetTitle className='truncate'>{data.full_name}</SheetTitle>
                  <SheetDescription className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                    <span className='font-mono text-xs'>{data.admission_no}</span>
                    <span>·</span>
                    <span>Class {classSection(data.class?.name, data.section?.name)}</span>
                    {data.roll_no && <span>· Roll {data.roll_no}</span>}
                  </SheetDescription>
                  <div className='mt-1 flex flex-wrap gap-1.5'>
                    <Badge tone={STUDENT_STATUS[data.status].tone} dot>
                      {STUDENT_STATUS[data.status].label}
                    </Badge>
                    <Badge tone='neutral'>{yearsLabel(data.years_in_school)}</Badge>
                    {data.sibling_count > 0 && (
                      <Badge tone='info'>
                        {data.sibling_count} {data.sibling_count === 1 ? 'sibling' : 'siblings'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>
            <SheetBody className='grid content-start gap-6'>
              <Block
                title='Class this year'
                action={
                  canManage && (
                    <Button variant='outline' size='sm' onClick={() => setPlacing(true)}>
                      <Pencil />
                      Change
                    </Button>
                  )
                }
              >
                <Facts
                  items={[
                    ['Class', data.class ? `Class ${data.class.name}` : 'Not placed'],
                    ['Section', data.section?.name ?? 'Not placed'],
                    ['Roll number', data.roll_no ?? '—'],
                    ['House', data.house ?? '—'],
                  ]}
                />
              </Block>

              <Block title='Profile'>
                <Facts
                  items={[
                    ['Date of birth', `${formatDate(data.dob)} · ${data.age} years`],
                    ['Gender', GENDER_LABELS[data.gender]],
                    ['Blood group', data.blood_group ?? '—'],
                    ['Admitted on', formatDate(data.admission_date)],
                    ['Previous school', data.previous_school ?? '—'],
                    [
                      'Address',
                      [data.address_line, data.city, data.pincode].filter(Boolean).join(', ') ||
                        '—',
                    ],
                  ]}
                />
              </Block>

              <Block
                title='Parents and guardians'
                action={
                  canManage && (
                    <Button variant='outline' size='sm' onClick={() => setLinking(true)}>
                      <Plus />
                      Link parent
                    </Button>
                  )
                }
              >
                <ul className='grid gap-2'>
                  {data.guardian_details.map((guardian) => (
                    <li key={guardian.id} className='flex items-start gap-3 rounded-lg border p-3'>
                      <Avatar name={guardian.name} size='sm' />
                      <div className='grid min-w-0 flex-1 gap-1'>
                        <div className='flex flex-wrap items-center gap-1.5'>
                          <span className='font-semibold'>{guardian.name}</span>
                          <Badge tone='neutral'>{RELATION_LABELS[guardian.relation]}</Badge>
                          {guardian.is_primary && <Badge tone='success'>Main contact</Badge>}
                        </div>
                        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                          <span className='tabular inline-flex items-center gap-1'>
                            <Phone className='size-3' />
                            +91 {guardian.mobile}
                          </span>
                          <span className='inline-flex items-center gap-1'>
                            <Smartphone className='size-3' />
                            {guardian.on_app
                              ? 'Uses the app'
                              : guardian.receives_alerts
                                ? 'Invited, not signed in'
                                : 'No app login'}
                          </span>
                          {guardian.occupation && <span>{guardian.occupation}</span>}
                          {guardian.qualification && <span>{guardian.qualification}</span>}
                        </div>
                      </div>
                      {canManage && (
                        <div className='flex shrink-0 gap-1'>
                          {!guardian.is_primary && (
                            <Button
                              variant='ghost'
                              size='icon-sm'
                              aria-label={`Make ${guardian.name} the main contact`}
                              title='Make main contact'
                              onClick={() => makeMain.mutate(guardian.id)}
                            >
                              <Star />
                            </Button>
                          )}
                          {data.guardian_details.length > 1 && (
                            <Button
                              variant='ghost'
                              size='icon-sm'
                              aria-label={`Unlink ${guardian.name}`}
                              title='Unlink from this student'
                              className='text-destructive hover:bg-destructive/10'
                              onClick={() => setUnlinking({ id: guardian.id, name: guardian.name })}
                            >
                              <X />
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Block>

              {data.siblings.length > 0 && (
                <Block title='Brothers and sisters in this school'>
                  <ul className='grid gap-2'>
                    {data.siblings.map((sibling) => (
                      <li key={sibling.id}>
                        <button
                          type='button'
                          onClick={() => onOpenStudent(sibling.id)}
                          className='flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none'
                        >
                          <Avatar name={sibling.full_name} size='sm' />
                          <span className='flex-1 font-semibold'>{sibling.full_name}</span>
                          <span className='text-xs text-muted-foreground'>
                            Class {sibling.class_section ?? '—'}
                          </span>
                          <Link2 className='size-4 text-muted-foreground' />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Block>
              )}

              <Block title='Class history'>
                <ul className='grid gap-0 overflow-hidden rounded-lg border'>
                  {data.history.map((row) => (
                    <li
                      key={row.academic_year}
                      className='flex items-center justify-between gap-3 border-b px-3 py-2.5 text-sm last:border-0'
                    >
                      <span className='font-semibold'>{row.academic_year}</span>
                      <span className='text-muted-foreground'>
                        Class {classSection(row.class_name, row.section_name)}
                        {row.roll_no ? ` · Roll ${row.roll_no}` : ''}
                      </span>
                      {row.is_current ? (
                        <Badge tone='success'>Current</Badge>
                      ) : (
                        <Badge tone='neutral' className='capitalize'>
                          {row.status}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </Block>

              {data.emergency_contacts.length > 0 && (
                <Block title='Emergency contacts'>
                  <Facts
                    items={data.emergency_contacts.map((contact) => [
                      `${contact.name} (${contact.relation})`,
                      `+91 ${contact.mobile}`,
                    ])}
                  />
                </Block>
              )}
            </SheetBody>

            {placing && <EnrollmentModal open onOpenChange={setPlacing} student={data} />}
            {linking && <LinkGuardianModal open onOpenChange={setLinking} student={data} />}
            <ConfirmDialog
              open={Boolean(unlinking)}
              onOpenChange={(open) => !open && setUnlinking(null)}
              title={`Unlink ${unlinking?.name ?? ''}?`}
              description='They stay in the school records and keep their other children. They will no longer get alerts for this student.'
              confirmText='Unlink'
              destructive
              loading={unlink.isPending}
              onConfirm={async () => {
                if (!unlinking) return
                try {
                  await unlink.mutateAsync(unlinking.id)
                  alerts.success(`${unlinking.name} unlinked`)
                } catch (error) {
                  alerts.error(toApiError(error).message)
                }
                setUnlinking(null)
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Block({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className='grid gap-3'>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='text-xs font-bold tracking-wider text-muted-foreground uppercase'>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className='grid gap-x-6 gap-y-3 rounded-lg border p-3 sm:grid-cols-2'>
      {items.map(([label, value]) => (
        <div key={label} className='grid gap-0.5'>
          <dt className='text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
            {label}
          </dt>
          <dd className='text-sm font-semibold break-words'>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function EnrollmentModal({
  open,
  onOpenChange,
  student,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: StudentDetail
}) {
  const [classId, setClassId] = useState<number | null>(student.class?.id ?? null)
  const [sectionId, setSectionId] = useState<number | null>(student.section?.id ?? null)
  const [roll, setRoll] = useState(student.roll_no ? String(student.roll_no) : '')
  const [error, setError] = useState<string | null>(null)
  const classes = useClasses(open)
  const sections = useSections(classId ?? undefined, open && Boolean(classId))
  const save = useStudentMutation(() =>
    studentsApi.enrollment(student.id, {
      class_id: classId!,
      section_id: sectionId,
      roll_no: sectionId && roll ? Number(roll) : null,
    })
  )

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Class for ${student.full_name}`}
      description='Applies to the current academic year. Last year stays in the history.'
      formId='enrollment-form'
      submitText='Save'
      loading={save.isPending}
    >
      <form
        id='enrollment-form'
        noValidate
        className='grid gap-4'
        onSubmit={async (event) => {
          event.preventDefault()
          if (!classId) {
            setError('Choose a class')
            return
          }
          try {
            await save.mutateAsync(undefined)
            alerts.success('Class and section saved')
            onOpenChange(false)
          } catch (caught) {
            setError(toApiError(caught).message)
          }
        }}
      >
        {error && (
          <p role='alert' className='text-sm font-medium text-destructive'>
            {error}
          </p>
        )}
        <FormField id='enrol-class' label='Class' required>
          <Combobox
            id='enrol-class'
            label='Class'
            value={classId ? String(classId) : undefined}
            placeholder='Choose class'
            options={(classes.data ?? []).map((item) => ({
              value: String(item.id),
              label: `Class ${item.name}`,
            }))}
            onChange={(value) => {
              setClassId(value ? Number(value) : null)
              setSectionId(null)
              setError(null)
            }}
            highlightSelected={false}
            className='sm:w-full'
          />
        </FormField>
        <div className='grid gap-4 sm:grid-cols-2'>
          <FormField id='enrol-section' label='Section'>
            <Combobox
              id='enrol-section'
              label='Section'
              value={sectionId ? String(sectionId) : undefined}
              placeholder='No section yet'
              allLabel='No section yet'
              options={(sections.data ?? []).map((item) => ({
                value: String(item.id),
                label: `Section ${item.name}`,
                hint: `${item.student_count}/${item.capacity}`,
              }))}
              onChange={(value) => {
                setSectionId(value ? Number(value) : null)
                setError(null)
              }}
              highlightSelected={false}
              className='sm:w-full'
            />
          </FormField>
          <FormField id='enrol-roll' label='Roll number' hint='Optional'>
            <Input
              id='enrol-roll'
              inputMode='numeric'
              disabled={!sectionId}
              value={roll}
              onChange={(event) => setRoll(event.target.value.replace(/\D/g, '').slice(0, 3))}
            />
          </FormField>
        </div>
      </form>
    </AppModal>
  )
}

function LinkGuardianModal({
  open,
  onOpenChange,
  student,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: StudentDetail
}) {
  const [draft, setDraft] = useState<GuardianDraft>(() => emptyGuardian('mother'))
  const [error, setError] = useState<string | null>(null)
  const save = useStudentMutation((input: GuardianDraft) => {
    const { key: _key, ...guardian } = input
    return studentsApi.addGuardian(student.id, {
      ...guardian,
      email: guardian.email || null,
      occupation: guardian.occupation || null,
      qualification: guardian.qualification || null,
    })
  })

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Link a parent to ${student.full_name}`}
      description='If this mobile already belongs to a parent in the school, that parent is linked, which connects brothers and sisters.'
      formId='link-guardian-form'
      submitText='Link parent'
      loading={save.isPending}
      size='lg'
    >
      <form
        id='link-guardian-form'
        noValidate
        className='grid gap-3'
        onSubmit={async (event) => {
          event.preventDefault()
          if (draft.name.trim().length < 2 || !/^[6-9]\d{9}$/.test(draft.mobile)) {
            setError('Enter the full name and a valid 10-digit mobile')
            return
          }
          try {
            await save.mutateAsync(draft)
            alerts.success(`${draft.name} linked`)
            setDraft(emptyGuardian('mother'))
            onOpenChange(false)
          } catch (caught) {
            setError(toApiError(caught).message)
          }
        }}
      >
        {error && (
          <p role='alert' className='text-sm font-medium text-destructive'>
            {error}
          </p>
        )}
        <GuardianFields value={draft} index={9} primary={false} onChange={setDraft} />
      </form>
    </AppModal>
  )
}
