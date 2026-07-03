import { berlinNow, weekStartOf } from './berlin-time';
import { isHolidayIn } from './holidays';
import { CUTOVER } from './bitch-scoring';

/**
 * Persönliche Trainings-Streak in zwei Einheiten:
 *  - days:  besuchte geplante Trainings am Stück (Hauptzahl, granular)
 *  - weeks: abgeschlossene Wochen ohne Trainings-Skip am Stück (für Badges)
 *
 * Ein geplanter Tag bricht die Streak nur, wenn er ein BESTÄTIGTER Bitch-Punkt ist:
 * nicht anwesend, nicht krank/Urlaub, nicht geschützt (streak_protected), kein Feiertag,
 * außerhalb der 3-Tage-Kulanz UND ohne (nicht abgelehnte) Ausrede. Frische Fehltage
 * (Kulanz) und offene/angenommene Ausreden sind neutral — so bricht die Streak nicht,
 * nur weil man mal kurzfristig getauscht oder sich gemeldet hat.
 *
 * Bewusst PERSÖNLICH (über alle Gruppen); zählt zurück bis zur Konto-Erstellung.
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

  // Ausreden je Tag mit ihren Gericht-Stimmen. Für die Streak-Kulanz gilt: eine
  // eingetragene Ausrede verschont den Tag, SOLANGE sie nicht abgelehnt ist
  // (reject > accept). So bricht die Streak nicht, während die Ausrede noch offen ist.
  const exRows = (await sql`
    SELECT s.date::text AS d,
      COUNT(*) FILTER (WHERE ev.vote = 'accept')::int AS accept,
      COUNT(*) FILTER (WHERE ev.vote = 'reject')::int AS reject
    FROM skipping s LEFT JOIN excuse_votes ev ON ev.skip_id = s.id
    WHERE s.user_name = ${user} AND s.excuse != ''
    GROUP BY s.date
  `) as { d: string; accept: number; reject: number }[];
  const excuseByDay = new Map(exRows.map((r) => [r.d, { accept: r.accept, reject: r.reject }]));

  // Streak zählt ab Konto-Erstellung (statt ab dem harten CUTOVER). Kann eine Streak
  // nur VERLÄNGERN, nie verkürzen — sie bricht weiterhin am ersten geplanten Tag ohne
  // Anwesenheits-Eintrag. Fallback auf CUTOVER, falls kein Datum vorliegt.
  const cRows = (await sql`SELECT created_at::date::text AS d FROM users WHERE user_name = ${user}`) as { d: string }[];
  const floor = cRows[0]?.d ?? CUTOVER;
  const floorWeek = weekStartOf(floor);

  const today = berlinNow().date;

  // 3 Tage Kulanz: ein Fehltag wird erst danach ein bestätigter Bitch-Punkt.
  const graceCutoff = addDaysStr(today, -3);
  // Bricht dieser geplante, nicht besuchte, nicht befreite, nicht geschützte Tag die Streak?
  // Nur wenn er ein BESTÄTIGTER Bitch-Punkt ist: außerhalb der 3-Tage-Kulanz UND ohne
  // (nicht abgelehnte) Ausrede. Solange in Kulanz oder Ausrede offen → neutral, kein Bruch.
  const breaksStreak = (dd: string): boolean => {
    if (dd > graceCutoff) return false;                 // noch in der Kulanz
    const ex = excuseByDay.get(dd);
    if (ex && ex.accept >= ex.reject) return false;     // Ausrede eingetragen & nicht abgelehnt
    return true;                                         // bestätigter Bitch-Punkt
  };

  // --- Tage: geplante Trainings am Stück (rückwärts ab heute) ---
  let days = 0;
  let d = today;
  for (let guard = 0; guard < 400 && d >= floor; guard++, d = addDaysStr(d, -1)) {
    if (!dows.has(isodow(d))) continue;
    if (isHolidayIn(d, bundesland)) continue;
    if (exempt(d)) continue;
    if (present.has(d)) { days++; continue; }
    if (protectedDays.has(d)) continue;       // geschützt → neutral
    if (!breaksStreak(d)) continue;           // 3-Tage-Kulanz / offene Ausrede → neutral
    break;                                     // bestätigter Bitch-Punkt → Bruch
  }

  // --- Wochen: abgeschlossene saubere Wochen am Stück (für Badges) ---
  const curWeekStart = weekStartOf(today);
  let weeks = 0;
  for (let i = 1; i <= 60; i++) {
    const ws = addDaysStr(curWeekStart, -7 * i);
    if (ws < floorWeek) break;
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
      if (!breaksStreak(wd)) continue;
      broke = true;
      break;
    }
    if (broke) break;
    if (hadScheduled) weeks++;
  }

  return { days, weeks };
}
