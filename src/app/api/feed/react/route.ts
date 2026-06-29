import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Daumen-hoch auf ein Feed-Ereignis umschalten (nur wenn reactable). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { eventId } = (await req.json().catch(() => ({}))) as { eventId?: number };
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

  const sql = getSql();
  const ev = (await sql`SELECT reactable FROM feed_events WHERE id = ${eventId}`) as { reactable: boolean }[];
  if (ev.length === 0 || !ev[0].reactable) {
    return NextResponse.json({ error: 'Nicht reagierbar' }, { status: 400 });
  }

  const existing = (await sql`SELECT 1 FROM feed_reactions WHERE event_id = ${eventId} AND user_name = ${me}`) as unknown[];
  let reacted: boolean;
  if (existing.length) {
    await sql`DELETE FROM feed_reactions WHERE event_id = ${eventId} AND user_name = ${me}`;
    reacted = false;
  } else {
    await sql`INSERT INTO feed_reactions (event_id, user_name) VALUES (${eventId}, ${me}) ON CONFLICT DO NOTHING`;
    reacted = true;
  }
  const cnt = (await sql`SELECT COUNT(*)::int AS n FROM feed_reactions WHERE event_id = ${eventId}`) as { n: number }[];
  return NextResponse.json({ reacted, count: cnt[0]?.n ?? 0 });
}
