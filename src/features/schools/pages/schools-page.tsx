import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Building2, CircleOff, Plus } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { DataTable, type Column } from '@/components/common/data-table'
import { FormField } from '@/components/common/form-field'
import { ListToolbar, SearchBox } from '@/components/common/list-toolbar'
import { Page, PageHeader } from '@/components/common/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RootError } from '@/features/setup/components/setup-shared'
import { fieldErrorsOf } from '@/features/setup/form-actions'
import { alerts } from '@/lib/alerts'
import { schoolContext, useSelectedSchool } from '@/lib/auth/school-context'
import { useSaveSchool, useSchools, type School, type SchoolInput } from '../api'

const LIMIT = 20
const BOARDS = [
  { value: 'CBSE', label: 'CBSE' },
  { value: 'STATE', label: 'State board' },
  { value: 'ICSE', label: 'ICSE' },
  { value: 'OTHER', label: 'Other' },
]

export function SchoolsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const selected = useSelectedSchool()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const schools = useSchools({ page, limit: LIMIT, search: search || undefined })
  const rows = schools.data?.items ?? []

  const workOn = (school: School) => {
    schoolContext.set(school.id)
    void queryClient.invalidateQueries()
    alerts.success(`Now working on ${school.name}`)
    void navigate({ to: '/setup', search: { tab: 'classes' } })
  }

  const columns: Column<School>[] = [
    {
      key: 'name',
      header: 'School',
      cell: (school) => (
        <div className='flex items-center gap-3'>
          <span className='grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-mono text-[11px] font-bold text-primary'>
            {school.code.slice(0, 4)}
          </span>
          <div className='grid min-w-0'>
            <span className='truncate font-bold'>{school.name}</span>
            <span className='text-xs text-muted-foreground'>
              {[school.city, school.board].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'students',
      header: 'Students',
      cell: (school) => <span className='tabular font-semibold'>{school.student_count}</span>,
    },
    {
      key: 'users',
      header: 'Users',
      hideBelow: 'lg',
      cell: (school) => <span className='tabular'>{school.user_count}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (school) => (
        <span className='flex flex-wrap gap-1'>
          <Badge tone={school.is_active ? 'success' : 'neutral'} dot>
            {school.is_active ? 'Active' : 'Switched off'}
          </Badge>
          {school.id === selected && <Badge tone='info'>Working on</Badge>}
        </span>
      ),
    },
    {
      key: 'open',
      header: <span className='sr-only'>Open</span>,
      align: 'right',
      cell: (school) => (
        <Button
          size='sm'
          variant='outline'
          onClick={(event) => {
            event.stopPropagation()
            workOn(school)
          }}
        >
          Open
          <ArrowRight />
        </Button>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader
        eyebrow='Settings'
        title='Schools'
        description='Every school on the platform. Opening a school switches the whole console to it.'
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Add school
          </Button>
        }
      />
      <Card className='overflow-hidden'>
        <ListToolbar summary={schools.data ? `${schools.data.total} schools` : ''}>
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder='Name, code or city'
            label='Search schools'
          />
        </ListToolbar>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(school) => school.id}
          loading={schools.isFetching}
          error={schools.isError ? schools.error.message : null}
          onRetry={() => schools.refetch()}
          onRowClick={workOn}
          empty={{
            icon: search ? CircleOff : Building2,
            title: search ? 'No school matches' : 'No schools yet',
            description: search
              ? 'Try another name or code.'
              : 'Add the first school and its admin.',
          }}
          card={(school) => (
            <div className='flex items-center justify-between gap-3'>
              <div className='grid'>
                <span className='font-bold'>{school.name}</span>
                <span className='text-xs text-muted-foreground'>
                  {school.code} · {school.student_count} students
                </span>
              </div>
              <Badge tone={school.is_active ? 'success' : 'neutral'} dot>
                {school.is_active ? 'Active' : 'Off'}
              </Badge>
            </div>
          )}
          pagination={{
            page,
            limit: LIMIT,
            total: schools.data?.total ?? 0,
            label: 'schools',
            onPageChange: setPage,
          }}
        />
      </Card>
      {creating && <SchoolModal onClose={() => setCreating(false)} />}
    </Page>
  )
}

function SchoolModal({ onClose }: { onClose: () => void }) {
  const save = useSaveSchool()
  const [draft, setDraft] = useState({
    name: '',
    code: '',
    board: 'CBSE',
    city: '',
    admin_name: '',
    admin_mobile: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (field: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title='Add school'
      description='The admin gets a sign-in invite by SMS and can set up classes from there.'
      formId='school-form'
      submitText='Create school'
      loading={save.isPending}
      size='lg'
    >
      <form
        id='school-form'
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          const next: Record<string, string> = {}
          if (draft.name.trim().length < 3) next.name = 'Enter the school name'
          if (!/^[A-Za-z0-9]{2,20}$/.test(draft.code.trim()))
            next.code = '2 to 20 letters or digits'
          if (draft.admin_name && !/^[6-9]\d{9}$/.test(draft.admin_mobile))
            next.admin_mobile = 'Enter a valid 10-digit mobile'
          if (draft.admin_mobile && draft.admin_name.trim().length < 2)
            next.admin_name = 'Enter the admin name'
          setErrors(next)
          if (Object.keys(next).length) return
          const input: SchoolInput = {
            name: draft.name.trim(),
            code: draft.code.trim().toUpperCase(),
            board: draft.board as SchoolInput['board'],
            city: draft.city.trim() || null,
            ...(draft.admin_name
              ? { admin_name: draft.admin_name.trim(), admin_mobile: draft.admin_mobile }
              : {}),
          }
          try {
            const school = await save.mutateAsync({ input })
            alerts.success(`${school.name} created`)
            onClose()
          } catch (error) {
            const fields = fieldErrorsOf(error)
            if (fields.root?.includes('code')) fields.code = fields.root
            if (fields.root?.includes('mobile')) fields.admin_mobile = fields.root
            setErrors(fields.code || fields.admin_mobile ? { ...fields, root: '' } : fields)
          }
        }}
      >
        <RootError message={errors.root} />
        <FormField
          id='school-name'
          label='School name'
          required
          error={errors.name}
          className='sm:col-span-2'
        >
          <Input
            id='school-name'
            autoFocus
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </FormField>
        <FormField
          id='school-code'
          label='Code'
          required
          error={errors.code}
          hint='Used in admission numbers'
        >
          <Input
            id='school-code'
            className='font-mono uppercase'
            maxLength={20}
            value={draft.code}
            onChange={(event) => set('code', event.target.value)}
          />
        </FormField>
        <FormField id='school-board' label='Board'>
          <Combobox
            id='school-board'
            label='Board'
            value={draft.board}
            placeholder='Choose board'
            options={BOARDS}
            onChange={(value) => set('board', value ?? 'CBSE')}
            highlightSelected={false}
            className='sm:w-full'
          />
        </FormField>
        <FormField id='school-city' label='City'>
          <Input
            id='school-city'
            value={draft.city}
            onChange={(event) => set('city', event.target.value)}
          />
        </FormField>
        <div />
        <FormField id='admin-name' label='First admin name' error={errors.admin_name}>
          <Input
            id='admin-name'
            value={draft.admin_name}
            onChange={(event) => set('admin_name', event.target.value)}
          />
        </FormField>
        <FormField id='admin-mobile' label='First admin mobile' error={errors.admin_mobile}>
          <Input
            id='admin-mobile'
            type='tel'
            inputMode='numeric'
            maxLength={10}
            className='tabular'
            value={draft.admin_mobile}
            onChange={(event) =>
              set('admin_mobile', event.target.value.replace(/\D/g, '').slice(-10))
            }
          />
        </FormField>
      </form>
    </AppModal>
  )
}
