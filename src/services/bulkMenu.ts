/**
 * Pure builders for the BULK_MENU_PATCH outbox payload.
 *
 * PocketBase's /api/batch endpoint is disabled for this deployment, so a bulk
 * edit flushes as INDIVIDUAL record PATCH/DELETE requests. Each request carries
 * the `X-BB-Bulk: 1` header: the Phase A hooks flag it and coalesce downstream
 * webhooks through a 1-second drain, keeping every request fast while normal
 * single writes keep immediate delivery.
 */

/** Header name/value the PocketBase bulk drain hook looks for. */
export const BULK_SYNC_HEADER_NAME = 'X-BB-Bulk';
export const BULK_SYNC_HEADER_VALUE = '1';

/** Fresh per-request options object so callers never share a mutable reference. */
export function bulkRequestOptions(): { headers: Record<string, string> } {
  return { headers: { [BULK_SYNC_HEADER_NAME]: BULK_SYNC_HEADER_VALUE } };
}

/** camelCase field set the UI works with (mirrors the local MenuItem model). */
export interface BulkMenuFields {
  price?: number;
  inStock?: boolean;
  isVisible?: boolean;
}

export interface BulkMenuPatchItem {
  id: string;
  fields: BulkMenuFields;
}

/** snake_case field set exactly as PocketBase's menu_items columns are named. */
export interface BulkMenuRecordFields {
  price?: number;
  in_stock?: boolean;
  is_visible?: boolean;
}

export interface BulkMenuRecordPatch {
  id: string;
  fields: BulkMenuRecordFields;
}

export interface BulkMenuPatchPayload {
  operation: 'update' | 'delete';
  items: BulkMenuRecordPatch[];
}

/**
 * Converts camelCase UI fields to the snake_case PocketBase payload, keeping
 * only defined keys so a stock toggle never accidentally rewrites price.
 */
export function toBulkMenuRecordFields(fields: BulkMenuFields): BulkMenuRecordFields {
  const record: BulkMenuRecordFields = {};
  if (fields.price !== undefined) record.price = fields.price;
  if (fields.inStock !== undefined) record.in_stock = fields.inStock;
  if (fields.isVisible !== undefined) record.is_visible = fields.isVisible;
  return record;
}

/** Builds the update variant: one PATCH per item, each with the bulk header. */
export function buildBulkMenuPatchPayload(items: BulkMenuPatchItem[]): BulkMenuPatchPayload {
  return {
    operation: 'update',
    items: items.map((item) => ({
      id: item.id,
      fields: toBulkMenuRecordFields(item.fields),
    })),
  };
}

/** Builds the delete variant: one DELETE per id, each with the bulk header. */
export function buildBulkMenuDeletePayload(itemIds: string[]): BulkMenuPatchPayload {
  return {
    operation: 'delete',
    items: itemIds.map((id) => ({ id, fields: {} })),
  };
}