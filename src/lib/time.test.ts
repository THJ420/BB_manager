import { formatCountdown, minutesUntil, parsePbDate, toPbFilterDate } from './time'

describe('PocketBase date handling', () => {
  it('parses the space-separated UTC format', () => {
    const date = parsePbDate('2026-11-02 18:30:00.000Z')

    expect(date).not.toBeNull()
    expect(date?.toISOString()).toBe('2026-11-02T18:30:00.000Z')
  })

  it('returns null for missing or invalid values', () => {
    expect(parsePbDate(null)).toBeNull()
    expect(parsePbDate('')).toBeNull()
    expect(parsePbDate('not-a-date')).toBeNull()
  })

  it('emits the PocketBase filter format', () => {
    expect(toPbFilterDate(new Date('2026-11-02T18:30:00.000Z'))).toBe('2026-11-02 18:30:00.000Z')
  })

  it('computes pickup countdowns', () => {
    const now = Date.parse('2026-11-02T18:00:00.000Z')

    expect(minutesUntil('2026-11-02 18:30:00.000Z', now)).toBe(30)
    expect(formatCountdown('2026-11-02 18:30:00.000Z', now)).toBe('in 30 min')
    expect(formatCountdown('2026-11-02 17:50:00.000Z', now)).toBe('10 min overdue')
    expect(formatCountdown('2026-11-02 18:00:30.000Z', now)).toBe('now')
  })
})
