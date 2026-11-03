jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 34 },
}));

jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: true,
  POCKETBASE_REQUEST_TIMEOUT_MS: 20000,
  pb: {
    baseUrl: 'https://pocket.example',
    health: { check: jest.fn() },
  },
}));

import { pb } from '../src/services/pocketbase';
import { runNetworkProbe } from '../src/services/networkProbe';

const healthMock = pb.health.check as unknown as jest.Mock;

function fakeResponse(status: number, body: string) {
  return {
    status,
    url: 'https://pocket.example/api/health',
    headers: { get: () => 'application/json' },
    text: async () => body,
  };
}

describe('runNetworkProbe', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('reports a healthy transport when raw fetch reaches the health endpoint', async () => {
    healthMock.mockResolvedValue({ code: 200 });
    global.fetch = jest.fn(async () =>
      fakeResponse(200, '{"message":"API is healthy.","code":200}')
    ) as unknown as typeof fetch;

    const result = await runNetworkProbe();

    const raw = result.checks.find((check) => check.id === 'raw-health');
    expect(raw?.reachable).toBe(true);
    expect(raw?.status).toBe(200);
    expect(result.verdict).toContain('transport layer is fine');
    // A control request is only made when the PocketBase host fails.
    expect(result.checks.some((check) => check.id === 'control-https')).toBe(false);
  });

  it('captures the raw exception and probes a control host when nothing answers', async () => {
    const transportError = () =>
      Object.assign(new TypeError('Network request failed'), {
        cause: { message: 'ECONNRESET' },
      });
    healthMock.mockRejectedValue(transportError());
    global.fetch = jest.fn(async () => {
      throw transportError();
    }) as unknown as typeof fetch;

    const result = await runNetworkProbe();

    const raw = result.checks.find((check) => check.id === 'raw-health');
    expect(raw?.reachable).toBe(false);
    expect(raw?.status).toBe(0);
    expect(raw?.errorName).toBe('TypeError');
    expect(raw?.errorMessage).toBe('Network request failed');
    expect(raw?.errorCause).toBe('ECONNRESET');
    expect(result.checks.some((check) => check.id === 'control-https')).toBe(true);
    expect(result.verdict).toContain('cannot complete any HTTPS request');
  });

  it('flags a localhost base URL as unreachable from a device', async () => {
    Object.defineProperty(pb, 'baseUrl', { value: 'http://127.0.0.1:8090', configurable: true });
    healthMock.mockRejectedValue(new TypeError('Network request failed'));
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    const result = await runNetworkProbe();

    expect(result.verdict).toContain('loopback');
  });
});
