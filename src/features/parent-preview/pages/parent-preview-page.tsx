import { useMemo, useState } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ExternalLink, Smartphone } from 'lucide-react'
import { Combobox, type ComboboxOption } from '@/components/common/combobox'
import { EmptyState } from '@/components/common/display'
import { Page, PageHeader } from '@/components/common/page'
import { Card } from '@/components/ui/card'
import { useMe } from '@/features/auth/api'
import { useStudent, useStudents, type StudentListItem } from '@/features/students/api'
import { useDebouncedValue } from '@/hooks/use-debounce'
import { parentBase, usePreviewHome, usePreviewNotifications } from '../api'
import { ChatScreen, DiaryScreen, MeetingsScreen, NewsScreen } from '../components/connect-screens'
import { AttendanceScreen, BusScreen, HomeScreen } from '../components/home-screens'
import { PhoneFrame } from '../components/phone-frame'
import { isConnectScreen, PHONE_TABS, screenTitle, type PhoneTab } from '../tabs'
import {
  AchievementsScreen,
  FeesScreen,
  NotificationsScreen,
  ResultsScreen,
} from '../components/record-screens'

const route = getRouteApi('/_app/parent-preview')

const classText = (student: Pick<StudentListItem, 'class' | 'section'>) =>
  [student.class?.name, student.section?.name].filter(Boolean).join(' - ')

const toOption = (student: StudentListItem): ComboboxOption => ({
  value: String(student.id),
  label: `${student.full_name} (${student.admission_no})`,
  hint: classText(student),
})

function Screen({
  tab,
  studentId,
  onTab,
}: {
  tab: PhoneTab
  studentId: number
  onTab: (tab: PhoneTab) => void
}) {
  switch (tab) {
    case 'attendance':
      return <AttendanceScreen studentId={studentId} />
    case 'bus':
      return <BusScreen studentId={studentId} />
    case 'results':
      return <ResultsScreen studentId={studentId} />
    case 'fees':
      return <FeesScreen studentId={studentId} />
    case 'achievements':
      return <AchievementsScreen studentId={studentId} />
    case 'notifications':
      return <NotificationsScreen studentId={studentId} />
    case 'diary':
      return <DiaryScreen base={parentBase(studentId)} party='parent' />
    case 'meetings':
      return <MeetingsScreen base={parentBase(studentId)} party='parent' />
    case 'chat':
      return <ChatScreen base={parentBase(studentId)} party='parent' />
    case 'news':
      return <NewsScreen base={parentBase(studentId)} />
    default:
      return <HomeScreen studentId={studentId} onOpen={onTab} />
  }
}

function ChildPhone({
  studentId,
  tab,
  onTab,
}: {
  studentId: number
  tab: PhoneTab
  onTab: (tab: PhoneTab) => void
}) {
  const me = useMe().data
  const home = usePreviewHome(studentId)
  const notifications = usePreviewNotifications(studentId)
  const unread = notifications.data?.items.filter((item) => !item.is_read).length ?? 0
  const schoolName = home.data?.child?.school.name ?? me?.school?.name ?? 'School'
  return (
    <PhoneFrame
      app='Parent app'
      nav={PHONE_TABS}
      tab={tab}
      onTab={onTab}
      title={tab === 'home' ? schoolName : screenTitle(tab)}
      subtitle={home.data?.child?.full_name ?? 'Parent app'}
      schoolName={schoolName}
      logoUrl={me?.school?.logo_url ?? null}
      unread={unread}
      onBell={() => onTab('notifications')}
      onBack={isConnectScreen(tab) ? () => onTab('home') : undefined}
    >
      <Screen key={`${studentId}-${tab}`} tab={tab} studentId={studentId} onTab={onTab} />
    </PhoneFrame>
  )
}

export function ParentPreviewPage() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/parent-preview' })
  const me = useMe().data
  const [query, setQuery] = useState('')
  const term = useDebouncedValue(query.trim(), 300)
  const students = useStudents({ page: 1, limit: 20, status: 'active', search: term || undefined })
  const selected = useStudent(search.student ?? null)
  const home = usePreviewHome(search.student ?? 0)
  const tab = search.tab ?? 'home'

  const options = useMemo(() => {
    const list = (students.data?.items ?? []).map(toOption)
    const current = selected.data
    if (current && !list.some((option) => option.value === String(current.id))) {
      list.unshift(toOption(current))
    }
    return list
  }, [students.data, selected.data])

  const setSearch = (patch: { student?: number; tab?: PhoneTab }) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

  const parent = search.student ? home.data?.parent : undefined

  return (
    <Page>
      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_auto] lg:justify-center xl:gap-12'>
        <div className='grid gap-6'>
          <PageHeader
            eyebrow='Parent app'
            title='Parent app preview'
            description='See what a parent sees in the mobile app for their child: home, attendance, bus, results, fees, awards, diary, meetings, chat and announcements.'
          />
          <Card className='grid gap-4 p-5'>
            <div className='grid gap-1.5'>
              <label htmlFor='preview-student' className='text-sm font-semibold'>
                Student
              </label>
              <Combobox
                id='preview-student'
                label='Student'
                placeholder='Pick a student'
                searchPlaceholder='Search by name or admission no.'
                value={search.student ? String(search.student) : undefined}
                options={options}
                onSearch={setQuery}
                emptyText={students.isPending ? 'Loading students…' : 'No students found'}
                onChange={(value) =>
                  setSearch({ student: value ? Number(value) : undefined, tab: 'home' })
                }
                className='h-11 sm:w-full'
              />
            </div>
            {search.student && (
              <div className='grid gap-2 text-sm'>
                <div className='flex justify-between gap-3'>
                  <span className='text-muted-foreground'>Signed-in parent</span>
                  <span className='truncate text-right font-semibold'>
                    {home.isPending
                      ? '…'
                      : parent
                        ? `${parent.name} (${parent.relation})`
                        : 'No app login yet'}
                  </span>
                </div>
                <div className='flex justify-between gap-3'>
                  <span className='text-muted-foreground'>School</span>
                  <span className='truncate text-right font-semibold'>
                    {me?.school?.name ?? '—'}
                  </span>
                </div>
                <Link
                  to='/students/$studentId'
                  params={{ studentId: String(search.student) }}
                  search={{ tab: 'profile' }}
                  className='mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline'
                >
                  Open student profile <ExternalLink className='size-3.5' />
                </Link>
              </div>
            )}
            <p className='text-xs text-muted-foreground'>
              Read-only. The preview uses the same data as the Parent app and never signs in as the
              parent.
            </p>
          </Card>
        </div>

        {search.student ? (
          <ChildPhone
            studentId={search.student}
            tab={tab}
            onTab={(next) => setSearch({ tab: next })}
          />
        ) : (
          <Card className='sm:w-[390px]'>
            <EmptyState
              icon={Smartphone}
              title='Pick a student'
              description='Choose a student to see the parent app for that child.'
            />
          </Card>
        )}
      </div>
    </Page>
  )
}
