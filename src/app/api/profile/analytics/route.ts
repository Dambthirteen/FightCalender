import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile, getUserBundesland } from '@/lib/groups';
import { loadWeekPlan } from '@/lib/schedule';
import { isHolidayIn } from '@/lib/holidays';
import { berlinNow, weekStartOf, isoDayOfWeek } from '@/lib/berlin-time';

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

    const perDay: Record<string, number> = {};
    const perMonth: Record<string, number> = {};
    const perWeek: Record<string, number> = {};
    for (const d of dates) {
      perDay[d] = (perDay[d] ?? 0) + 1;
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

    // Heatmap: letzte 371 Tage, nur Tage mit >0
    const cutoff = addDaysStr(today, -371);
    const heat = Object.entries(perDay).filter(([d]) => d >= cutoff).map(([d, n]) => ({ d, n }));

    // Trend: letzte 12 Wochen (inkl. Null-Wochen)
    const weeks: { w: string; n: number }[] = [];
    for (let i = 11; i >= 0; i--) { const w = addDaysStr(curWeek, -7 * i); weeks.push({ w, n: perWeek[w] ?? 0 }); }

    // Erscheinungsquote über die letzten RATE_WEEKS Wochen (geplant vs. tatsächlich da)
    let rate: { planned: number; attended: number; pct: number } | null = null;
    const plan = await loadWeekPlan(sql, user);
    if (plan.hasAny) {
      const bl = await getUserBundesland(user);
      const statusRows = (await sql`
        SELECT start_date::text AS s, end_date::text AS e FROM user_status
        WHERE user_name = ${user} AND status_type IN ('sick','vacation','injured')
      `) as { s: string; e: string }[];
      const exempt = (d: string) => statusRows.some((x) => d >= x.s && d <= x.e);
      let planned = 0, attended = 0;
      for (let i = 0; i < RATE_WEEKS; i++) {
        const ws = addDaysStr(curWeek, -7 * i);
        const dows = plan.dowsFor(ws);
        for (let off = 0; off < 7; off++) {
          const d = addDaysStr(ws, off);
          if (d > today) continue;                 // Zukunft überspringen
          if (!dows.has(isoDayOfWeek(d))) continue; // kein geplanter Tag
          if (isHolidayIn(d, bl)) continue;
          if (exempt(d)) continue;                  // krank/verletzt/Urlaub zählt nicht
          planned++;
          if (present.has(d)) attended++;
        }
      }
      if (planned > 0) rate = { planned, attended, pct: Math.round((attended / planned) * 100) };
    }

    return NextResponse.json({
      total,
      thisMonth: perMonth[curMonth] ?? 0,
      lastMonth: perMonth[lastMonth] ?? 0,
      bestMonth, bestWeek, heat, weeks, rate, rateWeeks: RATE_WEEKS,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
