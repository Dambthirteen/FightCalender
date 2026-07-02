import { berlinNow, weekStartOf } from './berlin-time';
import { isHolidayIn } from './holidays';
import { CUTOVER } from './bitch-scoring';

/**
 * Streak-Punkte verdienen (gedeckelt) + Vergabe-Ledger gegen Doppel-Vergabe.
 * Kontostand = users.streak_points. Quellen: perfekte Woche, Streak-Badge,
 * erhaltenes Gigalob, Werbung (Platzhalter, 1×/Woche).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export const STREAK_POINT_CAP = 5; // Knappheit: max. so viele horten
export type PointKind = 'perfect_week' | 'streak_badge' | 'gigalob' | 'ad';

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isodow(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return ((d.getUTCDay() + 6) % 7) + 1;
}

/** Vergibt genau einmal je (kind, ref) einen Punkt, gedeckelt auf STREAK_POINT_CAP. */
export async function grantStreakPoint(sql: Sql, user: string, kind: PointKind, ref: string): Promise<boolean> {
  const ins = await sql`
    INSERT INTO streak_point_log (user_name, kind, ref) VALUES (${user}, ${kind}, ${ref})
    ON CONFLICT (user_name, kind, ref) DO NOTHING RETURNING id
  `;
  if (ins.length === 0) return false; // schon vergeben
  await sql`UPDATE users SET streak_points = LEAST(${STREAK_POINT_CAP}, streak_points + 1) WHERE user_name = ${user}`;
  return true;
}

/** Aktuelle Wochenstart-Kennung (für die 1×/Woche-Werbung). */
export function currentWeekRef(): string {
  return weekStartOf(berlinNow().date);
}

/** Vergibt Punkte für zuletzt abgeschlossene PERFEKTE Wochen (alle geplanten Tage anwesend). */
export async function awardPerfectWeeks(sql: Sql, user: string, bundesland: string = 'NW'): Promise<void> {
  const schedRows = (await sql`
    SELECT DISTINCT c.day_of_week::int AS dow
    FROM user_schedule us JOIN classes c ON c.id = us.class_id
    WHERE us.user_name = ${user}
  `) as { dow: number }[];
  const dows = new Set(schedRows.map((r) => r.dow));
  if (dows.size === 0) return;

  const attRows = (await sql`
    SELECT (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date::text AS d
    FROM attendance a JOIN classes c ON c.id = a.class_id
    WHERE a.user_name = ${user}
  `) as { d: string }[];
  const present = new Set(attRows.map((r) => r.d));

  const statusRows = (await sql`
    SELECT start_date::text AS s, end_date::text AS e FROM user_status
    WHERE user_name = ${user} AND status_type IN ('sick', 'vacation')
  `) as { s: string; e: string }[];
  const exempt = (d: string) => statusRows.some((x) => d >= x.s && d <= x.e);

  const curWeekStart = weekStartOf(berlinNow().date);
  const cutoverWeek = weekStartOf(CUTOVER);

  // Letzte 8 abgeschlossene Wochen prüfen (deckt typische Login-Lücken ab; Cap begrenzt eh).
  for (let i = 1; i <= 8; i++) {
    const ws = addDaysStr(curWeekStart, -7 * i);
    if (ws < cutoverWeek) break;
    let hadScheduled = false;
    let perfect = true;
    for (let off = 0; off < 7; off++) {
      const d = addDaysStr(ws, off);
      if (!dows.has(isodow(d))) continue;
      if (isHolidayIn(d, bundesland)) continue;
      if (exempt(d)) continue;
      hadScheduled = true;
      if (!present.has(d)) { perfect = false; break; } // echte perfekte Woche: wirklich da gewesen
    }
    if (hadScheduled && perfect) {
      await grantStreakPoint(sql, user, 'perfect_week', ws);
    }
  }
}
