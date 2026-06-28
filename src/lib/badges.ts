// Abzeichen-Definitionen. Emojis sind Platzhalter — später durch kleine PNGs ersetzbar
// (einfach `emoji` durch `icon`-Pfad tauschen, die IDs bleiben stabil).

export type BadgeKind = 'streak' | 'competition' | 'judge' | 'special' | 'secret';

export interface BadgeDef {
  id: string;
  label: string;
  emoji: string;
  kind: BadgeKind;
  threshold: number; // Streak: Wochen · Wettkampf: Anzahl · Gericht: gerichtete Ausreden
  hint: string;
  secret?: boolean; // wird in der Übersicht erst nach Freischalten gezeigt
}

// Streak = aufeinanderfolgende Wochen ohne Trainings-Skip vom regulären Plan.
export const STREAK_BADGES: BadgeDef[] = [
  { id: 'streak_2', label: 'Rookie', emoji: '🐣', kind: 'streak', threshold: 2, hint: '2 Wochen ohne Skip' },
  { id: 'streak_3', label: 'Getting Serious', emoji: '😤', kind: 'streak', threshold: 3, hint: '3 Wochen ohne Skip' },
  { id: 'streak_4', label: 'Soldier', emoji: '🪖', kind: 'streak', threshold: 4, hint: '4 Wochen ohne Skip' },
  { id: 'streak_8', label: 'Unstoppable', emoji: '🔥', kind: 'streak', threshold: 8, hint: '8 Wochen ohne Skip' },
  { id: 'streak_12', label: 'Real Threat', emoji: '⚡', kind: 'streak', threshold: 12, hint: '12 Wochen ohne Skip' },
  { id: 'streak_26', label: 'How is that even possible?', emoji: '🤯', kind: 'streak', threshold: 26, hint: 'Halbes Jahr ohne Skip' },
  { id: 'streak_52', label: 'Ultimate Warrior', emoji: '👑', kind: 'streak', threshold: 52, hint: 'Ein Jahr ohne Skip' },
];

export const COMPETITION_BADGES: BadgeDef[] = [
  { id: 'comp_1', label: 'Junior Competitor', emoji: '🥋', kind: 'competition', threshold: 1, hint: '1 Wettkampf bestritten' },
  { id: 'comp_5', label: 'Competitor', emoji: '🥊', kind: 'competition', threshold: 5, hint: '5 Wettkämpfe bestritten' },
  { id: 'comp_10', label: 'Real Competitor', emoji: '🏅', kind: 'competition', threshold: 10, hint: '10 Wettkämpfe bestritten' },
  { id: 'comp_15', label: 'Skrupelloser Wettkämpfer', emoji: '😈', kind: 'competition', threshold: 15, hint: '15 Wettkämpfe bestritten' },
  { id: 'comp_30', label: 'Nuklearer Wettkämpfer', emoji: '☢️', kind: 'competition', threshold: 30, hint: '30 Wettkämpfe bestritten' },
];

// Gericht = Anzahl bewerteter (gerichteter) Ausreden.
export const JUDGE_BADGES: BadgeDef[] = [
  { id: 'judge_10', label: 'Jura Student', emoji: '📚', kind: 'judge', threshold: 10, hint: '10 Ausreden gerichtet' },
  { id: 'judge_20', label: 'Angehender Richter', emoji: '⚖️', kind: 'judge', threshold: 20, hint: '20 Ausreden gerichtet' },
  { id: 'judge_50', label: 'Richter', emoji: '👨‍⚖️', kind: 'judge', threshold: 50, hint: '50 Ausreden gerichtet' },
  { id: 'judge_100', label: 'Der Richtende!', emoji: '🔨', kind: 'judge', threshold: 100, hint: '100 Ausreden gerichtet' },
];

// Spezial-Abzeichen (rollenbasiert, nicht über Schwellen).
export const ADMIN_BADGE: BadgeDef = { id: 'special_admin', label: 'Admin', emoji: '🛠️', kind: 'special', threshold: 0, hint: 'Gruppen-Admin' };
export const SPECIAL_BADGES: BadgeDef[] = [ADMIN_BADGE];

// Geheime Abzeichen — in der Übersicht erst sichtbar, wenn freigeschaltet.
export const DOPPELMORAL_BADGE: BadgeDef = { id: 'secret_doppelmoral', label: 'Doppelmoral', emoji: '🎭', kind: 'secret', threshold: 0, hint: '10 Bitch-Punkte – und trotzdem über 20× gerichtet', secret: true };
export const SECRET_BADGES: BadgeDef[] = [DOPPELMORAL_BADGE];

export const ALL_BADGES: BadgeDef[] = [...STREAK_BADGES, ...COMPETITION_BADGES, ...JUDGE_BADGES, ...SPECIAL_BADGES, ...SECRET_BADGES];

export function earnedJudgeBadges(judged: number): BadgeDef[] {
  return JUDGE_BADGES.filter((b) => judged >= b.threshold);
}

export function badgeById(id: string): BadgeDef | undefined {
  return ALL_BADGES.find((b) => b.id === id);
}

export function earnedStreakBadges(weeks: number): BadgeDef[] {
  return STREAK_BADGES.filter((b) => weeks >= b.threshold);
}
export function earnedCompetitionBadges(count: number): BadgeDef[] {
  return COMPETITION_BADGES.filter((b) => count >= b.threshold);
}
export function earnedBadges(weeks: number, competitions: number, judged = 0): BadgeDef[] {
  return [...earnedStreakBadges(weeks), ...earnedCompetitionBadges(competitions), ...earnedJudgeBadges(judged)];
}

/** Nächstes Streak-Abzeichen über `weeks` (für Fortschritts-Anzeige), oder null wenn alle erreicht. */
export function nextStreakBadge(weeks: number): BadgeDef | null {
  return STREAK_BADGES.find((b) => weeks < b.threshold) ?? null;
}

/** Flammen-Stufe (0–4) für die optische Intensität der Streak-Anzeige. */
export function flameTier(weeks: number): number {
  if (weeks >= 52) return 4;
  if (weeks >= 12) return 3;
  if (weeks >= 4) return 2;
  if (weeks >= 2) return 1;
  return 0;
}
