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

  it('classifies a missing record', () => {
    const described = describePocketBaseError(pbError(404, { message: 'Not found.' }));
    expect(described.kind).toBe('not-found');
    expect(describeSyncHint(described)).toContain('does not exist');
  });
});
