/**
 * Minimal, dependency-free Server-Sent Events (SSE) implementation for React
 * Native / Expo Go.
 *
 * PocketBase's JS SDK opens its realtime channel with `new EventSource(...)`.
 * React Native ships no global `EventSource`, so without this polyfill the SDK
 * throws inside `RealtimeService.initConnect()`, the SSE socket never opens and
 * the terminal silently falls back to polling — which is exactly why incoming
 * website orders only appeared after a manual pull-to-refresh.
 *
 * `XMLHttpRequest` *is* available in React Native and delivers incremental
 * `responseText` while the connection is in the `LOADING` state, so it is used
 * here to stream the `text/event-stream` frames. Behaviour mirrors the widely
 * used `react-native-sse` package: reconnect on a clean close, surface errors
 * through `onerror`, and dispatch named events (PocketBase uses `PB_CONNECT`
 * plus one event name per collection, e.g. `orders/*`).
 */

export type EventSourceListener<T = unknown> = (event: T) => void;

export interface RNEventSourceOptions {
  method?: string;
  /** 0 disables the request timeout (recommended for a long-lived stream). */
  timeout?: number;
  timeoutBeforeConnection?: number;
  withCredentials?: boolean;
  headers?: Record<string, string>;
  body?: unknown;
  debug?: boolean;
  /** Delay before reopening after the server cleanly ends the stream. */
  pollingInterval?: number;
  /** Force a specific line ending (\r\n, \n or \r); auto-detected when null. */
  lineEndingCharacter?: string | null;
}

export interface RealtimeMessageEvent {
  type: string;
  data: string;
  url: string;
  lastEventId: string | null;
}

export interface RealtimeErrorEvent {
  type: 'error';
  message: string;
  xhrStatus?: number;
  xhrState?: number;
  error?: Error;
}

const XML_READY_STATE = ['UNSENT', 'OPENED', 'HEADERS_RECEIVED', 'LOADING', 'DONE'];
// React Native's XHR always reports these numeric states, even on platforms
// whose constructor does not expose the static constants.
const XHR_LOADING = 3;
const XHR_DONE = 4;

/** True when the platform gives us the XHR transport this polyfill needs. */
export function canStreamServerSentEvents(): boolean {
  return typeof XMLHttpRequest !== 'undefined';
}

export class RNEventSource {
  // DOM-compatible readyState constants.
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readonly url: string;
  readyState = RNEventSource.CONNECTING;
  lastEventId: string | null = null;
  /** PocketBase assigns this property directly. */
  onerror: ((event: RealtimeErrorEvent) => void) | null = null;
  onopen: ((event: { type: 'open' }) => void) | null = null;
  onmessage: ((event: RealtimeMessageEvent) => void) | null = null;

  private readonly method: string;
  private readonly timeout: number;
  private readonly timeoutBeforeConnection: number;
  private readonly withCredentials: boolean;
  private readonly headers: Record<string, string>;
  private readonly body: unknown;
  private readonly debug: boolean;
  private interval: number;
  private lineEndingCharacter: string | null;

  private listeners = new Map<string, EventSourceListener[]>();
  private xhr: XMLHttpRequest | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastIndexProcessed = 0;
  private closed = false;

