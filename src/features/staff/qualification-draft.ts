import type { Qualification, QualificationInput } from './api'

export interface QualificationDraft {
  key: string
  degree: string
  specialization: string
  institution: string
  year_completed: string
}

export const MAX_QUALIFICATIONS = 10

let counter = 0
const nextKey = () => `q${++counter}`

export const emptyQualification = (): QualificationDraft => ({
  key: nextKey(),
  degree: '',
  specialization: '',
  institution: '',
  year_completed: '',
})

export const toQualificationDrafts = (items: Qualification[]): QualificationDraft[] =>
  items.map((item) => ({
    key: nextKey(),
    degree: item.degree,
    specialization: item.specialization ?? '',
    institution: item.institution ?? '',
    year_completed: item.year_completed ? String(item.year_completed) : '',
  }))

export const toQualificationInputs = (drafts: QualificationDraft[]): QualificationInput[] =>
  drafts
    .filter((draft) => draft.degree.trim())
    .map((draft) => ({
      degree: draft.degree.trim(),
      specialization: draft.specialization.trim() || null,
      institution: draft.institution.trim() || null,
      year_completed: draft.year_completed ? Number(draft.year_completed) : null,
    }))

export function validateQualifications(drafts: QualificationDraft[], prefix = 'qualifications') {
  const errors: Record<string, string> = {}
  const thisYear = new Date().getFullYear()
  drafts.forEach((draft, index) => {
    const used = draft.degree || draft.specialization || draft.institution || draft.year_completed
    if (!used) return
    if (draft.degree.trim().length < 2) errors[`${prefix}.${index}.degree`] = 'Enter the degree'
    const year = Number(draft.year_completed)
    if (draft.year_completed && (year < 1960 || year > thisYear + 1))
      errors[`${prefix}.${index}.year_completed`] = `Year must be 1960 to ${thisYear + 1}`
  })
  return errors
}
