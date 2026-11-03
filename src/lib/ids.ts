const POCKETBASE_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const POCKETBASE_ID_LENGTH = 15;

/**
 * PocketBase custom record IDs must be exactly 15 lowercase alphanumeric
 * characters. Generating them client-side keeps optimistic records and queued
 * offline mutations addressable with the same ID after a later sync.
 */
export function createPocketBaseId(prefix = 'r'): string {
  const safePrefix =
    prefix
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 3) || 'r';
  const timestamp = Date.now().toString(36).slice(-5);
  let id = `${safePrefix}${timestamp}`;

  while (id.length < POCKETBASE_ID_LENGTH) {
    id += POCKETBASE_ID_ALPHABET[Math.floor(Math.random() * POCKETBASE_ID_ALPHABET.length)];
  }

  return id.slice(0, POCKETBASE_ID_LENGTH);
}

export function newMenuItemId(): string {
  return createPocketBaseId('m');
}

export function newDiningTableId(): string {
  return createPocketBaseId('t');
}
