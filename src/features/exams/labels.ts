import type { BadgeTone } from '@/components/ui/badge'
import type { Exam, ExamDetail, ExamStatus, ResultStatus } from './api'

export const EXAM_STATUS: Record<ExamStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'warning' },
  published: { label: 'Published', tone: 'success' },
}

export const RESULT_STATUS: Record<ResultStatus, { label: string; tone: BadgeTone }> = {
  pass: { label: 'Pass', tone: 'success' },
  fail: { label: 'Fail', tone: 'danger' },
  incomplete: { label: 'Incomplete', tone: 'neutral' },
}

export function gradeTone(grade: string | null): BadgeTone {
  if (!grade) return 'neutral'
  if (grade.startsWith('A')) return 'success'
  if (grade.startsWith('B')) return 'info'
  if (grade.startsWith('C')) return 'warning'
  return 'danger'
}

export const percentText = (value: number | null) => (value === null ? '—' : `${value}%`)

export const rankText = (rank: number | null) => (rank === null ? '—' : `#${rank}`)

export const marksText = (value: number | null, absent: boolean) =>
  absent ? 'AB' : value === null ? '—' : String(value)

export const studentsText = (count: number) => `${count} ${count === 1 ? 'student' : 'students'}`

export const PODIUM_TONES = [
  'border-warning/50 bg-warning/10 text-warning',
  'border-info/40 bg-info/10 text-info',
  'border-primary/40 bg-primary/10 text-primary',
]

export const podiumTone = (rank: number) => PODIUM_TONES[Math.min(rank, 3) - 1] ?? PODIUM_TONES[2]

export function progressPercent(entered: number, expected: number) {
  if (!expected) return 0
  return Math.min(100, Math.round((entered / expected) * 100))
}

export function sectionOptions(
  classes: {
    id: number
    name: string
    sections: { id: number; name: string; student_count: number }[]
  }[]
) {
  return classes.flatMap((item) =>
    item.sections.map((section) => ({
      value: String(section.id),
      label: `${item.name} - ${section.name}`,
      hint: studentsText(section.student_count),
    }))
  )
}

export function pickExam(exams: Exam[], examId: number | undefined, prefer: 'draft' | 'published') {
  if (examId) return examId
  return (exams.find((exam) => exam.status === prefer) ?? exams[0])?.id
}

export function pickSection(exam: ExamDetail | undefined, sectionId: number | undefined) {
  const sections = (exam?.class_details ?? []).flatMap((item) => item.sections)
  if (sectionId && sections.some((section) => section.id === sectionId)) return sectionId
  return sections.find((section) => section.student_count > 0)?.id ?? sections[0]?.id
}

export function classOfSection(exam: ExamDetail | undefined, sectionId: number | undefined) {
  return exam?.class_details.find((item) =>
    item.sections.some((section) => section.id === sectionId)
  )
}
