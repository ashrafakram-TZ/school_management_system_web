import { useState } from 'react'
import { IdCard, UsersRound } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Avatar } from '@/components/common/avatar'
import { DataTable, type Column } from '@/components/common/data-table'
import { FormField } from '@/components/common/form-field'
import { ListToolbar } from '@/components/common/list-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { alerts } from '@/lib/alerts'
import { formatDate } from '@/lib/format'
import { transportApi, useCrew, useTransportMutation, type Crew, type LicenceInput } from '../api'
import { ROLE_BADGE, formErrors } from '../labels'
import { ExpiryBadge } from './expiry-badges'

function Licence({ person }: { person: Crew }) {
  if (person.role !== 'driver') return <span className='text-muted-foreground'>Not needed</span>
  return (
    <span className='grid justify-items-start gap-1'>
      <span className='font-mono text-xs'>{person.licence_no ?? 'No licence number'}</span>
      {person.licence ? (
        <ExpiryBadge item={person.licence} withKind={false} />
      ) : (
        <Badge>Not set</Badge>
      )}
    </span>
  )
}

export function DriversTab({ canManage }: { canManage: boolean }) {
  const crew = useCrew()
  const [editing, setEditing] = useState<Crew | null>(null)
  const rows = crew.data ?? []

  const action = (person: Crew) =>
    canManage &&
    person.role === 'driver' && (
      <Button
        size='sm'
        variant='outline'
        aria-label={`Licence of ${person.name}`}
        onClick={() => setEditing(person)}
      >
        <IdCard />
        Licence
      </Button>
    )

  const columns: Column<Crew>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (person) => (
        <span className='flex items-center gap-3'>
          <Avatar name={person.name} />
          <span className='grid'>
            <span className='font-bold'>{person.name}</span>
            <span className='tabular text-xs text-muted-foreground'>{person.mobile}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (person) => (
        <Badge tone={ROLE_BADGE[person.role].tone}>{ROLE_BADGE[person.role].label}</Badge>
      ),
    },
    {
      key: 'bus',
      header: 'Bus',
      cell: (person) =>
        person.vehicle ? (
          <span className='font-mono text-xs font-semibold'>{person.vehicle.name}</span>
        ) : (
          <span className='text-muted-foreground'>No bus</span>
        ),
    },
    { key: 'licence', header: 'Licence', cell: (person) => <Licence person={person} /> },
    { key: 'actions', header: '', align: 'right', cell: action },
  ]

  return (
    <Card className='overflow-hidden'>
      <ListToolbar summary={crew.data ? `${rows.length} people` : ''}>
        <p className='text-sm text-muted-foreground'>
          Staff with the Driver or Bus attendant role. Give the role in Staff to add someone here.
        </p>
      </ListToolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(person) => person.user_id}
        loading={crew.isFetching}
        error={crew.isError ? crew.error.message : null}
        onRetry={() => crew.refetch()}
        empty={{
          icon: UsersRound,
          title: 'No drivers or attendants yet',
          description: 'Give staff the Driver or Bus attendant role and they appear here.',
        }}
        card={(person) => (
          <div className='flex items-start gap-3'>
            <Avatar name={person.name} />
            <div className='grid min-w-0 flex-1 gap-1.5'>
              <div className='flex items-start justify-between gap-2'>
                <span className='grid min-w-0'>
                  <span className='truncate font-bold'>{person.name}</span>
                  <span className='tabular text-xs text-muted-foreground'>{person.mobile}</span>
                </span>
                <Badge tone={ROLE_BADGE[person.role].tone}>{ROLE_BADGE[person.role].label}</Badge>
              </div>
              <span className='text-xs text-muted-foreground'>
                Bus{' '}
                <span className='font-semibold text-foreground'>
                  {person.vehicle?.name ?? 'No bus'}
                </span>
              </span>
              {person.role === 'driver' && <Licence person={person} />}
              {action(person) && <div>{action(person)}</div>}
            </div>
          </div>
        )}
      />
      {editing && <LicenceModal person={editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function LicenceModal({ person, onClose }: { person: Crew; onClose: () => void }) {
  const [number, setNumber] = useState(person.licence_no ?? '')
  const [expiry, setExpiry] = useState(person.licence_expiry ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useTransportMutation((input: LicenceInput) =>
    transportApi.saveLicence(person.user_id, input)
  )

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Licence of ${person.name}`}
      description='You get an alert 30, 7 and 1 days before the licence ends.'
      formId='licence-form'
      loading={save.isPending}
      size='sm'
    >
      <form
        id='licence-form'
        noValidate
        className='grid gap-4'
        onSubmit={async (event) => {
          event.preventDefault()
          const cleaned = number.trim().toUpperCase().replace(/\s+/g, '')
          const next: Record<string, string> = {}
          if (cleaned && (cleaned.length < 6 || cleaned.length > 20))
            next.licence_no = 'Enter 6 to 20 letters and digits'
          setErrors(next)
          if (Object.keys(next).length) return
          try {
            await save.mutateAsync({ licence_no: cleaned || null, licence_expiry: expiry || null })
            alerts.success('Licence saved')
            onClose()
          } catch (error) {
            setErrors(formErrors(error))
          }
        }}
      >
        <FormField id='licence-no' label='Licence number' error={errors.licence_no}>
          <Input
            id='licence-no'
            autoFocus
            placeholder='TN0920190012345'
            value={number}
            aria-invalid={Boolean(errors.licence_no) || undefined}
            onChange={(event) => setNumber(event.target.value.toUpperCase())}
          />
        </FormField>
        <FormField
          id='licence-expiry'
          label='Licence valid until'
          error={errors.licence_expiry}
          hint={person.licence_expiry ? `Now ${formatDate(person.licence_expiry)}` : undefined}
        >
          <Input
            id='licence-expiry'
            type='date'
            value={expiry}
            aria-invalid={Boolean(errors.licence_expiry) || undefined}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </FormField>
      </form>
    </AppModal>
  )
}
