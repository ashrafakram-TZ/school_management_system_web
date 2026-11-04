import { useState } from 'react'
import { X } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useClasses } from '@/features/setup/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import {
  announcementsApi,
  useAnnouncementAction,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementInput,
} from '../api'
import { AUDIENCE_LABEL, fromLocalInput, toLocalInput } from '../labels'

type Target = { kind: 'class' | 'section'; id: number; label: string }

export function AnnouncementForm({
  announcement,
  onOpenChange,
}: {
  announcement: Announcement | null
  onOpenChange: (open: boolean) => void
}) {
  const classes = useClasses()
  const [draft, setDraft] = useState({
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    audience: (announcement?.audience ?? 'parents') as AnnouncementAudience,
    urgent: announcement?.priority === 'urgent',
    publish_at: toLocalInput(announcement?.publish_at ?? null),
    expires_at: toLocalInput(announcement?.expires_at ?? null),
    send_now: false,
  })
  const [targets, setTargets] = useState<Target[]>([
    ...(announcement?.classes ?? []).map((item) => ({
      kind: 'class' as const,
      id: item.id,
      label: `Class ${item.name}`,
    })),
    ...(announcement?.sections ?? []).map((item) => ({
      kind: 'section' as const,
      id: item.id,
      label: item.name,
    })),
  ])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useAnnouncementAction((input: AnnouncementInput) =>
    announcement ? announcementsApi.update(announcement.id, input) : announcementsApi.create(input)
  )
  const set = <K extends keyof typeof draft>(field: K, value: (typeof draft)[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '', root: '' }))
  }

  const targetOptions = (classes.data ?? []).flatMap((item) => [
    { value: `class:${item.id}`, label: `Class ${item.name}`, hint: 'Every section' },
    ...item.sections.map((section) => ({
      value: `section:${section.id}`,
      label: `${item.name} - ${section.name}`,
    })),
  ])
  const chosen = new Set(targets.map((target) => `${target.kind}:${target.id}`))

  const submit = async () => {
    const next: Record<string, string> = {}
    if (!draft.title.trim()) next.title = 'Enter a title'
    if (!draft.body.trim()) next.body = 'Write the announcement'
    if (draft.audience === 'classes' && !targets.length)
      next.class_ids = 'Choose at least one class or section'
    if (draft.publish_at && draft.send_now) next.publish_at = 'Choose either a time or send now'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      const saved = await save.mutateAsync({
        title: draft.title.trim(),
        body: draft.body.trim(),
        audience: draft.audience,
        class_ids:
          draft.audience === 'classes'
            ? targets.filter((t) => t.kind === 'class').map((t) => t.id)
            : [],
        section_ids:
          draft.audience === 'classes'
            ? targets.filter((t) => t.kind === 'section').map((t) => t.id)
            : [],
        priority: draft.urgent ? 'urgent' : 'normal',
        publish_at: fromLocalInput(draft.publish_at),
        expires_at: fromLocalInput(draft.expires_at),
        publish_now: draft.send_now,
      })
      alerts.success(
        saved.status === 'published'
          ? `Sent to ${saved.recipient_count} people`
          : saved.status === 'scheduled'
            ? 'Announcement scheduled'
            : 'Draft saved'
      )
      onOpenChange(false)
    } catch (error) {
      const apiError = toApiError(error)
      const fields = Object.fromEntries(
        apiError.fieldErrors.map((item) => [item.field, item.message])
      )
      setErrors(Object.keys(fields).length ? fields : { root: apiError.message })
    }
  }

  return (
    <AppModal
      open
      onOpenChange={onOpenChange}
      title={announcement ? 'Edit announcement' : 'New announcement'}
      description='Parents and staff read it in the app. Urgent ones also go by SMS when the push does not arrive.'
      formId='announcement-form'
      submitText={draft.send_now ? 'Send now' : draft.publish_at ? 'Schedule' : 'Save draft'}
      loading={save.isPending}
      size='lg'
    >
      <form
        id='announcement-form'
        noValidate
        className='grid gap-3 sm:grid-cols-2'
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {errors.root && (
          <p role='alert' className='text-sm font-medium text-destructive sm:col-span-2'>
            {errors.root}
          </p>
        )}
        <FormField
          id='a-title'
          label='Title'
          required
          error={errors.title}
          className='sm:col-span-2'
        >
          <Input
            id='a-title'
            value={draft.title}
            maxLength={150}
            onChange={(event) => set('title', event.target.value)}
          />
        </FormField>
        <FormField
          id='a-body'
          label='Announcement'
          required
          error={errors.body}
          className='sm:col-span-2'
        >
          <Textarea
            id='a-body'
            value={draft.body}
            maxLength={4000}
            rows={5}
            onChange={(event) => set('body', event.target.value)}
          />
        </FormField>
        <FormField
          id='a-audience'
          label='Send to'
          error={errors.audience}
          className='sm:col-span-2'
        >
          <Combobox
            id='a-audience'
            label='Send to'
            value={draft.audience}
            placeholder='Choose who gets it'
            options={(Object.keys(AUDIENCE_LABEL) as AnnouncementAudience[]).map((value) => ({
              value,
              label: AUDIENCE_LABEL[value],
            }))}
            onChange={(value) => set('audience', (value ?? 'parents') as AnnouncementAudience)}
            highlightSelected={false}
            className='sm:w-full'
          />
        </FormField>
        {draft.audience === 'classes' && (
          <FormField
            id='a-targets'
            label='Classes and sections'
            required
            error={errors.class_ids ?? errors.section_ids}
            className='sm:col-span-2'
          >
            <div className='grid gap-2'>
              <Combobox
                id='a-targets'
                label='Add a class or section'
                placeholder='Add a class or section'
                options={targetOptions.filter((option) => !chosen.has(option.value))}
                onChange={(value) => {
                  if (!value) return
                  const [kind, id] = value.split(':')
                  const option = targetOptions.find((item) => item.value === value)
                  setTargets((current) => [
                    ...current,
                    { kind: kind as Target['kind'], id: Number(id), label: option?.label ?? value },
                  ])
                  setErrors((current) => ({ ...current, class_ids: '', section_ids: '' }))
                }}
                highlightSelected={false}
                className='sm:w-full'
              />
              {targets.length > 0 && (
                <span className='flex flex-wrap gap-1.5'>
                  {targets.map((target) => (
                    <Badge key={`${target.kind}:${target.id}`} tone='info'>
                      {target.label}
                      <button
                        type='button'
                        aria-label={`Remove ${target.label}`}
                        className='rounded-full hover:bg-info/20'
                        onClick={() =>
                          setTargets((current) =>
                            current.filter(
                              (item) => !(item.kind === target.kind && item.id === target.id)
                            )
                          )
                        }
                      >
                        <X className='size-3' />
                      </button>
                    </Badge>
                  ))}
                </span>
              )}
            </div>
          </FormField>
        )}
        <FormField
          id='a-publish'
          label='Send later'
          hint='Leave empty to save a draft'
          error={errors.publish_at}
        >
          <Input
            id='a-publish'
            type='datetime-local'
            value={draft.publish_at}
            disabled={draft.send_now}
            onChange={(event) => set('publish_at', event.target.value)}
          />
        </FormField>
        <FormField
          id='a-expires'
          label='Remove from the feed after'
          hint='Optional'
          error={errors.expires_at}
        >
          <Input
            id='a-expires'
            type='datetime-local'
            value={draft.expires_at}
            onChange={(event) => set('expires_at', event.target.value)}
          />
        </FormField>
        <label className='flex items-center justify-between gap-3 rounded-lg border p-3 text-sm'>
          <span className='grid'>
            <span className='font-semibold'>Urgent</span>
            <span className='text-xs text-muted-foreground'>SMS when the push does not arrive</span>
          </span>
          <Switch
            checked={draft.urgent}
            onCheckedChange={(checked) => set('urgent', checked)}
            aria-label='Urgent'
          />
        </label>
        <label className='flex items-center justify-between gap-3 rounded-lg border p-3 text-sm'>
          <span className='grid'>
            <span className='font-semibold'>Send now</span>
            <span className='text-xs text-muted-foreground'>Publish as soon as it is saved</span>
          </span>
          <Switch
            checked={draft.send_now}
            onCheckedChange={(checked) => {
              set('send_now', checked)
              if (checked) set('publish_at', '')
            }}
            aria-label='Send now'
          />
        </label>
      </form>
    </AppModal>
  )
}
