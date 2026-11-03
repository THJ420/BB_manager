import {
  arrivalTarget,
  buildOutboxEntry,
  buildSimulatedOrder,
  filterLedger,
  filterMenu,
  filterOrders,
  nextOrderNumber,
  orderAction,
  orderFilterOptions,
  sortOutboxChronologically,
  tableCapacityLabel,
} from '../src/lib/domain';
import { createSeedMenu, createSeedOrders } from '../src/lib/seed';

const NOW = Date.parse('2026-01-01T12:00:00.000Z');

describe('order filters', () => {
  const orders = createSeedOrders(NOW);

  it('counts every status bucket', () => {
    const options = orderFilterOptions(orders);
    expect(options.map((option) => option.label)).toEqual([
      'All',
      'New',
      'Preparing',
      'Ready',
      'Completed',
    ]);
    expect(options[0]?.count).toBe(4);
    expect(options[1]?.count).toBe(1);
    expect(options[2]?.count).toBe(1);
    expect(options[3]?.count).toBe(1);
    expect(options[4]?.count).toBe(1);
  });

  it('filters tickets by status', () => {
    expect(filterOrders(orders, 'all')).toHaveLength(4);
    expect(filterOrders(orders, 'ready').map((order) => order.orderNumber)).toEqual(['206']);
    expect(filterOrders(orders, 'cancelled')).toHaveLength(0);
  });
});

describe('order transitions', () => {
  it('advances new → preparing → ready → completed with explicit labels', () => {
    expect(orderAction('new')).toMatchObject({
      next: 'preparing',
      label: 'ACCEPT & START PREP',
    });
    expect(orderAction('preparing')).toMatchObject({
      next: 'ready',
      label: 'MARK READY FOR PICKUP',
    });
    expect(orderAction('ready')).toMatchObject({
      next: 'completed',
      label: 'COMPLETE PICKUP HANDOFF',
    });
    expect(orderAction('completed')).toBeNull();
    expect(orderAction('cancelled')).toBeNull();
  });

  it('increments the highest numeric ticket', () => {
    expect(nextOrderNumber(createSeedOrders(NOW))).toBe('208');
    expect(nextOrderNumber([])).toBe('208');
  });

  it('builds a deterministic simulated ticket', () => {
    const orders = createSeedOrders(NOW);
    const order = buildSimulatedOrder(orders, 'branch_dt_01', NOW, () => 0.5);

    expect(order.orderNumber).toBe('208');
    expect(order.id).toBe('ord_208');
    expect(order.status).toBe('new');
    expect(order.pickupCode).toMatch(/^\d{4}$/);
    expect(order.totalAmount).toBe(24.75);
    expect(order.estimatedPickupAt).toBe('2026-09-11T12:18:00.000Z'.replace('2026-09-11', '2026-01-01'));
    expect(order.branchId).toBe('branch_dt_01');
  });
});

describe('menu filtering', () => {
  const menu = createSeedMenu(NOW);

  it('filters by category and case-insensitive search', () => {
    expect(filterMenu(menu, 'Burgers', '')).toHaveLength(3);
    expect(filterMenu(menu, 'All', 'mango').map((item) => item.id)).toEqual(['m_06']);
    expect(filterMenu(menu, 'Sides', 'queso').map((item) => item.id)).toEqual(['m_05']);
    expect(filterMenu(menu, 'Beverages', 'burger')).toHaveLength(0);
  });

  it('returns everything for the All category with no query', () => {
    expect(filterMenu(menu, 'All', '   ')).toHaveLength(menu.length);
  });
});

describe('reservations and ledger', () => {
  it('toggles only between upcoming and arrived', () => {
    expect(arrivalTarget('upcoming')).toBe('arrived');
    expect(arrivalTarget('arrived')).toBe('upcoming');
    expect(arrivalTarget('seated')).toBeNull();
    expect(arrivalTarget('completed')).toBeNull();
  });

  it('searches the ledger by ticket, customer and PIN', () => {
    const orders = createSeedOrders(NOW);
    expect(filterLedger(orders, 'all', '#205').map((order) => order.id)).toEqual(['ord_102']);
    expect(filterLedger(orders, 'all', 'elena').map((order) => order.id)).toEqual(['ord_102']);
    expect(filterLedger(orders, 'all', '9120').map((order) => order.id)).toEqual(['ord_103']);
    expect(filterLedger(orders, 'completed', '')).toHaveLength(1);
  });
});

describe('tables and outbox', () => {
  it('labels seating capacity', () => {
    expect(tableCapacityLabel(1)).toBe('1 guest');
    expect(tableCapacityLabel(4)).toBe('4 guests');
  });

  it('creates a pending outbox entry', () => {
    const entry = buildOutboxEntry(
      'UPDATE_ORDER_STATUS',
      'Order #205 → READY',
      { orderId: 'ord_102', status: 'ready' },
      NOW
    );
    expect(entry.id).toMatch(/^act_\d+_\d+$/);
    expect(entry.synced).toBe(false);
    expect(entry.retryCount).toBe(0);
    expect(entry.createdAt).toBe(NOW);
    expect(entry.payload).toEqual({ orderId: 'ord_102', status: 'ready' });
  });

  it('flushes oldest actions first, preserving intra-millisecond order', () => {
    const newest = buildOutboxEntry('UPDATE_MENU_PRICE', 'newest', {}, NOW + 2_000);
    const oldest = buildOutboxEntry('CREATE_MENU_ITEM', 'oldest', {}, NOW);
    const firstSameMs = buildOutboxEntry('UPDATE_MENU_ITEM', 'first same ms', {}, NOW + 1_000);
    const secondSameMs = buildOutboxEntry('TOGGLE_MENU_STOCK', 'second same ms', {}, NOW + 1_000);

    const sorted = sortOutboxChronologically([
      newest,
      secondSameMs,
      oldest,
      firstSameMs,
    ]);

    expect(sorted.map((entry) => entry.label)).toEqual([
      'oldest',
      'first same ms',
      'second same ms',
      'newest',
    ]);
  });

  it('does not mutate the reducer newest-first list while sorting', () => {
    const older = buildOutboxEntry('CREATE_ORDER', 'older', {}, NOW);
    const newer = buildOutboxEntry('UPDATE_ORDER_STATUS', 'newer', {}, NOW + 1);
    const original = [newer, older];

    sortOutboxChronologically(original);

    expect(original.map((entry) => entry.label)).toEqual(['newer', 'older']);
  });
});
