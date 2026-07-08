import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, isHardMode, getUserBundesland } from '@/lib/groups';
import { isHolidayIn } from '@/lib/holidays';
import { berlinNow, weekStartOf, isoDayOfWeek } from '@/lib/berlin-time';
import { CUTOVER } from '@/lib/bitch-scoring';

/**
 * Gruppenstatistiken für die aktuelle Gruppe: Aktivität je Person, Erscheinungsquote je Person
 * + Schnitt, Trainingspartner-Paare, Kurs-Könige, Lob (gegeben/bekommen), Gruppen-Heatmap.
 * Alles aus attendance/user_schedule/user_status/praises abgeleitet (rückwirkend).
 */

function getSql() {
  return neon(process.env.DATABASE_URL!);
}
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const RATE_WEEKS = 12;

export async function GET() {
  try {
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    if (!gid) return NextResponse.json({ group: false });
    const sql = getSql();

    const memberRows = (await sql`SELECT user_name FROM group_members WHERE group_id = ${gid} AND status = 'active'`) as { user_name: string }[];
    const members = memberRows.map((r) => r.user_name);
    if (members.length === 0) return NextResponse.json({ group: true, members: [] });

    const hardMode = await isHardMode(gid);
    const bl = await getUserBundesland(me!);

    // Anwesenheiten der Gruppe (echtes Trainingsdatum).
    const attRows = (await sql`
      SELECT a.user_name AS u, (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date::text AS d
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid}
    `) as { u: string; d: string }[];
    const presentByUser = new Map<string, Set<string>>();
    const totalByUser = new Map<string, number>();
    const heatMap = new Map<string, number>();
    let groupSince = berlinNow().date;
    for (const r of attRows) {
      if (!presentByUser.has(r.u)) presentByUser.set(r.u, new Set());
      presentByUser.get(r.u)!.add(r.d);
      totalByUser.set(r.u, (totalByUser.get(r.u) ?? 0) + 1);
      heatMap.set(r.d, (heatMap.get(r.d) ?? 0) + 1);
      if (r.d < groupSince) groupSince = r.d;
    }
    const heat = Array.from(heatMap.entries()).map(([d, n]) => ({ d, n }));

    // Trainingspartner: gleiche Session (gleicher Kurs + gleiche Woche) = zusammen trainiert.
    const partners = (await sql`
      SELECT a1.user_name AS a, a2.user_name AS b, COUNT(*)::int AS n
      FROM attendance a1
      JOIN attendance a2 ON a1.class_id = a2.class_id AND a1.week_start = a2.week_start AND a1.user_name < a2.user_name
      JOIN classes c ON c.id = a1.class_id
      WHERE c.group_id = ${gid}
      GROUP BY a1.user_name, a2.user_name ORDER BY n DESC LIMIT 8
    `) as { a: string; b: string; n: number }[];

    // Kurs-König: wer ist am öftesten in welchem Kurs.
    const perCourse = (await sql`
      SELECT DISTINCT ON (c.name) c.name AS course, c.color AS color, a.user_name AS user, COUNT(*)::int AS n
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid}
      GROUP BY c.name, c.color, a.user_name
      ORDER BY c.name, n DESC
    `) as { course: string; color: string; user: string; n: number }[];

    // Lob bekommen / gegeben (innerhalb der Gruppe).
    const lobReceived = (await sql`
      SELECT to_user AS user, COUNT(*)::int AS n FROM praises
      WHERE to_user = ANY(${members}::text[]) GROUP BY to_user ORDER BY n DESC LIMIT 8
    `) as { user: string; n: number }[];
    const lobGiven = (await sql`
      SELECT from_user AS user, COUNT(*)::int AS n FROM praises
      WHERE from_user = ANY(${members}::text[]) GROUP BY from_user ORDER BY n DESC LIMIT 8
    `) as { user: string; n: number }[];

    // Bulk-Wochenplan (fest + KW-Abweichung) für die Erscheinungsquote je Person.
    const defRows = (await sql`
      SELECT us.user_name AS u, c.day_of_week AS dow
      FROM user_schedule us JOIN classes c ON c.id = us.class_id
      WHERE us.user_name = ANY(${members}::text[])
    `) as { u: string; dow: number }[];
    const ovRows = (await sql`
      SELECT ws.user_name AS u, ws.week_start::text AS w, c.day_of_week AS dow
      FROM weekly_schedule ws JOIN classes c ON c.id = ws.class_id
      WHERE ws.user_name = ANY(${members}::text[])
    `) as { u: string; w: string; dow: number }[];
    const defByUser = new Map<string, Set<number>>();
    for (const r of defRows) { if (!defByUser.has(r.u)) defByUser.set(r.u, new Set()); defByUser.get(r.u)!.add(r.dow); }
    const ovByUser = new Map<string, Map<string, Set<number>>>();
    for (const r of ovRows) {
      if (!ovByUser.has(r.u)) ovByUser.set(r.u, new Map());
      const m = ovByUser.get(r.u)!;
      if (!m.has(r.w)) m.set(r.w, new Set());
      m.get(r.w)!.add(r.dow);
    }

    // Status (krank/verletzt/Urlaub) + Konto-Erstellung je Person.
    const stRows = (await sql`
      SELECT user_name AS u, start_date::text AS s, end_date::text AS e FROM user_status
      WHERE user_name = ANY(${members}::text[]) AND status_type IN ('sick','injured','vacation')
    `) as { u: string; s: string; e: string }[];
    const stByUser = new Map<string, { s: string; e: string }[]>();
    for (const r of stRows) { if (!stByUser.has(r.u)) stByUser.set(r.u, []); stByUser.get(r.u)!.push({ s: r.s, e: r.e }); }
    const createdRows = (await sql`SELECT user_name AS u, created_at::date::text AS d FROM users WHERE user_name = ANY(${members}::text[])`) as { u: string; d: string }[];
    const createdByUser = new Map(createdRows.map((r) => [r.u, r.d]));

    const today = berlinNow().date;
    const curWeek = weekStartOf(today);

    const memberStats = members.map((u) => {
      const total = totalByUser.get(u) ?? 0;
      const def = defByUser.get(u);
      const ov = ovByUser.get(u);
      let ratePct: number | null = null;
      if ((def && def.size) || (ov && ov.size)) {
        const created = createdByUser.get(u) ?? CUTOVER;
        const since = created > CUTOVER ? created : CUTOVER;
        const present = presentByUser.get(u) ?? new Set<string>();
        const ranges = stByUser.get(u) ?? [];
        const exempt = (d: string) => ranges.some((x) => d >= x.s && d <= x.e);
        let planned = 0, attended = 0;
        for (let i = 0; i < RATE_WEEKS; i++) {
          const ws = addDaysStr(curWeek, -7 * i);
          const dows = ov?.get(ws) ?? def ?? new Set<number>();
          for (let off = 0; off < 7; off++) {
            const d = addDaysStr(ws, off);
            if (d > today || d < since) continue;
            if (!dows.has(isoDayOfWeek(d))) continue;
            if (isHolidayIn(d, bl)) continue;
            if (exempt(d)) continue;
            planned++;
            if (present.has(d)) attended++;
          }
        }
        if (planned > 0) ratePct = Math.round((attended / planned) * 100);
      }
      return { user: u, total, ratePct };
    });
    const rated = memberStats.filter((m) => m.ratePct !== null);
    const avgRate = rated.length ? Math.round(rated.reduce((s, m) => s + (m.ratePct ?? 0), 0) / rated.length) : null;

    return NextResponse.json({
      group: true, hardMode, avgRate, since: groupSince,
      members: memberStats, partners, perCourse, lobReceived, lobGiven, heat,
    });
  } catch (error) {
    return NextResponse.json({ group: false, error: String(error) }, { status: 500 });
  }
}
