import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  Check,
  CircleCheckBig,
  CircleOff,
  ClipboardList,
  Clock3,
  GraduationCap,
  Plus,
  X,
  XCircle,
} from 'lucide-react'
import { Avatar } from '@/components/common/avatar'
import { DataTable, type Column } from '@/components/common/data-table'
import { InsightCards, type Insight } from '@/components/common/insight-cards'
import { FilterSelect, ListToolbar, SearchBox } from '@/components/common/list-toolbar'
import { Page, PageHeader } from '@/components/common/page'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Kbd } from '@/components/shortcuts/kbd'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { can, useMe } from '@/features/auth/api'
import { useClasses } from '@/features/setup/api'
import { useNow } from '@/hooks/use-now'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { formatDate, timeAgo } from '@/lib/format'
import {
  studentsApi,
  useAdmissionInsights,
  useAdmissions,
  useStudentMutation,
  type Admission,
  type AdmissionStatus,
} from '../api'
import { ApplicationModal, EnrolModal, RejectModal } from '../components/admission-modals'
import { ADMISSION_STATUS, GENDER_LABELS, RELATION_LABELS } from '../labels'
import type { AdmissionsSearch } from '../search'

const route = getRouteApi('/_app/admissions')
const LIMIT = 20

export function AdmissionsPage() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/admissions' })
  const now = useNow(60_000)
  const me = useMe().data
  const canManage = can(me, 'admissions.manage')
  const [creating, setCreating] = useState(false)
  const [enrolling, setEnrolling] = useState<Admission | null>(null)
  const [rejecting, setRejecting] = useState<Admission | null>(null)

  const admissions = useAdmissions({ ...search, limit: LIMIT })
  const insights = useAdmissionInsights()
  const classes = useClasses()
  const approve = useStudentMutation((id: number) => studentsApi.approve(id))
  const rows = admissions.data?.items ?? []

  const setSearch = (patch: Partial<AdmissionsSearch>) =>
    navigate({ search: (prev) => ({ ...prev, page: 1, ...patch }), replace: true })
  const pick = (status: AdmissionStatus) =>
    setSearch({ status: search.status === status ? undefined : status })

  useShortcut('students.create', () => setCreating(true), { enabled: canManage })
  useShortcut('app.refresh', () => {
    void admissions.refetch()
    void insights.refetch()
  })

  const data = insights.data
  const cards: Insight[] = [
    {
      key: 'applied',
      label: 'Waiting for a decision',
      value: data?.applied ?? 0,
      hint: 'Approve or reject',
      icon: Clock3,
      tone: 'info',
      active: search.status === 'applied',
      onClick: () => pick('applied'),
    },
    {
      key: 'approved',
      label: 'Approved, not enrolled',
      value: data?.approved ?? 0,
      hint: 'Enrol to create the student',
      icon: CircleCheckBig,
      tone: 'warning',
      active: search.status === 'approved',
      onClick: () => pick('approved'),
    },
    {
      key: 'enrolled',
      label: 'Enrolled this year',
      value: data?.enrolled ?? 0,
      hint: 'Now in Students',
      icon: GraduationCap,
      tone: 'success',
      active: search.status === 'enrolled',
      onClick: () => pick('enrolled'),
    },
    {
      key: 'rejected',
      label: 'Rejected',
      value: data?.rejected ?? 0,
      hint: 'With the reason kept',
      icon: XCircle,
      tone: 'danger',
      active: search.status === 'rejected',
      onClick: () => pick('rejected'),
    },
  ]

  const actions = (admission: Admission) => {
    if (!canManage) return null
    if (admission.status === 'applied') {
      return (
        <div className='inline-flex gap-1'>
          <Button
            size='sm'
            variant='outline'
            loading={approve.isPending && approve.variables === admission.id}
            onClick={async (event) => {
              event.stopPropagation()
              try {
                await approve.mutateAsync(admission.id)
                alerts.success(`${admission.full_name} approved`)
              } catch (error) {
                alerts.error(toApiError(error).message)
              }
            }}
          >
            <Check />
            Approve
          </Button>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={`Reject ${admission.full_name}`}
            className='text-destructive hover:bg-destructive/10'
            onClick={(event) => {
              event.stopPropagation()
              setRejecting(admission)
            }}
          >
            <X />
          </Button>
        </div>
      )
    }
    if (admission.status === 'approved') {
      return (
        <div className='inline-flex gap-1'>
          <Button
            size='sm'
            onClick={(event) => {
              event.stopPropagation()
              setEnrolling(admission)
            }}
          >
            <GraduationCap />
            Enrol
          </Button>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={`Reject ${admission.full_name}`}
            className='text-destructive hover:bg-destructive/10'
            onClick={(event) => {
              event.stopPropagation()
              setRejecting(admission)
            }}
          >
            <X />
          </Button>
        </div>
      )
    }
    if (admission.status === 'enrolled' && admission.student_id) {
      return (
        <Button
          size='sm'
          variant='ghost'
          onClick={(event) => {
            event.stopPropagation()
            void navigate({ to: '/students', search: { page: 1, student: admission.student_id! } })
          }}
        >
          Open student
        </Button>
      )
    }
    return null
  }

  const columns: Column<Admission>[] = [
    {
      key: 'name',
      header: 'Applicant',
      sortKey: 'first_name',
      cell: (admission) => (
        <div className='flex items-center gap-3'>
          <Avatar name={admission.full_name} />
          <div className='grid min-w-0'>
            <span className='truncate font-bold'>{admission.full_name}</span>
            <span className='truncate font-mono text-xs text-muted-foreground'>
              {admission.admission_no ?? admission.application_no}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      sortKey: 'class',
      cell: (admission) => (
        <div className='grid'>
          <span className='font-semibold'>Class {admission.class.name}</span>
          <span className='text-xs text-muted-foreground'>
            {GENDER_LABELS[admission.gender]} · born {formatDate(admission.dob)}
          </span>
        </div>
      ),
    },
    {
      key: 'parent',
      header: 'Parent',
      hideBelow: 'lg',
      cell: (admission) => (
        <div className='grid'>
          <span className='font-medium'>
            {admission.guardian_name}{' '}
            <span className='text-xs text-muted-foreground'>
              ({RELATION_LABELS[admission.guardian_relation]})
            </span>
          </span>
          <span className='tabular text-xs text-muted-foreground'>
            +91 {admission.guardian_mobile}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      cell: (admission) => (
        <div className='grid justify-items-start gap-1'>
          <Badge tone={ADMISSION_STATUS[admission.status].tone} dot>
            {ADMISSION_STATUS[admission.status].label}
          </Badge>
          {admission.decision_note && (
            <span
              className='max-w-56 truncate text-[11px] text-muted-foreground'
              title={admission.decision_note}
            >
              {admission.decision_note}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Applied',
      sortKey: 'created_at',
      hideBelow: 'xl',
      cell: (admission) => (
        <span className='text-muted-foreground'>{timeAgo(admission.created_at, now)}</span>
      ),
    },
    {
      key: 'actions',
      header: <span className='sr-only'>Actions</span>,
      align: 'right',
      cell: actions,
    },
  ]

  const filtered = Boolean(search.search || search.status || search.class_id)

  return (
    <Page>
      <PageHeader
        eyebrow='People'
        title='Admissions'
        description='Applications move from waiting to approved to enrolled. Enrolling creates the student and invites the parent to the app.'
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New application
              <Kbd id='students.create' inverted />
            </Button>
          )
        }
      />

      <InsightCards items={cards} loading={insights.isPending} />

      <Card className='overflow-hidden'>
        <ListToolbar
          summary={admissions.data ? `${admissions.data.total} applications` : ''}
          onClear={filtered ? () => navigate({ search: { page: 1 }, replace: true }) : undefined}
        >
          <SearchBox
            value={search.search ?? ''}
            onChange={(value) => setSearch({ search: value || undefined })}
            placeholder='Application no., name or mobile'
            label='Search applications'
          />
          <FilterSelect
            id='admission-class'
            label='Filter by class'
            allLabel='All classes'
            value={search.class_id ? String(search.class_id) : undefined}
            options={(classes.data ?? []).map((item) => ({
              value: String(item.id),
              label: `Class ${item.name}`,
            }))}
            onChange={(value) => setSearch({ class_id: value ? Number(value) : undefined })}
          />
          <FilterSelect
            id='admission-status'
            label='Filter by status'
            allLabel='All statuses'
            value={search.status}
            options={(Object.keys(ADMISSION_STATUS) as AdmissionStatus[]).map((status) => ({
              value: status,
              label: ADMISSION_STATUS[status].label,
            }))}
            onChange={(value) => setSearch({ status: value as AdmissionStatus | undefined })}
          />
        </ListToolbar>

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(admission) => admission.id}
          loading={admissions.isFetching}
          error={admissions.isError ? admissions.error.message : null}
          onRetry={() => admissions.refetch()}
          sort={{ sort: search.sort, order: search.order ?? 'desc' }}
          onSortChange={(next) => setSearch(next as Partial<AdmissionsSearch>)}
          empty={{
            icon: filtered ? CircleOff : ClipboardList,
            title: filtered ? 'No applications match these filters' : 'No applications yet',
            description: filtered
              ? 'Try another search or clear the filters.'
              : 'Take the first application for this year.',
            action: !filtered && canManage && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New application
              </Button>
            ),
          }}
          card={(admission) => (
            <div className='grid gap-2'>
              <div className='flex items-start justify-between gap-2'>
                <div className='grid'>
                  <span className='font-bold'>{admission.full_name}</span>
                  <span className='font-mono text-xs text-muted-foreground'>
                    {admission.application_no}
                  </span>
                </div>
                <Badge tone={ADMISSION_STATUS[admission.status].tone} dot>
                  {ADMISSION_STATUS[admission.status].label}
                </Badge>
              </div>
              <span className='text-xs text-muted-foreground'>
                Class {admission.class.name} · {admission.guardian_name} · +91{' '}
                {admission.guardian_mobile}
              </span>
              <div>{actions(admission)}</div>
            </div>
          )}
          pagination={{
            page: search.page,
            limit: LIMIT,
            total: admissions.data?.total ?? 0,
            label: 'applications',
            onPageChange: (page) => navigate({ search: (prev) => ({ ...prev, page }) }),
          }}
        />
      </Card>

      <ApplicationModal open={creating} onOpenChange={setCreating} />
      {enrolling && (
        <EnrolModal admission={enrolling} onOpenChange={(open) => !open && setEnrolling(null)} />
      )}
      {rejecting && (
        <RejectModal admission={rejecting} onOpenChange={(open) => !open && setRejecting(null)} />
      )}
    </Page>
  )
}
