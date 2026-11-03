import { useState } from 'react'
import { EyeOff, FileText, Medal, Paperclip, Pencil, Plus, Trash2, Trophy } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/common/display'
import { FormField } from '@/components/common/form-field'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { filesApi, openFile } from '@/lib/files'
import { formatDate } from '@/lib/format'
import { useStudentMutation } from '../api'
import {
  recordsApi,
  useAchievements,
  type Achievement,
  type AchievementCategory,
  type AchievementInput,
  type AchievementLevel,
} from '../records-api'

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  academic: 'Academic',
  sports: 'Sports',
  arts: 'Arts',
  cultural: 'Cultural',
  competition: 'Competition',
  leadership: 'Leadership',
  other: 'Other',
}

const LEVEL_LABELS: Record<AchievementLevel, string> = {
  class: 'Class',
  school: 'School',
  zone: 'Zone',
  district: 'District',
  state: 'State',
  national: 'National',
  international: 'International',
}

const LEVEL_TONE: Record<AchievementLevel, BadgeTone> = {
  class: 'neutral',
  school: 'neutral',
  zone: 'info',
  district: 'info',
  state: 'success',
  national: 'success',
  international: 'success',
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export function AchievementsTab({
  studentId,
  canManage,
}: {
  studentId: number
  canManage: boolean
}) {
  const list = useAchievements(studentId)
  const [editing, setEditing] = useState<Achievement | 'new' | null>(null)
  const [removing, setRemoving] = useState<Achievement | null>(null)
  const remove = useStudentMutation((id: number) => recordsApi.removeAchievement(studentId, id))

  if (list.isError)
    return <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
  if (!list.data) return <Skeleton className='h-60' />

  return (
    <div className='grid gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-muted-foreground'>
          Awards, competitions and certificates. Parents see them in the Parent app and get a
          notification.
        </p>
        {canManage && (
          <Button size='sm' onClick={() => setEditing('new')}>
            <Plus />
            Add achievement
          </Button>
        )}
      </div>
      {list.data.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title='No achievements yet'
          description='Add prizes, competition results and certificates. Teachers can add them from the Staff app too.'
          className='border-dashed'
        />
      ) : (
        <ul className='grid gap-3 sm:grid-cols-2' aria-label='Achievements'>
          {list.data.map((item) => (
            <li key={item.id} className='flex gap-3 rounded-xl border p-3'>
              <span className='grid size-10 shrink-0 place-items-center rounded-full bg-warning/10 text-warning'>
                <Medal className='size-5' />
              </span>
              <div className='grid min-w-0 flex-1 gap-1'>
                <span className='font-semibold'>{item.title}</span>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <Badge tone='info'>{CATEGORY_LABELS[item.category]}</Badge>
                  <Badge tone={LEVEL_TONE[item.level]}>{LEVEL_LABELS[item.level]} level</Badge>
                  {item.position && <Badge tone='warning'>{item.position}</Badge>}
                  {!item.visible_to_parent && (
                    <Badge tone='neutral'>
                      <EyeOff className='size-3' />
                      Staff only
                    </Badge>
                  )}
                </div>
                {item.description && <p className='text-sm'>{item.description}</p>}
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {formatDate(item.achieved_on)}
                    {item.added_by ? ` · ${item.added_by.name}` : ''}
                  </span>
                  <span className='flex gap-1'>
                    {item.file && (
                      <Button
                        size='icon-sm'
                        variant='ghost'
                        aria-label={`Open certificate of ${item.title}`}
                        onClick={() =>
                          void openFile(`/files/${item.file!.id}/content`).catch((error: unknown) =>
                            alerts.error(toApiError(error).message)
                          )
                        }
                      >
                        <FileText />
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button
                          size='icon-sm'
                          variant='ghost'
                          aria-label={`Edit ${item.title}`}
                          onClick={() => setEditing(item)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size='icon-sm'
                          variant='ghost'
                          aria-label={`Delete ${item.title}`}
                          className='text-destructive hover:bg-destructive/10'
                          onClick={() => setRemoving(item)}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <AchievementModal
          studentId={studentId}
          achievement={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title='Delete this achievement?'
        description='Parents will no longer see it.'
        confirmText='Delete'
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!removing) return
          try {
            await remove.mutateAsync(removing.id)
            alerts.success('Achievement deleted')
          } catch (error) {
            alerts.error(toApiError(error).message)
          }
          setRemoving(null)
        }}
      />
    </div>
  )
}

function AchievementModal({
  studentId,
  achievement,
  onClose,
}: {
  studentId: number
  achievement?: Achievement
  onClose: () => void
}) {
  const [draft, setDraft] = useState({
    title: achievement?.title ?? '',
    category: achievement?.category ?? ('competition' as AchievementCategory),
    level: achievement?.level ?? ('school' as AchievementLevel),
    position: achievement?.position ?? '',
    achieved_on: achievement?.achieved_on ?? today(),
    description: achievement?.description ?? '',
    visible_to_parent: achievement?.visible_to_parent ?? true,
  })
  const [file, setFile] = useState<{ id: number; name: string } | null>(
    achievement?.file ? { id: achievement.file.id, name: achievement.file.name } : null
  )
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useStudentMutation((input: AchievementInput) =>
    achievement
      ? recordsApi.updateAchievement(studentId, achievement.id, input)
      : recordsApi.addAchievement(studentId, input)
  )
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={achievement ? 'Edit achievement' : 'Add achievement'}
      formId='achievement-form'
      submitText='Save'
      loading={save.isPending || uploading}
      size='lg'
    >
      <form
        id='achievement-form'
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          const next: Record<string, string> = {}
          if (draft.title.trim().length < 3)
            next.title = 'Enter the achievement, at least 3 letters'
          if (!draft.achieved_on) next.achieved_on = 'Choose the date'
          if (draft.achieved_on > today()) next.achieved_on = 'The date cannot be in the future'
          if (Object.keys(next).length) {
            setErrors(next)
            return
          }
          try {
            await save.mutateAsync({
              title: draft.title.trim(),
              category: draft.category,
              level: draft.level,
              position: draft.position.trim() || null,
              achieved_on: draft.achieved_on,
              description: draft.description.trim() || null,
              file_id: file?.id ?? null,
              visible_to_parent: draft.visible_to_parent,
            })
            alerts.success(achievement ? 'Achievement saved' : 'Achievement added')
            onClose()
          } catch (caught) {
            const apiError = toApiError(caught)
            if (apiError.fieldErrors.length) {
              setErrors(
                Object.fromEntries(apiError.fieldErrors.map((item) => [item.field, item.message]))
              )
            } else {
              alerts.error(apiError.message)
            }
          }
        }}
      >
        <FormField
          id='achievement-title'
          label='Achievement'
          required
          error={errors.title}
          className='sm:col-span-2'
        >
          <Input
            id='achievement-title'
            maxLength={120}
            placeholder='District level chess championship'
            value={draft.title}
            onChange={(event) => set('title', event.target.value)}
            aria-invalid={Boolean(errors.title) || undefined}
          />
        </FormField>
        <FormField id='achievement-category' label='Category' required>
          <Combobox
            id='achievement-category'
            label='Category'
            value={draft.category}
            placeholder='Choose category'
            options={(Object.keys(CATEGORY_LABELS) as AchievementCategory[]).map((value) => ({
              value,
              label: CATEGORY_LABELS[value],
            }))}
            onChange={(value) => value && set('category', value as AchievementCategory)}
            className='sm:w-full'
          />
        </FormField>
        <FormField id='achievement-level' label='Level' required>
          <Combobox
            id='achievement-level'
            label='Level'
            value={draft.level}
            placeholder='Choose level'
            options={(Object.keys(LEVEL_LABELS) as AchievementLevel[]).map((value) => ({
              value,
              label: LEVEL_LABELS[value],
            }))}
            onChange={(value) => value && set('level', value as AchievementLevel)}
            className='sm:w-full'
          />
        </FormField>
        <FormField
          id='achievement-position'
          label='Position'
          hint='Optional, like 1st place or Runner-up'
        >
          <Input
            id='achievement-position'
            maxLength={30}
            value={draft.position}
            onChange={(event) => set('position', event.target.value)}
          />
        </FormField>
        <FormField id='achievement-date' label='Date' required error={errors.achieved_on}>
          <Input
            id='achievement-date'
            type='date'
            max={today()}
            value={draft.achieved_on}
            onChange={(event) => set('achieved_on', event.target.value)}
            aria-invalid={Boolean(errors.achieved_on) || undefined}
          />
        </FormField>
        <FormField id='achievement-description' label='Details' className='sm:col-span-2'>
          <Input
            id='achievement-description'
            maxLength={500}
            placeholder='Optional'
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </FormField>
        <FormField
          id='achievement-file'
          label='Certificate or photo'
          hint='PDF or image, optional'
          error={errors.file_id}
        >
          {file ? (
            <div className='flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'>
              <span className='flex min-w-0 items-center gap-2'>
                <Paperclip className='size-4 shrink-0' />
                <span className='truncate'>{file.name}</span>
              </span>
              <Button type='button' size='sm' variant='ghost' onClick={() => setFile(null)}>
                Remove
              </Button>
            </div>
          ) : (
            <Input
              id='achievement-file'
              type='file'
              accept='application/pdf,image/*'
              disabled={uploading}
              onChange={async (event) => {
                const picked = event.target.files?.[0]
                if (!picked) return
                setUploading(true)
                try {
                  const uploaded = await filesApi.upload(picked, 'achievement')
                  setFile({ id: uploaded.id, name: uploaded.name })
                } catch (caught) {
                  alerts.error(toApiError(caught).message)
                } finally {
                  setUploading(false)
                }
              }}
            />
          )}
        </FormField>
        <FormField id='achievement-visible' label='Show to parents'>
          <div className='flex h-9 items-center gap-2'>
            <Switch
              id='achievement-visible'
              checked={draft.visible_to_parent}
              onCheckedChange={(checked) => set('visible_to_parent', checked)}
            />
            <span className='text-sm text-muted-foreground'>
              {draft.visible_to_parent ? 'Parents see it and get a notification' : 'Staff only'}
            </span>
          </div>
        </FormField>
      </form>
    </AppModal>
  )
}
