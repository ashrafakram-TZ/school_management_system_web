import { alerts } from '@/lib/alerts'
import { toApiError } from '@/lib/api/errors'

export async function run<T>(action: () => Promise<T>, success: string): Promise<T | undefined> {
  try {
    const result = await action()
    alerts.success(success)
    return result
  } catch (error) {
    alerts.error(toApiError(error).message)
    return undefined
  }
}

export function fieldErrorsOf(error: unknown): Record<string, string> {
  const apiError = toApiError(error)
  const fields = Object.fromEntries(apiError.fieldErrors.map((item) => [item.field, item.message]))
  return Object.keys(fields).length ? fields : { root: apiError.message }
}
