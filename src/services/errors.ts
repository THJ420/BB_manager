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

export type PocketBaseErrorKind =
  | 'auth'
  | 'forbidden'
  | 'rule'
  | 'validation'
  | 'not-found'
  | 'conflict'
  | 'network'
  | 'aborted'
  | 'unknown';

export interface DescribedPocketBaseError {
  kind: PocketBaseErrorKind;
  status: number;
  message: string;
  detail: string;
  url: string;
  data: Record<string, unknown>;
  /** Raw transport error (Android: "TypeError: Network request failed"). */
  raw: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function fieldErrorDetail(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [field, value] of Object.entries(data)) {
    if (value === null || typeof value !== 'object') continue;
    const entry = value as { message?: unknown; code?: unknown };
    const message = typeof entry.message === 'string' ? entry.message : '';
    const code = typeof entry.code === 'string' ? entry.code : '';
    if (message) {
      parts.push(`${field}: ${message}${code ? ` (${code})` : ''}`);
    }
  }
  return parts.join('; ');
}

/**
 * PocketBase hides the reason behind most write failures. This extracts the HTTP
 * status, the field-level validation data, and — for the empty-data 400 that the
 * collection rules produce — classifies it as a rule denial instead of a
 * transport problem.
 */
export function describePocketBaseError(error: unknown): DescribedPocketBaseError {
  const source = asRecord(error);
  const status = typeof source.status === 'number' ? source.status : 0;
  const url = typeof source.url === 'string' ? source.url : '';
  const message =
    typeof source.message === 'string' && source.message
      ? source.message
      : status === 0
        ? 'PocketBase is unreachable.'
        : 'PocketBase rejected the request.';

  // Response body: { code, message, data: { field: { code, message } } }.
  const response = asRecord(source.response);
  const responseData = asRecord(response.data);
  const data = Object.keys(responseData).length > 0 ? responseData : response;
  const fieldDetail = fieldErrorDetail(data);

  // Network/TLS failures never reach the server, so `response` is empty and the
  // only useful breadcrumb is the original exception the SDK wrapped. RN's fetch
  // collapses DNS/TLS/connection errors into "TypeError: Network request failed",
  // which is why the raw text is surfaced verbatim.
  const original = asRecord(source.originalError);
  const originalName = typeof original.name === 'string' ? original.name : '';
  const originalMessage = typeof original.message === 'string' ? original.message : '';
  const originalCause = asRecord(original.cause);
  const causeMessage =
    typeof originalCause.message === 'string' ? originalCause.message : '';
  const raw = [originalName, originalMessage, causeMessage]
    .filter((part) => part && part !== 'Error')
    .join(': ');

  const detail = fieldDetail || raw;

  let kind: PocketBaseErrorKind = 'unknown';
  if (source.name === 'BranchScopeError') {
    // Raised locally before any HTTP call; the entry names another branch.
    kind = 'forbidden';
  } else if (source.isAbort === true) {
    kind = 'aborted';
  } else if (status === 0) {
    kind = 'network';
  } else if (status === 401) {
    kind = 'auth';
  } else if (status === 403) {
    kind = 'forbidden';
  } else if (status === 404) {
    kind = 'not-found';
  } else if (status === 409) {
    kind = 'conflict';
  } else if (status === 400 && detail === '' && /^failed to /i.test(message)) {
    // PocketBase returns 400 with an empty data object when an API rule denies
    // the operation (wrong branch, wrong role, or an unauthenticated request).
    kind = 'rule';
  } else if (status === 400) {
    kind = 'validation';
  }

  return { kind, status, message, detail, url, data, raw };
}

export function isAuthFailure(error: DescribedPocketBaseError): boolean {
  return error.kind === 'auth' || error.kind === 'forbidden';
}

/** One-line, human-actionable explanation used by the diagnostics dialog. */
export function describeSyncHint(error: DescribedPocketBaseError): string {
  switch (error.kind) {
    case 'auth':
      return 'Staff session rejected (HTTP 401). Sign out and sign in again.';
    case 'forbidden':
      return 'This account is not allowed to write to this branch (HTTP 403).';
    case 'rule':
      return 'Blocked by PocketBase collection rules — check the account role and branch_id.';
    case 'validation':
      return error.detail || error.message;
    case 'not-found':
      return 'The record does not exist in PocketBase; its create likely failed first.';
    case 'network':
      return error.raw
        ? `No HTTP response (${error.raw}). Run the network probe to isolate TLS/DNS/URL.`
        : 'PocketBase is unreachable; queued actions retry automatically.';
    case 'conflict':
      return 'A record with this id already exists.';
    default:
      return error.message;
  }
}
