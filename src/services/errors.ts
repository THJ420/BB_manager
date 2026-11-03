function errorStatus(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

/** A missing settings row or record is recoverable; network and auth failures are not. */
export function isNotFoundError(error: unknown): boolean {
  return errorStatus(error) === 404;
}

/** PocketBase reports a retried custom-ID create as a duplicate validation error. */
export function isDuplicateRecordError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const response = (error as { response?: { data?: Record<string, unknown> } }).response;
  const idField = response?.data?.id;
  if (idField && typeof idField === 'object') {
    const code = (idField as { code?: unknown }).code;
    const message = (idField as { message?: unknown }).message;
    if (code === 'validation_not_unique') return true;
    if (typeof message === 'string' && message.toLowerCase().includes('already exists')) {
      return true;
    }
  }
  return false;
}

export function publicNetworkError(error: unknown): string {
  const status = errorStatus(error);
  if (status === 400 || status === 401 || status === 403) {
    return 'Invalid staff credentials or this account cannot access the selected branch.';
  }
  return 'PocketBase is unreachable. Check the network connection and try again.';
}
