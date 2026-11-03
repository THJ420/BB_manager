import { Colors } from '../theme/colors';
import { elapsedLabel, pickupCountdown } from './format';
import {
  DaySchedule,
  DiningTable,
  FilterChipOption,
  MenuItem,
  Order,
  OrderStatus,
  OutboxActionType,
  OutboxEntry,
  Reservation,
  ReservationStatus,
  StoreOperationsConfig,
} from '../types';

export type OrderFilter = 'all' | OrderStatus;

const ORDER_FILTER_DEFS: Array<{ id: OrderFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'completed', label: 'Completed' },
];

export function orderFilterOptions(orders: Order[]): Array<FilterChipOption<OrderFilter>> {
  return ORDER_FILTER_DEFS.map(({ id, label }) => ({
    id,
    label,
    count: id === 'all' ? orders.length : orders.filter((order) => order.status === id).length,
  }));
}

export function filterOrders(orders: Order[], filter: OrderFilter): Order[] {
  return filter === 'all' ? orders : orders.filter((order) => order.status === filter);
}

export function countActiveOrders(orders: Order[]): number {
  return orders.filter((order) => order.status === 'new' || order.status === 'preparing').length;
}

export interface OrderAction {
  next: OrderStatus;
  label: string;
  color: string;
  textColor: string;
}

/** Next kitchen-floor transition for an order ticket. */
export function orderAction(status: OrderStatus): OrderAction | null {
  switch (status) {
    case 'new':
      return {
        next: 'preparing',
        label: 'ACCEPT & START PREP',
        color: Colors.primary,
        textColor: Colors.white,
      };
    case 'preparing':
      return {
        next: 'ready',
        label: 'MARK READY FOR PICKUP',
        color: Colors.success,
        textColor: Colors.textInverse,
      };
    case 'ready':
      return {
        next: 'completed',
        label: 'COMPLETE PICKUP HANDOFF',
        color: Colors.slateDark,
        textColor: Colors.white,
      };
    default:
      return null;
  }
}

export interface StatusBadgeStyle {
  background: string;
  foreground: string;
  label: string;
}

export function orderStatusBadge(status: OrderStatus): StatusBadgeStyle {
  switch (status) {
    case 'new':
      return { background: Colors.infoMuted, foreground: Colors.info, label: 'NEW' };
    case 'preparing':
      return { background: Colors.warningMuted, foreground: Colors.warning, label: 'PREPARING' };
    case 'ready':
      return { background: Colors.successMuted, foreground: Colors.success, label: 'READY' };
    case 'completed':
      return {
        background: Colors.surfaceHighlight,
        foreground: Colors.textSecondary,
        label: 'COMPLETED',
      };
    case 'cancelled':
      return { background: Colors.errorMuted, foreground: Colors.error, label: 'CANCELLED' };
  }
}

export function orderTiming(order: Order, now: number) {
  return {
    elapsed: elapsedLabel(order.createdAt, now),
    countdown: pickupCountdown(order.estimatedPickupAt, now),
  };
}

export const MENU_CATEGORIES = ['Burgers', 'Sides', 'Beverages', 'Desserts'] as const;

export function menuCategoryOptions(items: MenuItem[]): Array<FilterChipOption<string>> {
  const categories = ['All', ...MENU_CATEGORIES];
  return categories.map((category) => ({
    id: category,
    label: category,
    count:
      category === 'All'
        ? items.length
        : items.filter((item) => item.category.toLowerCase() === category.toLowerCase()).length,
  }));
}

export function filterMenu(items: MenuItem[], category: string, query: string): MenuItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesCategory =
      category === 'All' || item.category.toLowerCase() === category.toLowerCase();
    const matchesQuery =
      needle.length === 0 ||
      item.name.toLowerCase().includes(needle) ||
      item.description.toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  });
}

