import { Platform } from 'react-native';
import { MenuItem } from '../types';
import { isLocalImageUri, toMenuItemRecord } from './mappers';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

function serializeFormValue(value: unknown): string {
  if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  return String(value ?? '');
}

function imageFileName(item: MenuItem): string {
  const mimeType = imageMimeType(item.imageUrl ?? '');
  const extension = Object.entries(MIME_BY_EXTENSION).find(
    ([, mime]) => mime === mimeType
  )?.[0];
  return `menu_${item.id}.${extension ?? 'jpg'}`;
}

function imageMimeType(uri: string): string {
  const dataUriMatch = /^data:([^;,]+)[;,]/.exec(uri);
  if (dataUriMatch?.[1]) return dataUriMatch[1];
  const extension = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(uri)?.[1]?.toLowerCase();
  return (extension && MIME_BY_EXTENSION[extension]) ?? 'image/jpeg';
}

/**
 * Creates either JSON or multipart record data. Picked dish photos are uploaded
 * to the PocketBase `image` file field; existing URLs stay in `image_url`.
 * When a user removes the last photo, `clearImage` sends an empty file value so
 * PocketBase deletes the previously uploaded file instead of keeping it alive.
 */
export async function buildMenuItemWritePayload(
  item: MenuItem,
  options: { clearImage?: boolean } = {}
): Promise<Record<string, unknown> | FormData> {
  const record = toMenuItemRecord(item);
  if (!item.imageUrl || !isLocalImageUri(item.imageUrl)) {
    if (options.clearImage) {
      // PocketBase treats an empty file value as "delete the uploaded file".
      record.image = '';
    }
    return record;
  }

  const form = new FormData();
  // Uploading a fresh file replaces the old PB file and stale external URL.
  for (const [key, value] of Object.entries({ ...record, image_url: '' })) {
    form.append(key, serializeFormValue(value));
  }

  if (Platform.OS === 'web') {
    const response = await fetch(item.imageUrl);
    if (!response.ok) throw new Error('Unable to read the selected menu image.');
    const blob = await response.blob();
    form.append('image', blob, imageFileName(item));
  } else {
    form.append(
      'image',
      {
        uri: item.imageUrl,
        name: imageFileName(item),
        type: imageMimeType(item.imageUrl),
      } as unknown as Blob
    );
  }

  return form;
}
