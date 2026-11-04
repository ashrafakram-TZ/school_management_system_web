import {
  Bell,
  BusFront,
  CalendarCheck,
  ClipboardCheck,
  House,
  IndianRupee,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

import type { PhoneTab } from './search'

export type { PhoneTab }

export const PHONE_TABS: { id: PhoneTab; label: string; title: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', title: 'Home', icon: House },
  { id: 'attendance', label: 'Attend.', title: 'Attendance', icon: CalendarCheck },
  { id: 'bus', label: 'Bus', title: 'School bus', icon: BusFront },
  { id: 'results', label: 'Results', title: 'Exam results', icon: ClipboardCheck },
  { id: 'fees', label: 'Fees', title: 'Fees', icon: IndianRupee },
  { id: 'achievements', label: 'Awards', title: 'Achievements', icon: Trophy },
  { id: 'notifications', label: 'Alerts', title: 'Notifications', icon: Bell },
]