export function nextOrderNumber(orders: Order[]): string {
  const highest = orders.reduce((max, order) => {
    const numeric = Number.parseInt(order.orderNumber, 10);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 207);
  return String(highest + 1);
}

const SIMULATED_CUSTOMERS = ['Chloe Zhang', 'James Miller', 'Maya Lin', 'Liam Davis'];

/** Builds the deterministic shape of a new online pickup ticket. */
export function buildSimulatedOrder(
  orders: Order[],
  branchId: string,
  now: number,
  random: () => number = Math.random
): Order {
  const orderNumber = nextOrderNumber(orders);
  const items = [
    { id: 'i_sim1', name: 'Smash Truffle Double Burger', quantity: 1, unitPrice: 14.0 },
    { id: 'i_sim2', name: 'House Mango Iced Tea', quantity: 1, unitPrice: 4.25 },
    { id: 'i_sim3', name: 'Parmesan Herb Crinkle Fries', quantity: 1, unitPrice: 6.5 },
  ];
  const customerIndex = Math.min(
    SIMULATED_CUSTOMERS.length - 1,
    Math.floor(random() * SIMULATED_CUSTOMERS.length)
  );
  const pickupDigits = 1000 + Math.floor(random() * 9000);
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return {
    id: `ord_${orderNumber}`,
    orderNumber,
    branchId,
    customerName: SIMULATED_CUSTOMERS[customerIndex] ?? 'Walk-in Guest',
    customerPhone: `+1 (555) 901-55${Number.parseInt(orderNumber, 10) % 100}`,
    status: 'new',
    pickupCode: String(pickupDigits),
    totalAmount: Math.round(total * 100) / 100,
    createdAt: new Date(now).toISOString(),
    estimatedPickupAt: new Date(now + 18 * 60_000).toISOString(),
    notes: 'Local pickup counter request',
    channel: 'online',
    items,
  };
}

export type ReservationFilter = 'all' | ReservationStatus;

const RESERVATION_FILTER_DEFS: Array<{ id: ReservationFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'seated', label: 'Seated' },
];

export function reservationFilterOptions(
  reservations: Reservation[]
): Array<FilterChipOption<ReservationFilter>> {
  return RESERVATION_FILTER_DEFS.map(({ id, label }) => ({
    id,
    label,
    count:
      id === 'all'
        ? reservations.length
        : reservations.filter((reservation) => reservation.status === id).length,
  }));
}

export function filterReservations(
  reservations: Reservation[],
  filter: ReservationFilter
): Reservation[] {
  return filter === 'all'
    ? reservations
    : reservations.filter((reservation) => reservation.status === filter);
}

export function reservationStatusBadge(status: ReservationStatus): StatusBadgeStyle {
  switch (status) {
    case 'upcoming':
      return { background: Colors.infoMuted, foreground: Colors.info, label: 'UPCOMING' };
    case 'arrived':
      return {
        background: Colors.warningMuted,
        foreground: Colors.warning,
        label: 'ARRIVED IN LOBBY',
      };
    case 'seated':
      return { background: Colors.successMuted, foreground: Colors.success, label: 'SEATED' };
    case 'completed':
      return {
        background: Colors.surfaceHighlight,
        foreground: Colors.textSecondary,
        label: 'COMPLETED',
      };
    case 'cancelled':
      return { background: Colors.errorMuted, foreground: Colors.error, label: 'CANCELLED' };
  }
}

/** Arrival is the only floor action on the view-only reservations ledger. */
export function arrivalTarget(status: ReservationStatus): ReservationStatus | null {
  if (status === 'upcoming') return 'arrived';
  if (status === 'arrived') return 'upcoming';
  return null;
}

export function filterLedger(
  orders: Order[],
  filter: OrderFilter,
  query: string
): Order[] {
  const needle = query.trim().replace(/^#/, '').toLowerCase();
  return orders.filter((order) => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesQuery =
      needle.length === 0 ||
      order.orderNumber.toLowerCase().includes(needle) ||
      order.customerName.toLowerCase().includes(needle) ||
      order.pickupCode.includes(needle);
    return matchesFilter && matchesQuery;
  });
}

export function tableCapacityLabel(capacity: number): string {
  return `${capacity} ${capacity === 1 ? 'guest' : 'guests'}`;
}

export function storeHoursSummary(config: StoreOperationsConfig): string {
  const openDays = config.weeklySchedule.filter((day) => day.isOpen);
  if (openDays.length === 0) return 'No open days configured';
  const first = openDays[0] as DaySchedule;
  return `${first.openTime} – ${first.closeTime} · ${openDays.length} days/week`;
}

let outboxSequence = 0;

export function buildOutboxEntry(
  actionType: OutboxActionType,
  label: string,
  payload: Record<string, unknown>,
  now: number = Date.now()
): OutboxEntry {
  outboxSequence += 1;
  return {
    id: `act_${now}_${outboxSequence}`,
    actionType,
    label,
    payload,
    createdAt: now,
    retryCount: 0,
    synced: false,
  };
}

function outboxEntrySequence(entry: OutboxEntry): number {
  const match = /_(\d+)$/.exec(entry.id);
  return match ? Number(match[1]) : 0;
}

/**
 * The UI stores outbox actions newest-first so the audit list reads naturally.
 * PocketBase must receive them oldest-first, otherwise a dependent update can
 * run before its create (or a stale order status can overwrite a newer one).
 */
export function sortOutboxChronologically(entries: OutboxEntry[]): OutboxEntry[] {
  return [...entries].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return outboxEntrySequence(a) - outboxEntrySequence(b);
  });
}

export function nextTableNumber(tables: DiningTable[]): string {
  return `tbl_${tables.length + 1}`.padStart(4, '0');
}
