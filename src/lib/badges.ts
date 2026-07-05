// Abzeichen-Definitionen. Emojis sind Platzhalter — später durch kleine PNGs ersetzbar
// (einfach `emoji` durch `icon`-Pfad tauschen, die IDs bleiben stabil).

export type BadgeKind = 'streak' | 'competition' | 'fight' | 'tournament' | 'judge' | 'special' | 'secret';

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

// Kampf-Siege nach Art des Sieges (aus den Wettkampf-Ergebnissen).
export const FIGHT_BADGES: BadgeDef[] = [
  { id: 'fight_points', label: 'Punktsieger', emoji: '🧮', kind: 'fight', threshold: 0, hint: 'Einen Wettkampf nach Punkten gewonnen' },
  { id: 'fight_tko', label: 'Abbruchsieg', emoji: '🛑', kind: 'fight', threshold: 0, hint: 'Einen Wettkampf per TKO gewonnen' },
  { id: 'fight_ko', label: 'K.-o.-Sieger', emoji: '💥', kind: 'fight', threshold: 0, hint: 'Einen Wettkampf per K.o. gewonnen' },
];
const FIGHT_BY_METHOD: Record<string, string> = { points: 'fight_points', tko: 'fight_tko', ko: 'fight_ko' };
export function earnedFightBadges(winMethods: string[]): BadgeDef[] {
  const ids = new Set(winMethods.map((m) => FIGHT_BY_METHOD[m]).filter(Boolean));
  return FIGHT_BADGES.filter((b) => ids.has(b.id));
}

// Turnier-Platzierungen (aus den Wettkämpfen mit placement gold/silver/bronze).
export const TOURNAMENT_BADGES: BadgeDef[] = [
  { id: 'tourn_gold', label: 'Gold geholt', emoji: '🥇', kind: 'tournament', threshold: 0, hint: '1. Platz bei einem Turnier' },
  { id: 'tourn_silver', label: 'Silber geholt', emoji: '🥈', kind: 'tournament', threshold: 0, hint: '2. Platz bei einem Turnier' },
  { id: 'tourn_bronze', label: 'Bronze geholt', emoji: '🥉', kind: 'tournament', threshold: 0, hint: '3. Platz bei einem Turnier' },
];
const TOURN_BY_PLACEMENT: Record<string, string> = { gold: 'tourn_gold', silver: 'tourn_silver', bronze: 'tourn_bronze' };
export function earnedTournamentBadges(placements: string[]): BadgeDef[] {
  const ids = new Set(placements.map((p) => TOURN_BY_PLACEMENT[p]).filter(Boolean));
  return TOURNAMENT_BADGES.filter((b) => ids.has(b.id));
}

// Gericht = Anzahl bewerteter (gerichteter) Ausreden.
export const JUDGE_BADGES: BadgeDef[] = [
  { id: 'judge_50', label: 'Jura Student', emoji: '📚', kind: 'judge', threshold: 50, hint: '50 Ausreden gerichtet' },
  { id: 'judge_200', label: 'Angehender Richter', emoji: '⚖️', kind: 'judge', threshold: 200, hint: '200 Ausreden gerichtet' },
  { id: 'judge_500', label: 'Richter', emoji: '👨‍⚖️', kind: 'judge', threshold: 500, hint: '500 Ausreden gerichtet' },
  { id: 'judge_1000', label: 'Der Richtende!', emoji: '🔨', kind: 'judge', threshold: 1000, hint: '1000 Ausreden gerichtet' },
];

// Spezial-Abzeichen (rollenbasiert, nicht über Schwellen).
export const ADMIN_BADGE: BadgeDef = { id: 'special_admin', label: 'Admin', emoji: '🛠️', kind: 'special', threshold: 0, hint: 'Gruppen-Admin' };
export const SPECIAL_BADGES: BadgeDef[] = [ADMIN_BADGE];

// Geheime Abzeichen — in der Übersicht erst sichtbar, wenn freigeschaltet.
export const DOPPELMORAL_BADGE: BadgeDef = { id: 'secret_doppelmoral', label: 'Doppelmoral', emoji: '🎭', kind: 'secret', threshold: 0, hint: '10 Chicken-Punkte – und trotzdem über 20× gerichtet', secret: true };
export const SECRET_BADGES: BadgeDef[] = [DOPPELMORAL_BADGE];

export const ALL_BADGES: BadgeDef[] = [...STREAK_BADGES, ...COMPETITION_BADGES, ...FIGHT_BADGES, ...TOURNAMENT_BADGES, ...JUDGE_BADGES, ...SPECIAL_BADGES, ...SECRET_BADGES];

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
