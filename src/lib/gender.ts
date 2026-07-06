// Geschlecht & Gendern. Wird in fighter_info.gender gespeichert ('m' | 'f' | 'd').
// Ohne Angabe (undefined / 'd') wird die inklusive Form („/in", „:in") genutzt.

export type Gender = 'm' | 'f' | 'd';

export const GENDERS: { key: Gender; label: string; short: string }[] = [
  { key: 'm', label: 'Männlich', short: '♂' },
  { key: 'f', label: 'Weiblich', short: '♀' },
  { key: 'd', label: 'Divers', short: '⚧' },
];

/** Passende Form wählen: männlich → m, weiblich → f, sonst neutral/inklusiv. */
export function gword(gender: string | undefined | null, m: string, f: string, neutral: string): string {
  if (gender === 'm') return m;
  if (gender === 'f') return f;
  return neutral;
}

export type Athlete = 'hobby' | 'competitor';

/** Account-Typ: 'hobby' → „Hobby", sonst gegenderte Wettkämpfer-Form. Unbekannt = Wettkämpfer. */
export function athleteLabel(athlete: string | undefined | null, gender?: string | null): string {
  return athlete === 'hobby' ? 'Hobby' : competitorLabel(gender);
}
export function isHobby(athlete: string | undefined | null): boolean {
  return athlete === 'hobby';
}

export const competitorLabel = (g?: string | null) => gword(g, 'Wettkämpfer', 'Wettkämpferin', 'Wettkämpfer/in');
export const trainerLabel = (g?: string | null) => gword(g, 'Trainer', 'Trainerin', 'Trainer:in');
export const macherMonth = (g?: string | null) => gword(g, 'Macher des Monats', 'Macherin des Monats', 'Macher:in des Monats');
export const macherYear = (g?: string | null) => gword(g, 'Macher des Jahres', 'Macherin des Jahres', 'Macher:in des Jahres');
