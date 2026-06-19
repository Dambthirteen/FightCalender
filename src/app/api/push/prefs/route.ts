import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

const DEFAULTS = { class_reminders: true, court_open: true, court_result: true };

/** Benachrichtigungs-Einstellungen des eingeloggten Nutzers. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  const rows = await sql`SELECT class_reminders, court_open, court_result FROM notification_prefs WHERE user_name = ${me}`;
  return NextResponse.json(rows[0] ?? DEFAULTS);
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const cr = body.class_reminders !== false;
  const co = body.court_open !== false;
  const crs = body.court_result !== false;
  const sql = getSql();
  await sql`
    INSERT INTO notification_prefs (user_name, class_reminders, court_open, court_result)
    VALUES (${me}, ${cr}, ${co}, ${crs})
    ON CONFLICT (user_name) DO UPDATE
      SET class_reminders = ${cr}, court_open = ${co}, court_result = ${crs}
  `;
  return NextResponse.json({ ok: true });
}
