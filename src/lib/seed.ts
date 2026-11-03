import {
  Branch,
  DaySchedule,
  DiningTable,
  MenuItem,
  Order,
  Reservation,
  StoreOperationsConfig,
  TerminalSettings,
} from '../types';
import { BRANCHES } from '../constants/branches';

const minutesAgo = (now: number, minutes: number): string =>
  new Date(now - minutes * 60_000).toISOString();

const minutesAhead = (now: number, minutes: number): string =>
  new Date(now + minutes * 60_000).toISOString();

export function activeBranch(): Branch {
  return BRANCHES[0] as Branch;
}

export function createSeedOrders(now: number): Order[] {
  return [
    {
      id: 'ord_101',
      orderNumber: '204',
      branchId: 'branch_dt_01',
      customerName: 'Marcus Sterling',
      customerPhone: '+1 (555) 234-8901',
      status: 'new',
      pickupCode: '8291',
      totalAmount: 34.5,
      createdAt: minutesAgo(now, 4),
      estimatedPickupAt: minutesAhead(now, 16),
      notes: 'Extra napkins and fork',
      channel: 'online',
      items: [
        { id: 'i1', name: 'Smash Truffle Double Burger', quantity: 2, unitPrice: 14.0 },
        { id: 'i2', name: 'Parmesan Herb Crinkle Fries', quantity: 1, unitPrice: 6.5 },
      ],
    },
    {
      id: 'ord_102',
      orderNumber: '205',
      branchId: 'branch_dt_01',
      customerName: 'Elena Rostova',
      customerPhone: '+1 (555) 876-1234',
      status: 'preparing',
      pickupCode: '4410',
      totalAmount: 22.0,
      createdAt: minutesAgo(now, 14),
      estimatedPickupAt: minutesAhead(now, 6),
      channel: 'online',
      items: [
        { id: 'i3', name: 'Crispy Nashville Hot Chicken Bun', quantity: 1, unitPrice: 13.5 },
        { id: 'i4', name: 'House Mango Iced Tea', quantity: 2, unitPrice: 4.25 },
      ],
    },
    {
      id: 'ord_103',
      orderNumber: '206',
      branchId: 'branch_dt_01',
      customerName: 'David K.',
      customerPhone: '+1 (555) 432-9087',
      status: 'ready',
      pickupCode: '9120',
      totalAmount: 16.75,
      createdAt: minutesAgo(now, 25),
      readyAt: minutesAgo(now, 13),
      estimatedPickupAt: minutesAgo(now, 5),
      channel: 'walk_in',
      items: [
        { id: 'i5', name: 'Smoked Bacon Avocado Melt', quantity: 1, unitPrice: 12.0 },
        { id: 'i6', name: 'Loaded Queso Dip & Crisps', quantity: 1, unitPrice: 4.75 },
      ],
    },
    {
      id: 'ord_104',
      orderNumber: '207',
      branchId: 'branch_dt_01',
      customerName: 'Sarah Jenkins',
      customerPhone: '+1 (555) 789-0123',
      status: 'completed',
      pickupCode: '1098',
      totalAmount: 48.0,
      createdAt: minutesAgo(now, 55),
      readyAt: minutesAgo(now, 43),
      completedAt: minutesAgo(now, 40),
      estimatedPickupAt: minutesAgo(now, 35),
      channel: 'online',
      items: [
        { id: 'i7', name: 'Family Combo Platter (4 Burgers)', quantity: 1, unitPrice: 42.0 },
        { id: 'i8', name: 'Salted Caramel Milkshake', quantity: 1, unitPrice: 6.0 },
      ],
    },
  ];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const HISTORICAL_ITEMS = [
  { name: 'Smash Truffle Double Burger', price: 14.0 },
  { name: 'Crispy Nashville Hot Chicken Bun', price: 13.5 },
  { name: 'Smoked Bacon Avocado Melt', price: 12.0 },
  { name: 'Parmesan Herb Crinkle Fries', price: 6.5 },
  { name: 'Loaded Queso Dip & Crisps', price: 4.75 },
  { name: 'House Mango Iced Tea', price: 4.25 },
  { name: 'Salted Caramel Milkshake', price: 6.0 },
  { name: 'Family Combo Platter (4 Burgers)', price: 42.0 },
];

const HISTORICAL_CUSTOMERS = [
  'Marcus Sterling',
  'Elena Rostova',
  'David K.',
  'Sarah Jenkins',
  'Priya Nair',
  'Noah Williams',
  'Ava Martinez',
  'Kenji Sato',
  'Maya Lin',
  'Oliver Grant',
];

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Deterministic one-year analytics ledger. Historical tickets stay out of the
 * live Orders board and are persisted under their own SQLite snapshot key.
 */
export function createHistoricalOrders(now: number, days = 365): Order[] {
  const random = seededRandom(0xbb2026);
  const orders: Order[] = [];
  let sequence = 0;

  for (let dayOffset = 1; dayOffset <= days; dayOffset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    day.setHours(0, 0, 0, 0);

    const ticketsToday = 4 + Math.floor(random() * 5);

    for (let ticketIndex = 0; ticketIndex < ticketsToday; ticketIndex += 1) {
      const createdAt = new Date(day);
      createdAt.setHours(11 + Math.floor(random() * 11), Math.floor(random() * 60), 0, 0);

      const itemCount = 1 + Math.floor(random() * 3);
      const items = Array.from({ length: itemCount }, (_, itemIndex) => {
        const menuItem = HISTORICAL_ITEMS[
          Math.floor(random() * HISTORICAL_ITEMS.length)
        ] as (typeof HISTORICAL_ITEMS)[number];
        return {
          id: `hist_item_${sequence}_${itemIndex}`,
          name: menuItem.name,
          quantity: random() < 0.22 ? 2 : 1,
          unitPrice: menuItem.price,
        };
      });
      const totalAmount = Math.round(
        items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100
      ) / 100;

      const prepMinutes = 7 + Math.floor(random() * 12);
      const readyAt = new Date(createdAt.getTime() + prepMinutes * 60_000);
      const completedAt = new Date(
        readyAt.getTime() + (4 + Math.floor(random() * 12)) * 60_000
      );
      const cancelled = random() < 0.045;
      const channel = random() < 0.68 ? 'online' : 'walk_in';
      const customerName = HISTORICAL_CUSTOMERS[
        Math.floor(random() * HISTORICAL_CUSTOMERS.length)
      ] as string;

      orders.push({
        id: `hist_${dayOffset}_${ticketIndex}`,
        orderNumber: String(1000 + sequence),
        branchId: 'branch_dt_01',
        customerName,
        customerPhone: `+1 (555) 010-${String(1000 + (sequence % 9000))}`,
        status: cancelled ? 'cancelled' : 'completed',
        items,
        totalAmount,
        createdAt: createdAt.toISOString(),
        readyAt: cancelled ? undefined : readyAt.toISOString(),
        completedAt: cancelled ? undefined : completedAt.toISOString(),
        estimatedPickupAt: new Date(createdAt.getTime() + 18 * 60_000).toISOString(),
        pickupCode: String(1000 + Math.floor(random() * 9000)),
        channel,
      });

      sequence += 1;
    }
  }

  return orders;
}

/** Regenerate the ledger when the persisted snapshot no longer covers the year. */
export function isHistoricalDatasetCurrent(orders: Order[], now: number): boolean {
  if (orders.length === 0) return false;

  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  for (const order of orders) {
    const timestamp = Date.parse(order.createdAt);
    if (!Number.isFinite(timestamp)) continue;
    earliest = Math.min(earliest, timestamp);
    latest = Math.max(latest, timestamp);
  }

  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) return false;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const coverageFloor = today.getTime() - 360 * DAY_MS;
  const freshnessFloor = today.getTime() - 12 * 60 * 60 * 1000;

  return earliest <= coverageFloor && latest >= freshnessFloor;
}

