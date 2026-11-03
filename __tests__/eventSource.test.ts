import {
  canStreamServerSentEvents,
  installEventSourcePolyfill,
  RNEventSource,
} from '../src/services/eventSource';

/**
 * Minimal XHR double that lets the test push incremental `responseText`
 * chunks the same way React Native does for a `text/event-stream` response.
 */
class FakeXMLHttpRequest {
  static readonly UNSENT = 0;
  static readonly OPENED = 1;
  static readonly HEADERS_RECEIVED = 2;
  static readonly LOADING = 3;
  static readonly DONE = 4;
  static instances: FakeXMLHttpRequest[] = [];

  readyState = 0;
  status = 0;
  responseText = '';
  timeout = 0;
  withCredentials = false;
  onreadystatechange: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  aborted = false;
  sent = false;
  method = '';
  url = '';
  headers: Record<string, string> = {};

  constructor() {
    FakeXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
    this.readyState = FakeXMLHttpRequest.OPENED;
  }

  setRequestHeader(key: string, value: string): void {
    this.headers[key] = value;
  }

  send(): void {
    this.sent = true;
  }

  abort(): void {
    this.aborted = true;
  }

  stream(readyState: number, status: number, responseText: string): void {
    this.readyState = readyState;
    this.status = status;
    this.responseText = responseText;
    this.onreadystatechange?.();
  }
}
const globalWithXhr = globalThis as { XMLHttpRequest?: unknown; EventSource?: unknown };

describe('React Native EventSource polyfill', () => {
  beforeEach(() => {
    FakeXMLHttpRequest.instances = [];
    globalWithXhr.XMLHttpRequest = FakeXMLHttpRequest;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete globalWithXhr.XMLHttpRequest;
    delete globalWithXhr.EventSource;
  });

  it('detects the XHR transport and installs a global EventSource', () => {
    expect(canStreamServerSentEvents()).toBe(true);
    installEventSourcePolyfill();
    expect(globalWithXhr.EventSource).toBe(RNEventSource);
  });

  it('does not overwrite a native EventSource', () => {
    const native = class NativeEventSource {};
    globalWithXhr.EventSource = native;
    installEventSourcePolyfill();
    expect(globalWithXhr.EventSource).toBe(native);
  });

  it('parses a PocketBase PB_CONNECT frame and exposes the client id', () => {
    const source = new RNEventSource('https://pocket.example.test/api/realtime', {
      timeoutBeforeConnection: 0,
    });
    const onConnect = jest.fn();
    source.addEventListener('PB_CONNECT', onConnect);

    jest.advanceTimersByTime(1);

    const xhr = FakeXMLHttpRequest.instances[0];
    expect(xhr).toBeDefined();
    expect(xhr.sent).toBe(true);
    expect(xhr.headers.Accept).toBe('text/event-stream');

    xhr.stream(
      FakeXMLHttpRequest.LOADING,
      200,
      'event: PB_CONNECT\nid: client-42\ndata: {"ok":true}\n\n'
    );

    expect(onConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PB_CONNECT',
        data: '{"ok":true}',
        lastEventId: 'client-42',
      })
    );
  });
it('dispatches a collection order event by its realtime topic', () => {
    const source = new RNEventSource('https://pocket.example.test/api/realtime', {
      timeoutBeforeConnection: 0,
    });
    const onOrder = jest.fn();
    source.addEventListener('orders/*', onOrder);

    jest.advanceTimersByTime(1);
    const xhr = FakeXMLHttpRequest.instances[0];

    xhr.stream(
      FakeXMLHttpRequest.LOADING,
      200,
      'event: orders/*\ndata: {"action":"create","record":{"id":"ord_1"}}\n\n'
    );

    expect(onOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'orders/*',
        data: '{"action":"create","record":{"id":"ord_1"}}',
      })
    );
  });

  it('parses multiple frames from one chunk without duplicating earlier ones', () => {
    const source = new RNEventSource('https://pocket.example.test/api/realtime', {
      timeoutBeforeConnection: 0,
    });
    const seen: string[] = [];
    source.addEventListener('orders/*', (event) => {
      seen.push((event as { data: string }).data);
    });

    jest.advanceTimersByTime(1);
    const xhr = FakeXMLHttpRequest.instances[0];

    xhr.stream(
      FakeXMLHttpRequest.LOADING,
      200,
      'event: orders/*\ndata: first\n\n' + 'event: orders/*\ndata: second\n\n'
    );
    // Re-deliver the same buffer; already-parsed frames must not repeat.
    xhr.stream(
      FakeXMLHttpRequest.LOADING,
      200,
      'event: orders/*\ndata: first\n\n' +
        'event: orders/*\ndata: second\n\n' +
        'event: orders/*\ndata: third\n\n'
    );

    expect(seen).toEqual(['first', 'second', 'third']);
  });

  it('surfaces transport failures through onerror and close() aborts the socket', () => {
    const source = new RNEventSource('https://pocket.example.test/api/realtime', {
      timeoutBeforeConnection: 0,
    });
    const onerror = jest.fn();
    source.onerror = onerror;

    jest.advanceTimersByTime(1);
    const xhr = FakeXMLHttpRequest.instances[0];

    xhr.onerror?.();
    expect(onerror).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );

    source.close();
    expect(xhr.aborted).toBe(true);
    expect(source.readyState).toBe(RNEventSource.CLOSED);
  });
});