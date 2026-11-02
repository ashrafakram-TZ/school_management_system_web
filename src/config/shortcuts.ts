export type ShortcutGroup = 'Navigation' | 'General' | 'Devices' | 'Users' | 'MQTT console'

export interface ShortcutDefinition {
  combo: string
  label: string
  group: ShortcutGroup
}

export const SHORTCUTS = {
  'nav.dashboard': { combo: 'g d', label: 'Go to dashboard', group: 'Navigation' },
  'nav.students': { combo: 'g s', label: 'Go to students', group: 'Navigation' },
  'nav.admissions': { combo: 'g a', label: 'Go to admissions', group: 'Navigation' },
  'nav.guardians': { combo: 'g p', label: 'Go to parents', group: 'Navigation' },
  'nav.setup': { combo: 'g c', label: 'Go to school setup', group: 'Navigation' },
  'nav.schools': { combo: 'g o', label: 'Go to schools', group: 'Navigation' },
  'nav.users': { combo: 'g u', label: 'Go to users and access', group: 'Navigation' },
  'nav.notifications': { combo: 'g n', label: 'Go to notifications', group: 'Navigation' },
  'nav.devices': { combo: 'g v', label: 'Go to devices', group: 'Navigation' },
  'nav.console': { combo: 'g m', label: 'Go to MQTT console', group: 'Navigation' },
  'app.help': { combo: 'shift+?', label: 'Show keyboard shortcuts', group: 'General' },
  'app.search': { combo: '/', label: 'Focus search', group: 'General' },
  'app.refresh': { combo: 'alt+r', label: 'Refresh data', group: 'General' },
  'app.theme': { combo: 'alt+t', label: 'Switch light or dark theme', group: 'General' },
  'app.sidebar': { combo: 'mod+b', label: 'Collapse or expand sidebar', group: 'General' },
  'modal.submit': { combo: 'mod+s', label: 'Save the open form', group: 'General' },
  'users.create': { combo: 'alt+n', label: 'Add a user', group: 'Users' },
  'students.create': { combo: 'alt+n', label: 'Add a student or application', group: 'Users' },
  'devices.create': { combo: 'alt+n', label: 'Register a device', group: 'Devices' },
  'console.connect': { combo: 'alt+c', label: 'Connect or disconnect', group: 'MQTT console' },
  'console.publish': { combo: 'mod+enter', label: 'Publish message', group: 'MQTT console' },
  'console.pause': { combo: 'alt+p', label: 'Pause or resume the stream', group: 'MQTT console' },
  'console.clear': { combo: 'alt+l', label: 'Clear messages', group: 'MQTT console' },
} as const satisfies Record<string, ShortcutDefinition>

export type ShortcutId = keyof typeof SHORTCUTS

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  'General',
  'Navigation',
  'Users',
  'Devices',
  'MQTT console',
]
