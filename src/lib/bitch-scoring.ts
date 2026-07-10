import { getHolidays } from './holidays';
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
function holidaysFor(start: string, endExclusive: string, bundesland: string): string[] {
  const y0 = parseInt(start.slice(0, 4));
  const y1 = parseInt(endExclusive.slice(0, 4));
  const out: string[] = [];
  for (let y = y0; y <= y1; y++) out.push(...getHolidays(y, bundesland).map((h) => h.date));
  return out;
}

export interface BitchScore { user_name: string; count: number }

/**
 * Bitch-Punkte je Nutzer für [start, endExclusive) (yyyy-MM-dd) — NUR innerhalb
 * der angegebenen Gruppe (Anwesenheit/Skips/Stundenplan werden über die Kurse
 * dieser Gruppe gefiltert). Alles ist gruppenbasiert, nichts global.
 */
export async function getBitchCounts(
  sql: Sql,
  start: string,
  endExclusive: string,
  groupId: number,
  bundesland: string = 'NW'
): Promise<BitchScore[]> {
  const today = berlinNow().date; // Berlin: „heute" — bis hierher (exklusiv) sind Tage vorbei
  const counts = new Map<string, number>();
  const add = (u: string, n: number) => counts.set(u, (counts.get(u) ?? 0) + n);

  // Test-/Dev-Accounts tauchen in keiner Wertung auf (Chicken/Macher/Awards/Wrapped).
  let testers = new Set<string>();
  try {
    const t = (await sql`SELECT user_name FROM users WHERE is_test = true`) as { user_name: string }[];
    testers = new Set(t.map((r) => r.user_name));
  } catch { /* is_test-Spalte evtl. noch nicht angelegt */ }

  // ---------- TEIL A: vor dem Stichtag — ALTE Logik (Historie unverändert) ----------
  const aEnd = endExclusive < CUTOVER ? endExclusive : CUTOVER; // min(endExclusive, CUTOVER)
  if (start < aEnd) {
    const holidays = holidaysFor(start, aEnd, bundesland);
    const rowsA = (await sql`
      SELECT s.user_name, COUNT(*)::int AS n
      FROM skipping s
      WHERE s.date >= ${start}::date AND s.date < ${aEnd}::date
        AND s.group_id = ${groupId}
        AND s.excuse != ''
        AND EXISTS (
          SELECT 1 FROM user_schedule us JOIN classes c ON c.id = us.class_id
          WHERE us.user_name = s.user_name AND c.day_of_week = EXTRACT(ISODOW FROM s.date)::int
            AND c.group_id = ${groupId}
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
    const holidaySet = new Set(holidaysFor(bStart, bEnd, bundesland));

    const scheduleRows = (await sql`
      SELECT us.user_name, c.day_of_week::int AS dow
      FROM user_schedule us JOIN classes c ON c.id = us.class_id
      WHERE c.group_id = ${groupId}
    `) as { user_name: string; dow: number }[];
    const userDows = new Map<string, Set<number>>();
    for (const r of scheduleRows) {
      if (!userDows.has(r.user_name)) userDows.set(r.user_name, new Set());
      userDows.get(r.user_name)!.add(r.dow);
    }

    // Wochenplan-Abweichungen der Gruppe: optional pro Nutzer & KW → überschreibt für
    // diese Woche den festen Plan (sonst gilt der feste Plan). Tabelle evtl. noch nicht da.
    let wsRows: { user_name: string; w: string; dow: number }[] = [];
    try {
      wsRows = (await sql`
        SELECT ws.user_name, ws.week_start::text AS w, c.day_of_week::int AS dow
        FROM weekly_schedule ws JOIN classes c ON c.id = ws.class_id
        WHERE c.group_id = ${groupId}
      `) as { user_name: string; w: string; dow: number }[];
    } catch { /* kein Wochenplan → nur fester Plan */ }
    const weekDows = new Map<string, Set<number>>(); // `${user}|${week_start}` → dows
    for (const r of wsRows) {
      const k = `${r.user_name}|${r.w}`;
      if (!weekDows.has(k)) weekDows.set(k, new Set());
      weekDows.get(k)!.add(r.dow);
    }
    const EMPTY: Set<number> = new Set();
    const dowsFor = (user: string, dateStr: string): Set<number> =>
      weekDows.get(`${user}|${weekStartOf(dateStr)}`) ?? userDows.get(user) ?? EMPTY;
    const allUsers = new Set<string>([...userDows.keys(), ...wsRows.map((r) => r.user_name)]);

    const presentRows = (await sql`
      SELECT a.user_name, (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date::text AS d
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE a.week_start >= ${weekStartOf(bStart)}::date AND a.week_start < ${bEnd}::date
        AND c.group_id = ${groupId}
    `) as { user_name: string; d: string }[];
    const present = new Set(presentRows.map((r) => `${r.user_name}|${r.d}`));

    const skipRows = (await sql`
      SELECT s.id, s.date::text AS date, s.user_name, s.excuse
      FROM skipping s WHERE s.date >= ${bStart}::date AND s.date < ${bEnd}::date
        AND s.group_id = ${groupId}
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

    // Eigene Wettkampftage: an dem Tag gibt es nie einen Chicken-Punkt.
    const compRows = (await sql`
      SELECT user_name, competition_date::text AS d FROM competitions
      WHERE competition_date >= ${bStart}::date AND competition_date < ${bEnd}::date
    `) as { user_name: string; d: string }[];
    const compSet = new Set(compRows.map((r) => `${r.user_name}|${r.d}`));

    // Ab wann zählt jemand in DIESER Gruppe? Erst ab dem Beitritt — sonst würde ein frisch
    // beigetretener Account mit Stundenplan rückwirkend Bitch-Punkte für den ganzen Vormonat
    // (vor seinem Beitritt) bekommen und fälschlich „Chicken des Monats" werden.
    const sinceRows = (await sql`
      SELECT user_name, created_at::date::text AS since FROM group_members
      WHERE group_id = ${groupId} AND created_at IS NOT NULL
    `) as { user_name: string; since: string }[];
    const joinFloor = new Map(sinceRows.map((r) => [r.user_name, r.since]));

    for (const user of allUsers) {
      const floor = joinFloor.get(user);
      let n = 0;
      for (let d = bStart; d < bEnd; d = addDaysStr(d, 1)) {
        if (floor && d < floor) continue;                 // vor dem Gruppen-Beitritt → kein Bitch
        if (!dowsFor(user, d).has(isodow(d))) continue;   // an dem Wochentag nichts geplant (KW-Plan)
        if (holidaySet.has(d)) continue;             // Feiertag
        if (exempt(user, d)) continue;               // krank/Urlaub
        if (compSet.has(`${user}|${d}`)) continue;   // eigener Wettkampftag → kein Bitch
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
    .filter(([user_name]) => !testers.has(user_name)) // Test-Accounts raus
    .map(([user_name, count]) => ({ user_name, count }))
    .sort((a, b) => b.count - a.count);
}
