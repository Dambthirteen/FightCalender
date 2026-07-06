import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId } from '@/lib/groups';
import { berlinNow, weekStartOf } from '@/lib/berlin-time';

function getSql() { return neon(process.env.DATABASE_URL!); }

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WEEK_EDITS = 2; // pro Nutzer & KW; Zurücksetzen zählt nicht mit

function currentWeekStart(): string {
  return weekStartOf(berlinNow().date);
}

async function editsUsed(sql: ReturnType<typeof getSql>, user: string, week: string): Promise<number> {
  try {
    const [row] = (await sql`SELECT edit_count FROM weekly_schedule_edits WHERE user_name = ${user} AND week_start = ${week}`) as { edit_count: number }[];
    return row?.edit_count ?? 0;
  } catch {
    return 0; // Tabelle evtl. noch nicht angelegt
  }
}

/** GET ?week=YYYY-MM-DD (Montag) → geplante Kurse dieser KW (Abweichung oder fester Plan) + Lock-Info. */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const week = req.nextUrl.searchParams.get('week');
  if (!week || !WEEK_RE.test(week)) return NextResponse.json({ error: 'Ungültige Woche' }, { status: 400 });
  const sql = getSql();

  const ov = (await sql`SELECT class_id FROM weekly_schedule WHERE user_name = ${me} AND week_start = ${week}`) as { class_id: number }[];
  const isOverride = ov.length > 0;
  const classIds = isOverride
    ? ov.map((r) => r.class_id)
    : ((await sql`SELECT class_id FROM user_schedule WHERE user_name = ${me}`) as { class_id: number }[]).map((r) => r.class_id);

  const used = await editsUsed(sql, me, week);
  const isCurrent = week === currentWeekStart();
  return NextResponse.json({
    classIds,
    isOverride,
    editsUsed: used,
    maxEdits: MAX_WEEK_EDITS,
    editable: isCurrent && used < MAX_WEEK_EDITS, // abweichenden Plan speichern erlaubt?
    isCurrentWeek: isCurrent,
  });
}

/** POST { week, classIds } → KW-Abweichung setzen (zählt als 1 Änderung) · { week, reset:true } → zurück zum festen Plan (zählt nicht). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { week, classIds, reset } = await req.json();
  if (!week || !WEEK_RE.test(String(week))) return NextResponse.json({ error: 'Ungültige Woche' }, { status: 400 });

  // Nur die aktuelle Woche ist über die App bearbeitbar (schützt die Wertungshistorie).
  if (String(week) !== currentWeekStart()) {
    return NextResponse.json({ error: 'Nur die aktuelle Woche kann angepasst werden.' }, { status: 403 });
  }

  const sql = getSql();

  const gid = await getCurrentGroupId(me);
  const valid = gid ? ((await sql`SELECT id FROM classes WHERE group_id = ${gid}`) as { id: number }[]) : [];
  const validSet = new Set(valid.map((r) => r.id));
  const ids = Array.isArray(classIds) ? classIds.map(Number).filter((n) => Number.isInteger(n) && validSet.has(n)) : [];

  // Zurücksetzen (oder leerer Plan → nicht als eigener Override speicherbar): Abweichung
  // löschen, zählt NICHT als Änderung. Ein leerer Plan ist kein „Override" (fällt auf fest zurück).
  if (reset || ids.length === 0) {
    await sql`DELETE FROM weekly_schedule WHERE user_name = ${me} AND week_start = ${week}`;
    return NextResponse.json({ ok: true, isOverride: false, editsUsed: await editsUsed(sql, me, week), maxEdits: MAX_WEEK_EDITS });
  }

  // Lock: max. 2 echte Anpassungen pro Woche.
  const used = await editsUsed(sql, me, week);
  if (used >= MAX_WEEK_EDITS) {
    return NextResponse.json({ error: `Wochenplan gesperrt — diese Woche schon ${MAX_WEEK_EDITS}× angepasst.`, editsUsed: used, maxEdits: MAX_WEEK_EDITS }, { status: 403 });
  }

  await sql`DELETE FROM weekly_schedule WHERE user_name = ${me} AND week_start = ${week}`;
  for (const id of ids) {
    await sql`INSERT INTO weekly_schedule (user_name, week_start, class_id) VALUES (${me}, ${week}, ${id}) ON CONFLICT DO NOTHING`;
  }
  // Anpassung zählen.
  const [row] = (await sql`
    INSERT INTO weekly_schedule_edits (user_name, week_start, edit_count, updated_at)
    VALUES (${me}, ${week}, 1, NOW())
    ON CONFLICT (user_name, week_start)
    DO UPDATE SET edit_count = weekly_schedule_edits.edit_count + 1, updated_at = NOW()
    RETURNING edit_count
  `) as { edit_count: number }[];
  const nowUsed = row?.edit_count ?? used + 1;
  return NextResponse.json({ ok: true, isOverride: true, editsUsed: nowUsed, maxEdits: MAX_WEEK_EDITS });
}