  constructor(url: string | { toString(): string }, options: RNEventSourceOptions = {}) {
    if (!url || (typeof url !== 'string' && typeof url.toString !== 'function')) {
      throw new SyntaxError('[EventSource] Invalid URL argument.');
    }

    this.url = typeof url === 'string' ? url : url.toString();

    this.method = options.method ?? 'GET';
    this.timeout = options.timeout ?? 0;
    this.timeoutBeforeConnection = options.timeoutBeforeConnection ?? 500;
    this.withCredentials = options.withCredentials ?? false;
    this.body = options.body;
    this.debug = options.debug ?? false;
    this.interval = options.pollingInterval ?? 5_000;
    this.lineEndingCharacter = options.lineEndingCharacter ?? null;
    this.headers = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers ?? {}),
    };

    // The transport opens asynchronously so callers can register listeners first.
    this.pollAgain(this.timeoutBeforeConnection, true);
  }

  addEventListener(type: string, listener: EventSourceListener): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: EventSourceListener): void {
    const current = this.listeners.get(type);
    if (!current) return;
    this.listeners.set(
      type,
      current.filter((entry) => entry !== listener)
    );
  }

  removeAllEventListeners(type?: string): void {
    if (type === undefined) {
      this.listeners.clear();
      return;
    }
    this.listeners.delete(type);
  }

  close(): void {
    this.closed = true;
    if (this.readyState !== RNEventSource.CLOSED) {
      this.readyState = RNEventSource.CLOSED;
      this.dispatch('close', { type: 'close' });
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.xhr) {
      try {
        this.xhr.abort();
      } catch {
        // The transport may already be gone.
      }
      this.xhr = null;
    }
  }

  private pollAgain(delay: number, allowZero: boolean): void {
    if (this.closed || (delay <= 0 && !allowZero)) return;
    this.log(`Will open a new connection in ${delay} ms.`);
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      this.open();
    }, Math.max(delay, 0));
  }

  private open(): void {
    if (this.closed || !canStreamServerSentEvents()) return;

    this.readyState = RNEventSource.CONNECTING;
    this.lastIndexProcessed = 0;

    const xhr = new XMLHttpRequest();
    this.xhr = xhr;

    try {
      xhr.open(this.method, this.url, true);

      if (this.withCredentials) {
        xhr.withCredentials = true;
      }

      for (const [key, value] of Object.entries(this.headers)) {
        if (value !== undefined && value !== null) {
          xhr.setRequestHeader(key, value);
        }
      }

      if (this.lastEventId !== null) {
        xhr.setRequestHeader('Last-Event-ID', this.lastEventId);
      }

      xhr.timeout = this.timeout;

      xhr.onreadystatechange = () => {
        if (this.closed) return;
        const state = xhr.readyState;
        this.log(`readyState: ${XML_READY_STATE[state] ?? state}, status: ${xhr.status}`);

        if (state !== XHR_LOADING && state !== XHR_DONE) return;

        if (xhr.status >= 200 && xhr.status < 400) {
          if (this.readyState === RNEventSource.CONNECTING) {
            this.readyState = RNEventSource.OPEN;
            this.dispatch('open', { type: 'open' });
            this.onopen?.({ type: 'open' });
          }

          this.handleChunk(xhr.responseText ?? '');

          if (state === XHR_DONE) {
            this.log('Stream ended; polling for a new connection.');
            this.pollAgain(this.interval, false);
          }
        } else if (xhr.status !== 0) {
          this.readyState = RNEventSource.CONNECTING;
          this.emitError({
            type: 'error',
            message: xhr.responseText || `SSE request failed with status ${xhr.status}`,
            xhrStatus: xhr.status,
            xhrState: state,
          });

          if (state === XHR_DONE) {
            this.pollAgain(this.interval, false);
          }
        }
      };

      xhr.onerror = () => {
        if (this.closed) return;
        this.emitError({
          type: 'error',
          message: 'Failed to establish realtime connection.',
          xhrState: xhr.readyState,
          xhrStatus: xhr.status,
        });
        this.pollAgain(this.interval, false);
      };

      xhr.ontimeout = () => {
        if (this.closed) return;
        this.emitError({
          type: 'error',
          message: 'Realtime connection timed out.',
          xhrState: xhr.readyState,
          xhrStatus: xhr.status,
        });
        this.pollAgain(this.interval, false);
      };

      xhr.send((this.body ?? null) as XMLHttpRequestBodyInit | null);
    } catch (error) {
      this.emitError({
        type: 'error',
        message: 'Failed to open realtime connection.',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      this.pollAgain(this.interval, false);
    }
  }

  private emitError(event: RealtimeErrorEvent): void {
    this.dispatch('error', event);
    this.onerror?.(event);
  }

  private dispatch(type: string, data: unknown): void {
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      handler(data);
    }
  }

  /** Parses any newly arrived SSE frames and dispatches them by event name. */
  private handleChunk(response: string): void {
    if (!response) return;

    if (this.lineEndingCharacter === null) {
      const detected = this.detectLineEnding(response);
      if (detected === null) {
        // Not enough data yet to know the delimiter; wait for the next chunk.
        return;
      }
      this.lineEndingCharacter = detected;
    }

    const boundary = this.getLastFrameBoundary(response);
    if (boundary <= this.lastIndexProcessed) return;

    const chunk = response
      .substring(this.lastIndexProcessed, boundary)
      .split(this.lineEndingCharacter);
    this.lastIndexProcessed = boundary;

    let type: string | undefined;
    let data: string[] = [];

    for (const line of chunk) {
      if (line === '') {
        if (data.length > 0) {
          const eventType = type ?? 'message';
          const message: RealtimeMessageEvent = {
            type: eventType,
            data: data.join('\n'),
            url: this.url,
            lastEventId: this.lastEventId,
          };
          this.dispatch(eventType, message);
          if (eventType === 'message') this.onmessage?.(message);
          data = [];
          type = undefined;
        }
        continue;
      }

      // A leading colon marks a comment / heartbeat frame.
      if (line.startsWith(':')) continue;

      const separator = line.indexOf(':');
      const field = separator === -1 ? line : line.substring(0, separator);
      let value = separator === -1 ? '' : line.substring(separator + 1);
      if (value.startsWith(' ')) value = value.substring(1);

      if (field === 'event') {
        type = value;
      } else if (field === 'data') {
        data.push(value);
      } else if (field === 'id') {
        this.lastEventId = value === '' ? null : value;
      } else if (field === 'retry') {
        const retry = Number.parseInt(value, 10);
        if (Number.isFinite(retry) && retry >= 0) {
          this.interval = retry;
        }
      }
    }
  }

  private detectLineEnding(response: string): string | null {
    for (const candidate of ['\r\n', '\n', '\r']) {
      if (response.includes(candidate)) return candidate;
    }
    return null;
  }

  private getLastFrameBoundary(response: string): number {
    if (this.lineEndingCharacter === null) return -1;
    const delimiter = this.lineEndingCharacter + this.lineEndingCharacter;
    const index = response.lastIndexOf(delimiter);
    return index === -1 ? -1 : index + delimiter.length;
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[EventSource] ${message}`);
    }
  }
}

/**
 * Installs the polyfill on the global object only when the runtime lacks a
 * native `EventSource` (React Native / Expo Go). Browsers keep their own
 * implementation, and Jest (no `XMLHttpRequest`) is left untouched.
 */
export function installEventSourcePolyfill(): void {
  const scope =
    typeof globalThis !== 'undefined'
      ? (globalThis as { EventSource?: unknown })
      : typeof global !== 'undefined'
        ? (global as { EventSource?: unknown })
        : null;

  if (!scope) return;
  if (typeof scope.EventSource !== 'undefined') return;
  if (!canStreamServerSentEvents()) return;

  scope.EventSource = RNEventSource;
}
