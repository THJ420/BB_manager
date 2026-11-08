import {
  AlertToneId,
  ContactSettings,
  DayName,
  DaySchedule,
  DeliveryPlatformUrls,
  FeeSettings,
  NotificationRoute,
  NotificationSettings,
  SmtpEncryption,
  SmtpSettings,
  SocialSettings,
  StaffMember,
  StaffRole,
  TerminalSettings,
} from '../types';
import { isAlertToneId } from './alertTones';
import { createDefaultTerminalSettings } from './seed';

const DAY_NAMES: DayName[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const STAFF_ROLES: StaffRole[] = ['owner', 'manager', 'kitchen_lead', 'floor_staff'];
const SMTP_ENCRYPTIONS: SmtpEncryption[] = ['TLS', 'SSL', 'STARTTLS'];

/**
 * Cached/remote settings are normalized from a partial payload. Nested objects
 * are intentionally partial so a backend row that only stores a subset of
 * fields can still be merged over the terminal defaults.
 */
export interface TerminalSettingsInput
  extends Omit<
    Partial<TerminalSettings>,
    'smtp' | 'notifications' | 'deliveryUrls' | 'staff' | 'contact' | 'social' | 'fees' | 'notificationRoutes'
  > {
  smtp?: Partial<SmtpSettings>;
  notifications?: Partial<NotificationSettings>;
  deliveryUrls?: Partial<DeliveryPlatformUrls>;
  contact?: Partial<ContactSettings>;
  social?: Partial<SocialSettings>;
  fees?: Partial<FeeSettings>;
  notificationRoutes?: unknown;
  staff?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Normalise the per-event router stored in `branch_settings.notification_routes`.
 *
 * The backend persists `{ "order.pickup.ready": { enabled, recipients } }`, but a
 * record can also arrive as a JSON string or with the pre-30-event bare-list
 * shape. Unknown keys are preserved so a hand-added event is never dropped.
 */
export function normalizeNotificationRoutes(
  value: unknown
): Record<string, NotificationRoute> {
  let source = value;

  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return {};
    }
  }

  const out: Record<string, NotificationRoute> = {};

  for (const [key, raw] of Object.entries(asRecord(source))) {
    if (Array.isArray(raw)) {
      // Legacy shape: a bare list of addresses meant "enabled".
      const legacy = parseStringArray(raw) ?? [];
      if (legacy.length > 0) {
        out[key] = { enabled: true, recipients: legacy };
      }
      continue;
    }

    const route = asRecord(raw);

    out[key] = {
      enabled: route.enabled === true,
      recipients: parseStringArray(route.recipients) ?? [],
    };
  }

  return out;
}

export function normalizeStaffRole(value: unknown, fallback: StaffRole = 'floor_staff'): StaffRole {
  return STAFF_ROLES.find((role) => role === value) ?? fallback;
}

export function parseStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string');
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeStaffRoster(value: unknown): StaffMember[] | null {
  const source = parseStringArray(value) === null && typeof value === 'string'
    ? null
    : Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? (() => {
            try {
              const parsed: unknown = JSON.parse(value);
              return Array.isArray(parsed) ? parsed : null;
            } catch {
              return null;
            }
          })()
        : null;

  if (!source) return null;

  return source.flatMap((entry, index): StaffMember[] => {
    const record = asRecord(entry);
    const email = stringOr(record.email, '').trim();
    const name = stringOr(record.name, '').trim();
    if (!email || !name) return [];
    return [
      {
        id: stringOr(record.id, `staff_${index + 1}`),
        name,
        email,
        role: normalizeStaffRole(record.role),
      },
    ];
  });
}

export function normalizeWeeklySchedule(
  value: unknown,
  fallback: DaySchedule[]
): DaySchedule[] {
  let source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      source = null;
    }
  }
  const entries = Array.isArray(source) ? source : [];

  return fallback.map((fallbackDay) => {
    const match = entries
      .map(asRecord)
      .find((entry) => entry.day === fallbackDay.day);
    if (!match) return { ...fallbackDay };
    return {
      day: fallbackDay.day,
      isOpen: typeof match.isOpen === 'boolean' ? match.isOpen : fallbackDay.isOpen,
      openTime: stringOr(match.openTime, fallbackDay.openTime),
      closeTime: stringOr(match.closeTime, fallbackDay.closeTime),
    };
  });
}

