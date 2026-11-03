import { Combobox } from '@/components/common/combobox'
import { formatDate } from '@/lib/format'
import type { Exam, ExamDetail } from '../api'
import { EXAM_STATUS, sectionOptions } from '../labels'

export function ExamPicker({
  exams,
  value,
  onChange,
}: {
  exams: Exam[]
  value?: number
  onChange: (id: number) => void
}) {
  return (
    <Combobox
      id='exam-picker'
      label='Exam'
      value={value ? String(value) : undefined}
      placeholder='Choose exam'
      searchPlaceholder='Search exams'
      emptyText='No exams yet'
      highlightSelected={false}
      options={exams.map((exam) => ({
        value: String(exam.id),
        label: exam.name,
        hint: `${EXAM_STATUS[exam.status].label} · ${formatDate(exam.start_date)}`,
      }))}
      onChange={(next) => next && onChange(Number(next))}
    />
  )
}

export function SectionPicker({
  exam,
  value,
  onChange,
}: {
  exam?: ExamDetail
  value?: number
  onChange: (id: number) => void
}) {
  return (
    <Combobox
      id='exam-section-picker'
      label='Section'
      value={value ? String(value) : undefined}
      placeholder='Choose section'
      searchPlaceholder='Search sections'
      emptyText='No sections write this exam'
      highlightSelected={false}
      options={sectionOptions(exam?.class_details ?? [])}
      onChange={(next) => next && onChange(Number(next))}
    />
  )
}
