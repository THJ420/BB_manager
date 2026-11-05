/**
 * The 30 operational notification events exposed by the Laravel backends.
 *
 * Keys are the exact dotted strings persisted in `branch_settings
 * .notification_routes` and read by App\Support\NotificationCatalog. Renaming a
 * key here silently disables that alert on the website, so treat this file as a
 * contract rather than a label list.
 */
export interface NotificationEventDefinition {
  key: string;
  label: string;
  description: string;
}

export interface NotificationEventCategory {
  id: string;
  title: string;
  /** Short helper shown under the section title. */
  hint: string;
  events: NotificationEventDefinition[];
}

export const NOTIFICATION_EVENT_CATEGORIES: NotificationEventCategory[] = [
  {
    id: 'orders',
    title: 'Pickup & online ordering',
    hint: 'Everything that happens to a customer pickup order.',
    events: [
      {
        key: 'order.pickup.submitted',
        label: 'Order submitted',
        description: 'A customer placed a new pickup order on the website.',
      },
      {
        key: 'order.pickup.confirmed',
        label: 'Order confirmed',
        description: 'Staff acknowledged and accepted the order.',
      },
      {
        key: 'order.pickup.preparing',
        label: 'Order preparing',
        description: 'The kitchen started preparing the order.',
      },
      {
        key: 'order.pickup.ready',
        label: 'Order ready',
        description: 'The order is packed and waiting at the counter.',
      },
      {
        key: 'order.pickup.completed',
        label: 'Order collected',
        description: 'The customer collected the order.',
      },
      {
        key: 'order.pickup.cancelled_by_customer',
        label: 'Cancelled by customer',
        description: 'The customer cancelled before pickup.',
      },
      {
        key: 'order.pickup.rejected_by_staff',
        label: 'Rejected by staff',
        description: 'Staff rejected the order. The customer is emailed with the reason.',
      },
      {
        key: 'order.pickup.updated',
        label: 'Order modified',
        description: 'Items, pickup time or total changed after ordering.',
      },
      {
        key: 'order.pickup.delayed',
        label: 'Order running late',
        description: 'The pickup time passed while the order was still open.',
      },
    ],
  },
  {
    id: 'reservations',
    title: 'Table reservations',
    hint: 'Booking lifecycle for the dining room.',
    events: [
      {
        key: 'reservation.table.submitted',
        label: 'Reservation requested',
        description: 'A guest submitted a new table reservation.',
      },
      {
        key: 'reservation.table.confirmed',
        label: 'Reservation confirmed',
        description: 'The booking was confirmed by the restaurant.',
      },
      {
        key: 'reservation.table.modified',
        label: 'Reservation modified',
        description: 'Date, time or party size changed.',
      },
      {
        key: 'reservation.table.cancelled',
        label: 'Reservation cancelled',
        description: 'A table reservation was cancelled.',
      },
      {
        key: 'reservation.table.reminder',
        label: 'Arrival reminder',
        description: 'Pre-arrival reminder ahead of the booking.',
      },
      {
        key: 'reservation.table.no_show',
        label: 'No-show',
        description: 'The guest never arrived.',
      },
      {
        key: 'reservation.table.seated',
        label: 'Guest seated',
        description: 'The guest arrived and was checked in.',
      },
    ],
  },
  {
    id: 'availability',
    title: 'Store availability',
    hint: 'Opening, closing and schedule overrides.',
    events: [
      {
        key: 'shop.availability.manual_closed',
        label: 'Closed manually',
        description: 'Online ordering was switched off from the panel.',
      },
      {
        key: 'shop.availability.manual_opened',
        label: 'Opened manually',
        description: 'Online ordering was switched back on.',
      },
      {
        key: 'shop.availability.auto_opened',
        label: 'Opened automatically',
        description: 'The configured opening time was reached.',
      },
      {
        key: 'shop.availability.auto_closed',
        label: 'Closed automatically',
        description: 'The configured closing time was reached.',
      },
      {
        key: 'shop.availability.override_activated',
        label: 'Hours overridden',
        description: 'A holiday or special-hours schedule was saved.',
      },
    ],
  },
  {
    id: 'menu',
    title: 'Menu & inventory',
    hint: 'Availability and edits to the catalogue.',
    events: [
      {
        key: 'menu.item.low_stock',
        label: 'Sold out / low stock',
        description: 'An item was flagged unavailable.',
      },
      {
        key: 'menu.item.restocked',
        label: 'Restocked',
        description: 'A sold-out item was marked available again.',
      },
      {
        key: 'menu.item.created',
        label: 'Item created',
        description: 'A new item was added to the menu.',
      },
      {
        key: 'menu.item.updated',
        label: 'Item updated',
        description: 'Price, category or description changed.',
      },
    ],
  },
  {
    id: 'system',
    title: 'System health',
    hint: 'Failures, security and reporting.',
    events: [
      {
        key: 'system.sync.pocketbase_error',
        label: 'PocketBase sync failure',
        description: 'A push or webhook to PocketBase failed.',
      },
      {
        key: 'system.smtp.test_failed',
        label: 'SMTP test failed',
        description: 'The mail server rejected a test message.',
      },
      {
        key: 'system.auth.suspicious_login',
        label: 'Suspicious admin login',
        description: 'An admin signed in from a new IP address.',
      },
      {
        key: 'system.report.daily_summary',
        label: 'Daily summary',
        description: 'End-of-day sales, bookings and pickup totals.',
      },
      {
        key: 'system.deployment.refreshed',
        label: 'Deployment refreshed',
        description: 'A deployment applied migrations or cleared caches.',
      },
    ],
  },
];

/** Flat list of every event key, in catalog order. */
export const NOTIFICATION_EVENT_KEYS: string[] =
  NOTIFICATION_EVENT_CATEGORIES.flatMap((category) =>
    category.events.map((event) => event.key)
  );

export function notificationEventLabel(key: string): string {
  for (const category of NOTIFICATION_EVENT_CATEGORIES) {
    const match = category.events.find((event) => event.key === key);
    if (match) return match.label;
  }
  return key;
}
