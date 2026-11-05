jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: false,
  pb: {
    files: {
      getURL: (
        record: { id: string; collectionName?: string },
        filename: string
      ) =>
        `https://pb.test/api/files/${record.collectionName ?? 'menu_items'}/${record.id}/${filename}`,
    },
  },
}));

import type { RecordModel } from 'pocketbase';
import {
  isPocketBaseFileUrl,
  mapBranchSettingsRecord,
  mapMenuRecord,
  mapOrderRecord,
  mapStoreConfigRecord,
  toBranchSettingsRecord,
  toMenuItemRecord,
  toOrderRecord,
  toStoreRecord,
} from '../src/services/mappers';
import {
  createDefaultStoreConfig,
  createDefaultTerminalSettings,
  createSeedMenu,
  createSeedOrders,
} from '../src/lib/seed';
import { MenuItem, StoreOperationsConfig, TerminalSettings } from '../src/types';

const NOW = Date.parse('2026-01-01T12:00:00.000Z');

function asRecord(fields: Record<string, unknown>): RecordModel {
  return {
    id: 'record000000001',
    collectionId: 'collection00001',
    collectionName: 'branch_settings',
    created: '2026-01-01 10:00:00.000Z',
    updated: '2026-01-01 10:00:00.000Z',
    ...fields,
  } as unknown as RecordModel;
}

describe('menu record mapping', () => {
  it('prefers the uploaded PocketBase file over a legacy external URL', () => {
    const item = mapMenuRecord(
      asRecord({
        collectionName: 'menu_items',
        branch_id: 'branch_dt_01',
        name: 'Truffle Double',
        category: 'Burgers',
        description: 'Two smashed patties',
        price: 14.5,
        currency: 'PLN',
        in_stock: false,
        is_visible: true,
        prep_minutes: 12,
        image: 'dish_abc123.png',
        image_url: 'https://cdn.example/legacy.jpg',
        modifiers: ['No onion'],
      })
    );

    expect(item.imageUrl).toBe(
      'https://pb.test/api/files/menu_items/record000000001/dish_abc123.png'
    );
    expect(item.inStock).toBe(false);
    expect(item.preparationMinutes).toBe(12);
    expect(item.modifiers).toEqual(['No onion']);
  });

  it('falls back to the external image_url when no file was uploaded', () => {
    const item = mapMenuRecord(
      asRecord({
        collectionName: 'menu_items',
        image: '',
        image_url: 'https://cdn.example/dish.jpg',
      })
    );

    expect(item.imageUrl).toBe('https://cdn.example/dish.jpg');
  });

  it('never writes local or PocketBase file URLs into image_url', () => {
    const base = createSeedMenu(NOW)[0] as MenuItem;

    expect(
      toMenuItemRecord({ ...base, imageUrl: 'file:///data/dish.jpg' }).image_url
    ).toBe('');
    expect(
      toMenuItemRecord({
        ...base,
        imageUrl: 'https://pb.test/api/files/menu_items/record/dish.jpg',
      }).image_url
    ).toBe('');
    expect(
      toMenuItemRecord({
        ...base,
        imageUrl: 'https://cdn.example/storefront.jpg',
      }).image_url
    ).toBe('https://cdn.example/storefront.jpg');
  });

  it('detects PocketBase file URLs', () => {
    expect(
      isPocketBaseFileUrl(
        'https://pb.test/api/files/menu_items/record/dish_123.jpg'
      )
    ).toBe(true);
    expect(isPocketBaseFileUrl('https://cdn.example/dish.jpg')).toBe(false);
    expect(isPocketBaseFileUrl(undefined)).toBe(false);
  });
});

