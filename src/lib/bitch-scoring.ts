import { getNRWHolidays } from './holidays';
import { berlinNow, weekStartOf } from './berlin-time';

/**
 * Bitch-Wertung (Hybrid, daten-sicher).
 *
 * Ab dem Stichtag CUTOVER gilt das NEUE Modell: ein geplanter Trainingstag ohne
 * besuchte Klasse = automatisch 1 Bitch-Punkt (entfernbar durch eine im
 * Ausreden-Gericht angenommene Ausrede). VOR dem Stichtag bleibt die ALTE Logik
 * (nur explizit eingetragene, abgelehnte Ausreden zählen) — damit ändern sich
 * keine bestehenden Ergebnisse.
 */
export const CUTOVER = '2026-06-19';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

function isodow(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return ((d.getUTCDay() + 6) % 7) + 1;
}
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function holidaysFor(start: string, endExclusive: string): string[] {
  const y0 = parseInt(start.slice(0, 4));
  const y1 = parseInt(endExclusive.slice(0, 4));
  const out: string[] = [];
  for (let y = y0; y <= y1; y++) out.push(...getNRWHolidays(y).map((h) => h.date));
  return out;
}

export interface BitchScore { user_name: string; count: number }

/**
 * Bitch-Punkte je Nutzer für [start, endExclusive) (yyyy-MM-dd).
 */
export async function getBitchCounts(sql: Sql, start: string, endExclusive: string): Promise<BitchScore[]> {
  const today = berlinNow().date; // Berlin: „heute" — bis hierher (exklusiv) sind Tage vorbei
  const counts = new Map<string, number>();
  const add = (u: string, n: number) => counts.set(u, (counts.get(u) ?? 0) + n);

  // ---------- TEIL A: vor dem Stichtag — ALTE Logik (Historie unverändert) ----------
  const aEnd = endExclusive < CUTOVER ? endExclusive : CUTOVER; // min(endExclusive, CUTOVER)
  if (start < aEnd) {
    const holidays = holidaysFor(start, aEnd);
    const rowsA = (await sql`
      SELECT s.user_name, COUNT(*)::int AS n
      FROM skipping s
      WHERE s.date >= ${start}::date AND s.date < ${aEnd}::date
        AND s.excuse != ''
        AND EXISTS (
          SELECT 1 FROM user_schedule us JOIN classes c ON c.id = us.class_id
          WHERE us.user_name = s.user_name AND c.day_of_week = EXTRACT(ISODOW FROM s.date)::int
        )
        AND NOT (s.date::text = ANY(${holidays}))
        AND NOT EXISTS (
          SELECT 1 FROM user_status st
          WHERE st.user_name = s.user_name AND s.date >= st.start_date AND s.date <= st.end_date
            AND st.status_type IN ('sick', 'vacation')
        )
        AND (SELECT COUNT(*) FROM excuse_votes ev WHERE ev.skip_id = s.id AND ev.vote = 'reject')
          > (SELECT COUNT(*) FROM excuse_votes ev WHERE ev.skip_id = s.id AND ev.vote = 'accept')
      GROUP BY s.user_name
    `) as { user_name: string; n: number }[];
    for (const r of rowsA) add(r.user_name, r.n);
  }

  // ---------- TEIL B: ab dem Stichtag — NEUE Logik (abgeleitete No-Shows) ----------
  const bStart = start > CUTOVER ? start : CUTOVER;          // max(start, CUTOVER)
  const bEnd = endExclusive < today ? endExclusive : today; // nur vergangene Tage (< heute)
  if (bStart < bEnd) {
    const holidaySet = new Set(holidaysFor(bStart, bEnd));

    const scheduleRows = (await sql`
      SELECT us.user_name, c.day_of_week::int AS dow
      FROM user_schedule us JOIN classes c ON c.id = us.class_id
    `) as { user_name: string; dow: number }[];
    const userDows = new Map<string, Set<number>>();
    for (const r of scheduleRows) {
      if (!userDows.has(r.user_name)) userDows.set(r.user_name, new Set());
      userDows.get(r.user_name)!.add(r.dow);
    }

    const presentRows = (await sql`
      SELECT a.user_name, (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date::text AS d
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE a.week_start >= ${weekStartOf(bStart)}::date AND a.week_start < ${bEnd}::date
    `) as { user_name: string; d: string }[];
    const present = new Set(presentRows.map((r) => `${r.user_name}|${r.d}`));

    const skipRows = (await sql`
      SELECT s.id, s.date::text AS date, s.user_name, s.excuse
      FROM skipping s WHERE s.date >= ${bStart}::date AND s.date < ${bEnd}::date
    `) as { id: number; date: string; user_name: string; excuse: string }[];
    const skipByKey = new Map<string, { id: number; excuse: string }>();
    for (const s of skipRows) skipByKey.set(`${s.user_name}|${s.date}`, { id: s.id, excuse: s.excuse });

    const voteRows = (await sql`SELECT skip_id, vote FROM excuse_votes`) as { skip_id: number; vote: string }[];
    const votes = new Map<number, { accept: number; reject: number }>();
    for (const v of voteRows) {
      const cur = votes.get(v.skip_id) ?? { accept: 0, reject: 0 };
      if (v.vote === 'accept') cur.accept++; else if (v.vote === 'reject') cur.reject++;
      votes.set(v.skip_id, cur);
    }

    const statusRows = (await sql`
      SELECT user_name, start_date::text AS s, end_date::text AS e FROM user_status
      WHERE status_type IN ('sick', 'vacation') AND start_date < ${bEnd}::date AND end_date >= ${bStart}::date
    `) as { user_name: string; s: string; e: string }[];
    const exempt = (u: string, d: string) =>
      statusRows.some((st) => st.user_name === u && d >= st.s && d <= st.e);

    for (const [user, dows] of userDows) {
      let n = 0;
      for (let d = bStart; d < bEnd; d = addDaysStr(d, 1)) {
        if (!dows.has(isodow(d))) continue;          // an dem Wochentag nichts geplant
        if (holidaySet.has(d)) continue;             // Feiertag
        if (exempt(user, d)) continue;               // krank/Urlaub
        if (present.has(`${user}|${d}`)) continue;   // war da → kein Bitch
        // No-Show → Bitch, außer eine angenommene Ausrede entfernt ihn
        const skip = skipByKey.get(`${user}|${d}`);
        if (skip && skip.excuse !== '') {
          const v = votes.get(skip.id) ?? { accept: 0, reject: 0 };
          if (v.accept > v.reject) continue;         // im Gericht angenommen → Punkt weg
        }
        n++;
      }
      if (n > 0) add(user, n);
    }
  }

  return [...counts.entries()]
    .map(([user_name, count]) => ({ user_name, count }))
    .sort((a, b) => b.count - a.count);
}
