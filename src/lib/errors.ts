import { ClientResponseError } from 'pocketbase'

export type ErrorKind = 'network' | 'auth' | 'forbidden' | 'notFound' | 'validation' | 'server' | 'unknown'

export interface NormalizedError {
  kind: ErrorKind
  status?: number
  message: string
  original?: unknown
}

export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof ClientResponseError) {
    const status = error.status

    if (status === 0 || error.isAbort) {
      return {
        kind: 'network',
        status,
        message: 'No connection. The change is saved and will sync when you are back online.',
        original: error,
      }
    }

    if (status === 401) {
      return {
        kind: 'auth',
        status,
        message: 'Your session expired. Sign in again to sync.',
        original: error,
      }
    }

    if (status === 403) {
      return {
        kind: 'forbidden',
        status,
        message: 'You do not have permission to change this record.',
        original: error,
      }
    }

    if (status === 404) {
      return {
        kind: 'notFound',
        status,
        message: 'This record is no longer available for your branch.',
        original: error,
      }
    }

    if (status === 400 || status === 422) {
      return {
        kind: 'validation',
        status,
        message: typeof error.response?.message === 'string'
          ? error.response.message
          : 'The server rejected this change.',
        original: error,
      }
    }

    return {
      kind: 'server',
      status,
      message: 'The server could not process this change. Try again.',
      original: error,
    }
  }

  if (error instanceof Error) {
    return {
      kind: 'unknown',
      message: error.message || 'Something went wrong.',
      original: error,
    }
  }

  return {
    kind: 'unknown',
    message: 'Something went wrong.',
    original: error,
  }
}

export function isRetryableError(error: NormalizedError): boolean {
  return error.kind === 'network' || error.kind === 'server'
}

export function isAuthError(error: NormalizedError): boolean {
  return error.kind === 'auth'
}

export function describeError(error: unknown): string {
  return normalizeError(error).message
}
