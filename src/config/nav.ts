import {
  BellRing,
  Building2,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  GraduationCap,
  Grid3x3,
  HeartHandshake,
  LayoutDashboard,
  School,
  ShieldCheck,
  Truck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { ShortcutId } from './shortcuts'

export type NavPath =
  | '/'
  | '/students'
  | '/admissions'
  | '/guardians'
  | '/staff'
  | '/staff/assignments'
  | '/attendance'
  | '/timetable'
  | '/notifications'
  | '/fleet'
  | '/setup'
  | '/schools'
  | '/users'

export interface NavItem {
  to: NavPath
  label: string
  description: string
  icon: LucideIcon
  shortcut: ShortcutId
  permission?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        description: 'School at a glance',
        icon: LayoutDashboard,
        shortcut: 'nav.dashboard',
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        to: '/students',
        label: 'Students',
        description: 'Profiles, classes and roll numbers',
        icon: GraduationCap,
        shortcut: 'nav.students',
        permission: 'students.view',
      },
      {
        to: '/admissions',
        label: 'Admissions',
        description: 'Applications and enrolment',
        icon: ClipboardList,
        shortcut: 'nav.admissions',
        permission: 'students.view',
      },
      {
        to: '/guardians',
        label: 'Parents',
        description: 'Parents and guardians with their children',
        icon: HeartHandshake,
        shortcut: 'nav.guardians',
        permission: 'students.view',
      },
      {
        to: '/staff',
        label: 'Staff',
        description: 'Teachers and staff with load, documents and bank details',
        icon: UsersRound,
        shortcut: 'nav.staff',
        permission: 'staff.view',
      },
      {
        to: '/staff/assignments',
        label: 'Teacher assignments',
        description: 'Who teaches each subject in each section',
        icon: Grid3x3,
        shortcut: 'nav.assignments',
        permission: 'staff.view',
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        to: '/attendance',
        label: 'Attendance',
        description: 'Daily attendance, staff check-ins and leave requests',
        icon: CalendarCheck,
        shortcut: 'nav.attendance',
        permission: 'attendance.view',
      },
      {
        to: '/timetable',
        label: 'Timetable',
        description: 'Weekly timetables, teacher workload and the bell schedule',
        icon: CalendarRange,
        shortcut: 'nav.timetable',
        permission: 'timetable.view',
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        to: '/notifications',
        label: 'Notifications',
        description: 'Outbox and delivery status',
        icon: BellRing,
        shortcut: 'nav.notifications',
        permission: 'notifications.view',
      },
    ],
  },
  {
    label: 'Fleet',
    items: [
      {
        to: '/fleet',
        label: 'Bus tracking',
        description: 'Where every bus is and whether it is moving',
        icon: Truck,
        shortcut: 'nav.fleet',
        permission: 'fleet.view',
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        to: '/setup',
        label: 'School setup',
        description: 'Profile, years, classes, subjects, holidays',
        icon: School,
        shortcut: 'nav.setup',
        permission: 'schools.view',
      },
      {
        to: '/schools',
        label: 'Schools',
        description: 'Every school on the platform',
        icon: Building2,
        shortcut: 'nav.schools',
        permission: 'platform.schools',
      },
      {
        to: '/users',
        label: 'Users & access',
        description: 'Logins, roles and access',
        icon: ShieldCheck,
        shortcut: 'nav.users',
        permission: 'users.view',
      },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)
