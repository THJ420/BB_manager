import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildReceiptHtml, estimateReceiptHeight } from '../lib/receiptHtml';
import { Branch, Order } from '../types';

/** 80mm at expo-print's 72dpi reference resolution. */
const THERMAL_PAGE_WIDTH = 227;

export interface ReceiptExportResult {
  uri: string;
  shared: boolean;
}

/**
 * Renders the receipt to a PDF on the device and opens the system share sheet
 * (which includes the OS print service and any installed thermal-printer app).
 * The file stays in the cache directory so it can be re-shared without a
 * network round-trip.
 */
export async function exportReceiptPdf(
  order: Order,
  branch?: Branch | null
): Promise<ReceiptExportResult> {
  const { uri } = await Print.printToFileAsync({
    html: buildReceiptHtml(order, branch),
    width: THERMAL_PAGE_WIDTH,
    height: estimateReceiptHeight(order),
  });

  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Receipt #${order.orderNumber}`,
      UTI: 'com.adobe.pdf',
    });
    shared = true;
  }

  return { uri, shared };
}