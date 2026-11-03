import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { z } from 'zod'
import { AppLayout } from '@/components/layout/app-layout'
import { queryClient } from '@/lib/api/query-client'
import { session } from '@/lib/auth/session'
import { attendanceSearchSchema } from '@/features/attendance/search'
import { GeneralErrorPage, NotFoundPage } from '@/features/errors/error-pages'
import { outboxSearchSchema } from '@/features/notifications/search'
import { setupSearchSchema } from '@/features/setup/search'
import {
  assignmentsSearchSchema,
  staffProfileSearchSchema,
  staffSearchSchema,
} from '@/features/staff/search'
import {
  admissionsSearchSchema,
  guardiansSearchSchema,
  studentProfileSearchSchema,
  studentsSearchSchema,
} from '@/features/students/search'
import { payrollSearchSchema } from '@/features/payroll/search'
import { substitutesSearchSchema } from '@/features/substitutes/search'
import { timetableSearchSchema } from '@/features/timetable/search'
import { transportSearchSchema } from '@/features/transport/search'
import { usersSearchSchema } from '@/features/users/search'

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
  errorComponent: GeneralErrorPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  beforeLoad: () => {
    if (session.get()) throw redirect({ to: '/' })
  },
  component: lazyRouteComponent(() => import('@/features/auth/pages/login-page'), 'LoginPage'),
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  beforeLoad: ({ location }) => {
    if (!session.get()) {
      throw redirect({ to: '/login', search: { redirect: location.href }, replace: true })
    }
  },
  component: AppLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: lazyRouteComponent(
    () => import('@/features/dashboard/pages/dashboard-page'),
    'DashboardPage'
  ),
})

const usersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/users',
  validateSearch: usersSearchSchema,
  component: lazyRouteComponent(() => import('@/features/users/pages/users-page'), 'UsersPage'),
})

const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/notifications',
  validateSearch: outboxSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/notifications/pages/notifications-page'),
    'NotificationsPage'
  ),
})

const fleetRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/fleet',
  component: lazyRouteComponent(() => import('@/features/fleet/pages/fleet-page'), 'FleetPage'),
})

const studentsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/students',
  validateSearch: studentsSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/students/pages/students-page'),
    'StudentsPage'
  ),
})

const studentRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/students/$studentId',
  validateSearch: studentProfileSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/students/pages/student-page'),
    'StudentPage'
  ),
})

const admissionsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/admissions',
  validateSearch: admissionsSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/students/pages/admissions-page'),
    'AdmissionsPage'
  ),
})

const guardiansRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/guardians',
  validateSearch: guardiansSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/students/pages/guardians-page'),
    'GuardiansPage'
  ),
})

const staffRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/staff',
  validateSearch: staffSearchSchema,
  component: lazyRouteComponent(() => import('@/features/staff/pages/staff-page'), 'StaffPage'),
})

const staffAssignmentsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/staff/assignments',
  validateSearch: assignmentsSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/staff/pages/assignments-page'),
    'AssignmentsPage'
  ),
})

const staffProfileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/staff/$staffId',
  validateSearch: staffProfileSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/staff/pages/staff-profile-page'),
    'StaffProfilePage'
  ),
})

const attendanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/attendance',
  validateSearch: attendanceSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/attendance/pages/attendance-page'),
    'AttendancePage'
  ),
})

const timetableRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/timetable',
  validateSearch: timetableSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/timetable/pages/timetable-page'),
    'TimetablePage'
  ),
})

const substitutesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/substitutes',
  validateSearch: substitutesSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/substitutes/pages/substitutes-page'),
    'SubstitutesPage'
  ),
})

const payrollRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/payroll',
  validateSearch: payrollSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/payroll/pages/payroll-page'),
    'PayrollPage'
  ),
})

const transportRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/transport',
  validateSearch: transportSearchSchema,
  component: lazyRouteComponent(
    () => import('@/features/transport/pages/transport-page'),
    'TransportPage'
  ),
})

const routeBuilderRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/transport/routes/$routeId',
  params: {
    parse: (raw) => ({ routeId: z.coerce.number().int().min(1).parse(raw.routeId) }),
    stringify: (params) => ({ routeId: String(params.routeId) }),
  },
  component: lazyRouteComponent(
    () => import('@/features/transport/pages/route-builder-page'),
    'RouteBuilderPage'
  ),
})

const setupRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/setup',
  validateSearch: setupSearchSchema,
  component: lazyRouteComponent(() => import('@/features/setup/pages/setup-page'), 'SetupPage'),
})

const schoolsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/schools',
  component: lazyRouteComponent(
    () => import('@/features/schools/pages/schools-page'),
    'SchoolsPage'
  ),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    studentsRoute,
    studentRoute,
    admissionsRoute,
    guardiansRoute,
    staffRoute,
    staffAssignmentsRoute,
    staffProfileRoute,
    attendanceRoute,
    timetableRoute,
    substitutesRoute,
    payrollRoute,
    transportRoute,
    routeBuilderRoute,
    setupRoute,
    schoolsRoute,
    usersRoute,
    notificationsRoute,
    fleetRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
