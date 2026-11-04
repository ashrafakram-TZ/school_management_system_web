import { Bell, ClipboardCheck, IndianRupee, Medal, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useStudentResults } from '@/features/exams/api'
import { useStudentFees } from '@/features/fees/api'
import { INVOICE_STATUS, rupees, STUDENT_FEE_STATUS, wholeRupees } from '@/features/fees/labels'
import {
  CATEGORY_LABELS,
  LEVEL_LABELS,
  LEVEL_TONE,
  RESULT_LABELS,
  RESULT_TONE,
} from '@/features/students/achievement-labels'
import { formatDate, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePreviewAchievements, usePreviewNotifications } from '../api'
import { AppCard, Metric, QueryView, ScreenEmpty, SectionTitle } from './phone-parts'

const rankText = (rank: number | null, size: number) => (rank ? `${rank} of ${size}` : '—')

export function ResultsScreen({ studentId }: { studentId: number }) {
  const query = useStudentResults(studentId)
  return (
    <QueryView query={query}>
      {(results) => {
        const [latest, ...older] = results
        if (!latest)
          return (
            <ScreenEmpty
              icon={ClipboardCheck}
              title='No results yet'
              description='Marks show here once the school publishes an exam.'
            />
          )
        return (
          <div className='grid gap-3'>
            <AppCard className='grid gap-3'>
              <div className='flex items-start justify-between gap-2'>
                <div className='grid min-w-0'>
                  <span className='truncate text-base font-extrabold'>{latest.exam.name}</span>
                  <span className='text-xs text-muted-foreground'>
                    Class {latest.class_name} - {latest.section_name} ·{' '}
                    {formatDate(latest.exam.end_date)}
                  </span>
                </div>
                <Badge
                  tone={
                    latest.result === 'pass'
                      ? 'success'
                      : latest.result === 'fail'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {latest.result === 'pass'
                    ? 'Passed'
                    : latest.result === 'fail'
                      ? 'Not passed'
                      : 'Incomplete'}
                </Badge>
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <Metric label='Score' value={latest.percent != null ? `${latest.percent}%` : '—'} />
                <Metric label='Grade' value={latest.grade ?? '—'} />
              </div>
              <p className='tabular rounded-xl bg-muted/60 px-3 py-2 text-sm'>
                Total <strong>{latest.total}</strong> out of {latest.max_total}
              </p>
              <div className='grid grid-cols-2 gap-2'>
                <Metric
                  label='Section rank'
                  value={rankText(latest.section_rank, latest.section_size)}
                />
                <Metric label='Class rank' value={rankText(latest.class_rank, latest.class_size)} />
              </div>
            </AppCard>
            <SectionTitle>Subjects</SectionTitle>
            <AppCard className='grid gap-0 divide-y p-0'>
              {latest.subjects.map((subject) => (
                <div
                  key={subject.subject_id}
                  className='flex min-h-12 items-center justify-between gap-3 px-4 py-2.5'
                >
                  <span className='min-w-0 truncate text-sm font-semibold'>{subject.name}</span>
                  <span
                    className={cn(
                      'tabular shrink-0 text-sm font-bold',
                      subject.passed === false && 'text-destructive'
                    )}
                  >
                    {subject.is_absent
                      ? 'Absent'
                      : `${subject.marks ?? '—'} / ${subject.max_marks}`}
                  </span>
                </div>
              ))}
            </AppCard>
            {older.length > 0 && (
              <>
                <SectionTitle>Earlier exams</SectionTitle>
                {older.map((result) => (
                  <AppCard
                    key={result.exam.id}
                    className='flex items-center justify-between gap-3 py-3'
                  >
                    <span className='min-w-0 truncate text-sm font-semibold'>
                      {result.exam.name}
                    </span>
                    <span className='tabular shrink-0 text-sm font-bold'>
                      {result.percent != null ? `${result.percent}%` : '—'}
                      {result.section_rank ? ` · #${result.section_rank}` : ''}
                    </span>
                  </AppCard>
                ))}
              </>
            )}
          </div>
        )
      }}
    </QueryView>
  )
}

export function FeesScreen({ studentId }: { studentId: number }) {
  const query = useStudentFees(studentId)
  return (
    <QueryView query={query}>
      {(fees) => {
        const invoices = fees.invoices.filter((invoice) => invoice.status !== 'cancelled')
        if (invoices.length === 0)
          return (
            <ScreenEmpty
              icon={IndianRupee}
              title='No fees yet'
              description='Fee bills show here.'
            />
          )
        const status = STUDENT_FEE_STATUS[fees.status]
        return (
          <div className='grid gap-3'>
            <AppCard className='grid gap-3'>
              <div className='flex items-center justify-between gap-2'>
                <span className='text-sm font-semibold text-muted-foreground'>Balance to pay</span>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <div
                className={cn(
                  'tabular text-4xl font-extrabold',
                  fees.balance > 0 ? 'text-foreground' : 'text-success'
                )}
              >
                {wholeRupees(fees.balance)}
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <Metric label='Paid' value={wholeRupees(fees.paid)} tone='success' />
                <Metric label='Total' value={wholeRupees(fees.total)} />
              </div>
              {fees.next_due_date && (
                <p className='rounded-xl bg-muted/60 px-3 py-2 text-sm'>
                  Next due on <strong>{formatDate(fees.next_due_date)}</strong>
                  {fees.overdue_amount > 0 && (
                    <span className='text-destructive'>
                      {' '}
                      · {wholeRupees(fees.overdue_amount)} overdue
                    </span>
                  )}
                </p>
              )}
            </AppCard>
            <SectionTitle>Bills</SectionTitle>
            {invoices.map((invoice) => (
              <AppCard key={invoice.id} className='grid gap-1.5 py-3'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='min-w-0 truncate text-sm font-bold'>{invoice.installment}</span>
                  <Badge tone={invoice.is_overdue ? 'danger' : INVOICE_STATUS[invoice.status].tone}>
                    {invoice.is_overdue ? 'Overdue' : INVOICE_STATUS[invoice.status].label}
                  </Badge>
                </div>
                <div className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
                  <span>Due {formatDate(invoice.due_date)}</span>
                  <span className='tabular'>
                    {rupees(invoice.paid)} of {rupees(invoice.total)} paid
                  </span>
                </div>
              </AppCard>
            ))}
            {fees.payments.length > 0 && (
              <>
                <SectionTitle>Payments</SectionTitle>
                <AppCard className='grid gap-0 divide-y p-0'>
                  {fees.payments.slice(0, 5).map((payment) => (
                    <div
                      key={payment.id}
                      className='flex min-h-12 items-center justify-between gap-3 px-4 py-2.5'
                    >
                      <span className='grid min-w-0'>
                        <span className='truncate text-sm font-semibold'>{payment.receipt_no}</span>
                        <span className='text-xs text-muted-foreground'>
                          {formatDate(payment.paid_on)}
                        </span>
                      </span>
                      <span className='tabular shrink-0 text-sm font-bold text-success'>
                        {rupees(payment.amount)}
                      </span>
                    </div>
                  ))}
                </AppCard>
              </>
            )}
          </div>
        )
      }}
    </QueryView>
  )
}

export function AchievementsScreen({ studentId }: { studentId: number }) {
  const query = usePreviewAchievements(studentId)
  return (
    <QueryView query={query}>
      {(items) =>
        items.length === 0 ? (
          <ScreenEmpty
            icon={Trophy}
            title='No achievements yet'
            description='Prizes and activities the school shares show here.'
          />
        ) : (
          <div className='grid gap-3'>
            {items.map((item) => (
              <AppCard key={item.id} className='flex gap-3'>
                <span className='grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary'>
                  <Medal className='size-5' />
                </span>
                <div className='grid min-w-0 flex-1 gap-1.5'>
                  <span className='text-sm leading-snug font-bold'>{item.title}</span>
                  <div className='flex flex-wrap gap-1'>
                    <Badge tone={RESULT_TONE[item.result]}>
                      {item.position ?? RESULT_LABELS[item.result]}
                    </Badge>
                    <Badge tone={LEVEL_TONE[item.level]}>{LEVEL_LABELS[item.level]}</Badge>
                    <Badge>{CATEGORY_LABELS[item.category]}</Badge>
                  </div>
                  <span className='text-xs text-muted-foreground'>
                    {formatDate(item.achieved_on)}
                  </span>
                </div>
              </AppCard>
            ))}
          </div>
        )
      }
    </QueryView>
  )
}

export function NotificationsScreen({ studentId }: { studentId: number }) {
  const query = usePreviewNotifications(studentId)
  return (
    <QueryView query={query}>
      {(page) =>
        page.items.length === 0 ? (
          <ScreenEmpty
            icon={Bell}
            title='No notifications'
            description='Messages from the school to this parent show here.'
          />
        ) : (
          <AppCard className='grid gap-0 divide-y p-0'>
            {page.items.map((item) => (
              <div key={item.id} className='flex gap-3 px-4 py-3'>
                <span
                  className={cn(
                    'mt-1.5 size-2.5 shrink-0 rounded-full',
                    item.is_read ? 'bg-transparent' : 'bg-primary'
                  )}
                />
                <div className='grid min-w-0 flex-1 gap-0.5'>
                  <div className='flex items-start justify-between gap-2'>
                    <span className='text-sm leading-snug font-bold'>{item.title}</span>
                    <span className='shrink-0 text-[11px] text-muted-foreground'>
                      {timeAgo(item.created_at)}
                    </span>
                  </div>
                  <p className='text-[13px] leading-snug text-muted-foreground'>{item.body}</p>
                </div>
              </div>
            ))}
          </AppCard>
        )
      }
    </QueryView>
  )
}
