import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Meeting, MeetingPerson } from '../api'
import { PARTY_LABEL } from '../labels'

function Person({ person }: { person: MeetingPerson }) {
  return (
    <span className='grid min-w-0'>
      <span className='font-semibold break-words'>{person.name}</span>
      <span className='text-xs text-muted-foreground capitalize'>
        {person.role === 'parent' && person.label ? person.label : PARTY_LABEL[person.role]}
      </span>
    </span>
  )
}

export function MeetingPeople({ meeting, className }: { meeting: Meeting; className?: string }) {
  return (
    <span
      className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1', className)}
      aria-label={`${meeting.from.name} booked with ${meeting.to.name}`}
    >
      <Person person={meeting.from} />
      <ArrowRight className='size-4 shrink-0 text-muted-foreground' aria-hidden />
      <Person person={meeting.to} />
    </span>
  )
}
