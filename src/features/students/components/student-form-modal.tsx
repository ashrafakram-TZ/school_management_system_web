import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useClasses, useSections } from '@/features/setup/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import {
  studentsApi,
  useStudentMutation,
  type Gender,
  type StudentDetail,
  type StudentInput,
} from '../api'
import { BLOOD_GROUPS, GENDER_LABELS, HOUSES, toOptions } from '../labels'
import { emptyGuardian, type GuardianDraft } from '../guardian-draft'
import { GuardianFields } from './guardian-fields'

const FORM_ID = 'student-form'

interface Draft {
  first_name: string
  last_name: string
  dob: string
  gender: Gender | ''
  blood_group: string
  house: string
  admission_no: string
  admission_date: string
  class_id: number | null
  section_id: number | null
  address_line: string
  city: string
  pincode: string
  previous_school: string
  identification_marks: string
}

const emptyDraft = (): Draft => ({
  first_name: '',
  last_name: '',
  dob: '',
  gender: '',
  blood_group: '',
  house: '',
  admission_no: '',
  admission_date: '',
  class_id: null,
  section_id: null,
  address_line: '',
  city: '',
  pincode: '',
  previous_school: '',
  identification_marks: '',
})

export function StudentFormModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: number) => void
}) {
  const create = useStudentMutation((input: StudentInput) => studentsApi.create(input))
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title='Add student'
      description='For students who are already admitted. New applicants go through Admissions.'
      formId={FORM_ID}
      submitText='Add student'
      size='lg'
      loading={create.isPending}
    >
      {open && (
        <StudentForm
          save={create.mutateAsync}
          onDone={(id) => {
            onOpenChange(false)
            onCreated?.(id)
          }}
        />
      )}
    </AppModal>
  )
}

