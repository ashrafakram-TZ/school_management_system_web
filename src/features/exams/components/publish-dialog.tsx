import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'
import { examsApi, useExamMutation, type ExamRef } from '../api'

export function PublishDialog({
  exam,
  incomplete = 0,
  onClose,
}: {
  exam: (ExamRef & { marks_entered?: number; marks_expected?: number }) | null
  incomplete?: number
  onClose: () => void
}) {
  const publish = useExamMutation((id: number) => examsApi.publish(id))
  const missing =
    exam?.marks_expected !== undefined && exam.marks_entered !== undefined
      ? Math.max(0, exam.marks_expected - exam.marks_entered)
      : incomplete
  return (
    <ConfirmDialog
      open={Boolean(exam)}
      onOpenChange={(next) => !next && onClose()}
      title={`Publish ${exam?.name ?? 'exam'} results?`}
      description={
        <>
          Parents of every student with a complete result get a notification with the percentage,
          grade and class rank. Teachers can no longer change marks; the office still can.
          {missing > 0 && (
            <span className='mt-2 block font-semibold text-warning'>
              {missing} {missing === 1 ? 'mark is' : 'marks are'} still missing. Those students show
              as incomplete and are not ranked.
            </span>
          )}
        </>
      }
      confirmText='Publish results'
      loading={publish.isPending}
      onConfirm={async () => {
        if (!exam) return
        try {
          await publish.mutateAsync(exam.id)
          alerts.success(`${exam.name} results published`, {
            description: 'Parents are being notified in the app.',
          })
          onClose()
        } catch (error) {
          alerts.error(toApiError(error).message)
        }
      }}
    />
  )
}