export function createSeedMenu(now: number): MenuItem[] {
  const updatedAt = new Date(now).toISOString();
  return [
    {
      id: 'm_01',
      branchId: 'branch_dt_01',
      name: 'Smash Truffle Double Burger',
      category: 'Burgers',
      description:
        'Double Angus smashed patties, black truffle aioli, aged cheddar on brioche.',
      price: 14.0,
      currency: 'PLN',
      inStock: true,
      isVisible: true,
      preparationMinutes: 12,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
      modifiers: ['Extra Truffle Mayo', 'Brioche Bun', 'Gluten-Free Bun'],
      updatedAt,
    },
    {
      id: 'm_02',
      branchId: 'branch_dt_01',
      name: 'Crispy Nashville Hot Chicken Bun',
      category: 'Burgers',
      description: 'Cayenne-dusted fried thigh, dill pickles, vinegar slaw, house cayenne mayo.',
      price: 13.5,
      currency: 'PLN',
      inStock: true,
      isVisible: true,
      preparationMinutes: 10,
      imageUrl: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600',
      modifiers: ['Mild Heat', 'X-Hot Heat', 'Extra Pickles'],
      updatedAt,
    },
    {
      id: 'm_03',
      branchId: 'branch_dt_01',
      name: 'Smoked Bacon Avocado Melt',
      category: 'Burgers',
      description: 'Applewood smoked bacon, Hass avocado, gouda cheese, toasted sourdough.',
      price: 12.0,
      currency: 'PLN',
      inStock: false,
      isVisible: true,
      preparationMinutes: 9,
      updatedAt,
    },
    {
      id: 'm_04',
      branchId: 'branch_dt_01',
      name: 'Parmesan Herb Crinkle Fries',
      category: 'Sides',
      description: 'Crispy crinkle cut tossed in shaved pecorino, parsley, and garlic oil.',
      price: 6.5,
      currency: 'PLN',
      inStock: true,
      isVisible: true,
      preparationMinutes: 6,
      imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600',
      updatedAt,
    },
    {
      id: 'm_05',
      branchId: 'branch_dt_01',
      name: 'Loaded Queso Dip & Crisps',
      category: 'Sides',
      description: 'Warm poblano three-cheese fondue with house tortilla crisps.',
      price: 4.75,
      currency: 'PLN',
      inStock: true,
      isVisible: false,
      preparationMinutes: 5,
      updatedAt,
    },
    {
      id: 'm_06',
      branchId: 'branch_dt_01',
      name: 'House Mango Iced Tea',
      category: 'Beverages',
      description:
        'Cold-brewed Ceylon black tea infused with natural alphonso mango nectar.',
      price: 4.25,
      currency: 'PLN',
      inStock: true,
      isVisible: true,
      preparationMinutes: 2,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600',
      updatedAt,
    },
    {
      id: 'm_07',
      branchId: 'branch_dt_01',
      name: 'Salted Caramel Milkshake',
      category: 'Beverages',
      description: 'Hand-spun Madagascar vanilla gelato with sea-salt butterscotch ribbons.',
      price: 6.0,
      currency: 'PLN',
      inStock: false,
      isVisible: true,
      preparationMinutes: 4,
      updatedAt,
    },
  ];
}

