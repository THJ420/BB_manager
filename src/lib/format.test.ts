import { formatPrice, formatQuantity, itemSummary, parsePriceInput } from './format'

describe('price parsing', () => {
  it('accepts comma and dot decimals', () => {
    expect(parsePriceInput('24,90')).toBe(24.9)
    expect(parsePriceInput('24.90')).toBe(24.9)
    expect(parsePriceInput('1 234,50')).toBe(1234.5)
  })

  it('rounds to grosz precision', () => {
    expect(parsePriceInput('12.345')).toBe(12.35)
  })

  it('rejects empty, non-numeric, and out-of-range values', () => {
    expect(parsePriceInput('')).toBeNull()
    expect(parsePriceInput('abc')).toBeNull()
    expect(parsePriceInput('1000000')).toBeNull()
    expect(parsePriceInput('-5')).toBeNull()
  })
})

describe('formatting helpers', () => {
  it('formats PLN amounts', () => {
    expect(formatPrice(24.9)).toContain('24,90')
  })

  it('formats quantities', () => {
    expect(formatQuantity(2)).toBe('2')
    expect(formatQuantity(1.5)).toBe('1.50')
  })

  it('summarises order items', () => {
    const summary = itemSummary([
      { name: 'Kebab', quantity: 2 },
      { menu_id: 'abc', quantity: 1 },
    ], { abc: 'Fries' })

    expect(summary).toBe('2× Kebab, 1× Fries')
  })
})
