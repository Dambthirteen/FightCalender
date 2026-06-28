import { describe, it, expect } from 'vitest';
import { overallRating } from '../fighter';

describe('overallRating', () => {
  it('unbewertet bei leeren Skills', () => {
    expect(overallRating({}).tier).toBe(0);
    expect(overallRating(null).label).toBe('Unbewertet');
  });

  it('eine entwickelte Disziplin = Single Discipline', () => {
    expect(overallRating({ striking: 100 }).tier).toBe(2);
    expect(overallRating({ striking: 100 }).label).toBe('Single Discipline');
  });

  it('niedrige Werte = Rookie (nichts >= 40)', () => {
    expect(overallRating({ striking: 20 }).tier).toBe(1);
  });

  it('alle Disziplinen hoch = Complete Fighter', () => {
    const r = overallRating({ striking: 100, clinch: 100, wrestling: 100, grappling: 100, gnp: 100 });
    expect(r.tier).toBe(6);
    expect(r.label).toBe('Complete Fighter');
  });
});
