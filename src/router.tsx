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
import { GeneralErrorPage, NotFoundPage } from '@/features/errors/error-pages'
import { outboxSearchSchema } from '@/features/notifications/search'
import { setupSearchSchema } from '@/features/setup/search'
import {
  admissionsSearchSchema,
  guardiansSearchSchema,
  studentsSearchSchema,
} from '@/features/students/search'
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

const devicesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/devices',
  component: lazyRouteComponent(
    () => import('@/features/devices/pages/devices-page'),
    'DevicesPage'
  ),
})

const deviceDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/devices/$deviceId',
  component: lazyRouteComponent(
    () => import('@/features/devices/pages/device-detail-page'),
    'DeviceDetailPage'
  ),
})

const consoleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/console',
  component: lazyRouteComponent(
    () => import('@/features/mqtt-console/pages/mqtt-console-page'),
    'MqttConsolePage'
  ),
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
    admissionsRoute,
    guardiansRoute,
    setupRoute,
    schoolsRoute,
    usersRoute,
    notificationsRoute,
    devicesRoute,
    deviceDetailRoute,
    consoleRoute,
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
