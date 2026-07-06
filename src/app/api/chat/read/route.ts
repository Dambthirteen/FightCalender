import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId } from '@/lib/groups';

function getSql() { return neon(process.env.DATABASE_URL!); }

/** GET → Anzahl ungelesener Nachrichten in der aktuellen Gruppe (für das Header-Badge). */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ count: 0 });
  const sql = getSql();
  const gid = await getCurrentGroupId(me);
  if (!gid) return NextResponse.json({ count: 0 });
  try {
    const [r] = (await sql`SELECT last_read_id FROM chat_reads WHERE user_name = ${me} AND group_id = ${gid}`) as { last_read_id: string }[];
    const lastRead = r?.last_read_id ?? '0';
    const [c] = (await sql`
      SELECT COUNT(*)::int AS n FROM messages
      WHERE group_id = ${gid} AND id > ${lastRead} AND user_name <> ${me} AND deleted_at IS NULL
        AND user_name NOT IN (SELECT blocked FROM chat_blocks WHERE blocker = ${me})
    `) as { n: number }[];
    return NextResponse.json({ count: c?.n ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

/** POST { lastId } → Lesestand setzen. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  const gid = await getCurrentGroupId(me);
  if (!gid) return NextResponse.json({ ok: true });
  const { lastId } = (await req.json().catch(() => ({}))) as { lastId?: string | number };
  const id = String(lastId ?? '').match(/^\d+$/) ? String(lastId) : '0';
  await sql`
    INSERT INTO chat_reads (user_name, group_id, last_read_id) VALUES (${me}, ${gid}, ${id})
    ON CONFLICT (user_name, group_id) DO UPDATE SET last_read_id = GREATEST(chat_reads.last_read_id, ${id})
  `;
  return NextResponse.json({ ok: true });
}
