import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId } from '@/lib/groups';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    if (!gid) return NextResponse.json([]); // alles gruppenbasiert: ohne Gruppe nichts
    const monthParam = req.nextUrl.searchParams.get('month'); // "2026-06"
    const monthStart = monthParam
      ? `${monthParam}-01`
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    // Nur aktuelle Mitglieder ranken — Anwesenheiten Ausgetretener bleiben in der DB,
    // sollen aber nicht mehr im Board auftauchen.
    const memberRows = (await sql`SELECT user_name FROM group_members WHERE group_id = ${gid} AND status = 'active'`) as { user_name: string }[];
    const members = memberRows.map((r) => r.user_name);
    if (members.length === 0) return NextResponse.json([]);

    // Nach dem ECHTEN Trainingstag filtern, nicht nach week_start (Montag der Woche):
    // sonst fallen Trainings am Monatsanfang, deren Woche noch im Vormonat startet,
    // aus dem Monat heraus (Board wirkt Anfang des Monats leer).
    const rows = (await sql`
      SELECT a.user_name, COUNT(*)::int AS attend_count
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid}
        AND a.user_name = ANY(${members}::text[])
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date >= ${monthStart}::date
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date < (${monthStart}::date + INTERVAL '1 month')
      GROUP BY a.user_name
    `) as { user_name: string; attend_count: number }[];

    // Sondertermin-Anmeldungen zählen wie ein Training (Macher-Punkt). Resilient, falls Tabelle fehlt.
    let evRows: { user_name: string; n: number }[] = [];
    try {
      evRows = (await sql`
        SELECT ea.user_name, COUNT(*)::int AS n
        FROM event_attendance ea JOIN group_events ge ON ge.id = ea.event_id
        WHERE ge.group_id = ${gid}
          AND ea.user_name = ANY(${members}::text[])
          AND ge.event_date >= ${monthStart}::date AND ge.event_date < (${monthStart}::date + INTERVAL '1 month')
        GROUP BY ea.user_name
      `) as { user_name: string; n: number }[];
    } catch { /* event_attendance evtl. noch nicht angelegt */ }

    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.user_name, r.attend_count);
    for (const r of evRows) counts.set(r.user_name, (counts.get(r.user_name) ?? 0) + r.n);
    const merged = [...counts.entries()]
      .map(([user_name, attend_count]) => ({ user_name, attend_count }))
      .sort((a, b) => b.attend_count - a.attend_count);
    return NextResponse.json(merged);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
