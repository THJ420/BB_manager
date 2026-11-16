jest.mock('react-native', () => ({ Platform: { OS: 'android' } }), {
  virtual: true,
});

jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: false,
  pb: {
    files: {
      getURL: (
        record: { id: string; collectionName?: string },
        filename: string
      ) =>
        `https://pb.test/api/files/${record.collectionName ?? 'menu_items'}/${record.id}/${filename}`,
    },
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  readAsStringAsync: jest.fn(async () => '/9j/4AAQ'),
  EncodingType: { Base64: 'base64' },
}));

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  buildMenuItemWritePayload,
  isLocalImageMissing,
  UploadPayloadError,
} from '../src/services/uploads';
import { createSeedMenu } from '../src/lib/seed';
import { MenuItem } from '../src/types';

const getInfoMock = FileSystem.getInfoAsync as jest.MockedFunction<
  typeof FileSystem.getInfoAsync
>;
const readMock = FileSystem.readAsStringAsync as jest.MockedFunction<
  typeof FileSystem.readAsStringAsync
>;

/** The bytes behind the mocked base64 read ('/9j/4AAQ'). */
const MOCK_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

interface BytesPart {
  name: string;
  type: string;
  bytes: () => Promise<Uint8Array>;
}

function asBytesPart(value: unknown): BytesPart {
  return value as BytesPart;
}

function itemWithImage(imageUrl?: string): MenuItem {
  return { ...(createSeedMenu(1)[0] as MenuItem), imageUrl };
}

function imagePart(appendSpy: jest.SpyInstance): unknown[] | undefined {
  return appendSpy.mock.calls.find(([key]) => key === 'image');
}

describe('buildMenuItemWritePayload', () => {
  let appendSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getInfoMock.mockResolvedValue({ exists: true } as never);
    readMock.mockResolvedValue('/9j/4AAQ' as never);
    (Platform as { OS: string }).OS = 'android';
    appendSpy = jest.spyOn(FormData.prototype, 'append');
  });

  afterEach(() => {
    appendSpy.mockRestore();
  });

  it('packages a content:// photo as a bytes() part Expo fetch can serialize', async () => {
    const item = itemWithImage('content://media/external/images/media/42');

    const payload = await buildMenuItemWritePayload(item);

    expect(payload).toBeInstanceOf(FormData);
    const part = asBytesPart(imagePart(appendSpy)?.[1]);
    expect(part.name).toBe(`menu_${item.id}.jpg`);
    expect(part.type).toBe('image/jpeg');
    expect(typeof part.bytes).toBe('function');
    expect(await part.bytes()).toEqual(MOCK_BYTES);
    expect(readMock).toHaveBeenCalledWith(
      'content://media/external/images/media/42',
      { encoding: 'base64' }
    );
    // The stale external URL field is cleared whenever a file is attached.
    expect(appendSpy).toHaveBeenCalledWith('image_url', '');
  });

  it('keeps the file name and MIME type consistent for a PNG file URI', async () => {
    const item = itemWithImage('file:///data/cache/IMG_0001.png');

    await buildMenuItemWritePayload(item);

    const part = asBytesPart(imagePart(appendSpy)?.[1]);
    expect(part.name).toBe(`menu_${item.id}.png`);
    expect(part.type).toBe('image/png');
    expect(await part.bytes()).toEqual(MOCK_BYTES);
  });

  it('falls back to JPEG for an unknown data: subtype and decodes its payload', async () => {
    const item = itemWithImage('data:application/octet-stream;base64,AAEC');

    await buildMenuItemWritePayload(item);

    const part = asBytesPart(imagePart(appendSpy)?.[1]);
    expect(part.name).toBe(`menu_${item.id}.jpg`);
    expect(part.type).toBe('image/jpeg');
    expect(await part.bytes()).toEqual(new Uint8Array([0, 1, 2]));
    expect(readMock).not.toHaveBeenCalled();
  });

  it('honors a declared image/png data URI', async () => {
    const item = itemWithImage('data:image/png;base64,AAAA');

    await buildMenuItemWritePayload(item);

    const part = asBytesPart(imagePart(appendSpy)?.[1]);
    expect(part.name).toBe(`menu_${item.id}.png`);
    expect(part.type).toBe('image/png');
    expect(await part.bytes()).toEqual(new Uint8Array([0, 0, 0]));
  });

  it('wraps an unreadable local photo as a permanent UploadPayloadError', async () => {
    const readerError = new Error('EACCES: permission denied');
    readMock.mockRejectedValue(readerError);
    const item = itemWithImage('file:///data/cache/locked.jpg');

    const error = await buildMenuItemWritePayload(item).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UploadPayloadError);
    // The original reader failure stays attached so diagnostics can print its
    // exact stack instead of only the wrapper message.
    expect((error as { cause?: unknown }).cause).toBe(readerError);
  });

  it('throws a permanent UploadPayloadError when the local file is gone', async () => {
    getInfoMock.mockResolvedValue({ exists: false } as never);
    const item = itemWithImage('file:///data/cache/deleted.jpg');

    await expect(buildMenuItemWritePayload(item)).rejects.toBeInstanceOf(
      UploadPayloadError
    );
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('stays optimistic when the file probe itself fails', async () => {
    getInfoMock.mockRejectedValue(new Error('provider unavailable'));
    const item = itemWithImage('content://media/external/images/media/42');

    const payload = await buildMenuItemWritePayload(item);

    expect(payload).toBeInstanceOf(FormData);
  });

  it('returns plain JSON for an external URL and clears the PB file on removal', async () => {
    const item = itemWithImage('https://cdn.example/dish.jpg');

    const kept = (await buildMenuItemWritePayload(item)) as Record<string, unknown>;
    expect(kept).not.toBeInstanceOf(FormData);
    expect(kept.image).toBeUndefined();

    const cleared = (await buildMenuItemWritePayload(item, {
      clearImage: true,
    })) as Record<string, unknown>;
    expect(cleared.image).toBe('');
  });

  it('wraps a failed web image read as a permanent UploadPayloadError', async () => {
    (Platform as { OS: string }).OS = 'web';
    const fetchMock = jest.fn(async () => ({ ok: false }));
    global.fetch = fetchMock as never;
    const item = itemWithImage('blob:http://localhost/abc');

    await expect(buildMenuItemWritePayload(item)).rejects.toBeInstanceOf(
      UploadPayloadError
    );
  });

  it('wraps a web fetch crash as a permanent UploadPayloadError', async () => {
    (Platform as { OS: string }).OS = 'web';
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as never;
    const item = itemWithImage('blob:http://localhost/abc');

    await expect(buildMenuItemWritePayload(item)).rejects.toBeInstanceOf(
      UploadPayloadError
    );
  });
});

describe('isLocalImageMissing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is false for remote URLs and data URIs without probing the filesystem', async () => {
    expect(await isLocalImageMissing('https://cdn.example/dish.jpg')).toBe(false);
    expect(await isLocalImageMissing('data:image/png;base64,AAAA')).toBe(false);
    expect(await isLocalImageMissing('')).toBe(false);
    expect(getInfoMock).not.toHaveBeenCalled();
  });

  it('is true only when the OS confirms the file no longer exists', async () => {
    getInfoMock.mockResolvedValue({ exists: false } as never);
    expect(await isLocalImageMissing('file:///cache/gone.jpg')).toBe(true);

    getInfoMock.mockRejectedValue(new Error('SecurityException'));
    expect(await isLocalImageMissing('content://media/42')).toBe(false);
  });
});