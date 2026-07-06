import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification } from '@/lib/notify';

export const runtime = 'nodejs'; // verschickt Push

/** Globaler Admin: Custom-Push + Glocke an ALLE Nutzer der App. */
export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password');
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { title, body } = (await req.json().catch(() => ({}))) as { title?: string; body?: string };
  const t = String(title ?? '').trim().slice(0, 80);
  const b = String(body ?? '').trim().slice(0, 300);
  if (!b) return NextResponse.json({ error: 'Nachricht fehlt' }, { status: 400 });

  const sql = neon(process.env.DATABASE_URL!);
  const users = (await sql`SELECT user_name FROM users`) as { user_name: string }[];
  let sent = 0;
  for (const u of users) {
    try {
      await createNotification(sql, {
        user: u.user_name,
        type: 'announcement',
        actor: 'Team',
        body: t ? `${t} — ${b}` : b,
        link: '/',
        push: { title: t || '📣 Ankündigung', body: b },
      });
      sent++;
    } catch { /* einzelne Fehler nicht die ganze Sendung stoppen */ }
  }
  return NextResponse.json({ ok: true, recipients: sent });
}
