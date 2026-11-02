import { useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { Combobox } from '@/components/common/combobox'
import { ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { alerts } from '@/lib/alerts'
import { setupApi, useSchoolProfile, useSetupMutation, type SchoolProfile } from '../api'
import { fieldErrorsOf } from '../form-actions'
import { RootError, Section } from './setup-shared'

const BOARDS = [
  { value: 'CBSE', label: 'CBSE' },
  { value: 'STATE', label: 'State board' },
  { value: 'ICSE', label: 'ICSE' },
  { value: 'OTHER', label: 'Other' },
]

export function ProfileTab({ canManage }: { canManage: boolean }) {
  const profile = useSchoolProfile()
  if (profile.isError)
    return <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />
  if (!profile.data) return <Skeleton className='h-96' />
  return <ProfileForm key={profile.data.id} school={profile.data} canManage={canManage} />
}

function ProfileForm({ school, canManage }: { school: SchoolProfile; canManage: boolean }) {
  const [draft, setDraft] = useState({
    name: school.name,
    board: school.board ?? '',
    address: school.address ?? '',
    city: school.city ?? '',
    state: school.state ?? '',
    pincode: school.pincode ?? '',
    phone: school.phone ?? '',
    emergency_phone: school.emergency_phone ?? '',
    email: school.email ?? '',
    latitude: school.latitude?.toString() ?? '',
    longitude: school.longitude?.toString() ?? '',
    geofence_radius_m: String(school.geofence_radius_m),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSetupMutation((input: Partial<SchoolProfile>) => setupApi.updateSchool(input))
  const set = (field: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }
  const text = (value: string) => value.trim() || null
  const number = (value: string) => (value.trim() === '' ? null : Number(value))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await save.mutateAsync({
        name: draft.name.trim(),
        board: (draft.board || null) as SchoolProfile['board'],
        address: text(draft.address),
        city: text(draft.city),
        state: text(draft.state),
        pincode: text(draft.pincode),
        phone: text(draft.phone),
        emergency_phone: text(draft.emergency_phone),
        email: text(draft.email),
        latitude: number(draft.latitude),
        longitude: number(draft.longitude),
        geofence_radius_m: Number(draft.geofence_radius_m) || 200,
      })
      alerts.success('School profile saved')
      setErrors({})
    } catch (error) {
      setErrors(fieldErrorsOf(error))
    }
  }

  const field = (
    id: keyof typeof draft,
    label: string,
    props: Partial<React.ComponentProps<typeof Input>> = {},
    hint?: string
  ) => (
    <FormField id={`school-${id}`} label={label} error={errors[id]} hint={hint}>
      <Input
        id={`school-${id}`}
        value={draft[id]}
        disabled={!canManage}
        onChange={(event) => set(id, event.target.value)}
        {...props}
      />
    </FormField>
  )

  return (
    <Section
      title='School profile'
      description={`School code ${school.code} · ${school.student_count} students · ${school.user_count} users`}
    >
      <form noValidate onSubmit={submit} className='grid gap-4 sm:grid-cols-2'>
        <RootError message={errors.root} />
        {field('name', 'School name')}
        <FormField id='school-board' label='Board'>
          <Combobox
            id='school-board'
            label='Board'
            value={draft.board || undefined}
            placeholder='Choose board'
            options={BOARDS}
            onChange={(value) => set('board', value ?? '')}
            highlightSelected={false}
            className='sm:w-full'
          />
        </FormField>
        <div className='sm:col-span-2'>{field('address', 'Address')}</div>
        {field('city', 'City')}
        {field('state', 'State')}
        {field('pincode', 'Pincode', { inputMode: 'numeric', maxLength: 6 })}
        {field('email', 'Office email', { type: 'email' })}
        {field('phone', 'Office phone', { type: 'tel' })}
        {field(
          'emergency_phone',
          'Emergency phone',
          { type: 'tel' },
          'Shown to parents in SOS and emergency messages'
        )}
        {field(
          'latitude',
          'Gate latitude',
          { inputMode: 'decimal' },
          'Used for bus arrival and staff check-in'
        )}
        {field('longitude', 'Gate longitude', { inputMode: 'decimal' })}
        {field(
          'geofence_radius_m',
          'Geofence radius (metres)',
          { inputMode: 'numeric' },
          '50 to 2000'
        )}
        {canManage && (
          <div className='flex justify-end sm:col-span-2'>
            <Button type='submit' loading={save.isPending}>
              <Save />
              Save profile
            </Button>
          </div>
        )}
      </form>
    </Section>
  )
}
