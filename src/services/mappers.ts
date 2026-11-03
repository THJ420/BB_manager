import type { RecordModel } from 'pocketbase';
import {
  Branch,
  DiningTable,
  MenuItem,
  Order,
  OrderChannel,
  OrderItem,
  OrderStatus,
  Reservation,
  ReservationStatus,
  StoreOperationsConfig,
  TerminalSettings,
} from '../types';
import { createDefaultStoreConfig, createDefaultTerminalSettings } from '../lib/seed';
import {
  normalizeStaffRoster,
  normalizeTerminalSettings,
  normalizeWeeklySchedule,
  parseStringArray,
} from '../lib/settings';
import { pb } from './pocketbase';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

const ORDER_STATUSES: OrderStatus[] = ['new', 'preparing', 'ready', 'completed', 'cancelled'];

export function normalizeOrderStatus(value: unknown): OrderStatus {
  const normalized = asString(value, 'new').toLowerCase();
  return ORDER_STATUSES.find((status) => status === normalized) ?? 'new';
}

const RESERVATION_STATUSES: ReservationStatus[] = [
  'upcoming',
  'arrived',
  'seated',
  'completed',
  'cancelled',
];

export function normalizeReservationStatus(value: unknown): ReservationStatus {
  const normalized = asString(value, 'upcoming').toLowerCase();
  return RESERVATION_STATUSES.find((status) => status === normalized) ?? 'upcoming';
}

function parseOrderItems(raw: unknown): OrderItem[] {
  const source = parseJson(raw);
  if (!Array.isArray(source)) return [];
  return source.flatMap((entry, index): OrderItem[] => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    return [
      {
        id: asString(record.id, `item_${index}`),
        name: asString(record.name, 'Menu item'),
        quantity: asNumber(record.quantity, 1),
        unitPrice: asNumber(record.unitPrice ?? record.unit_price, 0),
        specialInstructions:
          typeof record.specialInstructions === 'string'
            ? record.specialInstructions
            : undefined,
      },
    ];
  });
}

function parseModifiers(raw: unknown): string[] | undefined {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter((value): value is string => typeof value === 'string');
}

function primaryFileName(value: unknown): string {
  if (Array.isArray(value)) {
    return value.find((entry): entry is string => typeof entry === 'string') ?? '';
  }
  return asString(value);
}

export function mapOrderRecord(record: RecordModel): Order {
  const channel: OrderChannel = record.channel === 'walk_in' ? 'walk_in' : 'online';
  return {
    id: record.id,
    orderNumber: asString(record.order_number, record.id.slice(-3)),
    branchId: asString(record.branch_id),
    customerName: asString(record.customer_name, 'Guest'),
    customerPhone: asString(record.customer_phone),
    status: normalizeOrderStatus(record.status),
    items: parseOrderItems(record.items),
    totalAmount: asNumber(record.total_amount),
    createdAt: asString(record.created, new Date().toISOString()),
    readyAt: asString(record.ready_at) || undefined,
    completedAt: asString(record.completed_at) || undefined,
    estimatedPickupAt: asString(record.estimated_pickup_at) || undefined,
    pickupCode: asString(record.pickup_code),
    notes: asString(record.notes) || undefined,
    channel,
    cancellationReason: asString(record.cancellation_reason) || undefined,
  };
}

export function mapMenuRecord(record: RecordModel): MenuItem {
  const imageFile = primaryFileName(record.image);
  const imageUrl =
    (imageFile ? pb.files.getURL(record, imageFile) : '') ||
    asString(record.image_url) ||
    undefined;

  return {
    id: record.id,
    branchId: asString(record.branch_id),
    name: asString(record.name, 'Untitled item'),
    category: asString(record.category, 'Burgers'),
    description: asString(record.description),
    price: asNumber(record.price),
    currency: asString(record.currency, 'PLN'),
    inStock: asBoolean(record.in_stock, true),
    isVisible: asBoolean(record.is_visible, true),
    preparationMinutes: asNumber(record.prep_minutes, 10),
    imageUrl,
    modifiers: parseModifiers(record.modifiers),
    updatedAt: asString(record.updated, new Date().toISOString()),
  };
}

