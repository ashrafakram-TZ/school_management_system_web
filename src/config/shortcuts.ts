export type ShortcutGroup = 'Navigation' | 'General' | 'Users'

export interface ShortcutDefinition {
  combo: string
  label: string
  group: ShortcutGroup
}

export const SHORTCUTS = {
  'nav.dashboard': { combo: 'g d', label: 'Go to dashboard', group: 'Navigation' },
  'nav.students': { combo: 'g s', label: 'Go to students', group: 'Navigation' },
  'nav.staff': { combo: 'g t', label: 'Go to staff', group: 'Navigation' },
  'nav.assignments': { combo: 'g e', label: 'Go to teacher assignments', group: 'Navigation' },
  'nav.attendance': { combo: 'g r', label: 'Go to attendance', group: 'Navigation' },
  'nav.timetable': { combo: 'g w', label: 'Go to timetable', group: 'Navigation' },
  'nav.substitutes': { combo: 'g v', label: 'Go to proxy', group: 'Navigation' },
  'nav.payroll': { combo: 'g y', label: 'Go to payroll', group: 'Navigation' },
  'nav.fees': { combo: 'g f', label: 'Go to fees', group: 'Navigation' },
  'nav.exams': { combo: 'g x', label: 'Go to exams', group: 'Navigation' },
  'nav.transport': { combo: 'g m', label: 'Go to buses and routes', group: 'Navigation' },
  'nav.admissions': { combo: 'g a', label: 'Go to admissions', group: 'Navigation' },
  'nav.guardians': { combo: 'g p', label: 'Go to parents', group: 'Navigation' },
  'nav.setup': { combo: 'g c', label: 'Go to school setup', group: 'Navigation' },
  'nav.schools': { combo: 'g o', label: 'Go to schools', group: 'Navigation' },
  'nav.users': { combo: 'g u', label: 'Go to users and access', group: 'Navigation' },
  'nav.notifications': { combo: 'g n', label: 'Go to notifications', group: 'Navigation' },
  'nav.fleet': { combo: 'g b', label: 'Go to bus tracking', group: 'Navigation' },
  'app.help': { combo: 'shift+?', label: 'Show keyboard shortcuts', group: 'General' },
  'app.search': { combo: '/', label: 'Focus search', group: 'General' },
  'app.refresh': { combo: 'alt+r', label: 'Refresh data', group: 'General' },
  'app.theme': { combo: 'alt+t', label: 'Switch light or dark theme', group: 'General' },
  'app.sidebar': { combo: 'mod+b', label: 'Collapse or expand sidebar', group: 'General' },
  'modal.submit': { combo: 'mod+s', label: 'Save the open form', group: 'General' },
  'users.create': { combo: 'alt+n', label: 'Add a user', group: 'Users' },
  'students.create': { combo: 'alt+n', label: 'Add a student or application', group: 'Users' },
} as const satisfies Record<string, ShortcutDefinition>

export type ShortcutId = keyof typeof SHORTCUTS

export const SHORTCUT_GROUPS: ShortcutGroup[] = ['General', 'Navigation', 'Users']
