import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId } from '@/lib/groups';
import { berlinNow, weekStartOf } from '@/lib/berlin-time';
import { isCoach } from '@/lib/fighter';

function getSql() { return neon(process.env.DATABASE_URL!); }
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const currentWeekStart = () => weekStartOf(berlinNow().date);

async function myRole(sql: ReturnType<typeof getSql>, me: string): Promise<string | null> {
  try {
    const [r] = (await sql`SELECT fighter_info->>'role' AS role FROM users WHERE user_name = ${me}`) as { role: string | null }[];
    return r?.role ?? null;
  } catch { return null; }
}

/**
 * GET ?week=YYYY-MM-DD → Kurse, die ICH (Coach) diese KW gebe.
 * GET ?week=…&all=1   → { coaches: { [classId]: [name,…] } } für die aktuelle Gruppe (für den Kalender).
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const week = req.nextUrl.searchParams.get('week');
  if (!week || !WEEK_RE.test(week)) return NextResponse.json({ error: 'Ungültige Woche' }, { status: 400 });
  const sql = getSql();

  if (req.nextUrl.searchParams.get('all')) {
    const gid = await getCurrentGroupId(me);
    const rows = gid ? ((await sql`
      SELECT cs.class_id, cs.user_name FROM coach_schedule cs
      JOIN classes c ON c.id = cs.class_id AND c.group_id = ${gid}
      JOIN group_members gm ON gm.user_name = cs.user_name AND gm.group_id = ${gid} AND gm.status = 'active'
      WHERE cs.week_start = ${week}
    `) as { class_id: number; user_name: string }[]) : [];
    const coaches: Record<number, string[]> = {};
    for (const r of rows) (coaches[r.class_id] ??= []).push(r.user_name);
    return NextResponse.json({ coaches });
  }

  const rows = (await sql`SELECT class_id FROM coach_schedule WHERE user_name = ${me} AND week_start = ${week}`) as { class_id: number }[];
  return NextResponse.json({ classIds: rows.map((r) => r.class_id), isCurrentWeek: week === currentWeekStart() });
}

/** POST { week, classIds } → Trainingsplan der aktuellen KW setzen (nur Coaches). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  if (!isCoach(await myRole(sql, me))) return NextResponse.json({ error: 'Nur für Coaches.' }, { status: 403 });

  const { week, classIds } = await req.json();
  if (!week || !WEEK_RE.test(String(week))) return NextResponse.json({ error: 'Ungültige Woche' }, { status: 400 });
  if (String(week) !== currentWeekStart()) return NextResponse.json({ error: 'Nur die aktuelle Woche.' }, { status: 403 });

  const gid = await getCurrentGroupId(me);
  const valid = gid ? ((await sql`SELECT id FROM classes WHERE group_id = ${gid}`) as { id: number }[]) : [];
  const validSet = new Set(valid.map((r) => r.id));
  const ids = Array.isArray(classIds) ? classIds.map(Number).filter((n) => Number.isInteger(n) && validSet.has(n)) : [];

  await sql`DELETE FROM coach_schedule WHERE user_name = ${me} AND week_start = ${week}`;
  for (const id of ids) {
    await sql`INSERT INTO coach_schedule (user_name, week_start, class_id) VALUES (${me}, ${week}, ${id}) ON CONFLICT DO NOTHING`;
  }
  return NextResponse.json({ ok: true, classIds: ids });
}
