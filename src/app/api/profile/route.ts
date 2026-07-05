import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json([]); // nicht sichtbar → nichts
    const sql = getSql();
    const rows = await sql`SELECT class_id FROM user_schedule WHERE user_name = ${user}`;
    return NextResponse.json(rows.map((r) => r.class_id));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

const LOCK_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classIds } = await req.json();
    if (!Array.isArray(classIds)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const sql = getSql();

    // Nur bei echter Änderung greift die 7-Tage-Sperre (feste Wertungsbasis, gegen Tricksen).
    const cur = (await sql`SELECT class_id FROM user_schedule WHERE user_name = ${me}`) as { class_id: number }[];
    const curIds = new Set(cur.map((r) => r.class_id));
    const newIds = new Set<number>(classIds.map((x: unknown) => Number(x)));
    const changed = curIds.size !== newIds.size || [...newIds].some((id) => !curIds.has(id));

    if (!changed) return NextResponse.json({ ok: true, unchanged: true });

    // Sperre prüfen (Spalte evtl. noch nicht da → dann keine Sperre).
    try {
      const row = (await sql`SELECT schedule_changed_at AS t FROM users WHERE user_name = ${me}`) as { t: string | null }[];
      const last = row[0]?.t ? new Date(row[0].t) : null;
      if (last) {
        const until = new Date(last.getTime() + LOCK_DAYS * 86400000);
        if (Date.now() < until.getTime()) {
          return NextResponse.json({ error: 'Fester Plan gesperrt.', lockedUntil: until.toISOString() }, { status: 403 });
        }
      }
    } catch { /* Spalte fehlt → ohne Sperre weiter */ }

    // Immer nur den EIGENEN Stundenplan ändern — nie fremde Namen aus dem Body.
    await sql`DELETE FROM user_schedule WHERE user_name = ${me}`;
    for (const id of newIds) {
      await sql`INSERT INTO user_schedule (user_name, class_id) VALUES (${me}, ${id}) ON CONFLICT DO NOTHING`;
    }
    try { await sql`UPDATE users SET schedule_changed_at = NOW() WHERE user_name = ${me}`; } catch { /* Spalte fehlt → egal */ }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
