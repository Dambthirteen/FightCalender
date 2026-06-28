import { describe, it, expect } from 'vitest';
import { ymStart, ymNext, ymPrev, awardDate, tieDeadline } from '../awards';

describe('awards Monats-Helfer', () => {
  it('ymNext / ymPrev über Jahresgrenzen', () => {
    expect(ymNext('2026-06')).toBe('2026-07');
    expect(ymNext('2026-12')).toBe('2027-01');
    expect(ymPrev('2026-06')).toBe('2026-05');
    expect(ymPrev('2026-01')).toBe('2025-12');
  });

  it('ymStart / awardDate / tieDeadline', () => {
    expect(ymStart('2026-06')).toBe('2026-06-01');
    expect(awardDate('2026-06')).toBe('2026-07-01'); // Verleihung am 1. des Folgemonats
    expect(tieDeadline('2026-06')).toBe('2026-07-02'); // Gleichstand: +1 Tag
    expect(awardDate('2026-12')).toBe('2027-01-01');
    expect(tieDeadline('2026-12')).toBe('2027-01-02');
  });
});
