import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Bus,
  ClipboardList,
  GraduationCap,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { ErrorState } from '@/components/common/display'
import { FleetMap } from '@/components/common/fleet-map'
import { Page, PageHeader } from '@/components/common/page'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SosBanner } from '@/features/alerts/components/sos-banner'
import { can, useMe } from '@/features/auth/api'
import { SportsStarsCard } from '@/features/activities/components/sports-stars-card'
import { TopRankHoldersCard } from '@/features/exams/components/top-rank-holders-card'
import { useFleetLive, VEHICLE_STATE } from '@/features/fleet/api'
import { useStaffInsights } from '@/features/staff/api'
import { useAdmissionInsights, useStudentInsights } from '@/features/students/api'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

type TileLink =
  | { to: '/students'; search: { page: number } }
  | { to: '/admissions'; search: { page: number } }
  | { to: '/staff'; search: { page: number } }
  | { to: '/fleet' }

export function DashboardPage() {
  const me = useMe().data
  const firstName = me?.name.split(' ')[0] ?? ''
  return (
    <Page>
      <PageHeader
        eyebrow='Overview'
        title={`Good ${greeting()}, ${firstName}`}
        description='Today at a glance: students, admissions, staff and buses.'
      />
      {can(me, 'fleet.view') && <SosBanner />}
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4'>
        {can(me, 'students.view') && <StudentTiles />}
        {can(me, 'staff.view') && <StaffTile />}
        {can(me, 'fleet.view') && <BusTile />}
      </div>
      {can(me, 'fleet.view') && <BusMap />}
      {can(me, 'exams.view') && <TopRankHoldersCard />}
      {can(me, 'students.view') && <SportsStarsCard />}
    </Page>
  )
}

function greeting() {
  const hour = Number(
    new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' })
  )
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
}

function Tile({
  link,
  label,
  value,
  hint,
  icon: Icon,
  tone,
  loading,
}: {
  link: TileLink
  label: string
  value: string | number
  hint: string
  icon: LucideIcon
  tone: string
  loading?: boolean
}) {
  return (
    <Link
      {...link}
      className='group grid gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none sm:p-5'
    >
      <div className='flex items-start justify-between gap-2'>
        <span className='text-sm font-semibold text-muted-foreground'>{label}</span>
        <span className={cn('grid size-9 place-items-center rounded-lg', tone)}>
          <Icon className='size-4' />
        </span>
      </div>
      {loading ? (
        <Skeleton className='h-8 w-16' />
      ) : (
        <span className='tabular text-3xl font-extrabold tracking-tight'>{value}</span>
      )}
      <span className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
        {hint}
        <ArrowRight className='size-3.5 opacity-0 transition-opacity group-hover:opacity-100' />
      </span>
    </Link>
  )
}

function StudentTiles() {
  const students = useStudentInsights()
  const admissions = useAdmissionInsights()
  return (
    <>
      <Tile
        link={{ to: '/students', search: { page: 1 } }}
        label='Students'
        value={formatNumber(students.data?.total)}
        hint={`${students.data?.new_this_month ?? 0} joined this month`}
        icon={GraduationCap}
        tone='bg-primary/10 text-primary'
        loading={students.isPending}
      />
      <Tile
        link={{ to: '/admissions', search: { page: 1 } }}
        label='Applications waiting'
        value={formatNumber(admissions.data?.applied)}
        hint={`${admissions.data?.approved ?? 0} approved, not enrolled`}
        icon={ClipboardList}
        tone='bg-info/10 text-info'
        loading={admissions.isPending}
      />
    </>
  )
}

function StaffTile() {
  const staff = useStaffInsights()
  const attention = staff.data?.need_attention ?? 0
  return (
    <Tile
      link={{ to: '/staff', search: { page: 1 } }}
      label='Staff'
      value={formatNumber(staff.data?.total_staff)}
      hint={attention ? `${attention} need attention` : 'All records complete'}
      icon={attention ? UsersRound : UserRoundCheck}
      tone={attention ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}
      loading={staff.isPending}
    />
  )
}

function BusTile() {
  const live = useFleetLive()
  return (
    <Tile
      link={{ to: '/fleet' }}
      label='Buses moving'
      value={live.isError ? '—' : `${live.data?.moving ?? 0}/${live.data?.total ?? 0}`}
      hint={live.isError ? 'Bus tracking is not reachable' : `${live.data?.offline ?? 0} offline`}
      icon={Bus}
      tone='bg-success/10 text-success'
      loading={live.isPending}
    />
  )
}

function BusMap() {
  const live = useFleetLive()
  const vehicles = live.data?.vehicles ?? []
  return (
    <Card className='overflow-hidden'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5'>
        <div className='grid'>
          <h2 className='font-bold'>Buses now</h2>
          <p className='text-xs text-muted-foreground'>Live positions from bus tracking</p>
        </div>
        <div className='flex flex-wrap gap-1.5'>
          {vehicles.slice(0, 6).map((vehicle) => (
            <Badge key={vehicle.id} tone={VEHICLE_STATE[vehicle.state].tone} dot>
              {vehicle.name}
            </Badge>
          ))}
        </div>
      </div>
      {live.isError ? (
        <ErrorState message={live.error.message} onRetry={() => live.refetch()} />
      ) : live.isPending ? (
        <Skeleton className='h-80 rounded-none' />
      ) : (
        <FleetMap
          className='h-80'
          emptyText='No bus has sent its position yet'
          points={vehicles
            .filter((vehicle) => vehicle.position)
            .map((vehicle) => ({
              id: vehicle.id,
              lat: vehicle.position!.lat,
              lng: vehicle.position!.lng,
              label: vehicle.name,
              sublabel: VEHICLE_STATE[vehicle.state].label,
              color: VEHICLE_STATE[vehicle.state].color,
            }))}
        />
      )}
    </Card>
  )
}