export function normalizeTerminalSettings(
  cached: TerminalSettingsInput | null | undefined,
  defaults: TerminalSettings = createDefaultTerminalSettings()
): TerminalSettings {
  if (!cached) return defaults;

  const smtp = cached.smtp ?? {};
  const notifications = cached.notifications ?? {};
  const deliveryUrls = cached.deliveryUrls ?? {};
  const recipients = parseStringArray(notifications.recipients);
  const staff = normalizeStaffRoster(cached.staff);
  const alertToneId: AlertToneId = isAlertToneId(cached.alertToneId)
    ? cached.alertToneId
    : defaults.alertToneId;

  return {
    smtp: {
      host: stringOr(smtp.host, defaults.smtp.host),
      port: stringOr(smtp.port, defaults.smtp.port),
      username: stringOr(smtp.username, defaults.smtp.username),
      password: stringOr(smtp.password, defaults.smtp.password),
      encryption:
        SMTP_ENCRYPTIONS.find((value) => value === smtp.encryption) ??
        defaults.smtp.encryption,
      fromEmail: stringOr(smtp.fromEmail, defaults.smtp.fromEmail),
      fromName: stringOr(smtp.fromName, defaults.smtp.fromName),
    },
    notifications: {
      active:
        typeof notifications.active === 'boolean'
          ? notifications.active
          : defaults.notifications.active,
      recipients: recipients ?? defaults.notifications.recipients,
    },
    deliveryUrls: {
      web: stringOr(deliveryUrls.web, defaults.deliveryUrls.web),
      wolt: stringOr(deliveryUrls.wolt, defaults.deliveryUrls.wolt),
      glovo: stringOr(deliveryUrls.glovo, defaults.deliveryUrls.glovo),
      pyszne: stringOr(deliveryUrls.pyszne, defaults.deliveryUrls.pyszne),
      uberEats: stringOr(deliveryUrls.uberEats, defaults.deliveryUrls.uberEats),
    },
    alertToneId,
    soundAlertsEnabled:
      typeof cached.soundAlertsEnabled === 'boolean'
        ? cached.soundAlertsEnabled
        : defaults.soundAlertsEnabled,
    contact: {
      addressLine1: stringOr(cached.contact?.addressLine1, defaults.contact.addressLine1),
      addressLine2: stringOr(cached.contact?.addressLine2, defaults.contact.addressLine2),
      phone: stringOr(cached.contact?.phone, defaults.contact.phone),
      email: stringOr(cached.contact?.email, defaults.contact.email),
    },
    social: {
      facebookHandle: stringOr(cached.social?.facebookHandle, defaults.social.facebookHandle),
      facebookUrl: stringOr(cached.social?.facebookUrl, defaults.social.facebookUrl),
      instagramHandle: stringOr(cached.social?.instagramHandle, defaults.social.instagramHandle),
      instagramUrl: stringOr(cached.social?.instagramUrl, defaults.social.instagramUrl),
    },
    fees: {
      takeout: numberOr(cached.fees?.takeout, defaults.fees.takeout),
      packaging: numberOr(cached.fees?.packaging, defaults.fees.packaging),
      deliveryPerKm: numberOr(cached.fees?.deliveryPerKm, defaults.fees.deliveryPerKm),
    },
    notificationRoutes: normalizeNotificationRoutes(cached.notificationRoutes),
    branchName: stringOr(cached.branchName, defaults.branchName),
    pocketbaseBranchId: stringOr(
      cached.pocketbaseBranchId,
      defaults.pocketbaseBranchId
    ),
    staff: staff && staff.length > 0 ? staff : defaults.staff,
  };
}

/** Validates day names from an external 7-day schedule payload. */
export function isDayName(value: unknown): value is DayName {
  return DAY_NAMES.some((day) => day === value);
}
