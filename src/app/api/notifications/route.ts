import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Benachrichtigungen des eingeloggten Nutzers + Ungelesen-Zähler. */
export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ items: [], unread: 0 });
    const sql = getSql();
    const items = await sql`
      SELECT n.id, n.type, n.actor, n.body, n.link, n.ref_id, n.read, n.created_at,
        n.event_id, n.reactable,
        p.displayed AS praise_displayed, p.show_comment AS praise_show_comment,
        p.kind AS praise_kind, p.reason AS praise_reason,
        (SELECT COUNT(*)::int FROM feed_reactions fr WHERE fr.event_id = n.event_id) AS reaction_count,
        EXISTS(SELECT 1 FROM feed_reactions fr2 WHERE fr2.event_id = n.event_id AND fr2.user_name = ${me}) AS reacted_by_me
      FROM notifications n
      LEFT JOIN praises p ON n.type = 'praise' AND p.id = n.ref_id
      WHERE n.user_name = ${me} ORDER BY n.created_at DESC LIMIT 50
    `;
    const cnt = (await sql`
      SELECT COUNT(*)::int AS n FROM notifications WHERE user_name = ${me} AND read = false
    `) as { n: number }[];
    return NextResponse.json({ items, unread: cnt[0]?.n ?? 0 });
  } catch (error) {
    // Tabelle evtl. noch nicht angelegt → leer behandeln
    return NextResponse.json({ items: [], unread: 0, error: String(error) });
  }
}

/** Alle als gelesen markieren. */
export async function POST() {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sql = getSql();
    await sql`UPDATE notifications SET read = true WHERE user_name = ${me} AND read = false`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
