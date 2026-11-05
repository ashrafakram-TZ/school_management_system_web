import { useState, type FormEvent } from 'react'
import { BookOpenCheck, Check, MessageSquareWarning, Save, type LucideIcon } from 'lucide-react'
import { ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { alerts } from '@/lib/alerts'
import { cn } from '@/lib/utils'
import {
  setupApi,
  useSchoolProfile,
  useSetupMutation,
  type DiaryReviewMode,
  type SchoolProfile,
} from '../api'
import { fieldErrorsOf } from '../form-actions'
import { RootError, Section } from './setup-shared'

const REVIEW_MODES: {
  value: DiaryReviewMode
  option: string
  label: string
  hint: string
  icon: LucideIcon
}[] = [
  {
    value: 'all',
    option: 'Option A',
    label: 'Review every diary post',
    hint: 'Homework, remarks, feedback and notes all wait for the office to approve them before parents see them.',
    icon: BookOpenCheck,
  },
  {
    value: 'remarks',
    option: 'Option B',
    label: 'Review only remarks and feedback',
    hint: 'Homework and notes reach parents at once. Remarks and feedback wait for the office to approve them.',
    icon: MessageSquareWarning,
  },
]

export function CommunicationTab({ canManage }: { canManage: boolean }) {
  const profile = useSchoolProfile()
  if (profile.isError)
    return <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />
  if (!profile.data) return <Skeleton className='h-96' />
  return <CommunicationSettings key={profile.data.id} school={profile.data} canManage={canManage} />
}

function CommunicationSettings({
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
      alerts.success('Diary and chat settings saved')
      setErrors({})
    } catch (error) {
      setErrors(fieldErrorsOf(error))
    }
  }

  return (
    <form noValidate onSubmit={submit} className='grid gap-4'>
      <RootError message={errors.root} />
      <Section
        title='Diary review'
        description='Choose which diary posts the office checks before parents see them. Teachers’ posts follow this at once; posts already waiting stay in the review list.'
      >
        <fieldset className='grid gap-3 md:grid-cols-2' disabled={!canManage}>
          <legend className='sr-only'>Diary review</legend>
          {REVIEW_MODES.map((mode) => {
            const active = draft.diary_review_mode === mode.value
            return (
              <label
                key={mode.value}
                className={cn(
                  'relative flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30',
                  active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  !canManage && 'cursor-default'
                )}
              >
                <input
                  type='radio'
                  name='diary_review_mode'
                  value={mode.value}
                  checked={active}
                  onChange={() => set('diary_review_mode', mode.value)}
                  className='sr-only'
                />
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-lg',
                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <mode.icon className='size-5' />
                </span>
                <span className='grid gap-1'>
                  <span className='text-[11px] font-bold tracking-wide text-muted-foreground uppercase'>
                    {mode.option}
                  </span>
                  <span className='font-semibold'>{mode.label}</span>
                  <span className='text-sm text-muted-foreground'>{mode.hint}</span>
                </span>
                {active && (
                  <span className='absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground'>
                    <Check className='size-3.5' />
                  </span>
                )}
              </label>
            )
          })}
          {errors.diary_review_mode && (
            <p className='text-sm text-destructive md:col-span-2'>{errors.diary_review_mode}</p>
          )}
        </fieldset>
      </Section>

      <Section
        title='Chat office hours'
        description='When parent messages reach teachers. Messages sent outside these hours are saved and delivered when the hours start.'
      >
        <div className='grid gap-4 sm:grid-cols-2'>
          <FormField
            id='chat-office-start'
            label='Starts at'
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
            label='Ends at'
            error={errors.chat_office_end}
            hint='Teachers can reply at any time'
          >
            <Input
              id='chat-office-end'
              type='time'
              value={draft.chat_office_end}
              disabled={!canManage}
              onChange={(event) => set('chat_office_end', event.target.value)}
            />
          </FormField>
        </div>
      </Section>

      {canManage && (
        <div className='flex justify-end'>
          <Button type='submit' loading={save.isPending}>
            <Save />
            Save settings
          </Button>
        </div>
      )}
    </form>
  )
}
