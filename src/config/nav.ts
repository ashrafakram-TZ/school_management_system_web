import {
  BellRing,
  LayoutDashboard,
  RadioTower,
  Truck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { ShortcutId } from './shortcuts'

export type NavPath = '/' | '/users' | '/notifications' | '/devices' | '/console'

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
        to: '/users',
        label: 'Users',
        description: 'Accounts, roles and access',
        icon: UsersRound,
        shortcut: 'nav.users',
        permission: 'users.view',
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
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)