export function mapTableRecord(record: RecordModel): DiningTable {
  return {
    id: record.id,
    branchId: asString(record.branch_id),
    tableNumber: asString(record.table_number, record.id.slice(-4)),
    name: asString(record.name, 'Dining table'),
    capacity: asNumber(record.capacity, 2),
    isAvailable: asBoolean(record.is_available, true),
    zone: asString(record.zone, 'Main Dining'),
  };
}

export function mapReservationRecord(record: RecordModel): Reservation {
  return {
    id: record.id,
    branchId: asString(record.branch_id),
    customerName: asString(record.customer_name, 'Guest'),
    customerPhone: asString(record.customer_phone),
    guestCount: asNumber(record.guest_count, 1),
    reservationTime: asString(record.reservation_time),
    tableNumber: asString(record.table_number) || undefined,
    status: normalizeReservationStatus(record.status),
    specialRequests: asString(record.special_requests) || undefined,
  };
}

export function mapBranchRecord(record: RecordModel): Branch {
  return {
    id: record.id,
    name: asString(record.name, 'Restaurant Branch'),
    code: asString(record.code, record.id.slice(-5).toUpperCase()),
    address: asString(record.address),
    phone: asString(record.phone),
    isActive: asBoolean(record.is_active, true),
  };
}

export function mapStoreConfigRecord(record: RecordModel): StoreOperationsConfig {
  const fallback = createDefaultStoreConfig();
  return {
    isOpenForOrders: asBoolean(record.is_open_for_orders, fallback.isOpenForOrders),
    openingTime: asString(record.opening_time, fallback.openingTime),
    closingTime: asString(record.closing_time, fallback.closingTime),
    slotIntervalMinutes: asNumber(record.slot_interval_minutes, fallback.slotIntervalMinutes),
    acceptingPickups: asBoolean(record.accepting_pickups, fallback.acceptingPickups),
    acceptingReservations: asBoolean(
      record.accepting_reservations,
      fallback.acceptingReservations
    ),
    weeklySchedule: normalizeWeeklySchedule(
      record.weekly_schedule,
      fallback.weeklySchedule
    ),
  };
}

export function mapBranchSettingsRecord(
  record: RecordModel,
  defaults: TerminalSettings = createDefaultTerminalSettings()
): { config: StoreOperationsConfig; settings: TerminalSettings } {
  const recipients =
    parseStringArray(record.notification_recipients) ?? defaults.notifications.recipients;
  const staff = normalizeStaffRoster(record.staff_roster);

  const settings = normalizeTerminalSettings(
    {
      smtp: {
        host: asString(record.smtp_host, defaults.smtp.host),
        port: asString(record.smtp_port, defaults.smtp.port),
        username: asString(record.smtp_username, defaults.smtp.username),
        password: asString(record.smtp_password, defaults.smtp.password),
        encryption: asString(
          record.smtp_encryption,
          defaults.smtp.encryption
        ) as TerminalSettings['smtp']['encryption'],
        fromEmail: asString(record.smtp_from_email, defaults.smtp.fromEmail),
        fromName: asString(record.smtp_from_name, defaults.smtp.fromName),
      },
      notifications: {
        active: asBoolean(record.notifications_active, defaults.notifications.active),
        recipients,
      },
      deliveryUrls: {
        web: asString(record.delivery_web_url, defaults.deliveryUrls.web),
        wolt: asString(record.delivery_wolt_url, defaults.deliveryUrls.wolt),
        glovo: asString(record.delivery_glovo_url, defaults.deliveryUrls.glovo),
        pyszne: asString(record.delivery_pyszne_url, defaults.deliveryUrls.pyszne),
        uberEats: asString(record.delivery_uber_eats_url, defaults.deliveryUrls.uberEats),
      },
      alertToneId: record.alert_tone_id as TerminalSettings['alertToneId'],
      soundAlertsEnabled: asBoolean(
        record.sound_alerts_enabled,
        defaults.soundAlertsEnabled
      ),
      branchName: asString(record.branch_name, defaults.branchName),
      pocketbaseBranchId: asString(record.branch_id, defaults.pocketbaseBranchId),
      staff: staff ?? defaults.staff,
    },
    defaults
  );

  return {
    config: mapStoreConfigRecord(record),
    settings,
  };
}

