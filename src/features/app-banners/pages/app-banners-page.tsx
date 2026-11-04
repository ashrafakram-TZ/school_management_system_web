import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  CalendarClock,
  CircleCheck,
  ImageIcon,
  Pause,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/common/display'
import { InsightCards, type Insight } from '@/components/common/insight-cards'
import { FilterSelect, ListToolbar, SearchBox } from '@/components/common/list-toolbar'
import { Page, PageHeader } from '@/components/common/page'
import { useShortcut } from '@/components/shortcuts/shortcut-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { can, useMe } from '@/features/auth/api'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { formatDate } from '@/lib/format'
import {
  appBannersApi,
  useAppBannerInsights,
  useAppBanners,
  useBannerMutation,
  type AppBanner,
  type BannerAudience,
  type BannerState,
} from '../api'
import { BannerFormModal } from '../components/banner-form-modal'
import { AUDIENCE_LABELS, STATE_LABELS, STATE_TONE } from '../labels'
import type { AppBannersSearch } from '../search'

const route = getRouteApi('/_app/app-banners')

const CARD_TONE: Record<BannerState, Insight['tone']> = {
  live: 'success',
  scheduled: 'info',
  ended: 'neutral',
  paused: 'warning',
}

export function AppBannersPage() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/app-banners' })
  const setSearch = (patch: Partial<AppBannersSearch>) =>
    navigate({ search: (prev) => ({ ...prev, page: 1, ...patch }), replace: true })
  const canManage = can(useMe().data, 'notifications.send')
  const list = useAppBanners({
    page: search.page,
    limit: 12,
    search: search.search,
    state: search.state,
    audience: search.audience,
  })
  const insights = useAppBannerInsights()
  const [editing, setEditing] = useState<AppBanner | 'new' | null>(null)
  const [removing, setRemoving] = useState<AppBanner | null>(null)
  const remove = useBannerMutation((id: number) => appBannersApi.remove(id))
  const toggle = useBannerMutation((banner: AppBanner) =>
    appBannersApi.update(banner.id, { is_active: !banner.is_active })
  )

  useShortcut('banners.create', () => setEditing('new'), { enabled: canManage })

  const counts = insights.data
  const card = (state: BannerState, icon: Insight['icon'], hint: string): Insight => ({
    key: state,
    label: STATE_LABELS[state],
    value: counts?.[state] ?? 0,
    hint,
    icon,
    tone: CARD_TONE[state],
    active: search.state === state,
    onClick: () => setSearch({ state: search.state === state ? undefined : state }),
  })
  const cards: Insight[] = [
    card('live', CircleCheck, 'Showing in the apps today'),
    card('scheduled', CalendarClock, 'Start on a later date'),
    card('ended', ImageIcon, 'Past their last day'),
    card('paused', Pause, 'Hidden by the office'),
  ]
  const filtered = Boolean(search.state || search.audience || search.search)
  const rows = list.data?.items ?? []

  return (
    <Page>
      <PageHeader
        eyebrow='Communication'
        title='App banners'
        description='Banners for the home screen of the Staff app and the Parent app: events, holidays and notices, with or without an image, shown between two dates.'
        actions={
          canManage && (
            <Button onClick={() => setEditing('new')}>
              <Plus />
              Add banner
            </Button>
          )
        }
      />
      <InsightCards items={cards} loading={!counts} />
      <Card className='overflow-hidden'>
        <ListToolbar
          summary={
            list.data ? `${list.data.total} ${list.data.total === 1 ? 'banner' : 'banners'}` : ''
          }
          onClear={filtered ? () => navigate({ search: { page: 1 }, replace: true }) : undefined}
        >
          <SearchBox
            value={search.search ?? ''}
            onChange={(value) => setSearch({ search: value || undefined })}
            placeholder='Title or message'
            label='Search banners'
          />
          <FilterSelect
            id='banner-audience-filter'
            label='Filter by app'
            allLabel='Every app'
            value={search.audience}
            options={(Object.keys(AUDIENCE_LABELS) as BannerAudience[]).map((value) => ({
              value,
              label: AUDIENCE_LABELS[value],
            }))}
            onChange={(value) => setSearch({ audience: value as BannerAudience | undefined })}
          />
        </ListToolbar>
        {list.isError ? (
          <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
        ) : !list.data ? (
          <div className='grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3'>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className='h-64' />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={filtered ? 'No banners match' : 'No banners yet'}
            description={
              filtered
                ? 'Change or clear the filters.'
                : 'Add a banner for an event, a holiday or a notice, with or without an image. It shows on the app home screen between the dates you choose.'
            }
            action={
              canManage && !filtered ? (
                <Button onClick={() => setEditing('new')}>
                  <Plus />
                  Add banner
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className='grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3' aria-label='App banners'>
            {rows.map((banner) => (
              <li
                key={banner.id}
                className='grid content-start overflow-hidden rounded-xl border bg-card'
              >
                <div className='aspect-[3/1] w-full overflow-hidden bg-muted'>
                  {banner.image ? (
                    <img
                      src={banner.image.url}
                      alt={banner.title}
                      className='size-full object-cover'
                    />
                  ) : (
                    <div className='grid size-full place-items-center'>
                      <ImageIcon className='size-6 text-muted-foreground' />
                    </div>
                  )}
                </div>
                <div className='grid gap-2 p-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <span className='min-w-0 font-semibold'>{banner.title}</span>
                    <Badge tone={STATE_TONE[banner.state]} className='shrink-0'>
                      {STATE_LABELS[banner.state]}
                    </Badge>
                  </div>
                  {banner.message && (
                    <p className='text-sm text-muted-foreground'>{banner.message}</p>
                  )}
                  <div className='flex flex-wrap gap-1.5 text-xs'>
                    <Badge tone='neutral'>{AUDIENCE_LABELS[banner.audience]}</Badge>
                    <Badge tone='neutral'>
                      {formatDate(banner.starts_on)} – {formatDate(banner.ends_on)}
                    </Badge>
                    {banner.link_url && <Badge tone='info'>Opens a link</Badge>}
                  </div>
                  {canManage && (
                    <div className='flex justify-end gap-1'>
                      <Button
                        size='sm'
                        variant='ghost'
                        aria-label={`${banner.is_active ? 'Pause' : 'Resume'} ${banner.title}`}
                        loading={toggle.isPending && toggle.variables?.id === banner.id}
                        onClick={async () => {
                          try {
                            await toggle.mutateAsync(banner)
                            alerts.success(banner.is_active ? 'Banner paused' : 'Banner resumed')
                          } catch (error) {
                            alerts.error(toApiError(error).message)
                          }
                        }}
                      >
                        {banner.is_active ? <Pause /> : <Undo2 />}
                        {banner.is_active ? 'Pause' : 'Resume'}
                      </Button>
                      <Button
                        size='icon-sm'
                        variant='ghost'
                        aria-label={`Edit ${banner.title}`}
                        onClick={() => setEditing(banner)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size='icon-sm'
                        variant='ghost'
                        aria-label={`Delete ${banner.title}`}
                        className='text-destructive hover:bg-destructive/10'
                        onClick={() => setRemoving(banner)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing && (
        <BannerFormModal
          banner={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title='Delete this banner?'
        description='It disappears from the apps straight away.'
        confirmText='Delete'
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!removing) return
          try {
            await remove.mutateAsync(removing.id)
            alerts.success('Banner deleted')
          } catch (error) {
            alerts.error(toApiError(error).message)
          }
          setRemoving(null)
        }}
      />
    </Page>
  )
}
