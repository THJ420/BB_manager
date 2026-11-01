import { canTransition, isTerminal, nextActions, statusSortValue } from './orderStatus'

describe('order status machine', () => {
  it('allows the forward flow', () => {
    expect(canTransition('pending', 'accepted')).toBe(true)
    expect(canTransition('accepted', 'ready')).toBe(true)
    expect(canTransition('ready', 'completed')).toBe(true)
  })

  it('allows cancellation from every active status', () => {
    expect(canTransition('pending', 'cancelled')).toBe(true)
    expect(canTransition('accepted', 'cancelled')).toBe(true)
    expect(canTransition('ready', 'cancelled')).toBe(true)
  })

  it('rejects skipped or reversed transitions', () => {
    expect(canTransition('pending', 'ready')).toBe(false)
    expect(canTransition('pending', 'completed')).toBe(false)
    expect(canTransition('ready', 'accepted')).toBe(false)
    expect(canTransition('completed', 'ready')).toBe(false)
    expect(canTransition('cancelled', 'accepted')).toBe(false)
  })

  it('treats completed and cancelled as terminal', () => {
    expect(isTerminal('completed')).toBe(true)
    expect(isTerminal('cancelled')).toBe(true)
    expect(isTerminal('ready')).toBe(false)
  })

  it('returns only valid next actions', () => {
    expect(nextActions('pending').map((action) => action.status)).toEqual(['accepted', 'cancelled'])
    expect(nextActions('ready').map((action) => action.status)).toEqual(['completed', 'cancelled'])
    expect(nextActions('completed')).toEqual([])
  })

  it('sorts active statuses before terminal ones', () => {
    expect(statusSortValue('pending')).toBeLessThan(statusSortValue('accepted'))
    expect(statusSortValue('accepted')).toBeLessThan(statusSortValue('ready'))
    expect(statusSortValue('ready')).toBeLessThan(statusSortValue('completed'))
  })
})
