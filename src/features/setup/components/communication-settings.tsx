import { useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { alerts } from '@/lib/alerts'
import { setupApi, useSetupMutation, type DiaryReviewMode, type SchoolProfile } from '../api'
import { fieldErrorsOf } from '../form-actions'
import { RootError, Section } from './setup-shared'

const REVIEW_MODES: { value: DiaryReviewMode; label: string; hint: string }[] = [
  {
    value: 'remarks',
    label: 'Review remarks and feedback only',
    hint: 'Homework and notes reach parents at once',
  },
  {
    value: 'all',
    label: 'Review every diary post',
    hint: 'Nothing reaches parents until the office approves it',
  },
]

export function CommunicationSettings({
  school,
  canManage,
}: {
  school: SchoolProfile
  canManage: boolean
}) {
  const [draft, setDraft] = useState({
    diary_review_mode: school.diary_review_mode ?? 'remarks',
    chat_office_start: school.chat_office_start ?? '08:00',
    chat_office_end: school.chat_office_end ?? '17:00',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSetupMutation((input: Partial<SchoolProfile>) => setupApi.updateSchool(input))
  const set = (field: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '', root: '' }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.chat_office_end <= draft.chat_office_start) {
      setErrors({ chat_office_end: 'Office hours must end after they start' })
      return
    }
    try {
      await save.mutateAsync(draft)
      alerts.success('Communication settings saved')
      setErrors({})
    } catch (error) {
      setErrors(fieldErrorsOf(error))
    }
  }

  return (
    <Section
      title='Diary and chat'
      description='Who checks diary posts before parents see them, and when parent messages reach teachers.'
    >
      <form noValidate onSubmit={submit} className='grid gap-4 sm:grid-cols-2'>
        <RootError message={errors.root} />
        <FormField
          id='diary-review-mode'
          label='Diary review'
          error={errors.diary_review_mode}
          hint={REVIEW_MODES.find((mode) => mode.value === draft.diary_review_mode)?.hint}
          className='sm:col-span-2'
        >
          <Combobox
            id='diary-review-mode'
            label='Diary review'
            value={draft.diary_review_mode}
            placeholder='Choose how diary posts are reviewed'
            options={REVIEW_MODES.map(({ value, label }) => ({ value, label }))}
            onChange={(value) => set('diary_review_mode', value ?? 'remarks')}
            highlightSelected={false}
            className='sm:w-full'
          />
        </FormField>
        <FormField
          id='chat-office-start'
          label='Chat office hours start'
          error={errors.chat_office_start}
          hint='Monday to Saturday, not on holidays'
        >
          <Input
            id='chat-office-start'
            type='time'
            value={draft.chat_office_start}
            disabled={!canManage}
            onChange={(event) => set('chat_office_start', event.target.value)}
          />
        </FormField>
        <FormField
          id='chat-office-end'
          label='Chat office hours end'
          error={errors.chat_office_end}
          hint='Parent messages after this reach the teacher when office hours start'
        >
          <Input
            id='chat-office-end'
            type='time'
            value={draft.chat_office_end}
            disabled={!canManage}
            onChange={(event) => set('chat_office_end', event.target.value)}
          />
        </FormField>
        {canManage && (
          <div className='flex justify-end sm:col-span-2'>
            <Button type='submit' loading={save.isPending}>
              <Save />
              Save settings
            </Button>
          </div>
        )}
      </form>
    </Section>
  )
}
