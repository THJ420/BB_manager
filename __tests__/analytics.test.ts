import {
  analyticsMetrics,
  buildPeakBuckets,
  computeAnalytics,
  filterOrdersByRange,
  formatDateInput,
  getEfficiencyGrade,
  getPresetAnalyticsRange,
  mergeAnalyticsOrders,
  resolveAnalyticsRange,
  validateCustomAnalyticsRange,
} from '../src/lib/analytics';
import {
  createHistoricalOrders,
  createSeedOrders,
  createSeedReservations,
  createSeedTables,
  isHistoricalDatasetCurrent,
} from '../src/lib/seed';
import { Order } from '../src/types';

// Local noon keeps range fixtures stable regardless of the test machine timezone.
const NOW = new Date(2026, 0, 1, 12, 0, 0).getTime();
const orders = createSeedOrders(NOW);

function cloneOrderAt(hour: number, index: number): Order {
  const base = orders[0] as Order;
  return {
    ...base,
    id: `peak_${index}`,
    status: 'completed',
    totalAmount: 10,
    createdAt: new Date(2026, 0, 1, hour, 30, 0).toISOString(),
    readyAt: new Date(2026, 0, 1, hour + 1, 0, 0).toISOString(),
    completedAt: undefined,
  };
}

describe('computeAnalytics', () => {
  it('derives revenue, average order and completion counts from tickets', () => {
    const summary = computeAnalytics(orders);

    expect(summary.salesTotal).toBeCloseTo(121.25, 2);
    expect(summary.totalOrders).toBe(4);
    expect(summary.averageTicket).toBeCloseTo(30.3125, 4);
    expect(summary.completedCount).toBe(1);
    expect(summary.activeTickets).toBe(3);
    expect(summary.netProfitEstimate).toBeCloseTo(34.68, 2);
  });

  it('derives prep SLA and shift efficiency deterministically', () => {
    const summary = computeAnalytics(orders);

    expect(summary.averagePrepMinutes).toBe(12);
    expect(summary.cancellationRate).toBe(0);
    expect(summary.staffEfficiency).toBeCloseTo(96.4, 1);
    expect(summary.staffEfficiency).toBeLessThanOrEqual(100);
    expect(summary.staffEfficiency).toBeGreaterThanOrEqual(0);
  });

  it('counts cancellations in the void rate and excludes their revenue', () => {
    const cancelled: Order[] = orders.map((order, index) =>
      index === 0 ? { ...order, status: 'cancelled' } : order
    );
    const summary = computeAnalytics(cancelled);

    expect(summary.cancellationRate).toBe(25);
    expect(summary.salesTotal).toBeCloseTo(86.75, 2);
    expect(summary.averageTicket).toBeCloseTo(28.9167, 4);
    expect(summary.statusCounts.cancelled).toBe(1);
  });

  it('returns zeroed metrics when the selected window has no tickets', () => {
    const summary = computeAnalytics([]);

    expect(summary.salesTotal).toBe(0);
    expect(summary.averageTicket).toBe(0);
    expect(summary.cancellationRate).toBe(0);
    expect(summary.averagePrepMinutes).toBe(0);
    expect(summary.staffEfficiency).toBe(0);
    expect(summary.peakBuckets).toHaveLength(4);
    expect(summary.peakHour.isPeak).toBe(false);
  });

  it('recomputes peak buckets from the supplied ticket window', () => {
    const peakOrders = [11, 12, 18, 18, 18, 18].map((hour, index) =>
      cloneOrderAt(hour, index)
    );
    const summary = computeAnalytics(peakOrders);

    expect(summary.peakBuckets.map((bucket) => bucket.orderCount)).toEqual([2, 0, 4, 0]);
    expect(summary.peakBuckets.map((bucket) => bucket.percentage)).toEqual([
      50, 0, 100, 0,
    ]);
    expect(summary.peakHour.timeSlot).toBe('5 PM - 8 PM');
    expect(summary.peakHour.isPeak).toBe(true);

    const buckets = buildPeakBuckets([]);
    expect(buckets.every((bucket) => bucket.orderCount === 0)).toBe(true);
    expect(buckets.every((bucket) => bucket.isPeak === false)).toBe(true);
  });
});

