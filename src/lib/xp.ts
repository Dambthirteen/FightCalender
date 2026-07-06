/**
 * Level-System (Phase 1) — motivierender Fortschritt fürs „Auftauchen".
 *
 * XP wird NICHT als Event-Log geführt, sondern aus vorhandenen Daten ABGELEITET
 * (Anwesenheit, Wettkämpfe, Lob, Votes). Vorteil: die Historie zählt automatisch
 * mit, es gibt keinen State-Drift, und kein Event-Code muss instrumentiert werden.
 * Alles personenbezogen (global über alle Gruppen) — Level ist deine Fighter-Reise.
 */

import { isTestAccount, TEST_LEVEL } from './dev-override';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

/** XP je Quelle. Nur positive Anreize (Bitch-Punkte ziehen nichts ab). */
export const XP = {
  attend: 10,    // Training besucht
  comp: 50,      // Wettkampf bestritten
  win: 100,      // Wettkampf gewonnen (zusätzlich zu comp)
  lob: 15,       // Lob erhalten
  gigalob: 40,   // Gigalob erhalten
  vote: 2,       // Ausrede gerichtet (Stimme abgegeben)
} as const;

/** Kumulierte XP, um Level L zu ERREICHEN (Level 1 = 0 XP). Bedarf je Stufe = 100·L. */
export function cumulativeXp(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 50 * l * (l - 1);
}

/** Level aus Gesamt-XP (Umkehrung von cumulativeXp). */
export function levelForXp(xp: number): number {
  const x = Math.max(0, xp);
  const l = Math.floor((1 + Math.sqrt(1 + (4 * x) / 50)) / 2);
  return Math.max(1, l);
}

export interface LevelProgress {
  xp: number; level: number;
  into: number; span: number; nextAt: number; pct: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const base = cumulativeXp(level);
  const nextAt = cumulativeXp(level + 1);
  const span = nextAt - base;
  const into = xp - base;
  return { xp, level, into, span, nextAt, pct: span > 0 ? into / span : 0 };
}

export interface Rank { name: string; color: string }
// Engagement-Stufen (NICHT Kampf-Skill — das misst der Skilltree). Neutrale Tiers.
const RANKS: { min: number; name: string; color: string }[] = [
  { min: 1, name: 'Bronze', color: '#cd7f32' },
  { min: 10, name: 'Silber', color: '#c0c7d0' },
  { min: 20, name: 'Gold', color: '#ffc24b' },
  { min: 30, name: 'Platin', color: '#5ec8e0' },
  { min: 45, name: 'Diamant', color: '#7c9cff' },
  { min: 60, name: 'Elite', color: '#ff3b30' },
];
export function rankFor(level: number): Rank {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.min) r = x;
  return { name: r.name, color: r.color };
}

export interface XpBreakdown { attend: number; comp: number; win: number; lob: number; gigalob: number; vote: number }

/** Leitet die Gesamt-XP einer Person aus den vorhandenen Tabellen ab. */
export async function computeXp(sql: Sql, user: string): Promise<{ xp: number; breakdown: XpBreakdown }> {
  if (await isTestAccount(sql, user)) {
    const xp = cumulativeXp(TEST_LEVEL);
    return { xp, breakdown: { attend: xp, comp: 0, win: 0, lob: 0, gigalob: 0, vote: 0 } };
  }
  const [a] = (await sql`SELECT COUNT(*)::int AS n FROM attendance WHERE user_name = ${user}`) as { n: number }[];
  const [comp] = (await sql`
    SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE result = 'win')::int AS wins
    FROM competitions WHERE user_name = ${user}
  `) as { n: number; wins: number }[];
  const [pr] = (await sql`
    SELECT COUNT(*) FILTER (WHERE kind = 'lob')::int AS lob,
           COUNT(*) FILTER (WHERE kind = 'gigalob')::int AS giga
    FROM praises WHERE to_user = ${user}
  `) as { lob: number; giga: number }[];
  const [v] = (await sql`SELECT COUNT(*)::int AS n FROM excuse_votes WHERE voter_name = ${user}`) as { n: number }[];

  const breakdown: XpBreakdown = {
    attend: (a?.n ?? 0) * XP.attend,
    comp: (comp?.n ?? 0) * XP.comp,
    win: (comp?.wins ?? 0) * XP.win,
    lob: (pr?.lob ?? 0) * XP.lob,
    gigalob: (pr?.giga ?? 0) * XP.gigalob,
    vote: (v?.n ?? 0) * XP.vote,
  };
  const xp = Object.values(breakdown).reduce((s, n) => s + n, 0);
  return { xp, breakdown };
}
