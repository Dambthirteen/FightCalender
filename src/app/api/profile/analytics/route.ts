import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile, getUserBundesland } from '@/lib/groups';
import { loadWeekPlan } from '@/lib/schedule';
import { isHolidayIn } from '@/lib/holidays';
import { berlinNow, weekStartOf, isoDayOfWeek } from '@/lib/berlin-time';
import { CUTOVER } from '@/lib/bitch-scoring';

/**
 * Persönliche Trainings-Analytics fürs Profil (Stats-Tab):
 * Gesamt, Heatmap, Erscheinungsquote (geplant vs. da), Monats-/Wochen-Trend,
 * bester Monat & aktivste Woche. Alles aus attendance × classes abgeleitet.
 */

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const RATE_WEEKS = 12; // Erscheinungsquote über die letzten 12 Wochen

export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json({ private: true });
    const sql = getSql();

    const rows = (await sql`
      SELECT (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date::text AS d
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE a.user_name = ${user}
    `) as { d: string }[];
    const dates = rows.map((r) => r.d);
    const present = new Set(dates);
    const total = dates.length;

    // Kurs-Aufteilung (wie oft in welchem Kurs) — für den Donut.
    const byCourse = (await sql`
      SELECT c.name AS name, c.color AS color, COUNT(*)::int AS n
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE a.user_name = ${user}
      GROUP BY c.name, c.color ORDER BY n DESC
    `) as { name: string; color: string; n: number }[];

    const perMonth: Record<string, number> = {};
    const perWeek: Record<string, number> = {};
    for (const d of dates) {
      const m = d.slice(0, 7);
      perMonth[m] = (perMonth[m] ?? 0) + 1;
      const w = weekStartOf(d);
      perWeek[w] = (perWeek[w] ?? 0) + 1;
    }

    const today = berlinNow().date;
    const curMonth = today.slice(0, 7);
    const lastMonth = addDaysStr(`${curMonth}-01`, -1).slice(0, 7);
    const curWeek = weekStartOf(today);

    // Bester Monat / aktivste Woche (all-time)
    let bestMonth: { m: string; n: number } | null = null;
    for (const [m, n] of Object.entries(perMonth)) if (!bestMonth || n > bestMonth.n) bestMonth = { m, n };
    let bestWeek: { w: string; n: number } | null = null;
    for (const [w, n] of Object.entries(perWeek)) if (!bestWeek || n > bestWeek.n) bestWeek = { w, n };

    // Trend: letzte 12 Wochen (inkl. Null-Wochen)
    const weeks: { w: string; n: number }[] = [];
    for (let i = 11; i >= 0; i--) { const w = addDaysStr(curWeek, -7 * i); weeks.push({ w, n: perWeek[w] ?? 0 }); }

    // Gemeinsame Basis für Heatmap-Status & Erscheinungsquote.
    const plan = await loadWeekPlan(sql, user);
    const bl = await getUserBundesland(user);
    const stRows = (await sql`
      SELECT status_type AS t, start_date::text AS s, end_date::text AS e FROM user_status
      WHERE user_name = ${user} AND status_type IN ('sick','injured','vacation')
    `) as { t: string; s: string; e: string }[];
    const inRange = (d: string, types: string[]) => stRows.some((x) => types.includes(x.t) && d >= x.s && d <= x.e);
    const compRows = (await sql`SELECT competition_date::text AS d FROM competitions WHERE user_name = ${user}`) as { d: string }[];
    const compSet = new Set(compRows.map((r) => r.d));
    const isPlanned = (d: string) => plan.hasAny && !isHolidayIn(d, bl) && plan.dowsFor(weekStartOf(d)).has(isoDayOfWeek(d));

    // Heatmap-Fenster ab Tracking-Start (Konto-Erstellung, frühestens CUTOVER) — kein leeres Vorjahr.
    const createdRows = (await sql`SELECT created_at::date::text AS d FROM users WHERE user_name = ${user}`) as { d: string }[];
    const created = createdRows[0]?.d ?? CUTOVER;
    const since = created > CUTOVER ? created : CUTOVER;

    // Status je Tag ab `since` (nur Tage mit Status).
    // Priorität: Wettkampf(gold) > trainiert(grün) > krank/verletzt(lila) > Urlaub(blau) > verpasst(rot).
    const days: { d: string; status: string }[] = [];
    let hd = since;
    for (let guard = 0; guard <= 400 && hd <= today; guard++, hd = addDaysStr(hd, 1)) {
      let status: string | null = null;
      if (compSet.has(hd)) status = 'competition';
      else if (present.has(hd)) status = 'attended';
      else if (inRange(hd, ['sick', 'injured'])) status = 'sick';
      else if (inRange(hd, ['vacation'])) status = 'vacation';
      else if (hd < today && isPlanned(hd)) status = 'missed';
      if (status) days.push({ d: hd, status });
    }

    // Erscheinungsquote über die letzten RATE_WEEKS Wochen (geplant vs. tatsächlich da).
    let rate: { planned: number; attended: number; pct: number } | null = null;
    if (plan.hasAny) {
      let plannedN = 0, attendedN = 0;
      for (let i = 0; i < RATE_WEEKS; i++) {
        const ws = addDaysStr(curWeek, -7 * i);
        const dows = plan.dowsFor(ws);
        for (let off = 0; off < 7; off++) {
          const d = addDaysStr(ws, off);
          if (d > today) continue;                  // Zukunft überspringen
          if (!dows.has(isoDayOfWeek(d))) continue; // kein geplanter Tag
          if (isHolidayIn(d, bl)) continue;
          if (inRange(d, ['sick', 'injured', 'vacation'])) continue; // zählt nicht dagegen
          plannedN++;
          if (present.has(d)) attendedN++;
        }
      }
      if (plannedN > 0) rate = { planned: plannedN, attended: attendedN, pct: Math.round((attendedN / plannedN) * 100) };
    }

    return NextResponse.json({
      total,
      thisMonth: perMonth[curMonth] ?? 0,
      lastMonth: perMonth[lastMonth] ?? 0,
      bestMonth, bestWeek, days, since, weeks, byCourse, rate, rateWeeks: RATE_WEEKS,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