function StudentForm({
  save,
  onDone,
}: {
  save: (input: StudentInput) => Promise<StudentDetail>
  onDone: (id: number) => void
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [guardians, setGuardians] = useState<GuardianDraft[]>([emptyGuardian('father')])
  const [primary, setPrimary] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rootError, setRootError] = useState<string | null>(null)
  const classes = useClasses()
  const sections = useSections(draft.class_id ?? undefined, Boolean(draft.class_id))
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!draft.first_name.trim()) next.first_name = 'Enter the first name'
    if (!draft.dob) next.dob = 'Enter the date of birth'
    if (!draft.gender) next.gender = 'Choose a gender'
    if (!draft.class_id) next.class_id = 'Choose a class'
    if (draft.pincode && !/^\d{6}$/.test(draft.pincode)) next.pincode = 'Pincode must be 6 digits'
    guardians.forEach((guardian, index) => {
      if (guardian.name.trim().length < 2) next[`guardians.${index}.name`] = 'Enter the full name'
      if (!/^[6-9]\d{9}$/.test(guardian.mobile))
        next[`guardians.${index}.mobile`] = 'Enter a valid 10-digit mobile number'
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setRootError(null)
    if (!validate()) return
    const blank = (value: string) => value.trim() || null
    try {
      const student = await save({
        first_name: draft.first_name.trim(),
        last_name: blank(draft.last_name),
        dob: draft.dob,
        gender: draft.gender as Gender,
        blood_group: (draft.blood_group || null) as StudentInput['blood_group'],
        house: blank(draft.house),
        admission_no: draft.admission_no.trim() || undefined,
        admission_date: draft.admission_date || undefined,
        class_id: draft.class_id!,
        section_id: draft.section_id,
        address_line: blank(draft.address_line),
        city: blank(draft.city),
        pincode: blank(draft.pincode),
        previous_school: blank(draft.previous_school),
        identification_marks: blank(draft.identification_marks),
        guardians: guardians.map(({ key: _key, ...guardian }, index) => ({
          ...guardian,
          email: guardian.email || null,
          occupation: guardian.occupation || null,
          qualification: guardian.qualification || null,
          is_primary: index === primary,
        })),
      })
      alerts.success(`${student.full_name} added`, {
        description: `Admission number ${student.admission_no}`,
      })
      onDone(student.id)
    } catch (error) {
      const apiError = toApiError(error)
      const fieldErrors = Object.fromEntries(
        apiError.fieldErrors.map((item) => [item.field, item.message])
      )
      if (apiError.code === 'ROLL_TAKEN' || apiError.code === 'SECTION_FULL')
        fieldErrors.section_id = apiError.message
      if (apiError.code === 'ADMISSION_NO_TAKEN') fieldErrors.admission_no = apiError.message
      setErrors(fieldErrors)
      if (!Object.keys(fieldErrors).length) setRootError(apiError.message)
    }
  }

  const guardianErrors = (index: number) => ({
    name: errors[`guardians.${index}.name`],
    mobile: errors[`guardians.${index}.mobile`],
  })

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className='grid gap-5'>
      {rootError && (
        <p
          role='alert'
          className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive'
        >
          {rootError}
        </p>
      )}
      <section className='grid gap-3'>
        <h3 className='text-xs font-bold tracking-wider text-muted-foreground uppercase'>
          Student
        </h3>
        <div className='grid gap-3 sm:grid-cols-2'>
          <FormField id='first_name' label='First name' required error={errors.first_name}>
            <Input
              id='first_name'
              autoFocus
              value={draft.first_name}
              onChange={(event) => set('first_name', event.target.value)}
            />
          </FormField>
          <FormField id='last_name' label='Last name / initial' error={errors.last_name}>
            <Input
              id='last_name'
              value={draft.last_name}
              onChange={(event) => set('last_name', event.target.value)}
            />
          </FormField>
          <FormField id='dob' label='Date of birth' required error={errors.dob}>
            <Input
              id='dob'
              type='date'
              value={draft.dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => set('dob', event.target.value)}
            />
          </FormField>
          <FormField id='gender' label='Gender' required error={errors.gender}>
            <Combobox
              id='gender'
              label='Gender'
              value={draft.gender || undefined}
              placeholder='Choose gender'
              options={toOptions(GENDER_LABELS)}
              onChange={(value) => set('gender', (value ?? '') as Gender)}
              invalid={Boolean(errors.gender)}
              highlightSelected={false}
              className='sm:w-full'
            />
          </FormField>
          <FormField id='class_id' label='Class' required error={errors.class_id}>
            <Combobox
              id='class_id'
              label='Class'
              value={draft.class_id ? String(draft.class_id) : undefined}
              placeholder={classes.isPending ? 'Loading classes' : 'Choose class'}
              options={(classes.data ?? []).map((item) => ({
                value: String(item.id),
                label: `Class ${item.name}`,
              }))}
              onChange={(value) => {
                set('class_id', value ? Number(value) : null)
                set('section_id', null)
              }}
              invalid={Boolean(errors.class_id)}
              highlightSelected={false}
              className='sm:w-full'
            />
          </FormField>
          <FormField
            id='section_id'
            label='Section'
            error={errors.section_id}
            hint={draft.class_id ? 'Optional; can be set later' : 'Choose a class first'}
          >
            <Combobox
              id='section_id'
              label='Section'
              value={draft.section_id ? String(draft.section_id) : undefined}
              placeholder='No section yet'
              allLabel='No section yet'
              options={(sections.data ?? []).map((item) => ({
                value: String(item.id),
                label: `Section ${item.name}`,
                hint: `${item.student_count}/${item.capacity}`,
              }))}
              onChange={(value) => set('section_id', value ? Number(value) : null)}
              highlightSelected={false}
              className='sm:w-full'
            />
          </FormField>
          <FormField id='house' label='House'>
            <Combobox
              id='house'
              label='House'
              value={draft.house || undefined}
              placeholder='Choose house'
              allLabel='No house'
              options={HOUSES.map((house) => ({ value: house, label: house }))}
              onChange={(value) => set('house', value ?? '')}
              highlightSelected={false}
              className='sm:w-full'
            />
          </FormField>
          <FormField id='blood_group' label='Blood group'>
            <Combobox
              id='blood_group'
              label='Blood group'
              value={draft.blood_group || undefined}
              placeholder='Not known'
              allLabel='Not known'
              options={BLOOD_GROUPS.map((group) => ({ value: group, label: group }))}
              onChange={(value) => set('blood_group', value ?? '')}
              highlightSelected={false}
              className='sm:w-full'
            />
          </FormField>
          <FormField
            id='admission_no'
            label='Admission number'
            error={errors.admission_no}
            hint='Leave empty to generate'
          >
            <Input
              id='admission_no'
              value={draft.admission_no}
              onChange={(event) => set('admission_no', event.target.value)}
            />
          </FormField>
          <FormField id='admission_date' label='Admission date' hint='Defaults to today'>
            <Input
              id='admission_date'
              type='date'
              value={draft.admission_date}
              onChange={(event) => set('admission_date', event.target.value)}
            />
          </FormField>
          <FormField
            id='identification_marks'
            label='Identification marks'
            hint='Birth marks, moles or scars. Printed on the TC.'
            className='sm:col-span-2'
          >
            <Input
              id='identification_marks'
              maxLength={255}
              placeholder='e.g. A mole on the left cheek, a scar on the right thumb'
              value={draft.identification_marks}
              onChange={(event) => set('identification_marks', event.target.value)}
            />
          </FormField>
          <FormField id='address_line' label='Address' className='sm:col-span-2'>
            <Input
              id='address_line'
              value={draft.address_line}
              onChange={(event) => set('address_line', event.target.value)}
            />
          </FormField>
          <FormField id='city' label='City'>
            <Input
              id='city'
              value={draft.city}
              onChange={(event) => set('city', event.target.value)}
            />
          </FormField>
          <FormField id='pincode' label='Pincode' error={errors.pincode}>
            <Input
              id='pincode'
              inputMode='numeric'
              maxLength={6}
              value={draft.pincode}
              onChange={(event) => set('pincode', event.target.value.replace(/\D/g, ''))}
            />
          </FormField>
        </div>
      </section>

      <section className='grid gap-3'>
        <div className='flex items-center justify-between'>
          <h3 className='text-xs font-bold tracking-wider text-muted-foreground uppercase'>
            Parents and guardians
          </h3>
          {guardians.length < 3 && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                setGuardians((current) => [
                  ...current,
                  emptyGuardian(current.length === 1 ? 'mother' : 'guardian'),
                ])
              }
            >
              <Plus />
              Add another
            </Button>
          )}
        </div>
        {errors.guardians && (
          <p className='text-xs font-medium text-destructive'>{errors.guardians}</p>
        )}
        {guardians.map((guardian, index) => (
          <GuardianFields
            key={guardian.key}
            value={guardian}
            index={index}
            primary={index === primary}
            errors={guardianErrors(index)}
            onChange={(next) =>
              setGuardians((current) =>
                current.map((item, position) => (position === index ? next : item))
              )
            }
            onMakePrimary={() => setPrimary(index)}
            onRemove={
              guardians.length > 1
                ? () => {
                    setGuardians((current) =>
                      current.filter((_item, position) => position !== index)
                    )
                    setPrimary((current) =>
                      current === index ? 0 : current > index ? current - 1 : current
                    )
                  }
                : undefined
            }
          />
        ))}
      </section>
    </form>
  )
}
