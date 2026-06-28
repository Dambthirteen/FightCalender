import { describe, it, expect } from 'vitest';
import {
  earnedStreakBadges, earnedCompetitionBadges, earnedJudgeBadges, earnedBadges,
  nextStreakBadge, flameTier, badgeById, STREAK_BADGES,
} from '../badges';

describe('badges', () => {
  it('Streak-Badges nach Schwellen', () => {
    expect(earnedStreakBadges(0)).toHaveLength(0);
    expect(earnedStreakBadges(2).map((b) => b.id)).toContain('streak_2');
    expect(earnedStreakBadges(3).map((b) => b.id)).toEqual(['streak_2', 'streak_3']);
    expect(earnedStreakBadges(52)).toHaveLength(STREAK_BADGES.length);
  });

  it('Wettkampf- und Gericht-Badges', () => {
    expect(earnedCompetitionBadges(0)).toHaveLength(0);
    expect(earnedCompetitionBadges(1).map((b) => b.id)).toContain('comp_1');
    expect(earnedJudgeBadges(9)).toHaveLength(0);
    expect(earnedJudgeBadges(10).map((b) => b.id)).toContain('judge_10');
  });

  it('earnedBadges kombiniert Streak + Wettkampf + Gericht', () => {
    const ids = earnedBadges(2, 1, 10).map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['streak_2', 'comp_1', 'judge_10']));
  });

  it('nextStreakBadge / flameTier / badgeById', () => {
    expect(nextStreakBadge(0)?.id).toBe('streak_2');
    expect(nextStreakBadge(2)?.id).toBe('streak_3');
    expect(nextStreakBadge(52)).toBeNull();
    expect(flameTier(0)).toBe(0);
    expect(flameTier(2)).toBe(1);
    expect(flameTier(4)).toBe(2);
    expect(flameTier(12)).toBe(3);
    expect(flameTier(52)).toBe(4);
    expect(badgeById('comp_5')?.label).toBe('Competitor');
    expect(badgeById('gibtsnicht')).toBeUndefined();
  });
});
