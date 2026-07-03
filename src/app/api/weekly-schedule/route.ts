import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId } from '@/lib/groups';

function getSql() { return neon(process.env.DATABASE_URL!); }

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?week=YYYY-MM-DD (Montag) → geplante Kurse dieser KW (Abweichung oder fester Plan). */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const week = req.nextUrl.searchParams.get('week');
  if (!week || !WEEK_RE.test(week)) return NextResponse.json({ error: 'Ungültige Woche' }, { status: 400 });
  const sql = getSql();
  const ov = (await sql`SELECT class_id FROM weekly_schedule WHERE user_name = ${me} AND week_start = ${week}`) as { class_id: number }[];
  if (ov.length > 0) return NextResponse.json({ classIds: ov.map((r) => r.class_id), isOverride: true });
  const def = (await sql`SELECT class_id FROM user_schedule WHERE user_name = ${me}`) as { class_id: number }[];
  return NextResponse.json({ classIds: def.map((r) => r.class_id), isOverride: false });
}

/** POST { week, classIds } → KW-Abweichung setzen · { week, reset:true } → zurück zum festen Plan. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { week, classIds, reset } = await req.json();
  if (!week || !WEEK_RE.test(String(week))) return NextResponse.json({ error: 'Ungültige Woche' }, { status: 400 });
  const sql = getSql();
  await sql`DELETE FROM weekly_schedule WHERE user_name = ${me} AND week_start = ${week}`;
  if (reset) return NextResponse.json({ ok: true, isOverride: false });

  const gid = await getCurrentGroupId(me);
  const valid = gid ? ((await sql`SELECT id FROM classes WHERE group_id = ${gid}`) as { id: number }[]) : [];
  const validSet = new Set(valid.map((r) => r.id));
  const ids = Array.isArray(classIds) ? classIds.map(Number).filter((n) => Number.isInteger(n) && validSet.has(n)) : [];
  for (const id of ids) {
    await sql`INSERT INTO weekly_schedule (user_name, week_start, class_id) VALUES (${me}, ${week}, ${id}) ON CONFLICT DO NOTHING`;
  }
  return NextResponse.json({ ok: true, isOverride: ids.length > 0 });
}
