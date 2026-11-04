import { useNavigate } from '@tanstack/react-router'
import { Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import { useMeetings } from '../api'
import { durationLabel, MEETING_STATUS, PARTY_LABEL } from '../labels'
import { MeetingPeople } from './meeting-people'

export function ParentMeetings({ guardianId }: { guardianId: number }) {
  const navigate = useNavigate()
  const meetings = useMeetings({ page: 1, limit: 5, guardian_id: guardianId })
  const rows = meetings.data?.items ?? []

  if (meetings.isPending) return <Skeleton className='h-20' />
  if (meetings.isError) {
    return <p className='text-sm text-muted-foreground'>Meetings could not be loaded.</p>
  }
  if (!rows.length) {
    return (
      <p className='flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
        <Video className='size-4' />
        No video meetings with teachers yet.
      </p>
    )
  }

  return (
    <ul className='grid gap-2'>
      {rows.map((meeting) => (
        <li key={meeting.id}>
          <button
            type='button'
            onClick={() =>
              void navigate({ to: '/meetings', search: { page: 1, meeting: meeting.id } })
            }
            className='grid w-full gap-1.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none'
          >
            <span className='flex items-start justify-between gap-2'>
              <span className='grid min-w-0'>
                <span className='truncate font-semibold'>{meeting.title}</span>
                <span className='tabular text-xs text-muted-foreground'>
                  {formatDateTime(meeting.scheduled_at)} · {durationLabel(meeting.duration_minutes)}{' '}
                  · booked by the {PARTY_LABEL[meeting.scheduled_by].toLowerCase()}
                </span>
              </span>
              <Badge tone={MEETING_STATUS[meeting.status].tone} dot>
                {MEETING_STATUS[meeting.status].label}
              </Badge>
            </span>
            <MeetingPeople meeting={meeting} className='text-sm' />
          </button>
        </li>
      ))}
      {(meetings.data?.total ?? 0) > rows.length && (
        <li className='text-xs text-muted-foreground'>
          Showing the latest {rows.length} of {meetings.data?.total} meetings.
        </li>
      )}
    </ul>
  )
}
