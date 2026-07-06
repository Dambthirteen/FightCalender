import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, getRole, getMyGroups } from '@/lib/groups';
import { sendPush } from '@/lib/push';

export const runtime = 'nodejs'; // verschickt Push

function getSql() { return neon(process.env.DATABASE_URL!); }

interface MsgRow { id: string; user_name: string; text: string; created_at: string; color: string | null }

/** GET ?after=<id> → Chat der aktuellen Gruppe (blockierte & gelöschte ausgefiltert). */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  const gid = await getCurrentGroupId(me);
  if (!gid) return NextResponse.json({ messages: [], canModerate: false, me });
  const role = await getRole(me, gid);
  if (!role) return NextResponse.json({ messages: [], canModerate: false, me });

  const afterRaw = req.nextUrl.searchParams.get('after');
  const after = afterRaw && /^\d+$/.test(afterRaw) ? afterRaw : null;

  const rows = after
    ? (await sql`
        SELECT m.id::text, m.user_name, m.text, m.created_at::text, u.color
        FROM messages m LEFT JOIN users u ON u.user_name = m.user_name
        WHERE m.group_id = ${gid} AND m.id > ${after} AND m.deleted_at IS NULL
          AND m.user_name NOT IN (SELECT blocked FROM chat_blocks WHERE blocker = ${me})
        ORDER BY m.id ASC LIMIT 200
      `) as MsgRow[]
    : ((await sql`
        SELECT m.id::text, m.user_name, m.text, m.created_at::text, u.color
        FROM messages m LEFT JOIN users u ON u.user_name = m.user_name
        WHERE m.group_id = ${gid} AND m.deleted_at IS NULL
          AND m.user_name NOT IN (SELECT blocked FROM chat_blocks WHERE blocker = ${me})
        ORDER BY m.id DESC LIMIT 60
      `) as MsgRow[]).reverse();

  return NextResponse.json({
    messages: rows.map((r) => ({ id: r.id, user: r.user_name, text: r.text, ts: r.created_at, color: r.color })),
    canModerate: role === 'admin' || role === 'moderator',
    me,
  });
}

/** POST { text } → Nachricht in die aktuelle Gruppe senden. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  const gid = await getCurrentGroupId(me);
  if (!gid) return NextResponse.json({ error: 'Keine Gruppe' }, { status: 400 });
  if (!(await getRole(me, gid))) return NextResponse.json({ error: 'Kein Mitglied' }, { status: 403 });

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const t = String(text ?? '').trim().slice(0, 1000);
  if (!t) return NextResponse.json({ error: 'Leere Nachricht' }, { status: 400 });

  // Rate-Limit: max. 15 Nachrichten/Minute.
  const [rl] = (await sql`SELECT COUNT(*)::int AS n FROM messages WHERE user_name = ${me} AND group_id = ${gid} AND created_at > NOW() - INTERVAL '60 seconds'`) as { n: number }[];
  if ((rl?.n ?? 0) >= 15) return NextResponse.json({ error: 'Zu viele Nachrichten — kurz durchatmen.' }, { status: 429 });

  const [row] = (await sql`
    INSERT INTO messages (group_id, user_name, text) VALUES (${gid}, ${me}, ${t})
    RETURNING id::text, created_at::text
  `) as { id: string; created_at: string }[];
  // Eigene Nachricht gilt als gelesen.
  await sql`
    INSERT INTO chat_reads (user_name, group_id, last_read_id) VALUES (${me}, ${gid}, ${row.id})
    ON CONFLICT (user_name, group_id) DO UPDATE SET last_read_id = GREATEST(chat_reads.last_read_id, ${row.id})
  `;

  // Gedrosselter Push: höchstens einmal pro 60 s je Gruppe (bündelt lebhafte Unterhaltungen).
  try {
    const claim = (await sql`
      INSERT INTO chat_push_throttle (group_id, last_push_at) VALUES (${gid}, NOW())
      ON CONFLICT (group_id) DO UPDATE SET last_push_at = NOW()
        WHERE chat_push_throttle.last_push_at IS NULL OR chat_push_throttle.last_push_at < NOW() - INTERVAL '60 seconds'
      RETURNING group_id
    `) as { group_id: number }[];
    if (claim.length > 0) {
      const groupName = (await getMyGroups(me)).find((g) => g.id === gid)?.name ?? 'Crew';
      const subs = (await sql`
        SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps
        JOIN group_members gm ON gm.user_name = ps.user_name AND gm.group_id = ${gid} AND gm.status = 'active'
        WHERE ps.user_name <> ${me}
          AND ps.user_name NOT IN (SELECT user_name FROM notification_prefs WHERE chat_pushes = false)
          AND ps.user_name NOT IN (SELECT blocker FROM chat_blocks WHERE blocked = ${me})
      `) as { endpoint: string; p256dh: string; auth: string }[];
      const body = t.length > 90 ? `${me}: ${t.slice(0, 90)}…` : `${me}: ${t}`;
      for (const s of subs) {
        const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { title: `💬 ${groupName}`, body, url: '/chat' });
        if (!r.ok && r.gone) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
      }
    }
  } catch { /* Push best effort */ }

  return NextResponse.json({ id: row.id, user: me, text: t, ts: row.created_at, color: null });
}
