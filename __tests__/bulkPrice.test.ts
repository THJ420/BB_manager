import {
  computeAdjustedPrice,
  roundPrice,
} from '../src/services/bulkPrice';

describe('computeAdjustedPrice', () => {
  it('adds a fixed amount', () => {
    expect(computeAdjustedPrice(20, 'fixed', 'increase', 2.5)).toBe(22.5);
  });

  it('subtracts a fixed amount', () => {
    expect(computeAdjustedPrice(20, 'fixed', 'decrease', 2.5)).toBe(17.5);
  });

  it('increases by a percentage', () => {
    expect(computeAdjustedPrice(20, 'percent', 'increase', 10)).toBe(22);
    expect(computeAdjustedPrice(19.99, 'percent', 'increase', 15)).toBe(22.99);
  });

  it('decreases by a percentage', () => {
    expect(computeAdjustedPrice(20, 'percent', 'decrease', 10)).toBe(18);
    expect(computeAdjustedPrice(19.99, 'percent', 'decrease', 15)).toBe(16.99);
  });

  it('clamps a negative fixed result to 0', () => {
    expect(computeAdjustedPrice(5, 'fixed', 'decrease', 10)).toBe(0);
    expect(computeAdjustedPrice(0, 'fixed', 'decrease', 1)).toBe(0);
  });

  it('clamps an over-100% decrease to 0', () => {
    expect(computeAdjustedPrice(20, 'percent', 'decrease', 150)).toBe(0);
    expect(computeAdjustedPrice(20, 'percent', 'decrease', 100)).toBe(0);
  });

  it('rounds to 2 decimals', () => {
    expect(computeAdjustedPrice(10, 'percent', 'increase', 33.333)).toBe(13.33);
    expect(computeAdjustedPrice(19.99, 'percent', 'increase', 7.5)).toBe(21.49);
    expect(computeAdjustedPrice(1.005, 'fixed', 'increase', 0)).toBe(1.01);
    expect(computeAdjustedPrice(9.99, 'fixed', 'increase', 0.005)).toBe(10);
  });

  it('handles zero values and zero adjustments', () => {
    expect(computeAdjustedPrice(0, 'fixed', 'increase', 5)).toBe(5);
    expect(computeAdjustedPrice(0, 'percent', 'increase', 50)).toBe(0);
    expect(computeAdjustedPrice(0, 'percent', 'decrease', 50)).toBe(0);
    expect(computeAdjustedPrice(12.34, 'fixed', 'increase', 0)).toBe(12.34);
    expect(computeAdjustedPrice(12.34, 'percent', 'decrease', 0)).toBe(12.34);
  });

  it('treats the value as a magnitude regardless of its sign', () => {
    expect(computeAdjustedPrice(20, 'fixed', 'increase', -5)).toBe(25);
    expect(computeAdjustedPrice(20, 'fixed', 'decrease', -5)).toBe(15);
  });

  it('never produces NaN for non-finite inputs', () => {
    expect(computeAdjustedPrice(Number.NaN, 'fixed', 'increase', 5)).toBe(5);
    expect(computeAdjustedPrice(10, 'percent', 'increase', Number.NaN)).toBe(10);
    expect(computeAdjustedPrice(Number.POSITIVE_INFINITY, 'fixed', 'increase', 1)).toBe(1);
  });

  it('supports large catalog prices without float drift', () => {
    expect(computeAdjustedPrice(999.99, 'percent', 'increase', 10)).toBe(1099.99);
    expect(computeAdjustedPrice(0.1, 'fixed', 'increase', 0.2)).toBe(0.3);
  });
});

describe('roundPrice', () => {
  it('rounds half up at 2 decimals', () => {
    expect(roundPrice(1.005)).toBe(1.01);
    expect(roundPrice(2.675)).toBe(2.68);
    expect(roundPrice(10)).toBe(10);
  });

  it('falls back to 0 for non-finite input', () => {
    expect(roundPrice(Number.NaN)).toBe(0);
    expect(roundPrice(Number.POSITIVE_INFINITY)).toBe(0);
  });
});