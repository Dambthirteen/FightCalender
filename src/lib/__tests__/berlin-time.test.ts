import { describe, it, expect } from 'vitest';
import { isoDayOfWeek, weekStartOf, hmToMinutes } from '../berlin-time';

describe('berlin-time', () => {
  it('isoDayOfWeek: Montag = 1, Sonntag = 7', () => {
    expect(isoDayOfWeek('2026-06-22')).toBe(1); // Montag
    expect(isoDayOfWeek('2026-06-28')).toBe(7); // Sonntag
  });

  it('weekStartOf liefert den Montag der Woche', () => {
    expect(weekStartOf('2026-06-28')).toBe('2026-06-22'); // So → Mo davor
    expect(weekStartOf('2026-06-22')).toBe('2026-06-22'); // Mo → sich selbst
    expect(weekStartOf('2026-06-24')).toBe('2026-06-22'); // Mi → Mo
  });

  it('hmToMinutes', () => {
    expect(hmToMinutes('18:30')).toBe(1110);
    expect(hmToMinutes('00:00')).toBe(0);
    expect(hmToMinutes('09:05')).toBe(545);
  });
});