/** Outbound shapes for the offline outbox flush. */
export function toOrderRecord(order: Order): Record<string, unknown> {
  return {
    order_number: order.orderNumber,
    branch_id: order.branchId,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    status: order.status,
    items: order.items,
    total_amount: order.totalAmount,
    pickup_code: order.pickupCode,
    notes: order.notes ?? '',
    channel: order.channel,
    cancellation_reason: order.cancellationReason ?? '',
    ready_at: order.readyAt ?? '',
    completed_at: order.completedAt ?? '',
    estimated_pickup_at: order.estimatedPickupAt ?? '',
  };
}

export function isLocalImageUri(uri: string | undefined): boolean {
  if (!uri) return false;
  return /^(file|content|ph|assets-library|blob|data):/i.test(uri);
}

/**
 * PocketBase returns uploaded files through its `/api/files/` URL. Those URLs
 * belong to the `image` file field, not the `image_url` text field, so they
 * must never be written back as an external storefront image URL.
 */
export function isPocketBaseFileUrl(uri: string | undefined): boolean {
  return Boolean(uri && /\/api\/files\//i.test(uri));
}

export function toMenuItemRecord(item: MenuItem): Record<string, unknown> {
  const localImage = isLocalImageUri(item.imageUrl);
  const externalImage =
    item.imageUrl && !localImage && !isPocketBaseFileUrl(item.imageUrl)
      ? item.imageUrl
      : '';
  return {
    branch_id: item.branchId,
    name: item.name,
    category: item.category,
    description: item.description,
    price: item.price,
    currency: 'PLN',
    in_stock: item.inStock,
    is_visible: item.isVisible,
    prep_minutes: item.preparationMinutes,
    image_url: externalImage,
    modifiers: item.modifiers ?? [],
  };
}

export function toTableRecord(table: DiningTable): Record<string, unknown> {
  return {
    branch_id: table.branchId,
    table_number: table.tableNumber,
    name: table.name,
    capacity: table.capacity,
    is_available: table.isAvailable,
    zone: table.zone,
  };
}

export function toStoreRecord(config: StoreOperationsConfig): Record<string, unknown> {
  return {
    is_open_for_orders: config.isOpenForOrders,
    opening_time: config.openingTime,
    closing_time: config.closingTime,
    slot_interval_minutes: config.slotIntervalMinutes,
    accepting_pickups: config.acceptingPickups,
    accepting_reservations: config.acceptingReservations,
    weekly_schedule: config.weeklySchedule,
  };
}

export function toBranchSettingsRecord(
  settings: TerminalSettings
): Record<string, unknown> {
  return {
    branch_id: settings.pocketbaseBranchId,
    branch_name: settings.branchName,
    smtp_host: settings.smtp.host,
    smtp_port: settings.smtp.port,
    smtp_username: settings.smtp.username,
    smtp_password: settings.smtp.password,
    smtp_encryption: settings.smtp.encryption,
    smtp_from_email: settings.smtp.fromEmail,
    smtp_from_name: settings.smtp.fromName,
    notifications_active: settings.notifications.active,
    notification_recipients: settings.notifications.recipients,
    delivery_web_url: settings.deliveryUrls.web,
    delivery_wolt_url: settings.deliveryUrls.wolt,
    delivery_glovo_url: settings.deliveryUrls.glovo,
    delivery_pyszne_url: settings.deliveryUrls.pyszne,
    delivery_uber_eats_url: settings.deliveryUrls.uberEats,
    alert_tone_id: settings.alertToneId,
    sound_alerts_enabled: settings.soundAlertsEnabled,
    staff_roster: settings.staff,
  };
}
