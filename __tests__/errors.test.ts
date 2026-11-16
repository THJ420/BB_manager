import {
  describePocketBaseError,
  describeSyncHint,
  isAuthFailure,
} from '../src/services/errors';

function pbError(status: number, body: Record<string, unknown>): unknown {
  return {
    status,
    message: body.message ?? 'Something went wrong while processing your request.',
    response: body,
    url: 'https://pocket.example/api/collections/menu_items/records',
  };
}

describe('describePocketBaseError', () => {
  it('classifies the empty-data 400 from a collection rule as a rule denial', () => {
    const described = describePocketBaseError(
      pbError(400, { message: 'Failed to create record.', data: {} })
    );

    expect(described.kind).toBe('rule');
    expect(described.status).toBe(400);
    expect(describeSyncHint(described)).toContain('collection rules');
  });

  it('surfaces per-field validation detail', () => {
    const described = describePocketBaseError(
      pbError(400, {
        message: 'Failed to create record.',
        data: { price: { code: 'validation_invalid_number', message: 'Must be a number.' } },
      })
    );

    expect(described.kind).toBe('validation');
    expect(described.detail).toBe('price: Must be a number. (validation_invalid_number)');
  });

  it('treats 401 and 403 as auth failures', () => {
    expect(isAuthFailure(describePocketBaseError(pbError(401, { message: 'Failed to authenticate.' })))).toBe(true);
    expect(isAuthFailure(describePocketBaseError(pbError(403, { message: 'Only admins can perform this action.' })))).toBe(true);
    expect(isAuthFailure(describePocketBaseError(pbError(404, { message: 'Not found.' })))).toBe(false);
  });

  it('classifies an unreachable server as a network failure', () => {
    const described = describePocketBaseError(new TypeError('Network request failed'));
    expect(described.kind).toBe('network');
    expect(described.status).toBe(0);
  });

  it('surfaces the raw Android transport error on status 0', () => {
    const transportError = Object.assign(new TypeError('Network request failed'), {
      cause: { message: 'SSL handshake aborted' },
    });
    const described = describePocketBaseError({
      status: 0,
      message: 'Something went wrong while processing your request.',
      response: {},
      url: 'https://pocket.example/api/health',
      originalError: transportError,
    });

    expect(described.kind).toBe('network');
    expect(described.raw).toContain('TypeError');
    expect(described.raw).toContain('Network request failed');
    expect(described.raw).toContain('SSL handshake aborted');
    expect(describeSyncHint(described)).toContain('No HTTP response');
  });

  it('classifies a missing record', () => {
    const described = describePocketBaseError(pbError(404, { message: 'Not found.' }));
    expect(described.kind).toBe('not-found');
    expect(describeSyncHint(described)).toContain('does not exist');
  });

  it('classifies an unreadable local photo as a permanent payload error', () => {
    const uploadError = Object.assign(
      new Error('The attached photo is no longer available on this device.'),
      { name: 'UploadPayloadError', status: 0 }
    );
    const described = describePocketBaseError(uploadError);

    expect(described.kind).toBe('payload');
    expect(describeSyncHint(described)).toContain('no longer available');
  });

  it('captures the exact throw-site stack of the thrown error', () => {
    const error = Object.assign(new Error('boom'), {
      status: 400,
      stack: 'Error: boom\n    at buildMenuItemWritePayload (uploads.ts:155:13)',
    });
    expect(describePocketBaseError(error).stack).toBe(error.stack);
  });

  it('falls back to the wrapped originalError stack', () => {
    const original = Object.assign(new TypeError('Network request failed'), {
      stack: 'TypeError: Network request failed\n    at fetch (native)',
    });
    const described = describePocketBaseError({
      status: 0,
      message: 'Something went wrong while processing your request.',
      response: {},
      originalError: original,
    });
    expect(described.stack).toBe(original.stack);
  });

  it('falls back to the ES2022 cause stack kept by UploadPayloadError', () => {
    const reader = Object.assign(new Error('EACCES: permission denied'), {
      stack: 'Error: EACCES: permission denied\n    at readAsStringAsync (native)',
    });
    const wrapper = Object.assign(new Error('The menu photo could not be packaged for upload.'), {
      name: 'UploadPayloadError',
      status: 0,
      cause: reader,
    });
    delete (wrapper as { stack?: string }).stack;
    const described = describePocketBaseError(wrapper);
    expect(described.kind).toBe('payload');
    expect(described.stack).toBe(reader.stack);
  });

  it('reports an empty stack when the rejection carries none', () => {
    expect(describePocketBaseError(pbError(404, { message: 'Not found.' })).stack).toBe('');
  });
});
