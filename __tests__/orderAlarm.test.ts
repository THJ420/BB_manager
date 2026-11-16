jest.mock(
  'react-native',
  () => ({ Platform: { OS: 'android' } }),
  { virtual: true }
);

jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  AndroidNotificationPriority: { MAX: 'max' },
  scheduleNotificationAsync: jest.fn(async () => 'notif_1'),
  dismissAllNotificationsAsync: jest.fn(async () => undefined),
}));

jest.mock('../src/services/push', () => ({
  ensurePickupNotificationChannel: jest.fn(async () => undefined),
}));

import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';
import { ensurePickupNotificationChannel } from '../src/services/push';

const requireNativeMock = requireNativeModule as jest.Mock;

const nativeStub = {
  present: jest.fn(() => true),
  dismiss: jest.fn(),
  startLoop: jest.fn(() => true),
  stopLoop: jest.fn(),
  canUseFullScreenIntent: jest.fn(() => true),
  openFullScreenIntentSettings: jest.fn(() => true),
};

type OrderAlarmService = typeof import('../src/services/orderAlarm');

function loadService(): OrderAlarmService {
  let service!: OrderAlarmService;
  jest.isolateModules(() => {
    service = require('../src/services/orderAlarm');
  });
  return service;
}

const CONTENT = {
  orderId: 'ord_101',
  title: 'Incoming pickup order',
  body: 'Ayesha · #205',
};

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'android';
  requireNativeMock.mockReturnValue(nativeStub);
  nativeStub.present.mockReturnValue(true);
  nativeStub.startLoop.mockReturnValue(true);
  nativeStub.canUseFullScreenIntent.mockReturnValue(true);
  nativeStub.openFullScreenIntentSettings.mockReturnValue(true);
});

describe('presentOrderAlarm', () => {
  it('fires the native full-screen intent alarm on Android', async () => {
    const service = loadService();
    await service.presentOrderAlarm(CONTENT);

    expect(requireNativeMock).toHaveBeenCalledWith('OrderAlarm');
    expect(nativeStub.present).toHaveBeenCalledWith(
      CONTENT.title,
      CONTENT.body,
      CONTENT.orderId
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('falls back to a MAX-priority heads-up notification when native present fails', async () => {
    nativeStub.present.mockReturnValue(false);
    const service = loadService();
    await service.presentOrderAlarm(CONTENT);

    expect(ensurePickupNotificationChannel).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: CONTENT.title,
          priority: 'max',
          data: { type: 'pickup_order', orderId: CONTENT.orderId },
        }),
        trigger: null,
      })
    );
  });

  it('degrades gracefully when the native module is absent (Expo Go)', async () => {
    requireNativeMock.mockImplementation(() => {
      throw new Error('Cannot find native module OrderAlarm');
    });
    const service = loadService();
    await service.presentOrderAlarm(CONTENT);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('is a no-op on non-Android platforms', async () => {
    (Platform as { OS: string }).OS = 'ios';
    const service = loadService();
    await service.presentOrderAlarm(CONTENT);

    expect(nativeStub.present).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('dismissOrderAlarm', () => {
  it('cancels through the native engine when available', async () => {
    const service = loadService();
    await service.dismissOrderAlarm();

    expect(nativeStub.dismiss).toHaveBeenCalled();
    expect(Notifications.dismissAllNotificationsAsync).not.toHaveBeenCalled();
  });

  it('falls back to dismissing notifications without the native module', async () => {
    requireNativeMock.mockImplementation(() => {
      throw new Error('missing');
    });
    const service = loadService();
    await service.dismissOrderAlarm();

    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
  });
});

describe('continuous alarm loop', () => {
  it('starts the native gapless loop with the configured tone', () => {
    const service = loadService();
    expect(service.startOrderAlarmLoop('loud_alarm')).toBe(true);
    expect(nativeStub.startLoop).toHaveBeenCalledWith('loud_alarm');
  });

  it('reports failure so callers can fall back to expo-audio', () => {
    nativeStub.startLoop.mockReturnValue(false);
    const service = loadService();
    expect(service.startOrderAlarmLoop('loud_alarm')).toBe(false);
  });

  it('reports failure when the native module is absent or throws', () => {
    requireNativeMock.mockImplementation(() => {
      throw new Error('missing');
    });
    const service = loadService();
    expect(service.startOrderAlarmLoop('loud_alarm')).toBe(false);
    expect(service.stopOrderAlarmLoop()).toBeUndefined();
  });

  it('stops the native loop without touching notifications', () => {
    const service = loadService();
    service.stopOrderAlarmLoop();
    expect(nativeStub.stopLoop).toHaveBeenCalled();
    expect(Notifications.dismissAllNotificationsAsync).not.toHaveBeenCalled();
  });

  it('swallows native start/stop errors', () => {
    nativeStub.startLoop.mockImplementation(() => {
      throw new Error('MediaPlayer failure');
    });
    nativeStub.stopLoop.mockImplementation(() => {
      throw new Error('already released');
    });
    const service = loadService();
    expect(service.startOrderAlarmLoop('loud_alarm')).toBe(false);
    expect(() => service.stopOrderAlarmLoop()).not.toThrow();
  });
});

describe('full-screen intent access', () => {
  it('maps the native capability check', () => {
    const service = loadService();
    expect(service.checkFullScreenIntentAccess()).toBe('granted');

    nativeStub.canUseFullScreenIntent.mockReturnValue(false);
    expect(service.checkFullScreenIntentAccess()).toBe('needs-settings');
  });

  it('reports unsupported without the native module', () => {
    requireNativeMock.mockImplementation(() => {
      throw new Error('missing');
    });
    const service = loadService();
    expect(service.checkFullScreenIntentAccess()).toBe('unsupported');
    expect(service.openFullScreenIntentSettings()).toBe(false);
  });

  it('opens the system full-screen notification settings page', () => {
    const service = loadService();
    expect(service.openFullScreenIntentSettings()).toBe(true);
    expect(nativeStub.openFullScreenIntentSettings).toHaveBeenCalled();
  });
});