import { berlinNow } from './berlin-time';
import { getBitchCounts } from './bitch-scoring';
import { getGroupBundesland } from './groups';

/**
 * „des Monats"-Titel (Macher / Bitch) — Vergabe + Gleichstand-Voting.
 * ALLES ist gruppenbasiert: jeder Titel, jedes Voting gilt nur innerhalb einer Gruppe.
 *
 * Regeln:
 *  - Ein Titel wird erst für einen ABGESCHLOSSENEN Monat vergeben (= Monat liegt
 *    vor dem laufenden). Dadurch ist das Ausreden-Gericht (Monatsende) bereits
 *    ausgewertet, und die Verleihung passiert am 1. des Folgemonats.
 *  - Gibt es einen eindeutigen #1 → sofort final.
 *  - Gibt es einen GLEICHSTAND → die Gruppe stimmt ab. Das Voting läuft einen Tag
 *    (1. → 2. des Folgemonats), die Auswertung verzögert sich also um einen Tag.
 *    Danach gewinnt der Meistgewählte (bei Stimmen-Gleichstand alphabetisch).
 *
 * Einzige Wahrheitsquelle für „wer hat den Titel" — genutzt von Profil-Statistik,
 * Awards-API und Verleihungs-Popup.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export type Kind = 'macher' | 'bitch';
export const KINDS: Kind[] = ['macher', 'bitch'];

// ---------- Monats-Helfer (alle 'YYYY-MM') ----------
export function ymStart(ym: string): string {
  return `${ym}-01`;
}
export function ymNext(ym: string): string {
  let [y, m] = ym.split('-').map(Number);
  m++;
  if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
export function ymPrev(ym: string): string {
  let [y, m] = ym.split('-').map(Number);
  m--;
  if (m < 1) { m = 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
/** Tag der regulären Verleihung: 1. des Folgemonats, z. B. '2026-06' → '2026-07-01'. */
export function awardDate(ym: string): string {
  return `${ymNext(ym)}-01`;
}
/** Bei Gleichstand: Auswertung einen Tag später, z. B. '2026-06' → '2026-07-02'. */
export function tieDeadline(ym: string): string {
  const d = new Date(`${awardDate(ym)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
/** Laufender Monat (Europe/Berlin). */
export function currentYm(): string {
  return berlinNow().date.slice(0, 7);
}
/** Abgeschlossen = liegt vor dem laufenden Monat. */
export function isCompleted(ym: string): boolean {
  return ym < currentYm();
}

// ---------- Kandidaten (Spitzenreiter eines Monats in einer Gruppe; bei Gleichstand mehrere) ----------
export interface Candidates { names: string[]; score: number; }

/** Macher-Kandidaten: meiste Anwesenheiten im Monat (nur Kurse dieser Gruppe). */
export async function macherCandidates(sql: Sql, groupId: number, ym: string): Promise<Candidates> {
  const rows = (await sql`
    WITH m AS (
      SELECT a.user_name, COUNT(*)::int AS n,
        RANK() OVER (ORDER BY COUNT(*) DESC) AS r
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${groupId}
        AND a.user_name IN (SELECT user_name FROM group_members WHERE group_id = ${groupId} AND status = 'active')
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date >= ${ymStart(ym)}::date
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date < ${awardDate(ym)}::date
        AND a.user_name NOT IN (SELECT user_name FROM users WHERE is_test = true)
      GROUP BY a.user_name
    )
    SELECT user_name, n FROM m WHERE r = 1 ORDER BY user_name
  `) as { user_name: string; n: number }[];
  if (!rows.length || rows[0].n <= 0) return { names: [], score: 0 };
  return { names: rows.map((r) => r.user_name), score: rows[0].n };
}

/** Bitch-Kandidaten: meiste Bitch-Punkte (Hybrid-Wertung inkl. Gericht, gruppen-scoped). */
export async function bitchCandidates(sql: Sql, groupId: number, ym: string): Promise<Candidates> {
  const counts = await getBitchCounts(sql, ymStart(ym), awardDate(ym), groupId, await getGroupBundesland(groupId));
  const max = counts[0]?.count ?? 0;
  if (max <= 0) return { names: [], score: 0 };
  return { names: counts.filter((c) => c.count === max).map((c) => c.user_name).sort(), score: max };
}

export function candidatesFor(sql: Sql, groupId: number, ym: string, kind: Kind): Promise<Candidates> {
  return kind === 'macher' ? macherCandidates(sql, groupId, ym) : bitchCandidates(sql, groupId, ym);
}

// ---------- Auflösung eines Titels ----------
export interface TitleState {
  groupId: number;
  month: string;
  kind: Kind;
  status: 'none' | 'voting' | 'final'; // none = niemand (keine Daten/0 Punkte)
  winner: string | null;
  candidates: string[];
}

/**
 * Ermittelt den Stand eines (abgeschlossenen) Monats-Titels in EINER Gruppe und
 * persistiert Gleichstand-Voting bzw. die Auswertung. Idempotent.
 */
export async function resolveTitle(sql: Sql, groupId: number, ym: string, kind: Kind): Promise<TitleState> {
  const base = { groupId, month: ym, kind };

  // Bereits gespeicherter Gleichstands-Fall?
  const existing = (await sql`
    SELECT candidates, winner, status FROM monthly_titles
    WHERE group_id = ${groupId} AND month = ${ym} AND kind = ${kind}
  `) as { candidates: string[]; winner: string | null; status: string }[];

  if (existing.length && existing[0].status === 'final') {
    return { ...base, status: 'final', winner: existing[0].winner, candidates: existing[0].candidates ?? [] };
  }

  // Kandidaten: bei laufendem Voting aus der eingefrorenen Liste, sonst frisch berechnen.
  let cands: string[];
  if (existing.length) {
    cands = existing[0].candidates ?? [];
  } else {
    cands = (await candidatesFor(sql, groupId, ym, kind)).names;
  }

  if (cands.length === 0) {
    return { ...base, status: 'none', winner: null, candidates: [] };
  }
  if (cands.length === 1 && !existing.length) {
    // eindeutiger Sieger → sofort final, kein Voting nötig (nicht persistiert: neu berechenbar)
    return { ...base, status: 'final', winner: cands[0], candidates: cands };
  }

  // Gleichstand → Voting-Zeile anlegen (friert die Kandidatenliste ein).
  if (!existing.length) {
    await sql`
      INSERT INTO monthly_titles (group_id, month, kind, candidates, status)
      VALUES (${groupId}, ${ym}, ${kind}, ${JSON.stringify(cands)}::jsonb, 'voting')
      ON CONFLICT (group_id, month, kind) DO NOTHING
    `;
  }

  if (berlinNow().date < tieDeadline(ym)) {
    return { ...base, status: 'voting', winner: null, candidates: cands };
  }

  // Deadline erreicht → Stimmen auszählen und final setzen.
  const winner = await finalizeTie(sql, groupId, ym, kind, cands);
  return { ...base, status: 'final', winner, candidates: cands };
}

/** Zählt die Stimmen aus und schreibt den Sieger fest. */
async function finalizeTie(sql: Sql, groupId: number, ym: string, kind: Kind, candidates: string[]): Promise<string> {
  const rows = (await sql`
    SELECT choice, COUNT(*)::int AS n FROM title_votes
    WHERE group_id = ${groupId} AND month = ${ym} AND kind = ${kind}
    GROUP BY choice
  `) as { choice: string; n: number }[];
  const tally = new Map<string, number>();
  for (const r of rows) tally.set(r.choice, r.n);

  // Meiste Stimmen; bei Gleichstand (oder gar keinen Stimmen) alphabetisch.
  let winner = candidates[0];
  let best = -1;
  for (const c of [...candidates].sort()) {
    const n = tally.get(c) ?? 0;
    if (n > best) { best = n; winner = c; }
  }

  await sql`
    UPDATE monthly_titles SET winner = ${winner}, status = 'final', resolved_at = NOW()
    WHERE group_id = ${groupId} AND month = ${ym} AND kind = ${kind} AND status != 'final'
  `;
  return winner;
}
