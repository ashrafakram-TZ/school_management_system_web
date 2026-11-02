import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { BellRing, CalendarRange, Gauge, UserRound } from 'lucide-react'
import { Page, PageHeader } from '@/components/common/page'
import { PageTabs } from '@/components/common/page-tabs'
import { can, useMe } from '@/features/auth/api'
import { BellTab } from '../components/bell-tab'
import { BuilderTab } from '../components/builder-tab'
import { TeacherTab } from '../components/teacher-tab'
import { WorkloadTab } from '../components/workload-tab'
import type { TimetableSearch, TimetableTab } from '../search'

const route = getRouteApi('/_app/timetable')

export function TimetablePage() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/timetable' })
  const canManage = can(useMe().data, 'timetable.manage')

  const setSearch = (patch: Partial<TimetableSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

  return (
    <Page>
      <PageHeader
        eyebrow='Academics'
        title='Timetable'
        description='Weekly timetable of each section, every teacher’s week, workload against limits and the bell schedule.'
      />
      <PageTabs
        label='Timetable sections'
        value={search.tab}
        onChange={(tab: TimetableTab) => setSearch({ tab })}
        tabs={[
          { value: 'builder', label: 'Builder', icon: CalendarRange },
          { value: 'teachers', label: 'Teacher view', icon: UserRound },
          { value: 'workload', label: 'Workload', icon: Gauge },
          { value: 'bells', label: 'Bell schedule', icon: BellRing },
        ]}
      />
      {search.tab === 'builder' && (
        <BuilderTab
          sectionId={search.section_id}
          canManage={canManage}
          onSectionChange={(section_id) => setSearch({ section_id })}
        />
      )}
      {search.tab === 'teachers' && (
        <TeacherTab
          teacherId={search.teacher_id}
          onTeacherChange={(teacher_id) => setSearch({ teacher_id })}
        />
      )}
      {search.tab === 'workload' && (
        <WorkloadTab onOpenTeacher={(teacher_id) => setSearch({ tab: 'teachers', teacher_id })} />
      )}
      {search.tab === 'bells' && <BellTab canManage={canManage} />}
    </Page>
  )
}
