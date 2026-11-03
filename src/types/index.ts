/**
 * Shared domain types for the BB Manager terminal.
 * These mirror the PocketBase collections documented in README.md.
 */

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export type OrderChannel = 'online' | 'walk_in';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  specialInstructions?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  /** ISO timestamp of when the ticket landed on the board. */
  createdAt: string;
  /** ISO timestamp of when the kitchen marked the ticket ready. */
  readyAt?: string;
  /** ISO timestamp of counter hand-off. */
  completedAt?: string;
  /** ISO timestamp of the promised customer pickup window. */
  estimatedPickupAt?: string;
  pickupCode: string;
  notes?: string;
  channel: OrderChannel;
  /** Why the order was rejected; present when status is cancelled. */
  cancellationReason?: string;
}

export interface MenuItem {
  id: string;
  branchId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  inStock: boolean;
  isVisible: boolean;
  preparationMinutes: number;
  imageUrl?: string;
  modifiers?: string[];
  updatedAt: string;
}

export interface DiningTable {
  id: string;
  branchId: string;
  tableNumber: string;
  name: string;
  capacity: number;
  isAvailable: boolean;
  zone: string;
}

export type ReservationStatus =
  | 'upcoming'
  | 'arrived'
  | 'seated'
  | 'completed'
  | 'cancelled';

export interface Reservation {
  id: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  /** Formatted booking slot, e.g. "6:30 PM (In 20m)". */
  reservationTime: string;
  tableNumber?: string;
  status: ReservationStatus;
  specialRequests?: string;
}

export type DayName =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface DaySchedule {
  day: DayName;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface StoreOperationsConfig {
  isOpenForOrders: boolean;
  openingTime: string;
  closingTime: string;
  slotIntervalMinutes: number;
  acceptingPickups: boolean;
  acceptingReservations: boolean;
  weeklySchedule: DaySchedule[];
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
}

export type StaffRole = 'manager' | 'kitchen_lead' | 'floor_staff';

export type AlertToneId =
  | 'classic_chime'
  | 'kitchen_bell'
  | 'digital_beep'
  | 'loud_alarm'
  | 'subtle_ping'
  | 'double_gong'
  | 'restaurant_chime'
  | 'high_pitch'
  | 'marimba'
  | 'urgent_pulse';

export interface StaffSession {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  branchId: string;
  branchName: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

export type ConnectionStatus = 'live' | 'polling' | 'offline';

export type OutboxActionType =
  | 'UPDATE_ORDER_STATUS'
  | 'CREATE_ORDER'
  | 'TOGGLE_MENU_STOCK'
  | 'UPDATE_MENU_PRICE'
  | 'CREATE_MENU_ITEM'
  | 'UPDATE_MENU_ITEM'
  | 'DELETE_MENU_ITEM'
  | 'SAVE_TABLE'
  | 'DELETE_TABLE'
  | 'UPDATE_RESERVATION_STATUS'
  | 'UPDATE_STORE_HOURS'
  | 'UPDATE_SETTINGS';

export interface OutboxEntry {
  id: string;
  actionType: OutboxActionType;
  /** Human readable audit line shown in the terminal sync card. */
  label: string;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
  synced: boolean;
}

export type SmtpEncryption = 'TLS' | 'SSL' | 'STARTTLS';

export interface SmtpSettings {
  host: string;
  port: string;
  username: string;
  password: string;
  encryption: SmtpEncryption;
  fromEmail: string;
  fromName: string;
}

export interface NotificationSettings {
  active: boolean;
  recipients: string[];
}

export interface DeliveryPlatformUrls {
  web: string;
  wolt: string;
  glovo: string;
  pyszne: string;
  uberEats: string;
}

export interface TerminalSettings {
  smtp: SmtpSettings;
  notifications: NotificationSettings;
  alertToneId: AlertToneId;
  soundAlertsEnabled: boolean;
  deliveryUrls: DeliveryPlatformUrls;
  branchName: string;
  pocketbaseBranchId: string;
  staff: StaffMember[];
}

export interface FilterChipOption<T> {
  id: T;
  label: string;
  count?: number;
}

export interface PeakHourBucket {
  timeSlot: string;
  orderCount: number;
  revenue: number;
  /** 0..100, relative to the busiest bucket. */
  percentage: number;
  isPeak?: boolean;
}

export interface AnalyticsMetric {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  accentColor: string;
  badge: string;
  icon: string;
}
