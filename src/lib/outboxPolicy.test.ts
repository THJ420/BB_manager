import {
  backoffSeconds,
  nextAttemptAt,
  projectMenu,
  projectOrderStatus,
  shouldMarkFailed,
  type ProjectableOutboxRow,
} from './outboxPolicy'

function statusRow(
  status: string,
  createdAt: number,
  state: ProjectableOutboxRow['state'] = 'pending',
): ProjectableOutboxRow {
  return {
    kind: 'order_status',
    entityId: 'order-1',
    payload: JSON.stringify({ status }),
    state,
    createdAt,
  }
}

function menuRow(
  payload: Record<string, unknown>,
  createdAt: number,
  state: ProjectableOutboxRow['state'] = 'pending',
): ProjectableOutboxRow {
  return {
    kind: 'menu_update',
    entityId: 'menu-1',
    payload: JSON.stringify(payload),
    state,
    createdAt,
  }
}

describe('outbox projections', () => {
  it('projects a chain of queued order statuses', () => {
    const projection = projectOrderStatus('pending', 'order-1', [
      statusRow('accepted', 1),
      statusRow('ready', 2),
    ])

    expect(projection.status).toBe('ready')
    expect(projection.pending).toBe(true)
    expect(projection.failed).toBe(false)
  })

  it('ignores rows for other entities', () => {
    const row = statusRow('accepted', 1)

    expect(projectOrderStatus('pending', 'order-2', [row]).status).toBe('pending')
  })

  it('marks failed queued changes', () => {
    const projection = projectOrderStatus('pending', 'order-1', [
      statusRow('accepted', 1, 'failed'),
    ])

    expect(projection.status).toBe('accepted')
    expect(projection.failed).toBe(true)
  })

  it('projects the latest menu price and availability', () => {
    const projection = projectMenu({ price: 10, isAvailable: true }, 'menu-1', [
      menuRow({ price: 12.5 }, 1),
      menuRow({ is_available: false }, 2),
    ])

    expect(projection.price).toBe(12.5)
    expect(projection.isAvailable).toBe(false)
    expect(projection.pending).toBe(true)
  })

  it('ignores malformed payloads', () => {
    const projection = projectMenu({ price: 10, isAvailable: true }, 'menu-1', [{
      kind: 'menu_update',
      entityId: 'menu-1',
      payload: '{bad json',
      state: 'pending',
      createdAt: 1,
    }])

    expect(projection.price).toBe(10)
    expect(projection.isAvailable).toBe(true)
  })
})

describe('outbox retry policy', () => {
  it('uses the documented backoff sequence', () => {
    expect([1, 2, 3, 4, 5, 9].map(backoffSeconds)).toEqual([2, 5, 15, 60, 300, 300])
  })

  it('caps retries after five attempts', () => {
    expect(shouldMarkFailed(4)).toBe(false)
    expect(shouldMarkFailed(5)).toBe(true)
  })

  it('schedules the next attempt from the supplied clock', () => {
    expect(nextAttemptAt(1, 1000)).toBe(3000)
    expect(nextAttemptAt(5, 1000)).toBe(301000)
  })
})