describe('branch settings mapping', () => {
  function customFixtures(): {
    settings: TerminalSettings;
    config: StoreOperationsConfig;
  } {
    const defaults = createDefaultTerminalSettings();
    const settings: TerminalSettings = {
      ...defaults,
      smtp: {
        host: 'smtp.example.test',
        port: '465',
        username: 'terminal@example.test',
        password: 'super-secret',
        encryption: 'SSL',
        fromEmail: 'orders@example.test',
        fromName: 'Example Dispatch',
      },
      notifications: {
        active: false,
        recipients: ['ops@example.test', 'manager@example.test'],
      },
      deliveryUrls: {
        web: 'https://order.example.test',
        wolt: 'https://wolt.example.test/store',
        glovo: 'https://glovo.example.test/store',
        pyszne: 'https://pyszne.example.test/store',
        uberEats: 'https://ubereats.example.test/store',
      },
      alertToneId: 'urgent_pulse',
      soundAlertsEnabled: false,
      branchName: 'Uptown Bistro',
      pocketbaseBranchId: 'branch_ub_02',
      staff: [
        {
          id: 'staff_9',
          name: 'Nina Patel',
          email: 'nina@example.test',
          role: 'kitchen_lead',
        },
      ],
    };
    const config: StoreOperationsConfig = {
      ...createDefaultStoreConfig(),
      isOpenForOrders: false,
      acceptingReservations: false,
      slotIntervalMinutes: 45,
    };
    return { settings, config };
  }

  it('round-trips settings, SMTP, recipients, delivery URLs and hours', () => {
    const { settings, config } = customFixtures();
    const record = asRecord({
      ...toStoreRecord(config),
      ...toBranchSettingsRecord(settings),
    });

    const mapped = mapBranchSettingsRecord(record);

    expect(mapped.settings.smtp).toEqual(settings.smtp);
    expect(mapped.settings.notifications).toEqual(settings.notifications);
    expect(mapped.settings.deliveryUrls).toEqual(settings.deliveryUrls);
    expect(mapped.settings.alertToneId).toBe('urgent_pulse');
    expect(mapped.settings.soundAlertsEnabled).toBe(false);
    expect(mapped.settings.staff).toEqual(settings.staff);
    expect(mapped.settings.branchName).toBe('Uptown Bistro');
    expect(mapped.settings.pocketbaseBranchId).toBe('branch_ub_02');
    expect(mapped.config).toEqual(config);
  });

  it('accepts JSON-stringified JSON fields from older PocketBase rows', () => {
    const { settings, config } = customFixtures();
    const record = asRecord({
      ...toStoreRecord(config),
      ...toBranchSettingsRecord(settings),
      notification_recipients: JSON.stringify(settings.notifications.recipients),
      staff_roster: JSON.stringify(settings.staff),
      weekly_schedule: JSON.stringify(config.weeklySchedule),
    });

    const mapped = mapBranchSettingsRecord(record);

    expect(mapped.settings.notifications.recipients).toEqual(
      settings.notifications.recipients
    );
    expect(mapped.settings.staff).toEqual(settings.staff);
    expect(mapped.config.weeklySchedule).toEqual(config.weeklySchedule);
  });

  it('round-trips storefront contact, social, fees and the event router', () => {
    const { settings, config } = customFixtures();
    const withStorefront = {
      ...settings,
      contact: {
        addressLine1: '12 Market Street',
        addressLine2: 'Springfield, IL 62701',
        phone: '+1 217 555 0142',
        email: 'hello@example.test',
      },
      social: {
        facebookHandle: '@bbmanager',
        facebookUrl: 'https://facebook.com/bbmanager',
        instagramHandle: '@bbmanager',
        instagramUrl: 'https://instagram.com/bbmanager',
      },
      fees: { takeout: 3.5, packaging: 1.25, deliveryPerKm: 6 },
      notificationRoutes: {
        'order.pickup.ready': { enabled: true, recipients: ['kitchen@example.test'] },
        'menu.item.low_stock': { enabled: false, recipients: [] },
      },
    };

    const record = asRecord({
      ...toStoreRecord(config),
      ...toBranchSettingsRecord(withStorefront),
    });

    const mapped = mapBranchSettingsRecord(record);

    expect(mapped.settings.contact).toEqual(withStorefront.contact);
    expect(mapped.settings.social).toEqual(withStorefront.social);
    expect(mapped.settings.fees).toEqual(withStorefront.fees);
    expect(mapped.settings.notificationRoutes).toEqual(withStorefront.notificationRoutes);
  });

  it('reads the legacy bare-list route shape as enabled', () => {
    const { settings, config } = customFixtures();
    const record = asRecord({
      ...toStoreRecord(config),
      ...toBranchSettingsRecord(settings),
      notification_routes: {
        'order.pickup.submitted': ['legacy@example.test'],
        'order.pickup.ready': { enabled: true, recipients: ['kitchen@example.test'] },
      },
    });

    const mapped = mapBranchSettingsRecord(record);

    expect(mapped.settings.notificationRoutes['order.pickup.submitted']).toEqual({
      enabled: true,
      recipients: ['legacy@example.test'],
    });
    expect(mapped.settings.notificationRoutes['order.pickup.ready']).toEqual({
      enabled: true,
      recipients: ['kitchen@example.test'],
    });
  });

  it('accepts notification routes delivered as a JSON string', () => {
    const { settings, config } = customFixtures();
    const record = asRecord({
      ...toStoreRecord(config),
      ...toBranchSettingsRecord(settings),
      notification_routes: JSON.stringify({
        'shop.availability.manual_closed': {
          enabled: true,
          recipients: ['owner@example.test'],
        },
      }),
    });

    const mapped = mapBranchSettingsRecord(record);

    expect(mapped.settings.notificationRoutes['shop.availability.manual_closed']).toEqual({
      enabled: true,
      recipients: ['owner@example.test'],
    });
  });

  it('maps only the operating schedule without overwriting terminal settings', () => {
    const config = {
      ...createDefaultStoreConfig(),
      acceptingReservations: false,
      openingTime: '08:00 AM',
      closingTime: '09:00 PM',
    };

    expect(mapStoreConfigRecord(asRecord(toStoreRecord(config)))).toEqual(config);
  });
});

describe('order rejection mapping', () => {
  it('reads the rejection reason from a PocketBase order', () => {
    const order = mapOrderRecord(
      asRecord({
        collectionName: 'orders',
        branch_id: 'branch_dt_01',
        order_number: 'R1',
        customer_name: 'Guest',
        customer_phone: '',
        status: 'cancelled',
        items: [],
        total_amount: 10,
        pickup_code: 'P1',
        channel: 'online',
        cancellation_reason: 'Item currently out of stock',
      })
    );

    expect(order.cancellationReason).toBe('Item currently out of stock');
  });

  it('writes the rejection reason back to a PocketBase order payload', () => {
    const base = createSeedOrders(NOW)[0]!;

    expect(
      toOrderRecord({
        ...base,
        status: 'cancelled',
        cancellationReason: 'Kitchen is too busy / overloaded',
      })
    ).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'Kitchen is too busy / overloaded',
    });
  });
});
