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

    // Nach dem ECHTEN Trainingstag filtern, nicht nach week_start (Montag der Woche):
    // sonst fallen Trainings am Monatsanfang, deren Woche noch im Vormonat startet,
    // aus dem Monat heraus (Board wirkt Anfang des Monats leer).
    const rows = await sql`
      SELECT a.user_name, COUNT(*)::int AS attend_count
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid}
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date >= ${monthStart}::date
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date < (${monthStart}::date + INTERVAL '1 month')
      GROUP BY a.user_name
      ORDER BY attend_count DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
