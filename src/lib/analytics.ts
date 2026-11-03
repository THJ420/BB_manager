import { Colors } from '../theme/colors';
import { formatCurrency, formatPercent } from './format';
import { AnalyticsMetric, Order, OrderStatus, PeakHourBucket } from '../types';

const NET_MARGIN_PERCENT = 28.6;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Historical analytics are capped at one calendar year. */
export const MAX_ANALYTICS_DAYS = 365;

export type AnalyticsRangePreset = 'today' | 'week' | 'month' | 'custom';

export interface AnalyticsDateRange {
  start: number;
  end: number;
}

export interface AnalyticsRange extends AnalyticsDateRange {
  label: string;
}

export interface CustomRangeResult {
  range?: AnalyticsDateRange;
  error?: string;
}

interface PeakBucketDefinition {
  timeSlot: string;
  startHour: number;
  endHour: number;
}

const PEAK_BUCKET_DEFINITIONS: PeakBucketDefinition[] = [
  { timeSlot: '11 AM - 1 PM', startHour: 11, endHour: 13 },
  { timeSlot: '1 PM - 5 PM', startHour: 13, endHour: 17 },
  { timeSlot: '5 PM - 8 PM', startHour: 17, endHour: 20 },
  { timeSlot: '8 PM - 11 PM', startHour: 20, endHour: 23 },
];

const MONTH_LABELS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

export interface AnalyticsSummary {
  salesTotal: number;
  averageTicket: number;
  completedCount: number;
  cancellationRate: number;
  averagePrepMinutes: number;
  staffEfficiency: number;
  netProfitEstimate: number;
  activeTickets: number;
  totalOrders: number;
  statusCounts: Record<OrderStatus, number>;
  peakBuckets: PeakHourBucket[];
  peakHour: PeakHourBucket;
}

export interface AnalyticsMetricContext {
  rangePreset?: AnalyticsRangePreset;
  rangeLabel?: string;
}

export type EfficiencyGradeLetter = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
export type EfficiencyGradeTone = 'success' | 'primary' | 'warning' | 'error' | 'neutral';

