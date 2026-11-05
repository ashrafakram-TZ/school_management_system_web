import {
  Bell,
  BookOpenCheck,
  BusFront,
  CalendarCheck,
  ClipboardCheck,
  House,
  IndianRupee,
  Megaphone,
  MessagesSquare,
  Trophy,
  Video,
} from 'lucide-react'

import type { PhoneScreen } from './components/phone-frame'
import type { PhoneTab } from './search'

export type { PhoneTab }

export const PHONE_TABS: PhoneScreen<PhoneTab>[] = [
  { id: 'home', label: 'Home', title: 'Home', icon: House },
  { id: 'attendance', label: 'Attend.', title: 'Attendance', icon: CalendarCheck },
  { id: 'bus', label: 'Bus', title: 'School bus', icon: BusFront },
  { id: 'results', label: 'Results', title: 'Exam results', icon: ClipboardCheck },
  { id: 'fees', label: 'Fees', title: 'Fees', icon: IndianRupee },
  { id: 'achievements', label: 'Awards', title: 'Achievements', icon: Trophy },
  { id: 'notifications', label: 'Alerts', title: 'Notifications', icon: Bell },
]

export const CONNECT_SCREENS: PhoneScreen<PhoneTab>[] = [
  { id: 'diary', label: 'Diary', title: 'Diary', icon: BookOpenCheck },
  { id: 'meetings', label: 'Meetings', title: 'Meetings', icon: Video },
  { id: 'chat', label: 'Chat', title: 'Chat with teachers', icon: MessagesSquare },
  { id: 'news', label: 'News', title: 'Announcements', icon: Megaphone },
]

export const screenTitle = (tab: PhoneTab) =>
  [...PHONE_TABS, ...CONNECT_SCREENS].find((item) => item.id === tab)?.title ?? 'Home'

export const isConnectScreen = (tab: PhoneTab) => CONNECT_SCREENS.some((item) => item.id === tab)
