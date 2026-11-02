import { useState, type ReactNode } from 'react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Input } from '@/components/ui/input'
import { useClasses, useSections } from '@/features/setup/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import {
  studentsApi,
  useStudentMutation,
  type BloodGroup,
  type Gender,
  type StudentDetail,
} from '../api'
import { emptyGuardian, type GuardianDraft } from '../guardian-draft'
import { BLOOD_GROUPS, GENDER_LABELS, HOUSES, toOptions } from '../labels'
import { GuardianFields } from './guardian-fields'

export function Block({
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

export function Facts({ items }: { items: [string, ReactNode][] }) {
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

export function EnrollmentModal({
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

export function LinkGuardianModal({
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
            setError('Enter the full name and a valid 10-digit mobile number')
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

export function EditStudentModal({
  student,
  onClose,
}: {
  student: StudentDetail
  onClose: () => void
}) {
  const [draft, setDraft] = useState({
    first_name: student.first_name,
    last_name: student.last_name ?? '',
    dob: student.dob,
    gender: student.gender,
    blood_group: student.blood_group ?? '',
    house: student.house ?? '',
    address_line: student.address_line ?? '',
    city: student.city ?? '',
    pincode: student.pincode ?? '',
    previous_school: student.previous_school ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useStudentMutation(() =>
    studentsApi.update(student.id, {
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim() || null,
      dob: draft.dob,
      gender: draft.gender,
      blood_group: (draft.blood_group || null) as BloodGroup | null,
      house: draft.house || null,
      address_line: draft.address_line.trim() || null,
      city: draft.city.trim() || null,
      pincode: draft.pincode.trim() || null,
      previous_school: draft.previous_school.trim() || null,
    })
  )
  const set = (field: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Edit ${student.full_name}`}
      description='Class, parents and documents are changed from their own tabs.'
      formId='edit-student-form'
      submitText='Save'
      loading={save.isPending}
      size='lg'
    >
      <form
        id='edit-student-form'
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          const next: Record<string, string> = {}
          if (!draft.first_name.trim()) next.first_name = 'Enter the first name'
          if (!draft.dob) next.dob = 'Choose the date of birth'
          if (draft.pincode && !/^\d{6}$/.test(draft.pincode)) next.pincode = 'Pincode has 6 digits'
          setErrors(next)
          if (Object.keys(next).length) return
          try {
            await save.mutateAsync(undefined)
            alerts.success('Details saved')
            onClose()
          } catch (error) {
            const apiError = toApiError(error)
            setErrors(
              apiError.fieldErrors.length
                ? Object.fromEntries(apiError.fieldErrors.map((item) => [item.field, item.message]))
                : { root: apiError.message }
            )
          }
        }}
      >
        {errors.root && (
          <p role='alert' className='text-sm font-medium text-destructive sm:col-span-2'>
            {errors.root}
          </p>
        )}
        <FormField id='edit-first' label='First name' required error={errors.first_name}>
          <Input
            id='edit-first'
            value={draft.first_name}
            onChange={(event) => set('first_name', event.target.value)}
          />
        </FormField>
        <FormField id='edit-last' label='Last name' error={errors.last_name}>
          <Input
            id='edit-last'
            value={draft.last_name}
            onChange={(event) => set('last_name', event.target.value)}
          />
        </FormField>
        <FormField id='edit-dob' label='Date of birth' required error={errors.dob}>
          <Input
            id='edit-dob'
            type='date'
            value={draft.dob}
            onChange={(event) => set('dob', event.target.value)}
          />
        </FormField>
        <FormField id='edit-gender' label='Gender' required>
          <Combobox
            id='edit-gender'
            label='Gender'
            value={draft.gender}
            placeholder='Choose'
            options={toOptions(GENDER_LABELS)}
            onChange={(value) => set('gender', (value ?? 'male') as Gender)}
            highlightSelected={false}
            className='sm:w-full'
          />
        </FormField>
        <FormField id='edit-blood' label='Blood group'>
          <Combobox
            id='edit-blood'
            label='Blood group'
            value={draft.blood_group || undefined}
            placeholder='Not known'
            allLabel='Not known'
            options={BLOOD_GROUPS.map((value) => ({ value, label: value }))}
            onChange={(value) => set('blood_group', value ?? '')}
            highlightSelected={false}
            className='sm:w-full'
          />
        </FormField>
        <FormField id='edit-house' label='House'>
          <Combobox
            id='edit-house'
            label='House'
            value={draft.house || undefined}
            placeholder='No house'
            allLabel='No house'
            options={HOUSES.map((value) => ({ value, label: value }))}
            onChange={(value) => set('house', value ?? '')}
            highlightSelected={false}
            className='sm:w-full'
          />
        </FormField>
        <FormField
          id='edit-address'
          label='Address'
          className='sm:col-span-2'
          error={errors.address_line}
        >
          <Input
            id='edit-address'
            value={draft.address_line}
            onChange={(event) => set('address_line', event.target.value)}
          />
        </FormField>
        <FormField id='edit-city' label='City' error={errors.city}>
          <Input
            id='edit-city'
            value={draft.city}
            onChange={(event) => set('city', event.target.value)}
          />
        </FormField>
        <FormField id='edit-pincode' label='Pincode' error={errors.pincode}>
          <Input
            id='edit-pincode'
            inputMode='numeric'
            maxLength={6}
            value={draft.pincode}
            onChange={(event) => set('pincode', event.target.value.replace(/\D/g, ''))}
          />
        </FormField>
        <FormField
          id='edit-previous'
          label='Previous school'
          className='sm:col-span-2'
          error={errors.previous_school}
        >
          <Input
            id='edit-previous'
            value={draft.previous_school}
            onChange={(event) => set('previous_school', event.target.value)}
          />
        </FormField>
      </form>
    </AppModal>
  )
}
