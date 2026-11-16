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
    (Platform as { OS: string }).OS = 'android';
    appendSpy = jest.spyOn(FormData.prototype, 'append');
  });

  afterEach(() => {
    appendSpy.mockRestore();
  });

  it('packages a content:// photo without an extension as a named JPEG part', async () => {
    const item = itemWithImage('content://media/external/images/media/42');

    const payload = await buildMenuItemWritePayload(item);

    expect(payload).toBeInstanceOf(FormData);
    const part = imagePart(appendSpy);
    expect(part?.[1]).toEqual({
      uri: 'content://media/external/images/media/42',
      name: `menu_${item.id}.jpg`,
      type: 'image/jpeg',
    });
    // The stale external URL field is cleared whenever a file is attached.
    expect(appendSpy).toHaveBeenCalledWith('image_url', '');
  });

  it('keeps the file name and MIME type consistent for a PNG file URI', async () => {
    const item = itemWithImage('file:///data/cache/IMG_0001.png');

    await buildMenuItemWritePayload(item);

    expect(imagePart(appendSpy)?.[1]).toEqual({
      uri: 'file:///data/cache/IMG_0001.png',
      name: `menu_${item.id}.png`,
      type: 'image/png',
    });
  });

  it('falls back to JPEG for an unknown data: subtype', async () => {
    const item = itemWithImage('data:application/octet-stream;base64,AAAA');

    await buildMenuItemWritePayload(item);

    expect(imagePart(appendSpy)?.[1]).toMatchObject({
      name: `menu_${item.id}.jpg`,
      type: 'image/jpeg',
    });
  });

  it('honors a declared image/png data URI', async () => {
    const item = itemWithImage('data:image/png;base64,AAAA');

    await buildMenuItemWritePayload(item);

    expect(imagePart(appendSpy)?.[1]).toMatchObject({
      name: `menu_${item.id}.png`,
      type: 'image/png',
    });
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