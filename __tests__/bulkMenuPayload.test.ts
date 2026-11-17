import {
  BULK_SYNC_HEADER_NAME,
  BULK_SYNC_HEADER_VALUE,
  buildBulkMenuDeletePayload,
  buildBulkMenuPatchPayload,
  bulkRequestOptions,
  toBulkMenuRecordFields,
} from '../src/services/bulkMenu';

describe('bulk menu payload builders', () => {
  it('maps camelCase fields to the snake_case PocketBase columns', () => {
    expect(
      toBulkMenuRecordFields({ price: 12.5, inStock: false, isVisible: true })
    ).toEqual({ price: 12.5, in_stock: false, is_visible: true });
  });

  it('keeps only defined fields so a stock toggle never rewrites price', () => {
    expect(toBulkMenuRecordFields({ inStock: true })).toEqual({ in_stock: true });
    expect(toBulkMenuRecordFields({ isVisible: false })).toEqual({ is_visible: false });
    expect(toBulkMenuRecordFields({ price: 0 })).toEqual({ price: 0 });
    expect(toBulkMenuRecordFields({})).toEqual({});
  });

  it('builds the update payload with one record patch per item', () => {
    const payload = buildBulkMenuPatchPayload([
      { id: 'm_01', fields: { inStock: false } },
      { id: 'm_02', fields: { price: 9.99, isVisible: true } },
    ]);
    expect(payload.operation).toBe('update');
    expect(payload.items).toEqual([
      { id: 'm_01', fields: { in_stock: false } },
      { id: 'm_02', fields: { price: 9.99, is_visible: true } },
    ]);
  });

  it('builds the delete payload as id-only entries', () => {
    const payload = buildBulkMenuDeletePayload(['m_01', 'm_02']);
    expect(payload.operation).toBe('delete');
    expect(payload.items).toEqual([
      { id: 'm_01', fields: {} },
      { id: 'm_02', fields: {} },
    ]);
  });

  it('produces empty item lists for empty input', () => {
    expect(buildBulkMenuPatchPayload([]).items).toEqual([]);
    expect(buildBulkMenuDeletePayload([]).items).toEqual([]);
  });

  it('exposes the X-BB-Bulk header the PocketBase drain hook expects', () => {
    expect(BULK_SYNC_HEADER_NAME).toBe('X-BB-Bulk');
    expect(BULK_SYNC_HEADER_VALUE).toBe('1');
    expect(bulkRequestOptions()).toEqual({ headers: { 'X-BB-Bulk': '1' } });
  });

  it('returns a fresh options object per request', () => {
    const first = bulkRequestOptions();
    const second = bulkRequestOptions();
    expect(first).not.toBe(second);
    expect(first.headers).not.toBe(second.headers);
    first.headers['X-BB-Bulk'] = 'mutated';
    expect(second.headers['X-BB-Bulk']).toBe('1');
  });
});