describe('staff efficiency grading', () => {
  it('maps every score boundary to the correct grade and performance label', () => {
    const cases: Array<[number, string, string, string]> = [
      [100, 'A+', 'EXCELLENT PERFORMANCE', 'success'],
      [95, 'A+', 'EXCELLENT PERFORMANCE', 'success'],
      [94.9, 'A', 'EXCELLENT PERFORMANCE', 'success'],
      [90, 'A', 'EXCELLENT PERFORMANCE', 'success'],
      [89.9, 'B+', 'GOOD PERFORMANCE', 'primary'],
      [85, 'B+', 'GOOD PERFORMANCE', 'primary'],
      [84.9, 'B', 'GOOD PERFORMANCE', 'primary'],
      [80, 'B', 'GOOD PERFORMANCE', 'primary'],
      [79.9, 'C+', 'AVERAGE PERFORMANCE', 'warning'],
      [75, 'C+', 'AVERAGE PERFORMANCE', 'warning'],
      [74.9, 'C', 'AVERAGE PERFORMANCE', 'warning'],
      [70, 'C', 'AVERAGE PERFORMANCE', 'warning'],
      [69.9, 'D', 'NEEDS IMPROVEMENT', 'error'],
      [60, 'D', 'NEEDS IMPROVEMENT', 'error'],
      [59.9, 'F', 'NEEDS IMPROVEMENT', 'error'],
      [0, 'F', 'NEEDS IMPROVEMENT', 'error'],
    ];

    for (const [score, letter, status, tone] of cases) {
      expect(getEfficiencyGrade(score, 12)).toEqual({ letter, status, tone });
    }
  });

  it('uses a neutral badge when the selected window has no tickets', () => {
    expect(getEfficiencyGrade(98, 0)).toEqual({
      letter: null,
      status: 'NO TICKETS IN RANGE',
      tone: 'neutral',
    });
  });

  it('grades the live summary using its filtered ticket count', () => {
    const summary = computeAnalytics(orders);

    expect(getEfficiencyGrade(summary.staffEfficiency, summary.totalOrders)).toMatchObject({
      letter: 'A+',
      status: 'EXCELLENT PERFORMANCE',
      tone: 'success',
    });
  });
});

describe('analytics date windows', () => {
  it('builds today and week ranges that include the current tickets', () => {
    const today = getPresetAnalyticsRange('today', NOW);
    expect(today.start).toBe(new Date(2026, 0, 1, 0, 0, 0, 0).getTime());
    expect(today.end).toBe(new Date(2026, 0, 1, 23, 59, 59, 999).getTime());
    expect(filterOrdersByRange(orders, today)).toHaveLength(4);
    expect(today.label).toContain('TODAY');

    const week = getPresetAnalyticsRange('week', NOW);
    expect(week.start).toBe(new Date(2025, 11, 29, 0, 0, 0, 0).getTime());
    expect(week.end).toBe(today.end);
    expect(filterOrdersByRange(orders, week)).toHaveLength(4);
  });

  it('validates custom dates and caps the window at 365 days', () => {
    const valid = validateCustomAnalyticsRange('2025-12-01', '2025-12-31', NOW);
    expect(valid.error).toBeUndefined();
    expect(valid.range?.start).toBe(new Date(2025, 11, 1, 0, 0, 0, 0).getTime());
    expect(valid.range?.end).toBe(new Date(2025, 11, 31, 23, 59, 59, 999).getTime());

    expect(validateCustomAnalyticsRange('2025-02-30', '2025-03-01', NOW).error).toBeDefined();
    expect(validateCustomAnalyticsRange('2025-12-31', '2025-12-01', NOW).error).toBeDefined();
    expect(validateCustomAnalyticsRange('2025-12-01', '2026-01-02', NOW).error).toBeDefined();
    expect(validateCustomAnalyticsRange('2024-01-01', '2024-02-01', NOW).error).toBeDefined();
    expect(formatDateInput(valid.range?.start as number)).toBe('2025-12-01');
  });

  it('resolves a custom range label and filters out other months', () => {
    const custom = {
      start: new Date(2025, 11, 1).getTime(),
      end: new Date(2025, 11, 31, 23, 59, 59, 999).getTime(),
    };
    const range = resolveAnalyticsRange('custom', custom, NOW);

    expect(range.label).toContain('DEC 1, 2025');
    expect(range.label).toContain('DEC 31, 2025');
    expect(filterOrdersByRange(orders, range)).toHaveLength(0);
  });
});