export function createSeedTables(): DiningTable[] {
  return [
    { id: 'tbl_01', branchId: 'branch_dt_01', tableNumber: 'T-01', name: 'Window Booth Alpha', capacity: 4, isAvailable: true, zone: 'Main Dining' },
    { id: 'tbl_02', branchId: 'branch_dt_01', tableNumber: 'T-02', name: 'Center High-Top', capacity: 2, isAvailable: false, zone: 'Main Dining' },
    { id: 'tbl_03', branchId: 'branch_dt_01', tableNumber: 'T-03', name: 'Patio Garden Bench', capacity: 6, isAvailable: true, zone: 'Patio' },
    { id: 'tbl_04', branchId: 'branch_dt_01', tableNumber: 'T-04', name: 'Patio Pergola Table', capacity: 4, isAvailable: false, zone: 'Patio' },
    { id: 'tbl_05', branchId: 'branch_dt_01', tableNumber: 'BAR-01', name: 'Counter Stools East', capacity: 2, isAvailable: true, zone: 'Bar' },
    { id: 'tbl_06', branchId: 'branch_dt_01', tableNumber: 'BAR-02', name: 'Counter Stools West', capacity: 2, isAvailable: true, zone: 'Bar' },
  ];
}

export function createSeedReservations(): Reservation[] {
  return [
    {
      id: 'res_101',
      branchId: 'branch_dt_01',
      customerName: 'Jonathan Vance',
      customerPhone: '+1 (555) 781-9921',
      guestCount: 4,
      reservationTime: '6:30 PM (In 20m)',
      tableNumber: 'T-01',
      status: 'upcoming',
      specialRequests: 'High chair needed',
    },
    {
      id: 'res_102',
      branchId: 'branch_dt_01',
      customerName: 'Melissa Howard',
      customerPhone: '+1 (555) 349-8812',
      guestCount: 2,
      reservationTime: '7:00 PM (In 50m)',
      tableNumber: 'T-03',
      status: 'upcoming',
      specialRequests: 'Quiet booth requested',
    },
    {
      id: 'res_103',
      branchId: 'branch_dt_01',
      customerName: 'Derrick Campbell',
      customerPhone: '+1 (555) 912-3301',
      guestCount: 6,
      reservationTime: '6:15 PM',
      tableNumber: 'T-04',
      status: 'arrived',
      specialRequests: 'Separate checks',
    },
    {
      id: 'res_104',
      branchId: 'branch_dt_01',
      customerName: 'Grace Lin',
      customerPhone: '+1 (555) 230-1199',
      guestCount: 3,
      reservationTime: '5:45 PM',
      tableNumber: 'T-02',
      status: 'seated',
    },
  ];
}

