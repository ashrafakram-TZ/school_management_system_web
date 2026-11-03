import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  CircleAlert,
  CircleCheck,
  ListChecks,
  UserRoundCheck,
  UserRoundX,
  Wand2,
} from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/common/display'
import { InsightCards, type Insight } from '@/components/common/insight-cards'
import { Page, PageHeader } from '@/components/common/page'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { can, useMe } from '@/features/auth/api'
import { DateStepper } from '@/features/attendance/components/date-stepper'
import { Notice } from '@/features/attendance/components/notice'
import { today } from '@/features/attendance/labels'
import {
  substitutesApi,
  useSubstituteBoard,
  useSubstituteMutation,
  type AbsentPeriod,
  type AbsentTeacher,
} from '../api'
import { AssignModal } from '../components/assign-modal'
import { TeacherCard } from '../components/teacher-card'
import { countText, dayOffText } from '../labels'

const route = getRouteApi('/_app/substitutes')

interface Assigning {
  teacher: AbsentTeacher
  period: AbsentPeriod
}

export function SubstitutesPage() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/substitutes' })
  const canManage = can(useMe().data, 'substitutes.manage')
  const now = today()
  const date = search.date ?? now
  const board = useSubstituteBoard(date)
  const data = board.data
  const [assigning, setAssigning] = useState<Assigning | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const remove = useSubstituteMutation((id: number) => substitutesApi.remove(id))
  const auto = useSubstituteMutation((value: string) => substitutesApi.auto(value))

  useShortcut('app.refresh', () => void board.refetch())

  const past = date < now
  const dayOff = data ? !data.working_day : false
  const editable = canManage && !past && !dayOff

  const setDate = (next: string) =>
    navigate({ search: { date: next === now ? undefined : next }, replace: true })

  const removeSubstitute = async (period: AbsentPeriod) => {
    if (!period.substitution_id) return
    setRemovingId(period.substitution_id)
    try {
      await remove.mutateAsync(period.substitution_id)
      alerts.success(
        `${period.substitute?.name ?? 'Substitute'} removed from period ${period.period_no}`
      )
    } catch (error) {
      alerts.error(toApiError(error).message)
    } finally {
      setRemovingId(null)
    }
  }

  const assignAll = async () => {
    try {
      const result = await auto.mutateAsync(date)
      const assigned = `${countText(result.assigned, 'period', 'periods')} assigned`
      if (result.left_uncovered) {
        alerts.warning(
          `${assigned}. ${countText(result.left_uncovered, 'period has', 'periods have')} no free teacher.`
        )
      } else {
        alerts.success(assigned)
      }
    } catch (error) {
      alerts.error(toApiError(error).message)
    }
  }

  const cards: Insight[] = [
    {
      key: 'away',
      label: 'Teachers away',
      value: data?.absent_teachers ?? 0,
      hint: 'On leave or marked absent',
      icon: UserRoundX,
      tone: data?.absent_teachers ? 'warning' : 'neutral',
    },
    {
      key: 'periods',
      label: 'Periods to cover',
      value: data?.periods ?? 0,
      hint: 'Classes they would teach',
      icon: ListChecks,
      tone: 'info',
    },
    {
      key: 'covered',
      label: 'Covered',
      value: data?.covered ?? 0,
      hint: 'Substitute assigned',
      icon: CircleCheck,
      tone: 'success',
    },
    {
      key: 'uncovered',
      label: 'Not covered',
      value: data?.uncovered ?? 0,
      hint: data?.uncovered ? 'Need a substitute' : 'Nothing left to cover',
      icon: CircleAlert,
      tone: data?.uncovered ? 'danger' : 'success',
    },
  ]

  return (
    <Page>
      <PageHeader
        eyebrow='Academics'
        title='Substitutes'
        description='Teachers away on a day, the periods they miss and who covers each one. The substitute is told in the Staff app.'
      />
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <DateStepper id='substitutes-date' value={date} onChange={setDate} allowFuture />
        {editable && Boolean(data?.uncovered) && (
          <Button onClick={() => void assignAll()} loading={auto.isPending}>
            <Wand2 />
            Assign all
          </Button>
        )}
      </div>
      {data && dayOff && <Notice>{dayOffText(data.holiday)}</Notice>}
      {data && !dayOff && past && canManage && (
        <Notice tone='info'>
          This date has passed. Substitutes can be set for today or later.
        </Notice>
      )}
      <InsightCards items={cards} loading={board.isPending} />
      {board.isPending ? (
        <div className='grid gap-4'>
          <Skeleton className='h-40' />
          <Skeleton className='h-40' />
        </div>
      ) : board.isError && !data ? (
        <Card>
          <ErrorState message={board.error.message} onRetry={() => board.refetch()} />
        </Card>
      ) : !data?.teachers.length ? (
        <Card>
          <EmptyState
            icon={UserRoundCheck}
            title={date === now ? 'Everyone is in today' : 'Everyone is in on this day'}
            description={
              dayOff
                ? 'No classes on this date.'
                : 'No teacher is on leave or marked absent, so there are no periods to cover.'
            }
          />
        </Card>
      ) : (
        <div className='grid gap-4 xl:grid-cols-2'>
          {data.teachers.map((item) => (
            <TeacherCard
              key={item.teacher.id}
              item={item}
              editable={editable}
              removingId={removingId}
              onAssign={(period) => setAssigning({ teacher: item, period })}
              onRemove={(period) => void removeSubstitute(period)}
            />
          ))}
        </div>
      )}
      {assigning && (
        <AssignModal
          date={date}
          teacherName={assigning.teacher.teacher.name}
          period={assigning.period}
          onClose={() => setAssigning(null)}
        />
      )}
    </Page>
  )
}
