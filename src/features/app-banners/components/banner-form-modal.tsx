import { useState } from 'react'
import { ImageUp } from 'lucide-react'
import { AppModal } from '@/components/common/app-modal'
import { Combobox } from '@/components/common/combobox'
import { FormField } from '@/components/common/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { filesApi } from '@/lib/files'
import {
  appBannersApi,
  useBannerMutation,
  type AppBanner,
  type AppBannerInput,
  type BannerAudience,
} from '../api'
import { AUDIENCE_LABELS } from '../labels'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export function BannerFormModal({ banner, onClose }: { banner?: AppBanner; onClose: () => void }) {
  const [draft, setDraft] = useState({
    title: banner?.title ?? '',
    message: banner?.message ?? '',
    audience: banner?.audience ?? ('all' as BannerAudience),
    starts_on: banner?.starts_on ?? today(),
    ends_on: banner?.ends_on ?? today(),
    link_url: banner?.link_url ?? '',
    sort_order: String(banner?.sort_order ?? 0),
    is_active: banner?.is_active ?? true,
  })
  const [image, setImage] = useState<{ id: number; url: string } | null>(
    banner?.image ? { id: banner.image.id, url: banner.image.url } : null
  )
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useBannerMutation((input: AppBannerInput) =>
    banner ? appBannersApi.update(banner.id, input) : appBannersApi.create(input)
  )
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) {
      setErrors((current) => ({ ...current, image_file_id: 'Choose a PNG, JPG or WEBP image' }))
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setErrors((current) => ({ ...current, image_file_id: 'The image must be 3 MB or smaller' }))
      return
    }
    setUploading(true)
    try {
      const uploaded = await filesApi.upload(file, 'app_banner')
      setImage({ id: uploaded.id, url: uploaded.url })
      setErrors((current) => ({ ...current, image_file_id: '' }))
    } catch (caught) {
      alerts.error(toApiError(caught).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={banner ? 'Edit banner' : 'Add banner'}
      description='Shown on the home screen of the Staff app, the Parent app or both, between the two dates.'
      formId='banner-form'
      submitText='Save'
      loading={save.isPending || uploading}
      size='lg'
    >
      <form
        id='banner-form'
        noValidate
        className='grid gap-4 sm:grid-cols-2'
        onSubmit={async (event) => {
          event.preventDefault()
          const next: Record<string, string> = {}
          if (draft.title.trim().length < 3) next.title = 'Enter a title of 3 to 80 letters'
          if (!draft.starts_on) next.starts_on = 'Choose the first day'
          if (!draft.ends_on) next.ends_on = 'Choose the last day'
          if (draft.starts_on && draft.ends_on && draft.ends_on < draft.starts_on)
            next.ends_on = 'The last day must be on or after the first day'
          if (draft.link_url.trim() && !/^https?:\/\//.test(draft.link_url.trim()))
            next.link_url = 'Enter a full link starting with https://'
          if (Object.keys(next).length) {
            setErrors(next)
            return
          }
          try {
            await save.mutateAsync({
              title: draft.title.trim(),
              message: draft.message.trim() || null,
              image_file_id: image?.id ?? null,
              audience: draft.audience,
              starts_on: draft.starts_on,
              ends_on: draft.ends_on,
              link_url: draft.link_url.trim() || null,
              sort_order: Number(draft.sort_order) || 0,
              is_active: draft.is_active,
            })
            alerts.success(banner ? 'Banner saved' : 'Banner added')
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
          id='banner-image'
          label='Banner image'
          error={errors.image_file_id}
          hint='Optional. Wide image, about 3:1 (for example 1200 × 400). PNG, JPG or WEBP up to 3 MB. Without an image the app shows a text banner.'
          className='sm:col-span-2'
        >
          <div className='grid gap-2'>
            <div className='grid aspect-[3/1] w-full place-items-center overflow-hidden rounded-xl border bg-muted'>
              {image ? (
                <img src={image.url} alt='Banner preview' className='size-full object-cover' />
              ) : (
                <ImageUp className='size-8 text-muted-foreground' aria-hidden />
              )}
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button asChild variant='outline' size='sm' className='w-fit' disabled={uploading}>
                <label htmlFor='banner-image' className='cursor-pointer'>
                  <ImageUp />
                  {uploading ? 'Uploading…' : image ? 'Change image' : 'Upload image'}
                  <input
                    id='banner-image'
                    type='file'
                    accept={IMAGE_TYPES.join(',')}
                    className='sr-only'
                    disabled={uploading}
                    onChange={(event) => {
                      void upload(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </label>
              </Button>
              {image && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='w-fit text-destructive hover:bg-destructive/10'
                  onClick={() => setImage(null)}
                >
                  Remove image
                </Button>
              )}
            </div>
          </div>
        </FormField>
        <FormField
          id='banner-title'
          label='Title'
          required
          error={errors.title}
          className='sm:col-span-2'
        >
          <Input
            id='banner-title'
            maxLength={80}
            placeholder='Annual Sports Day · 21 Nov'
            value={draft.title}
            onChange={(event) => set('title', event.target.value)}
            aria-invalid={Boolean(errors.title) || undefined}
          />
        </FormField>
        <FormField
          id='banner-message'
          label='Short message'
          hint='Optional, up to 200 letters'
          className='sm:col-span-2'
        >
          <Input
            id='banner-message'
            maxLength={200}
            placeholder='Parents are welcome from 8 am at the main ground.'
            value={draft.message}
            onChange={(event) => set('message', event.target.value)}
          />
        </FormField>
        <FormField id='banner-audience' label='Show in' required>
          <Combobox
            id='banner-audience'
            label='Show in'
            placeholder='Choose the app'
            value={draft.audience}
            options={(Object.keys(AUDIENCE_LABELS) as BannerAudience[]).map((value) => ({
              value,
              label: AUDIENCE_LABELS[value],
            }))}
            onChange={(value) => value && set('audience', value as BannerAudience)}
            className='sm:w-full'
          />
        </FormField>
        <FormField id='banner-order' label='Order' hint='Lower shows first'>
          <Input
            id='banner-order'
            inputMode='numeric'
            maxLength={2}
            value={draft.sort_order}
            onChange={(event) => set('sort_order', event.target.value.replace(/\D/g, ''))}
          />
        </FormField>
        <FormField id='banner-start' label='Show from' required error={errors.starts_on}>
          <Input
            id='banner-start'
            type='date'
            value={draft.starts_on}
            onChange={(event) => set('starts_on', event.target.value)}
            aria-invalid={Boolean(errors.starts_on) || undefined}
          />
        </FormField>
        <FormField id='banner-end' label='Show until' required error={errors.ends_on}>
          <Input
            id='banner-end'
            type='date'
            min={draft.starts_on}
            value={draft.ends_on}
            onChange={(event) => set('ends_on', event.target.value)}
            aria-invalid={Boolean(errors.ends_on) || undefined}
          />
        </FormField>
        <FormField
          id='banner-link'
          label='Link on tap'
          hint='Optional, for example a form or a page'
          error={errors.link_url}
          className='sm:col-span-2'
        >
          <Input
            id='banner-link'
            type='url'
            maxLength={300}
            placeholder='https://'
            value={draft.link_url}
            onChange={(event) => set('link_url', event.target.value)}
            aria-invalid={Boolean(errors.link_url) || undefined}
          />
        </FormField>
        <FormField id='banner-active' label='Active'>
          <div className='flex h-9 items-center gap-2'>
            <Switch
              id='banner-active'
              checked={draft.is_active}
              onCheckedChange={(checked) => set('is_active', checked)}
            />
            <span className='text-sm text-muted-foreground'>
              {draft.is_active ? 'Shows between the dates' : 'Paused, hidden from the apps'}
            </span>
          </div>
        </FormField>
      </form>
    </AppModal>
  )
}
