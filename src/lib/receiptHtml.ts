import { formatCurrency, parseReservationTimestamp } from './format';
import { Branch, Order } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Customer-supplied strings come from the public website — never trust them. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function receiptDateTime(iso: string): string {
  const date = parseReservationTimestamp(iso);
  if (!date) return escapeHtml(iso);
  const hours24 = date.getHours();
  const hours = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const clock = `${hours}:${minutes} ${hours24 < 12 ? 'AM' : 'PM'}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${clock}`;
}

/**
 * 80mm thermal receipt markup. `expo-print` rasterises this into a PDF on the
 * device; the narrow page keeps it readable on thermal roll paper as well as
 * on a plain A4 printout.
 */
export function buildReceiptHtml(order: Order, branch?: Branch | null): string {
  const storeName = escapeHtml(branch?.name || 'BB Manager Store');
  const storeAddress = branch?.address ? `<div class="muted">${escapeHtml(branch.address)}</div>` : '';
  const storePhone = branch?.phone ? `<div class="muted">Tel: ${escapeHtml(branch.phone)}</div>` : '';

  const itemRows = order.items
    .map((item) => {
      const lineTotal = formatCurrency(item.unitPrice * item.quantity);
      const instructions = item.specialInstructions
        ? `<div class="muted small">${escapeHtml(item.specialInstructions)}</div>`
        : '';
      return `<tr>
        <td>${escapeHtml(item.name)}${instructions}</td>
        <td class="num">${item.quantity} × ${formatCurrency(item.unitPrice)}</td>
        <td class="num">${lineTotal}</td>
      </tr>`;
    })
    .join('');

  const emailRow = order.customerEmail
    ? `<div>Email: ${escapeHtml(order.customerEmail)}</div>`
    : '';
  const phoneRow = order.customerPhone
    ? `<div>Phone: ${escapeHtml(order.customerPhone)}</div>`
    : '';
  const notesBlock = order.notes
    ? `<div class="section"><span class="label">Notes</span><div>${escapeHtml(order.notes)}</div></div>`
    : '';
  const pinBlock = order.pickupCode
    ? `<div class="pin">PICKUP PIN ${escapeHtml(order.pickupCode)}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: 72mm;
    margin: 0 auto;
    padding: 4mm 2mm;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .store { font-size: 15px; font-weight: bold; letter-spacing: 1px; }
  .muted { color: #333; }
  .small { font-size: 9px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .label { font-weight: bold; text-transform: uppercase; font-size: 9px; letter-spacing: 1px; }
  .section { margin: 6px 0; }
  .pin { text-align: center; font-size: 14px; font-weight: bold; letter-spacing: 2px; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; padding-left: 6px; }
  .total td { font-size: 13px; font-weight: bold; border-top: 1px dashed #000; padding-top: 6px; }
  .footer { text-align: center; margin-top: 10px; }
</style>
</head>
<body>
  <div class="center">
    <div class="store">${storeName}</div>
    ${storeAddress}
    ${storePhone}
  </div>
  <div class="divider"></div>
  <div class="center"><span class="label">Order</span> #${escapeHtml(order.orderNumber)}</div>
  ${pinBlock}
  <div class="section">
    <div>Date: ${receiptDateTime(order.createdAt)}</div>
    <div>Channel: ${order.channel === 'online' ? 'Online pickup' : 'Walk-in'}</div>
  </div>
  <div class="divider"></div>
  <div class="section">
    <span class="label">Customer</span>
    <div>${escapeHtml(order.customerName)}</div>
    ${emailRow}
    ${phoneRow}
  </div>
  <div class="divider"></div>
  <table>
    <tr><td class="label">Item</td><td class="num label">Qty × Price</td><td class="num label">Amount</td></tr>
    ${itemRows}
    <tr class="total"><td>Total</td><td></td><td class="num">${formatCurrency(order.totalAmount)}</td></tr>
  </table>
  ${notesBlock}
  <div class="divider"></div>
  <div class="footer muted small">Thank you for your order!<br/>${storeName}</div>
</body>
</html>`;
}

/**
 * Single-page height estimate at expo-print's 72dpi (Android converts the
 * pixel value to mils). Generous on purpose: trailing whitespace is harmless
 * on thermal roll, a clipped total is not.
 */
export function estimateReceiptHeight(order: Order): number {
  const itemLines = order.items.reduce(
    (lines, item) => lines + 1 + (item.specialInstructions ? 1 : 0),
    0
  );
  return 420 + itemLines * 30 + (order.notes ? 48 : 0);
}