import type { BadgeTone } from '@/components/ui/badge'
import type { AdmissionStatus, BloodGroup, Gender, Relation, StudentStatus } from './api'

export const RELATION_LABELS: Record<Relation, string> = {
  father: 'Father',
  mother: 'Mother',
  guardian: 'Guardian',
  grandparent: 'Grandparent',
  sibling: 'Elder sibling',
  other: 'Other',
}

export const GENDER_LABELS: Record<Gender, string> = { male: 'Boy', female: 'Girl', other: 'Other' }

export const STUDENT_STATUS: Record<StudentStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Studying', tone: 'success' },
  transferred: { label: 'Transferred', tone: 'warning' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  alumni: { label: 'Alumni', tone: 'info' },
}

export const ADMISSION_STATUS: Record<AdmissionStatus, { label: string; tone: BadgeTone }> = {
  applied: { label: 'Waiting', tone: 'info' },
  approved: { label: 'Approved', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
  enrolled: { label: 'Enrolled', tone: 'success' },
}

export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export const HOUSES = ['Red', 'Blue', 'Green', 'Yellow']

export const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }))

export const classSection = (className?: string | null, sectionName?: string | null) =>
  className ? [className, sectionName].filter(Boolean).join(' - ') : 'Not placed'

export const yearsLabel = (years: number) =>
  years === 0 ? 'First year' : `${years} ${years === 1 ? 'year' : 'years'} here`
