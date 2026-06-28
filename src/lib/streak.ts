import { berlinNow, weekStartOf } from './berlin-time';
import { isHoliday } from './holidays';
import { CUTOVER } from './bitch-scoring';

/**
 * Persönliche Trainings-Streak: aufeinanderfolgende ABGESCHLOSSENE Wochen, in denen
 * der Nutzer keinen geplanten Trainingstag „geskippt" hat (No-Show ohne Befreiung).
 *
 * Eine Woche bricht die Streak, sobald an einem geplanten Tag gilt: kein Feiertag,
 * nicht krank/Urlaub, NICHT anwesend — UND der Skip wurde nicht mit einem
 * Streak-Punkt geschützt (streak_protected). Geschützte Skips zählen weiter als
 * Bitch-Punkt, brechen aber die Streak nicht.
 *
 * Bewusst PERSÖNLICH (über alle Gruppen), da Streak/Badges Profil-Erfolge sind.
 * Gezählt wird erst ab dem Stichtag (CUTOVER) — davor wurden No-Shows nicht abgeleitet.
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

export async function getStreakWeeks(sql: Sql, user: string): Promise<number> {
  // Geplante Wochentage (aktueller Stundenplan, über alle Gruppen).
  const schedRows = (await sql`
    SELECT DISTINCT c.day_of_week::int AS dow
    FROM user_schedule us JOIN classes c ON c.id = us.class_id
    WHERE us.user_name = ${user}
  `) as { dow: number }[];
  const dows = new Set(schedRows.map((r) => r.dow));
  if (dows.size === 0) return 0;

  // Anwesenheits-Tage.
  const attRows = (await sql`
    SELECT (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date::text AS d
    FROM attendance a JOIN classes c ON c.id = a.class_id
    WHERE a.user_name = ${user}
  `) as { d: string }[];
  const present = new Set(attRows.map((r) => r.d));

  // Mit Streak-Punkt geschützte Skip-Tage.
  const skipRows = (await sql`
    SELECT date::text AS d FROM skipping WHERE user_name = ${user} AND streak_protected = TRUE
  `) as { d: string }[];
  const protectedDays = new Set(skipRows.map((r) => r.d));

  // Krank/Urlaub-Zeiträume (befreien).
  const statusRows = (await sql`
    SELECT start_date::text AS s, end_date::text AS e FROM user_status
    WHERE user_name = ${user} AND status_type IN ('sick', 'vacation')
  `) as { s: string; e: string }[];
  const exempt = (d: string) => statusRows.some((x) => d >= x.s && d <= x.e);

  const curWeekStart = weekStartOf(berlinNow().date);
  const cutoverWeek = weekStartOf(CUTOVER);

  let streak = 0;
  for (let i = 1; i <= 60; i++) {
    const ws = addDaysStr(curWeekStart, -7 * i); // i-te abgeschlossene Woche vor dieser
    if (ws < cutoverWeek) break;

    let hadScheduled = false;
    let broke = false;
    for (let off = 0; off < 7; off++) {
      const d = addDaysStr(ws, off);
      if (!dows.has(isodow(d))) continue;
      if (isHoliday(d)) continue;
      if (exempt(d)) continue;
      hadScheduled = true;
      if (present.has(d)) continue;
      if (protectedDays.has(d)) continue;
      broke = true;
      break;
    }
    if (broke) break;
    if (hadScheduled) streak++;
    // Woche ohne geplante Tage = neutral: weder Bruch noch Zähler.
  }
  return streak;
}
