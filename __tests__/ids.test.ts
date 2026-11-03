import {
  createPocketBaseId,
  newDiningTableId,
  newMenuItemId,
} from '../src/lib/ids';

describe('PocketBase record IDs', () => {
  it('generates 15-character lowercase alphanumeric IDs', () => {
    const ids = Array.from({ length: 200 }, () => createPocketBaseId());

    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]{15}$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prefixes menu items and dining tables', () => {
    expect(newMenuItemId()).toMatch(/^m[a-z0-9]{14}$/);
    expect(newDiningTableId()).toMatch(/^t[a-z0-9]{14}$/);
  });

  it('sanitizes prefixes that PocketBase would reject', () => {
    expect(createPocketBaseId('M$X')).toMatch(/^mx[a-z0-9]{13}$/);
    expect(createPocketBaseId('!!!')).toMatch(/^r[a-z0-9]{14}$/);
  });
});
