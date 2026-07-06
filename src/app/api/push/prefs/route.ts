import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

const DEFAULTS = { class_reminders: true, court_open: true, court_result: true, bitch_reminders: true, coach_reminders: true, chat_pushes: true };

/** Benachrichtigungs-Einstellungen des eingeloggten Nutzers. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  try {
    const rows = await sql`SELECT class_reminders, court_open, court_result, bitch_reminders, coach_reminders, chat_pushes FROM notification_prefs WHERE user_name = ${me}`;
    return NextResponse.json(rows[0] ?? DEFAULTS);
  } catch {
    return NextResponse.json(DEFAULTS); // neue Spalte evtl. noch nicht angelegt
  }
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const cr = body.class_reminders !== false;
  const co = body.court_open !== false;
  const crs = body.court_result !== false;
  const br = body.bitch_reminders !== false;
  const cch = body.coach_reminders !== false;
  const chat = body.chat_pushes !== false;
  const sql = getSql();
  await sql`
    INSERT INTO notification_prefs (user_name, class_reminders, court_open, court_result, bitch_reminders, coach_reminders, chat_pushes)
    VALUES (${me}, ${cr}, ${co}, ${crs}, ${br}, ${cch}, ${chat})
    ON CONFLICT (user_name) DO UPDATE
      SET class_reminders = ${cr}, court_open = ${co}, court_result = ${crs}, bitch_reminders = ${br}, coach_reminders = ${cch}, chat_pushes = ${chat}
  `;
  return NextResponse.json({ ok: true });
}