export interface EfficiencyGrade {
  letter: EfficiencyGradeLetter | null;
  status:
    | 'EXCELLENT PERFORMANCE'
    | 'GOOD PERFORMANCE'
    | 'AVERAGE PERFORMANCE'
    | 'NEEDS IMPROVEMENT'
    | 'NO TICKETS IN RANGE';
  tone: EfficiencyGradeTone;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Maps the shift efficiency percentage to the analytics grade scale. Empty
 * date windows stay neutral so a lack of tickets is never shown as a failure.
 */
export function getEfficiencyGrade(score: number, totalOrders: number): EfficiencyGrade {
  if (!Number.isFinite(totalOrders) || totalOrders <= 0) {
    return { letter: null, status: 'NO TICKETS IN RANGE', tone: 'neutral' };
  }

  const normalized = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;

  if (normalized >= 95) {
    return { letter: 'A+', status: 'EXCELLENT PERFORMANCE', tone: 'success' };
  }
  if (normalized >= 90) {
    return { letter: 'A', status: 'EXCELLENT PERFORMANCE', tone: 'success' };
  }
  if (normalized >= 85) {
    return { letter: 'B+', status: 'GOOD PERFORMANCE', tone: 'primary' };
  }
  if (normalized >= 80) {
    return { letter: 'B', status: 'GOOD PERFORMANCE', tone: 'primary' };
  }
  if (normalized >= 75) {
    return { letter: 'C+', status: 'AVERAGE PERFORMANCE', tone: 'warning' };
  }
  if (normalized >= 70) {
    return { letter: 'C', status: 'AVERAGE PERFORMANCE', tone: 'warning' };
  }
  if (normalized >= 60) {
    return { letter: 'D', status: 'NEEDS IMPROVEMENT', tone: 'error' };
  }
  return { letter: 'F', status: 'NEEDS IMPROVEMENT', tone: 'error' };
}

export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function addLocalDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function formatDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseAnalyticsDateInput(input: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return startOfLocalDay(parsed.getTime());
}

function formatMonthDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`;
}

function formatMonthDayYear(timestamp: number): string {
  const date = new Date(timestamp);
  return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatCustomAnalyticsRangeLabel(start: number, end: number): string {
  return `${formatMonthDayYear(start)} – ${formatMonthDayYear(end)}`;
}

function formatPresetRangeLabel(
  preset: Exclude<AnalyticsRangePreset, 'custom'>,
  start: number,
  end: number
): string {
  if (preset === 'today') return `TODAY • ${formatMonthDay(end)}`;
  if (preset === 'week') {
    return `THIS WEEK • ${formatMonthDay(start)} – ${formatMonthDay(end)}`;
  }
  return `THIS MONTH • ${formatMonthDay(start)} – ${formatMonthDay(end)}`;
}

export function getPresetAnalyticsRange(
  preset: Exclude<AnalyticsRangePreset, 'custom'>,
  now: number
): AnalyticsRange {
  const end = endOfLocalDay(now);
  let start = startOfLocalDay(now);

  if (preset === 'week') {
    const mondayOffset = (new Date(start).getDay() + 6) % 7;
    start = addLocalDays(start, -mondayOffset);
  } else if (preset === 'month') {
    const date = new Date(start);
    start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  }

  return {
    start,
    end,
    label: formatPresetRangeLabel(preset, start, end),
  };
}

export function getDefaultCustomRange(now: number, days = 30): AnalyticsDateRange {
  const end = startOfLocalDay(now);
  return {
    start: addLocalDays(end, -(Math.max(1, days) - 1)),
    end,
  };
}

export function resolveAnalyticsRange(
  preset: AnalyticsRangePreset,
  customRange: AnalyticsDateRange | null,
  now: number
): AnalyticsRange {
  if (preset === 'custom') {
    const range = customRange ?? getDefaultCustomRange(now);
    return {
      ...range,
      label: formatCustomAnalyticsRangeLabel(range.start, range.end),
    };
  }
  return getPresetAnalyticsRange(preset, now);
}

export function validateCustomAnalyticsRange(
  startText: string,
  endText: string,
  now: number
): CustomRangeResult {
  const startDay = parseAnalyticsDateInput(startText);
  const endDay = parseAnalyticsDateInput(endText);

  if (startDay === null || endDay === null) {
    return { error: 'Use YYYY-MM-DD for both dates.' };
  }
  if (endDay < startDay) {
    return { error: 'Start date must be on or before the end date.' };
  }

  const today = startOfLocalDay(now);
  if (endDay > today) {
    return { error: 'End date cannot be in the future.' };
  }

  const earliest = addLocalDays(today, -(MAX_ANALYTICS_DAYS - 1));
  if (startDay < earliest) {
    return { error: 'Choose a range within the last 12 months.' };
  }

  const inclusiveDays = Math.round((endDay - startDay) / DAY_MS) + 1;
  if (inclusiveDays > MAX_ANALYTICS_DAYS) {
    return { error: 'Choose a date range of 365 days or fewer.' };
  }

  return {
    range: {
      start: startDay,
      end: endOfLocalDay(endDay),
    },
  };
}

/**
 * The live board and the one-year analytics ledger overlap: recent tickets
 * exist in both. Merge by record ID (live data wins so latest status/pricing is
 * used) instead of concatenating, otherwise sales are counted twice.
 */
export function mergeAnalyticsOrders(liveOrders: Order[], history: Order[]): Order[] {
  const byId = new Map<string, Order>();
  for (const order of history) byId.set(order.id, order);
  for (const order of liveOrders) byId.set(order.id, order);

  return [...byId.values()].sort((a, b) => {
    const aTime = Date.parse(a.createdAt);
    const bTime = Date.parse(b.createdAt);
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

export function filterOrdersByRange(orders: Order[], range: AnalyticsDateRange): Order[] {
  return orders.filter((order) => {
    const timestamp = Date.parse(order.createdAt);
    return (
      Number.isFinite(timestamp) && timestamp >= range.start && timestamp <= range.end
    );
  });
}

export function buildPeakBuckets(orders: Order[]): PeakHourBucket[] {
  const buckets = PEAK_BUCKET_DEFINITIONS.map((definition) => ({
    timeSlot: definition.timeSlot,
    orderCount: 0,
    revenue: 0,
    percentage: 0,
    isPeak: false,
  }));

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;

    const hour = createdAt.getHours();
    const index = PEAK_BUCKET_DEFINITIONS.findIndex(
      (definition) => hour >= definition.startHour && hour < definition.endHour
    );
    if (index < 0) continue;

    const bucket = buckets[index] as PeakHourBucket;
    bucket.orderCount += 1;
    bucket.revenue += order.totalAmount;
  }

  const busiestCount = Math.max(...buckets.map((bucket) => bucket.orderCount), 0);
  return buckets.map((bucket) => ({
    ...bucket,
    revenue: Math.round(bucket.revenue * 100) / 100,
    percentage:
      busiestCount > 0 ? Math.round((bucket.orderCount / busiestCount) * 100) : 0,
    isPeak: busiestCount > 0 && bucket.orderCount === busiestCount,
  }));
}

function averagePrepMinutes(orders: Order[]): number | null {
  const prepared = orders
    .filter((order) => Boolean(order.readyAt))
    .map(
      (order) =>
        (Date.parse(order.readyAt as string) - Date.parse(order.createdAt)) / 60_000
    )
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);

  if (prepared.length === 0) return null;
  return prepared.reduce((sum, minutes) => sum + minutes, 0) / prepared.length;
}

export function computeAnalytics(orders: Order[]): AnalyticsSummary {
  const statusCounts: Record<OrderStatus, number> = {
    new: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
  };

  let salesTotal = 0;
  let paidTickets = 0;

  for (const order of orders) {
    statusCounts[order.status] += 1;
    if (order.status !== 'cancelled') {
      salesTotal += order.totalAmount;
      paidTickets += 1;
    }
  }

  const activeTickets = statusCounts.new + statusCounts.preparing + statusCounts.ready;
  const cancellationRate =
    orders.length > 0 ? (statusCounts.cancelled / orders.length) * 100 : 0;
  const averageTicket = paidTickets > 0 ? salesTotal / paidTickets : 0;
  const prepAverage = averagePrepMinutes(orders);
  const averagePrep = prepAverage ?? 0;

  const efficiencyRaw =
    100 - Math.max(0, averagePrep - 10) * 1.5 - cancellationRate * 2 - activeTickets * 0.2;
  const staffEfficiency =
    orders.length === 0
      ? 0
      : Math.min(100, Math.max(0, round1(efficiencyRaw)));

  const peakBuckets = buildPeakBuckets(orders);
  const peakHour = peakBuckets.reduce(
    (peak, bucket) => (bucket.orderCount > peak.orderCount ? bucket : peak),
    peakBuckets[0] as PeakHourBucket
  );

  return {
    salesTotal: Math.round(salesTotal * 100) / 100,
    averageTicket,
    completedCount: statusCounts.completed,
    cancellationRate,
    averagePrepMinutes: round1(averagePrep),
    staffEfficiency,
    netProfitEstimate:
      Math.round(salesTotal * (NET_MARGIN_PERCENT / 100) * 100) / 100,
    activeTickets,
    totalOrders: orders.length,
    statusCounts,
    peakBuckets,
    peakHour,
  };
}

/** The six KPI cards shown in the analytics grid. */
export function analyticsMetrics(
  summary: AnalyticsSummary,
  context: AnalyticsMetricContext = {}
): AnalyticsMetric[] {
  const salesTitle =
    context.rangePreset && context.rangePreset !== 'today' ? 'SALES' : 'SALES TODAY';

  return [
    {
      key: 'revenue',
      title: salesTitle,
      value: formatCurrency(summary.salesTotal),
      subtitle: context.rangeLabel ?? `${summary.totalOrders} tickets in range`,
      accentColor: Colors.success,
      badge: 'GROSS',
      icon: '💵',
    },
    {
      key: 'average-ticket',
      title: 'AVG ORDER',
      value: formatCurrency(summary.averageTicket),
      subtitle: `${summary.totalOrders} tickets • ${summary.completedCount} completed`,
      accentColor: Colors.primary,
      badge: 'ARPT',
      icon: '🧾',
    },
    {
      key: 'completed',
      title: 'COMPLETED ORDERS',
      value: String(summary.completedCount),
      subtitle: `${summary.activeTickets} tickets live`,
      accentColor: Colors.primary,
      badge: 'HANDED OFF',
      icon: '📦',
    },
    {
      key: 'void-cancel',
      title: 'VOID / CANCEL RATE',
      value: formatPercent(summary.cancellationRate),
      subtitle: 'Threshold: < 5.0%',
      accentColor: summary.cancellationRate > 5 ? Colors.error : Colors.success,
      badge: 'HEALTH',
      icon: '⚠️',
    },
    {
      key: 'prep-sla',
      title: 'AVG PREP SLA',
      value: `${summary.averagePrepMinutes.toFixed(1)}m`,
      subtitle: 'Target: 12.0m',
      accentColor: Colors.warning,
      badge: 'SLA',
      icon: '⏱️',
    },
    {
      key: 'peak-hours',
      title: 'PEAK ORDER HOURS',
      value: summary.peakHour.timeSlot,
      subtitle:
        summary.peakHour.orderCount > 0
          ? `${summary.peakHour.orderCount} orders • ${formatCurrency(summary.peakHour.revenue)}`
          : 'No peak data for this range',
      accentColor: Colors.warning,
      badge: 'PEAK HOUR',
      icon: '🔥',
    },
  ];
}
