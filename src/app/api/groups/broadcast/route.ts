import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, getRole } from '@/lib/groups';
import { broadcastToGroup } from '@/lib/feed';
import { isCoach } from '@/lib/fighter';

export const runtime = 'nodejs'; // verschickt Push

/** Custom-Push + Feed an alle aktiven Mitglieder einer Gruppe. Erlaubt: Gruppen-Admin/Mod ODER Coach. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { groupId, title, body } = (await req.json().catch(() => ({}))) as { groupId?: number; title?: string; body?: string };
  const gid = Number(groupId) || (await getCurrentGroupId(me));
  if (!gid) return NextResponse.json({ error: 'Keine Gruppe' }, { status: 400 });

  const sql = neon(process.env.DATABASE_URL!);
  const role = await getRole(me, gid); // null = kein aktives Mitglied
  if (!role) return NextResponse.json({ error: 'Kein Mitglied dieser Gruppe' }, { status: 403 });

  let fighterRole: string | null = null;
  try {
    const [r] = (await sql`SELECT fighter_info->>'role' AS role FROM users WHERE user_name = ${me}`) as { role: string | null }[];
    fighterRole = r?.role ?? null;
  } catch { /* egal */ }

  const allowed = role === 'admin' || role === 'moderator' || isCoach(fighterRole);
  if (!allowed) return NextResponse.json({ error: 'Nur Gruppen-Admins, Mods oder Coaches.' }, { status: 403 });

  const t = String(title ?? '').trim().slice(0, 80);
  const b = String(body ?? '').trim().slice(0, 300);
  if (!b) return NextResponse.json({ error: 'Nachricht fehlt' }, { status: 400 });

  await broadcastToGroup(sql, {
    groupId: gid,
    type: 'announcement',
    actor: me,
    body: t ? `${t} — ${b}` : b,
    link: '/',
    excludeActor: false, // der Sender darf seine eigene Ankündigung auch sehen
    push: { title: t || '📣 Nachricht', body: b },
  });

  const [cnt] = (await sql`SELECT COUNT(*)::int AS n FROM group_members WHERE group_id = ${gid} AND status = 'active'`) as { n: number }[];
  return NextResponse.json({ ok: true, recipients: cnt?.n ?? 0 });
}
