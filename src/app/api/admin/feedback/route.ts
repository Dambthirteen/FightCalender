import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

function getSql() { return neon(process.env.DATABASE_URL!); }
function authed(req: NextRequest) {
  const pw = req.headers.get('x-admin-password');
  return !!process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD;
}

/** Admin: alle Feedback-/Bug-Meldungen (neueste zuerst). */
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  try {
    const rows = await sql`SELECT id, user_name, kind, text, resolved, created_at::text FROM feedback ORDER BY resolved ASC, id DESC`;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}

/** Admin: erledigt markieren / löschen. */
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { action, id } = (await req.json().catch(() => ({}))) as { action?: string; id?: number };
  const fid = Number(id);
  if (!fid) return NextResponse.json({ error: 'id fehlt' }, { status: 400 });
  const sql = getSql();
  if (action === 'delete') await sql`DELETE FROM feedback WHERE id = ${fid}`;
  else if (action === 'resolve') await sql`UPDATE feedback SET resolved = true WHERE id = ${fid}`;
  else if (action === 'reopen') await sql`UPDATE feedback SET resolved = false WHERE id = ${fid}`;
  else return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
