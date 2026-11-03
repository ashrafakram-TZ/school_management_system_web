import { useState } from 'react'
import { BellRing, Bus, IdCard, ShieldCheck } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/common/display'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { formatDate } from '@/lib/format'
import { transportApi, useExpiries, useTransportMutation, type ExpiryRun } from '../api'
import { daysText, daysTone } from '../labels'

export function ExpiriesTab({ canManage }: { canManage: boolean }) {
  const expiries = useExpiries(30)
  const [lastRun, setLastRun] = useState<ExpiryRun | null>(null)
  const check = useTransportMutation(() => transportApi.checkExpiries())
  const rows = expiries.data ?? []

  const send = async () => {
    try {
      const result = await check.mutateAsync(undefined)
      setLastRun(result)
      alerts.success(
        result.alerts_sent
          ? `${result.alerts_sent} ${result.alerts_sent === 1 ? 'alert' : 'alerts'} sent`
          : 'No new alerts to send'
      )
    } catch (error) {
      alerts.error(toApiError(error).message)
    }
  }

  return (
    <Card className='overflow-hidden'>
      <div className='flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5'>
        <div className='grid gap-0.5'>
          <h2 className='font-bold'>Documents ending in the next 30 days</h2>
          <p className='text-xs text-muted-foreground'>
            Insurance, fitness, PUC, permit and driving licences. Alerts go out every day at 07:00
            at 30, 7 and 1 days left and on the last day.
          </p>
        </div>
        {canManage && (
          <Button onClick={send} loading={check.isPending}>
            <BellRing />
            Send alerts now
          </Button>
        )}
      </div>
      {lastRun && (
        <p
          role='status'
          className='border-b bg-accent/50 px-4 py-2 text-sm font-medium text-accent-foreground sm:px-5'
        >
          {lastRun.alerts_sent
            ? `${lastRun.alerts_sent} ${lastRun.alerts_sent === 1 ? 'alert was' : 'alerts were'} sent to the transport in-charge and admin.`
            : 'No new alerts were due. Each document gets one alert per reminder day.'}
        </p>
      )}
      {expiries.isError ? (
        <ErrorState message={expiries.error.message} onRetry={() => expiries.refetch()} />
      ) : !expiries.data ? (
        <div className='grid gap-2 p-4'>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className='h-14' />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title='Nothing ends in the next 30 days'
          description='Every bus document and driving licence is valid for at least a month.'
        />
      ) : (
        <ul className='grid divide-y'>
          {rows.map((item) => {
            const Icon = item.kind === 'licence' ? IdCard : Bus
            return (
              <li
                key={`${item.kind}-${item.ref_id}`}
                className='flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5'
              >
                <span className='grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground'>
                  <Icon className='size-4' />
                </span>
                <span className='grid min-w-0 flex-1'>
                  <span className='truncate font-semibold'>{item.label}</span>
                  <span className='truncate text-xs text-muted-foreground'>
                    <span className={item.kind === 'licence' ? '' : 'font-mono'}>
                      {item.subject}
                    </span>{' '}
                    · ends {formatDate(item.date)}
                  </span>
                </span>
                <Badge tone={daysTone(item.days_left)}>{daysText(item.days_left)}</Badge>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
