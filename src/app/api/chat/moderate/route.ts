import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, getRole } from '@/lib/groups';
import { createNotification } from '@/lib/notify';

export const runtime = 'nodejs';

function getSql() { return neon(process.env.DATABASE_URL!); }

/** POST { action: 'delete'|'report'|'block'|'unblock', id?, user? } */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  const gid = await getCurrentGroupId(me);
  if (!gid) return NextResponse.json({ error: 'Keine Gruppe' }, { status: 400 });
  const role = await getRole(me, gid);
  if (!role) return NextResponse.json({ error: 'Kein Mitglied' }, { status: 403 });

  const { action, id, user } = (await req.json().catch(() => ({}))) as { action?: string; id?: string | number; user?: string };
  const msgId = String(id ?? '').match(/^\d+$/) ? String(id) : null;

  if (action === 'delete') {
    if (!msgId) return NextResponse.json({ error: 'Ungültig' }, { status: 400 });
    const [m] = (await sql`SELECT user_name FROM messages WHERE id = ${msgId} AND group_id = ${gid}`) as { user_name: string }[];
    if (!m) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    const canModerate = role === 'admin' || role === 'moderator';
    if (m.user_name !== me && !canModerate) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    await sql`UPDATE messages SET deleted_at = NOW() WHERE id = ${msgId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'report') {
    if (!msgId) return NextResponse.json({ error: 'Ungültig' }, { status: 400 });
    const [m] = (await sql`SELECT user_name FROM messages WHERE id = ${msgId} AND group_id = ${gid}`) as { user_name: string }[];
    if (!m) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    await sql`INSERT INTO message_reports (message_id, reporter) VALUES (${msgId}, ${me}) ON CONFLICT (message_id, reporter) DO NOTHING`;
    // Admins & Mods der Gruppe informieren.
    const mods = (await sql`SELECT user_name FROM group_members WHERE group_id = ${gid} AND status = 'active' AND role IN ('admin','moderator')`) as { user_name: string }[];
    for (const mod of mods) {
      if (mod.user_name === me) continue;
      await createNotification(sql, {
        user: mod.user_name, type: 'announcement', actor: me,
        body: `⚠️ Chat-Nachricht von ${m.user_name} wurde gemeldet — bitte prüfen.`,
        link: '/chat',
        push: { title: '⚠️ Chat gemeldet', body: `Eine Nachricht von ${m.user_name} wurde gemeldet` },
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'block' || action === 'unblock') {
    const other = String(user ?? '').trim();
    if (!other || other === me) return NextResponse.json({ error: 'Ungültig' }, { status: 400 });
    if (action === 'block') await sql`INSERT INTO chat_blocks (blocker, blocked) VALUES (${me}, ${other}) ON CONFLICT DO NOTHING`;
    else await sql`DELETE FROM chat_blocks WHERE blocker = ${me} AND blocked = ${other}`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
