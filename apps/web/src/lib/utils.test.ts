import { describe, it, expect } from 'vitest';
import { formatMoney } from './utils';

describe('formatMoney', () => {
  it('formats USD with two decimals', () => {
    expect(formatMoney(1999, 'USD', 'en-US')).toBe('$19.99');
  });

  it('formats INR with locale separators', () => {
    expect(formatMoney(449900, 'INR', 'en-IN')).toMatch(/₹\s?4,499\.00/);
  });

  it('formats JPY without minor units', () => {
    expect(formatMoney(1500, 'JPY', 'ja-JP')).toMatch(/￥1,500|¥1,500/);
  });

  it('handles zero', () => {
    expect(formatMoney(0, 'USD', 'en-US')).toBe('$0.00');
  });
});
