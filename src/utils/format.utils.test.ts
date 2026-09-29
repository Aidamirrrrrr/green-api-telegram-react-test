import { describe, expect, it } from 'vitest';

import { formatDay, initials } from './format.utils';

const NOW = new Date(2026, 8, 29, 15, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

describe('formatDay', () => {
  it('называет сегодняшний и вчерашний день словами', () => {
    expect(formatDay(NOW - 3600_000, NOW)).toBe('Сегодня');
    expect(formatDay(NOW - DAY, NOW)).toBe('Вчера');
  });

  it('показывает год только для прошлых лет', () => {
    expect(formatDay(NOW - 10 * DAY, NOW)).toBe('19 сентября');
    expect(formatDay(NOW - 400 * DAY, NOW)).toMatch(/2025 г\./);
  });
});

describe('initials', () => {
  it('берёт две первые буквы имени или цифры номера', () => {
    expect(initials('Василиса')).toBe('ВА');
    expect(initials('+79001234567')).toBe('79');
    expect(initials('')).toBe('?');
  });
});
