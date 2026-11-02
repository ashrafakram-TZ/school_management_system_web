import { isAxiosError } from 'axios'

export interface FieldError {
  field: string
  message: string
}

export interface ApiErrorBody {
  status: number
  error: string
  message: string
  errors?: FieldError[]
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }

  get isNotFound() {
    return this.status === 404
  }

  get isNetwork() {
    return this.status === 0
  }

  fieldError(field: string) {
    return this.fieldErrors.find((error) => error.field === field)?.message
  }
}

const isErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ApiErrorBody).status === 'number' &&
  typeof (value as ApiErrorBody).message === 'string'

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (isAxiosError(error)) {
    const body = error.response?.data
    if (isErrorBody(body)) {
      return new ApiError(body.status, body.error ?? 'ERROR', body.message, body.errors ?? [])
    }
    if (error.code === 'ECONNABORTED') {
      return new ApiError(0, 'TIMEOUT', 'The server took too long to respond. Try again.')
    }
    if (!error.response) {
      return new ApiError(
        0,
        'NETWORK_ERROR',
        'Cannot reach the API. Check that the backend is running.'
      )
    }
    return new ApiError(
      error.response.status,
      'HTTP_ERROR',
      `Request failed (${error.response.status})`
    )
  }

  if (error instanceof Error) return new ApiError(0, 'UNKNOWN', error.message)
  return new ApiError(0, 'UNKNOWN', 'Something went wrong')
}

export function getErrorMessage(error: unknown) {
  return toApiError(error).message
}
