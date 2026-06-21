import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Per Einladungscode beitreten → erzeugt eine Anfrage (status 'pending'); Admin nimmt an. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { code } = await req.json();
  if (!code || !String(code).trim()) return NextResponse.json({ error: 'Code fehlt' }, { status: 400 });

  const sql = getSql();
  const g = await sql`SELECT id, name FROM groups WHERE UPPER(invite_code) = UPPER(${String(code).trim()})`;
  if (g.length === 0) return NextResponse.json({ error: 'Code ungültig' }, { status: 404 });
  const gid = g[0].id as number;

  const existing = await sql`SELECT status FROM group_members WHERE group_id = ${gid} AND user_name = ${me}`;
  if (existing.length > 0) {
    return NextResponse.json({ ok: true, status: existing[0].status, group: g[0].name });
  }
  await sql`
    INSERT INTO group_members (group_id, user_name, role, status)
    VALUES (${gid}, ${me}, 'member', 'pending') ON CONFLICT (group_id, user_name) DO NOTHING
  `;
  return NextResponse.json({ ok: true, status: 'pending', group: g[0].name });
}
