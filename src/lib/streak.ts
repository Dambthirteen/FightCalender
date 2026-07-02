import { berlinNow, weekStartOf } from './berlin-time';
import { isHolidayIn } from './holidays';
import { CUTOVER } from './bitch-scoring';

/**
 * Persönliche Trainings-Streak in zwei Einheiten:
 *  - days:  besuchte geplante Trainings am Stück (Hauptzahl, granular)
 *  - weeks: abgeschlossene Wochen ohne Trainings-Skip am Stück (für Badges)
 *
 * Ein geplanter Tag bricht die Streak nur, wenn: kein Feiertag, nicht krank/Urlaub,
 * NICHT anwesend UND nicht mit einem Streak-Punkt geschützt (streak_protected).
 * Geschützte/befreite/Feiertags-Tage sind neutral (kein Bruch, kein +). Heute ist
 * neutral, solange noch nichts eingetragen ist (Training evtl. noch ausstehend).
 *
 * Bewusst PERSÖNLICH (über alle Gruppen) und erst ab dem Stichtag (CUTOVER).
 */

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

export interface Streak { days: number; weeks: number; }

export async function getStreak(sql: Sql, user: string, bundesland: string = 'NW'): Promise<Streak> {
  const schedRows = (await sql`
    SELECT DISTINCT c.day_of_week::int AS dow
    FROM user_schedule us JOIN classes c ON c.id = us.class_id
    WHERE us.user_name = ${user}
  `) as { dow: number }[];
  const dows = new Set(schedRows.map((r) => r.dow));
  if (dows.size === 0) return { days: 0, weeks: 0 };

  const attRows = (await sql`
    SELECT (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date::text AS d
    FROM attendance a JOIN classes c ON c.id = a.class_id
    WHERE a.user_name = ${user}
  `) as { d: string }[];
  const present = new Set(attRows.map((r) => r.d));

  const skipRows = (await sql`
    SELECT date::text AS d FROM skipping WHERE user_name = ${user} AND streak_protected = TRUE
  `) as { d: string }[];
  const protectedDays = new Set(skipRows.map((r) => r.d));

  const statusRows = (await sql`
    SELECT start_date::text AS s, end_date::text AS e FROM user_status
    WHERE user_name = ${user} AND status_type IN ('sick', 'vacation')
  `) as { s: string; e: string }[];
  const exempt = (d: string) => statusRows.some((x) => d >= x.s && d <= x.e);

  const today = berlinNow().date;

  // --- Tage: geplante Trainings am Stück (rückwärts ab heute) ---
  let days = 0;
  let d = today;
  for (let guard = 0; guard < 400 && d >= CUTOVER; guard++, d = addDaysStr(d, -1)) {
    if (!dows.has(isodow(d))) continue;
    if (isHolidayIn(d, bundesland)) continue;
    if (exempt(d)) continue;
    if (present.has(d)) { days++; continue; }
    if (protectedDays.has(d)) continue;       // geschützt → neutral
    if (d === today) continue;                // heute noch offen → neutral
    break;                                     // ungeschützter No-Show in der Vergangenheit → Bruch
  }

  // --- Wochen: abgeschlossene saubere Wochen am Stück (für Badges) ---
  const curWeekStart = weekStartOf(today);
  const cutoverWeek = weekStartOf(CUTOVER);
  let weeks = 0;
  for (let i = 1; i <= 60; i++) {
    const ws = addDaysStr(curWeekStart, -7 * i);
    if (ws < cutoverWeek) break;
    let hadScheduled = false;
    let broke = false;
    for (let off = 0; off < 7; off++) {
      const wd = addDaysStr(ws, off);
      if (!dows.has(isodow(wd))) continue;
      if (isHolidayIn(wd, bundesland)) continue;
      if (exempt(wd)) continue;
      hadScheduled = true;
      if (present.has(wd)) continue;
      if (protectedDays.has(wd)) continue;
      broke = true;
      break;
    }
    if (broke) break;
    if (hadScheduled) weeks++;
  }

  return { days, weeks };
}
