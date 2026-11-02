import {
  BellRing,
  Building2,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  RadioTower,
  School,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import type { ShortcutId } from './shortcuts'

export type NavPath =
  | '/'
  | '/students'
  | '/admissions'
  | '/guardians'
  | '/notifications'
  | '/devices'
  | '/console'
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
        to: '/devices',
        label: 'Devices',
        description: 'Registered trackers',
        icon: Truck,
        shortcut: 'nav.devices',
        permission: 'fleet.view',
      },
      {
        to: '/console',
        label: 'MQTT console',
        description: 'Publish and watch messages',
        icon: RadioTower,
        shortcut: 'nav.console',
        permission: 'fleet.manage',
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
