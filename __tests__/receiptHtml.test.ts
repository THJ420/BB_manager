jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: false,
  pb: { files: { getURL: () => '' } },
}));

import type { RecordModel } from 'pocketbase';
import { filterLedger } from '../src/lib/domain';
import {
  buildReceiptHtml,
  escapeHtml,
  estimateReceiptHeight,
} from '../src/lib/receiptHtml';
import { mapOrderRecord, toOrderRecord } from '../src/services/mappers';
import { Branch, Order } from '../src/types';

const branch: Branch = {
  id: 'branch_cc',
  name: 'Crispy Chicken',
  code: 'CC-POZNAN',
  address: 'ul. Testowa 1, Poznań',
  phone: '+48 61 000 00 00',
  isActive: true,
};

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord000000000001',
    orderNumber: '205',
    branchId: 'branch_cc',
    customerName: 'Elena Nowak',
    customerPhone: '+48 555 100 200',
    customerEmail: 'elena@example.com',
    status: 'new',
    items: [
      { id: 'item_1', name: 'Crispy Burger', quantity: 2, unitPrice: 24.5 },
      { id: 'item_2', name: 'Fries', quantity: 1, unitPrice: 9 },
    ],
    totalAmount: 58,
    createdAt: '2026-11-17T12:00:00.000Z',
    pickupCode: '9120',
    channel: 'online',
    ...overrides,
  };
}

describe('buildReceiptHtml', () => {
  it('includes store metadata, customer details and itemized lines', () => {
    const html = buildReceiptHtml(order(), branch);
    expect(html).toContain('Crispy Chicken');
    expect(html).toContain('ul. Testowa 1, Poznań');
    expect(html).toContain('+48 61 000 00 00');
    expect(html).toContain('#205');
    expect(html).toContain('PICKUP PIN 9120');
    expect(html).toContain('Elena Nowak');
    expect(html).toContain('elena@example.com');
    expect(html).toContain('+48 555 100 200');
    expect(html).toContain('Crispy Burger');
    expect(html).toContain('2 ×');
    expect(html).toContain('58.00');
  });

  it('escapes hostile customer input from the public website', () => {
    const html = buildReceiptHtml(
      order({
        customerName: '<script>alert(1)</script>',
        notes: '"><img src=x onerror=alert(1)>',
      }),
      branch
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('omits email/phone rows when the website did not collect them', () => {
    const html = buildReceiptHtml(
      order({ customerEmail: undefined, customerPhone: '' }),
      branch
    );
    expect(html).not.toContain('Email:');
    expect(html).not.toContain('Phone:');
  });

  it('falls back to a generic store header without branch metadata', () => {
    const html = buildReceiptHtml(order(), null);
    expect(html).toContain('BB Manager Store');
  });

  it('grows the page estimate with item count and notes', () => {
    const base = estimateReceiptHeight(order());
    const withNotes = estimateReceiptHeight(order({ notes: 'No onions' }));
    expect(withNotes).toBeGreaterThan(base);
    expect(base).toBeGreaterThan(400);
  });
});

describe('escapeHtml', () => {
  it('escapes all five HTML special characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('filterLedger amount search', () => {
  const orders = [
    order({ id: 'a', orderNumber: '300', totalAmount: 45 }),
    order({ id: 'b', orderNumber: '301', totalAmount: 145 }),
    order({ id: 'c', orderNumber: '302', totalAmount: 45.5 }),
  ];

  it('matches amounts by prefix without swallowing larger totals', () => {
    expect(filterLedger(orders, 'all', '45').map((o) => o.id)).toEqual(['a', 'c']);
    expect(filterLedger(orders, 'all', '45.50').map((o) => o.id)).toEqual(['c']);
    expect(filterLedger(orders, 'all', '145').map((o) => o.id)).toEqual(['b']);
  });

  it('still matches customer, order number and PIN', () => {
    expect(filterLedger(orders, 'all', 'elena').map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(filterLedger(orders, 'all', '#301').map((o) => o.id)).toEqual(['b']);
    expect(filterLedger(orders, 'all', '9120').map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('order customer email mapping', () => {
  it('maps customer_email from PocketBase and back', () => {
    const record = {
      id: 'ord000000000001',
      branch_id: 'branch_cc',
      customer_name: 'Elena',
      customer_email: 'elena@example.com',
      status: 'new',
      items: [],
      total_amount: 10,
      created: '2026-11-17T12:00:00.000Z',
    } as unknown as RecordModel;
    const mapped = mapOrderRecord(record);
    expect(mapped.customerEmail).toBe('elena@example.com');
    expect(toOrderRecord(mapped).customer_email).toBe('elena@example.com');
  });

  it('leaves email undefined when absent and writes an empty string back', () => {
    const record = {
      id: 'ord000000000002',
      branch_id: 'branch_cc',
      status: 'new',
      items: [],
      total_amount: 10,
      created: '2026-11-17T12:00:00.000Z',
    } as unknown as RecordModel;
    const mapped = mapOrderRecord(record);
    expect(mapped.customerEmail).toBeUndefined();
    expect(toOrderRecord(mapped).customer_email).toBe('');
  });
});