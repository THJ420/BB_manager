import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { MenuItem } from '../types';
import { isLocalImageUri, toMenuItemRecord } from './mappers';

/**
 * A local photo that cannot be read or serialized is a permanent payload
 * problem, not a transport problem. The outbox dead-letters this error instead
 * of retrying it forever (which previously jammed the whole queue).
 */
export class UploadPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadPayloadError';
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

function serializeFormValue(value: unknown): string {
  if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  return String(value ?? '');
}

/**
 * content:// and ph:// URIs usually carry no extension, and data: URIs can
 * declare exotic subtypes. Everything unrecognized falls back to JPEG so the
 * multipart part always has a valid image MIME and a matching file name.
 */
function imageMimeType(uri: string): string {
  const dataUriMatch = /^data:([^;,]+)[;,]/.exec(uri);
  const declared = dataUriMatch?.[1]?.toLowerCase();
  if (declared && EXTENSION_BY_MIME[declared]) return declared;
  const extension = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(uri)?.[1]?.toLowerCase();
  return (extension && MIME_BY_EXTENSION[extension]) ?? 'image/jpeg';
}

function imageFileName(item: MenuItem): string {
  const extension = EXTENSION_BY_MIME[imageMimeType(item.imageUrl ?? '')] ?? 'jpg';
  return `menu_${item.id}.${extension}`;
}

/** True only when the OS confirms the file is gone; probe errors stay optimistic. */
export async function isLocalImageMissing(uri: string): Promise<boolean> {
  if (!uri || !isLocalImageUri(uri) || uri.startsWith('data:')) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists === false;
  } catch {
    return false;
  }
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let written = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | BASE64_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[written++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes.subarray(0, written);
}

async function readLocalImageBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    if (comma === -1) {
      throw new UploadPayloadError('Unable to read the selected menu image.');
    }
    return decodeBase64ToBytes(uri.slice(comma + 1));
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decodeBase64ToBytes(base64);
}

/**
 * Creates either JSON or multipart record data. Picked dish photos are uploaded
 * to the PocketBase `image` file field; existing URLs stay in `image_url`.
 * When a user removes the last photo, `clearImage` sends an empty file value so
 * PocketBase deletes the previously uploaded file instead of keeping it alive.
 * Every failure inside this boundary is an UploadPayloadError so the outbox
 * can dead-letter it instead of retrying a corrupt payload forever.
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

  try {
    if (await isLocalImageMissing(item.imageUrl)) {
      throw new UploadPayloadError(
        'The attached photo is no longer available on this device. Re-attach the image and save again.'
      );
    }

    const form = new FormData();
    // Uploading a fresh file replaces the old PB file and stale external URL.
    for (const [key, value] of Object.entries({ ...record, image_url: '' })) {
      form.append(key, serializeFormValue(value));
    }

    if (Platform.OS === 'web') {
      const response = await fetch(item.imageUrl);
      if (!response.ok) {
        throw new UploadPayloadError('Unable to read the selected menu image.');
      }
      const blob = await response.blob();
      form.append('image', blob, imageFileName(item));
    } else {
      // Expo SDK 58's fetch serializes multipart itself and only accepts
      // strings, Blobs or parts exposing bytes(). RN's classic {uri} notation
      // throws "Unsupported FormDataPart implementation", so the file is read
      // into memory and appended as a bytes() part with an explicit MIME/name.
      const bytes = await readLocalImageBytes(item.imageUrl);
      form.append(
        'image',
        {
          name: imageFileName(item),
          type: imageMimeType(item.imageUrl),
          bytes: async () => bytes,
        } as unknown as Blob
      );
    }

    return form;
  } catch (error) {
    if (error instanceof UploadPayloadError) throw error;
    throw new UploadPayloadError(
      `The menu photo could not be packaged for upload: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}