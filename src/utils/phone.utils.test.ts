import { describe, expect, it } from 'vitest';

import { normalizePhone } from './phone.utils';

describe('normalizePhone', () => {
  it('убирает форматирование', () => {
    expect(normalizePhone('+7 (900) 123-45-67')).toBe('79001234567');
  });
  it('заменяет ведущую 8 на 7', () => {
    expect(normalizePhone('8 900 123 45 67')).toBe('79001234567');
  });
  it('отклоняет слишком короткие и длинные номера', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1'.repeat(16))).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});
