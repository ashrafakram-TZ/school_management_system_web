import { BookOpenCheck, House, Megaphone, MessagesSquare, Video } from 'lucide-react'
import type { PhoneScreen } from '@/features/parent-preview/components/phone-frame'
import type { TeacherTab } from './search'

export const TEACHER_TABS: PhoneScreen<TeacherTab>[] = [
  { id: 'home', label: 'Today', title: 'Today', icon: House },
  { id: 'diary', label: 'Diary', title: 'My diary posts', icon: BookOpenCheck },
  { id: 'meetings', label: 'Meetings', title: 'Parent meetings', icon: Video },
  { id: 'chat', label: 'Chat', title: 'Chat with parents', icon: MessagesSquare },
  { id: 'news', label: 'News', title: 'Announcements', icon: Megaphone },
]

export const teacherTitle = (tab: TeacherTab) =>
  TEACHER_TABS.find((item) => item.id === tab)?.title ?? 'Today'