describe('one-year analytics ledger', () => {
  it('creates a deterministic year of historical tickets outside the live board', () => {
    const history = createHistoricalOrders(NOW);
    const startOfToday = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();

    expect(history.length).toBeGreaterThan(1000);
    expect(new Set(history.map((order) => order.id)).size).toBe(history.length);
    expect(
      history.every((order) => Date.parse(order.createdAt) < startOfToday)
    ).toBe(true);
    expect(
      Math.min(...history.map((order) => Date.parse(order.createdAt)))
    ).toBeLessThanOrEqual(new Date(2025, 0, 1, 23, 59, 59).getTime());
    expect(history.some((order) => order.status === 'cancelled')).toBe(true);
    expect(isHistoricalDatasetCurrent(history, NOW)).toBe(true);
    expect(isHistoricalDatasetCurrent([], NOW)).toBe(false);
  });
});

describe('mergeAnalyticsOrders', () => {
  it('merges live and historical tickets without double-counting', () => {
    const completed = orders[0] as Order;
    const historical = {
      ...completed,
      id: 'hist_1',
      totalAmount: 20,
      status: 'completed' as const,
    };
    const live = {
      ...historical,
      totalAmount: 25,
      status: 'cancelled' as const,
    };
    const historyOnly = {
      ...(orders[1] as Order),
      id: 'hist_2',
      totalAmount: 15,
    };

    const merged = mergeAnalyticsOrders([live], [historical, historyOnly]);

    expect(merged).toHaveLength(2);
    expect(merged.find((order) => order.id === 'hist_1')?.status).toBe('cancelled');
    expect(merged.find((order) => order.id === 'hist_1')?.totalAmount).toBe(25);
    expect(merged.find((order) => order.id === 'hist_2')?.totalAmount).toBe(15);
    expect(computeAnalytics(merged).totalOrders).toBe(2);
  });

  it('returns history when the live board is empty', () => {
    const history = orders.slice(0, 2);
    expect(mergeAnalyticsOrders([], history)).toHaveLength(2);
    expect(mergeAnalyticsOrders([], [])).toEqual([]);
  });
});

describe('analyticsMetrics', () => {
  it('exposes only the requested six KPI cards', () => {
    const summary = computeAnalytics(orders);
    const metrics = analyticsMetrics(summary);

    expect(metrics).toHaveLength(6);
    expect(metrics.map((metric) => metric.key)).toEqual([
      'revenue',
      'average-ticket',
      'completed',
      'void-cancel',
      'prep-sla',
      'peak-hours',
    ]);
    expect(metrics[0]?.title).toBe('SALES TODAY');
    expect(metrics[0]?.value).toBe('121.25 zł');
    expect(metrics[1]?.title).toBe('AVG ORDER');
    expect(metrics[2]?.title).toBe('COMPLETED ORDERS');
    expect(metrics[3]?.title).toBe('VOID / CANCEL RATE');
    expect(metrics[4]?.title).toBe('AVG PREP SLA');
    expect(metrics[5]?.title).toBe('PEAK ORDER HOURS');
  });

  it('drops the removed cards and adapts the sales label for longer ranges', () => {
    const summary = computeAnalytics(orders);
    const titles = analyticsMetrics(summary, {
      rangePreset: 'month',
      rangeLabel: 'THIS MONTH • JAN 1 – JAN 1',
    }).map((metric) => metric.title);

    expect(titles).not.toContain('TABLE TURNOVER');
    expect(titles).not.toContain('NET PROFIT MARGIN EST.');
    expect(titles).not.toContain('ONLINE VS WALK-IN');
    expect(titles).not.toContain('RETURN RATE');
    expect(titles).toContain('SALES');
  });
});
