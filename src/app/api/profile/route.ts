import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';
import { berlinNow, weekStartOf } from '@/lib/berlin-time';
import { CUTOVER } from '@/lib/bitch-scoring';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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

    // Vergangenheit einfrieren: den ALTEN Plan als KW-Override für alle ABGESCHLOSSENEN
    // Wochen festschreiben (wo noch kein Override existiert), damit eine Plan-Änderung
    // die Streak-/Wertungs-Historie nicht rückwirkend umschreibt. Neuer Plan gilt ab
    // der laufenden Woche. Nur wenn es einen alten (nicht leeren) Plan gibt.
    if (curIds.size > 0) {
      try {
        const today = berlinNow().date;
        const curWeek = weekStartOf(today);
        const cRows = (await sql`SELECT created_at::date::text AS d FROM users WHERE user_name = ${me}`) as { d: string | null }[];
        let startWeek = weekStartOf(cRows[0]?.d ?? CUTOVER);
        const minWeek = weekStartOf(addDaysStr(today, -60 * 7)); // so weit blickt die Streak zurück
        if (startWeek < minWeek) startWeek = minWeek;
        const existing = new Set(
          ((await sql`SELECT DISTINCT week_start::text AS w FROM weekly_schedule WHERE user_name = ${me}`) as { w: string }[]).map((r) => r.w),
        );
        const weeks: string[] = [];
        for (let w = startWeek; w < curWeek; w = addDaysStr(w, 7)) if (!existing.has(w)) weeks.push(w);
        if (weeks.length > 0) {
          const oldIds = [...curIds];
          await sql`
            INSERT INTO weekly_schedule (user_name, week_start, class_id)
            SELECT ${me}, w::date, c
            FROM unnest(${weeks}::text[]) AS w, unnest(${oldIds}::int[]) AS c
            ON CONFLICT DO NOTHING
          `;
        }
      } catch { /* weekly_schedule evtl. noch nicht da → Snapshot überspringen */ }
    }

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
