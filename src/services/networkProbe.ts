import { Platform } from 'react-native';
import {
  isPocketBaseConfigured,
  pb,
  POCKETBASE_REQUEST_TIMEOUT_MS,
} from './pocketbase';

export interface ProbeCheck {
  id: string;
  label: string;
  url: string;
  method: string;
  /** true when a response was received (any HTTP status), false on status 0. */
  reachable: boolean;
  status: number;
  elapsedMs: number;
  contentType: string;
  bodyPreview: string;
  errorName: string;
  errorMessage: string;
  errorCause: string;
}

export interface NetworkProbeResult {
  checkedAt: string;
  baseUrl: string;
  configured: boolean;
  requestTimeoutMs: number;
  platform: string;
  runtimeFetch: string;
  checks: ProbeCheck[];
  verdict: string;
}

const HEALTH_PATH = '/api/health';
const CONTROL_URL = 'https://www.cloudflare.com/cdn-cgi/trace';
const PROBE_TIMEOUT_MS = 8_000;

function emptyCheck(
  id: string,
  label: string,
  url: string,
  method: string
): ProbeCheck {
  return {
    id,
    label,
    url,
    method,
    reachable: false,
    status: 0,
    elapsedMs: 0,
    contentType: '',
    bodyPreview: '',
    errorName: '',
    errorMessage: '',
    errorCause: '',
  };
}

function describeError(error: unknown): Pick<
  ProbeCheck,
  'errorName' | 'errorMessage' | 'errorCause'
> {
  if (!error || typeof error !== 'object') {
    return { errorName: '', errorMessage: String(error), errorCause: '' };
  }
  const source = error as { name?: unknown; message?: unknown; cause?: unknown };
  const cause = source.cause as { message?: unknown } | undefined;
  return {
    errorName: typeof source.name === 'string' ? source.name : '',
    errorMessage: typeof source.message === 'string' ? source.message : '',
    errorCause: typeof cause?.message === 'string' ? cause.message : '',
  };
}

async function timedFetch(
  id: string,
  label: string,
  url: string,
  init: RequestInit,
  timeoutMs = PROBE_TIMEOUT_MS
): Promise<ProbeCheck> {
  const check = emptyCheck(id, label, url, (init.method ?? 'GET').toUpperCase());
  const started = Date.now();
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: controller?.signal,
    });
    const text = await response.text();
    return {
      ...check,
      reachable: true,
      status: response.status,
      elapsedMs: Date.now() - started,
      contentType: response.headers.get('content-type') ?? '',
      bodyPreview: text.slice(0, 180),
    };
  } catch (error) {
    return {
      ...check,
      elapsedMs: Date.now() - started,
      ...describeError(error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sdkHealthCheck(): Promise<ProbeCheck> {
  const check = emptyCheck(
    'sdk-health',
    'PocketBase SDK health.check()',
    `${pb.baseUrl}${HEALTH_PATH}`,
    'GET'
  );
  const started = Date.now();
  return pb.health
    .check()
    .then((data) => ({
      ...check,
      reachable: true,
      status: 200,
      elapsedMs: Date.now() - started,
      contentType: 'application/json',
      bodyPreview: JSON.stringify(data).slice(0, 180),
    }))
    .catch((error: unknown) => ({
      ...check,
      elapsedMs: Date.now() - started,
      ...describeError(error),
    }));
}

function verdictFor(checks: ProbeCheck[]): string {
  const raw = checks.find((check) => check.id === 'raw-health');
  const control = checks.find((check) => check.id === 'control-https');

  if (raw?.status === 200) {
    return 'React Native fetch reached PocketBase. The transport layer is fine.';
  }
  if (raw && raw.status > 0) {
    return `The server answered HTTP ${raw.status} instead of JSON health data — a WAF/challenge/route issue, not a network failure.`;
  }
  if (raw && !raw.reachable && control?.reachable) {
    return 'General HTTPS works from the app but this host does not answer — TLS/Cloudflare is treating the app client differently from the browser.';
  }
  if (raw && !raw.reachable && control && !control.reachable) {
    return 'The app cannot complete any HTTPS request — device VPN/Private DNS/proxy or TLS interception.';
  }
  return 'Inconclusive. Compare the individual checks below.';
}

/**
 * Runs the same HTTPS request through a raw `fetch` (no PocketBase SDK) and
 * through the SDK, then repeats it against a neutral host. This isolates a
 * transport failure from an auth/rule failure and, on Android, prints the raw
 * exception instead of the SDK's generic message.
 */
export async function runNetworkProbe(): Promise<NetworkProbeResult> {
  const base = pb.baseUrl.replace(/\/+$/, '');
  const platform =
    Platform.OS === 'android'
      ? `android ${String(Platform.Version)}`
      : `${Platform.OS} ${String(Platform.Version)}`;

  // Run the independent checks concurrently so a dead host costs one timeout,
  // not four.
  const checks: ProbeCheck[] = await Promise.all([
    sdkHealthCheck(),
    timedFetch('raw-health', 'raw fetch GET health', `${base}${HEALTH_PATH}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }),
    timedFetch(
      'redirect-health',
      'raw fetch with //api path (redirect check)',
      `${base}//api/health`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    ),
    timedFetch(
      'raw-post-auth',
      'raw fetch POST auth endpoint',
      `${base}/collections/staff_users/auth-with-password`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identity: 'probe@invalid.local', password: 'probe' }),
      }
    ),
  ]);

  if (!checks.find((check) => check.id === 'raw-health')?.reachable) {
    checks.push(
      await timedFetch('control-https', 'control HTTPS host', CONTROL_URL, {
        method: 'GET',
      })
    );
  }

  let verdict = verdictFor(checks);
  if (/localhost|127\.0\.0\.1/.test(base)) {
    verdict =
      `Configured URL is ${base} — a physical device cannot reach its own loopback. ` +
      verdict;
  }
  const result: NetworkProbeResult = {
    checkedAt: new Date().toISOString(),
    baseUrl: base,
    configured: isPocketBaseConfigured,
    requestTimeoutMs: POCKETBASE_REQUEST_TIMEOUT_MS,
    platform,
    runtimeFetch: typeof fetch === 'function' ? 'global.fetch available' : 'NO fetch',
    checks,
    verdict,
  };

  console.log('[net] probe:', platform, '| base:', base, '|', verdict);
  for (const check of checks) {
    console.log(
      `[net] ${check.id}: ${check.reachable ? `HTTP ${check.status}` : `NO RESPONSE ${check.errorName}`}` +
        ` in ${check.elapsedMs}ms` +
        (check.errorMessage ? ` | message=${check.errorMessage}` : '') +
        (check.errorCause ? ` | cause=${check.errorCause}` : '') +
        (check.bodyPreview ? ` | body=${check.bodyPreview.replace(/\s+/g, ' ')}` : '')
    );
  }

  return result;
}