export function createDefaultStoreConfig(): StoreOperationsConfig {
  const weeklySchedule: DaySchedule[] = [
    { day: 'Monday', isOpen: true, openTime: '10:00 AM', closeTime: '10:30 PM' },
    { day: 'Tuesday', isOpen: true, openTime: '10:00 AM', closeTime: '10:30 PM' },
    { day: 'Wednesday', isOpen: true, openTime: '10:00 AM', closeTime: '10:30 PM' },
    { day: 'Thursday', isOpen: true, openTime: '10:00 AM', closeTime: '10:30 PM' },
    { day: 'Friday', isOpen: true, openTime: '10:00 AM', closeTime: '11:00 PM' },
    { day: 'Saturday', isOpen: true, openTime: '10:00 AM', closeTime: '11:00 PM' },
    { day: 'Sunday', isOpen: true, openTime: '11:00 AM', closeTime: '09:30 PM' },
  ];

  return {
    isOpenForOrders: true,
    openingTime: '10:00 AM',
    closingTime: '10:30 PM',
    slotIntervalMinutes: 30,
    acceptingPickups: true,
    acceptingReservations: true,
    weeklySchedule,
  };
}

export function createDefaultTerminalSettings(): TerminalSettings {
  return {
    smtp: {
      host: 'smtp.mailgun.org',
      port: '587',
      username: 'postmaster@bbmanager.com',
      password: '',
      encryption: 'TLS',
      fromEmail: 'orders@bbmanager.com',
      fromName: 'BB Manager Dispatch',
    },
    notifications: {
      active: true,
      recipients: [
        'manager.downtown@bbmanager.internal',
        'kitchen.leads@bbmanager.internal',
        'alerts@bbmanager.internal',
      ],
    },
    deliveryUrls: {
      web: 'https://order.bbmanager.internal/downtown',
      wolt: 'https://wolt.com/en/usa/restaurant/bb-flagship',
      glovo: 'https://glovoapp.com/en/bb-flagship-burger-bar',
      pyszne: 'https://pyszne.pl/restauracja-bb-manager',
      uberEats: 'https://ubereats.com/store/bb-manager-flagship',
    },
    alertToneId: 'classic_chime',
    soundAlertsEnabled: true,
    branchName: 'Downtown Flagship',
    pocketbaseBranchId: 'branch_dt_01',
    staff: [
      {
        id: 'staff_1',
        name: 'Alex Vance',
        email: 'alex.vance@bbmanager.internal',
        role: 'manager',
      },
      {
        id: 'staff_2',
        name: 'Chef Marco Rossi',
        email: 'marco.kds@bbmanager.internal',
        role: 'kitchen_lead',
      },
      {
        id: 'staff_3',
        name: 'Sarah Jenkins',
        email: 'sarah.counter@bbmanager.internal',
        role: 'floor_staff',
      },
    ],
  };
}
